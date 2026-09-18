import type { ArchitectProject, Opening, Point, Wall } from './model.ts';
import type { GeometryDelta, ModifiedEntity } from './revisionDelta.ts';
import { primitives } from './drawing.ts';
import { drawingBounds } from './sheets.ts';

/**
 * Revision clouding: the drawing convention that marks what changed between two
 * revisions. A cloud is a scalloped polyline that encloses the changed work; the
 * delta mark beside it names the revision. Nothing here measures or prices
 * anything — a cloud is an annotation about a change, never a change itself.
 */

export type DeltaStatus = 'added' | 'removed' | 'changed';

export type BoundingBox = { min: Point; max: Point };

/** One changed entity: what it is, which way it changed, and where it was. */
export type DeltaRegisterEntry = {
  id: string;
  category: 'Wall' | 'Door / window' | 'Slab' | 'Roof';
  status: DeltaStatus;
  name: string;
  /** In the baseline revision for a removal, in the target for an addition or a change. */
  levelId: string;
  /** Where the entity is in *both* revisions: the union of its old and new extent. */
  box: BoundingBox;
  /** The baseline extent, absent when the entity is new. */
  baselineBox: BoundingBox | null;
  /** The target extent, absent when the entity was removed. */
  targetBox: BoundingBox | null;
  /** Whether the entity moved rather than merely being reshaped. */
  shifted: boolean;
  changes: string[];
};

export type DeltaRegister = {
  entries: DeltaRegisterEntry[];
  counts: { added: number; removed: number; changed: number; shifted: number; total: number };
  levels: string[];
  /** Entities whose extent this module could not establish, named rather than dropped. */
  unmeasured: string[];
};

export type RevisionCloudOptions = {
  /** Model units between scallop centres. Smaller means a busier cloud. */
  scallopSize?: number;
  /** Model units between the entity's extent and the cloud line. */
  padding?: number;
  /** Clouds are drawn per level; this selects one. Omit for every level. */
  levelId?: string;
};

export type RevisionCloud = {
  id: string;
  levelId: string;
  status: DeltaStatus;
  /** The padded box the cloud encloses. */
  box: BoundingBox;
  /** The scalloped outline, closed, in model coordinates. */
  points: Point[];
  /** The rectangle the outline actually reaches — what a test can check it against. */
  outlineBox: BoundingBox;
  /** Radius of each scallop. */
  scallopRadius: number;
  /** Area of the padded box, in square model units. */
  boxArea: number;
};

export type DeltaMark = {
  id: string;
  label: string;
  status: DeltaStatus;
  /** The union box of every cloud this mark labels, so it never strides onto a neighbour. */
  box: BoundingBox;
  /** Where the label is anchored: just above the box's top-left corner. */
  anchor: Point;
  /** Which cloud this mark belongs to when a group holds more than one. */
  index: number;
  count: number;
};

export type CloudedRevision = {
  revision: string;
  clouds: RevisionCloud[];
  marks: DeltaMark[];
  /** The viewport every cloud and mark was drawn for, so a caller can clip to it. */
  viewBox: string;
  /** The change count the clouds depict. A cloud layer with none is empty, not hidden. */
  entries: number;
};

const EMPTY_BOX: BoundingBox = { min: [Infinity, Infinity], max: [-Infinity, -Infinity] };

function boxOfPoints(points: Point[]): BoundingBox {
  let min: Point = [Infinity, Infinity];
  let max: Point = [-Infinity, -Infinity];
  for (const [x, y] of points) {
    min = [Math.min(min[0], x), Math.min(min[1], y)];
    max = [Math.max(max[0], x), Math.max(max[1], y)];
  }
  return { min, max };
}

function union(a: BoundingBox, b: BoundingBox): BoundingBox {
  return { min: [Math.min(a.min[0], b.min[0]), Math.min(a.min[1], b.min[1])], max: [Math.max(a.max[0], b.max[0]), Math.max(a.max[1], b.max[1])] };
}

function boxIsMeasured(box: BoundingBox): boolean {
  return Number.isFinite(box.min[0]) && Number.isFinite(box.max[0]);
}

/** Half the wall's own thickness, the least a plan drawing shows of it. */
function halfThickness(wall: Wall): number {
  const total = wall.layers.reduce((sum, layer) => sum + layer.thickness, 0);
  return Math.max(total / 2, 1);
}

/** A wall's plan extent: the run between its ends, opened by half its build-up. */
export function wallBox(wall: Wall): BoundingBox {
  const reach = halfThickness(wall);
  return { min: [Math.min(wall.a[0], wall.b[0]) - reach, Math.min(wall.a[1], wall.b[1]) - reach], max: [Math.max(wall.a[0], wall.b[0]) + reach, Math.max(wall.a[1], wall.b[1]) + reach] };
}

/**
 * An opening's plan extent, measured along its host wall. The authored `offset`
 * is the aperture's *centre* along the wall, so the cut spans half its width to
 * either side — read it as a left edge and every cloud lands half a door out.
 * Removed openings are measured in the revision that still holds their host wall,
 * because an opening is a cut in a wall and outside one it has no position at all.
 */
export function openingBox(opening: Opening, host: Wall | undefined): BoundingBox | null {
  if (!host) return null;
  const run = Math.hypot(host.b[0] - host.a[0], host.b[1] - host.a[1]);
  if (!(run > 0)) return null;
  const ux = (host.b[0] - host.a[0]) / run;
  const uy = (host.b[1] - host.a[1]) / run;
  const start = Math.max(0, Math.min(opening.offset - opening.width / 2, run));
  const end = Math.max(0, Math.min(opening.offset + opening.width / 2, run));
  const at = (along: number): Point => [host.a[0] + ux * along, host.a[1] + uy * along];
  const reach = halfThickness(host);
  const corners: Point[] = [at(start), at(end)];
  const across: Point = [-uy * reach, ux * reach];
  const points: Point[] = [];
  for (const corner of corners) {
    points.push([corner[0] + across[0], corner[1] + across[1]], [corner[0] - across[0], corner[1] - across[1]]);
  }
  return boxOfPoints(points);
}

/** A slab or roof's plan extent, from its authored boundary. */
export function boundaryBox(points: Point[]): BoundingBox {
  return boxOfPoints(points);
}

function shiftedBetween(baselineBox: BoundingBox | null, targetBox: BoundingBox | null): boolean {
  if (!baselineBox || !targetBox) return false;
  // A shape that grew in place keeps a corner; one that moved shares no corner
  // closely and no centre either, which is what a reader calls "shifted".
  const centre = (box: BoundingBox): Point => [(box.min[0] + box.max[0]) / 2, (box.min[1] + box.max[1]) / 2];
  const moved = Math.hypot(centre(baselineBox)[0] - centre(targetBox)[0], centre(baselineBox)[1] - centre(targetBox)[1]);
  const size = Math.max(baselineBox.max[0] - baselineBox.min[0], baselineBox.max[1] - baselineBox.min[1], 1);
  return moved > size * 0.25;
}

type Measured = { box: BoundingBox | null; baselineBox: BoundingBox | null; targetBox: BoundingBox | null };

/**
 * A wall demolished by lifecycle still appears in the later model, so the geometry
 * comparison reports it as changed — but it is not on the later drawing, and a cloud
 * drawn at its target position would sit over empty paper. Demolition is read out of
 * the lifecycle here so the register says removed, which is what a reader sees.
 */
function isDemolished(wall: Wall | ModifiedEntity<Wall>): boolean {
  const entity = 'target' in wall ? wall.target : wall;
  return entity.lifecycle?.status === 'demolished';
}

function measureWall(entity: Wall | ModifiedEntity<Wall>, status: DeltaStatus): Measured {
  const isModified = 'baseline' in entity;
  const removed = status === 'removed' || isDemolished(entity);
  const targetBox = removed ? null : wallBox(isModified ? entity.target : entity);
  const baselineBox = status === 'added' ? null : wallBox(isModified ? entity.baseline : entity);
  return { box: union(baselineBox ?? EMPTY_BOX, targetBox ?? EMPTY_BOX), baselineBox, targetBox };
}

function measureOpening(
  entity: Opening | ModifiedEntity<Opening>,
  status: DeltaStatus,
  baseline: ArchitectProject,
  target: ArchitectProject,
): Measured {
  const isModified = 'baseline' in entity;
  const targetOpening = isModified ? entity.target : entity;
  const baselineOpening = isModified ? entity.baseline : entity;
  const hostOf = (project: ArchitectProject, opening: Opening) => project.walls.find((wall) => wall.id === opening.wallId);
  const targetBox = status === 'removed' ? null : openingBox(targetOpening, hostOf(target, targetOpening));
  const baselineBox = status === 'added' ? null : openingBox(baselineOpening, hostOf(baseline, baselineOpening));
  return { box: union(baselineBox ?? EMPTY_BOX, targetBox ?? EMPTY_BOX), baselineBox, targetBox };
}

function measureBoundary(
  entity: { points: Point[] } | ModifiedEntity<{ points: Point[] }>,
  status: DeltaStatus,
): Measured {
  const isModified = 'baseline' in entity;
  const targetBox = status === 'removed' ? null : boundaryBox((isModified ? entity.target : entity).points);
  const baselineBox = status === 'added' ? null : boundaryBox((isModified ? entity.baseline : entity).points);
  return { box: union(baselineBox ?? EMPTY_BOX, targetBox ?? EMPTY_BOX), baselineBox, targetBox };
}

/**
 * The delta register: every added, removed and changed entity with the box it
 * occupies across both revisions. An entity whose extent cannot be established
 * (an opening whose host wall is absent from the revision that would place it)
 * is named in `unmeasured` rather than silently given a zero-size box, because a
 * cloud drawn round nothing is worse than a cloud not drawn.
 */
export function revisionDeltaRegister(
  delta: GeometryDelta,
  baseline: ArchitectProject,
  target: ArchitectProject,
): DeltaRegister {
  const entries: DeltaRegisterEntry[] = [];
  const unmeasured: string[] = [];

  const push = (
    scope: string,
    category: DeltaRegisterEntry['category'],
    status: DeltaStatus,
    id: string,
    name: string,
    levelId: string,
    measured: Measured,
    changes: string[],
  ) => {
    if (!measured.box || !boxIsMeasured(measured.box)) {
      unmeasured.push(`${scope} ${id}: ${status === 'removed' ? 'the baseline' : 'the target'} revision holds no host that places it.`);
      return;
    }
    entries.push({
      id: `${scope}:${id}`, category, status, name,
      levelId,
      box: measured.box,
      baselineBox: measured.baselineBox,
      targetBox: measured.targetBox,
      shifted: status === 'changed' && shiftedBetween(measured.baselineBox, measured.targetBox),
      changes,
    });
  };

  for (const wall of delta.walls.added) push('wall', 'Wall', 'added', wall.id, wall.name, wall.levelId, measureWall(wall, 'added'), []);
  for (const wall of delta.walls.removed) push('wall', 'Wall', 'removed', wall.id, wall.name, wall.levelId, measureWall(wall, 'removed'), []);
  for (const wall of delta.walls.changed) push('wall', 'Wall', isDemolished(wall) ? 'removed' : 'changed', wall.id, wall.name, wall.target.levelId, measureWall(wall, 'changed'), wall.changes);

  for (const opening of delta.openings.added) push('opening', 'Door / window', 'added', opening.id, `${opening.kind} ${opening.tag}`, opening.wallId, measureOpening(opening, 'added', baseline, target), []);
  for (const opening of delta.openings.removed) push('opening', 'Door / window', 'removed', opening.id, `${opening.kind} ${opening.tag}`, opening.wallId, measureOpening(opening, 'removed', baseline, target), []);
  for (const opening of delta.openings.changed) push('opening', 'Door / window', 'changed', opening.id, `${opening.target.kind} ${opening.target.tag}`, opening.target.wallId, measureOpening(opening, 'changed', baseline, target), opening.changes);

  for (const slab of delta.slabs.added) push('slab', 'Slab', 'added', slab.id, slab.name, slab.levelId, measureBoundary(slab, 'added'), []);
  for (const slab of delta.slabs.removed) push('slab', 'Slab', 'removed', slab.id, slab.name, slab.levelId, measureBoundary(slab, 'removed'), []);
  for (const slab of delta.slabs.changed) push('slab', 'Slab', 'changed', slab.id, slab.name, slab.target.levelId, measureBoundary(slab, 'changed'), slab.changes);

  for (const roof of delta.roofs.added) push('roof', 'Roof', 'added', roof.id, roof.name, roof.levelId, measureBoundary(roof, 'added'), []);
  for (const roof of delta.roofs.removed) push('roof', 'Roof', 'removed', roof.id, roof.name, roof.levelId, measureBoundary(roof, 'removed'), []);
  for (const roof of delta.roofs.changed) push('roof', 'Roof', 'changed', roof.id, roof.name, roof.target.levelId, measureBoundary(roof, 'changed'), roof.changes);

  // An entity's box is settled by its host wall's level, but a level removed from
  // the target must not take its wall's box with it; fall back to the other revision.
  const knownLevel = new Set([...baseline.levels, ...target.levels].map((level) => level.id));
  for (const entry of entries) {
    if (!knownLevel.has(entry.levelId)) entry.levelId = target.levels[0]?.id ?? baseline.levels[0]?.id ?? entry.levelId;
  }
  // Largest first: a reader's eye lands on the biggest change, and the order is
  // settled by geometry rather than by array order, so it is stable across runs.
  const area = (entry: DeltaRegisterEntry) => (entry.box.max[0] - entry.box.min[0]) * (entry.box.max[1] - entry.box.min[1]);
  entries.sort((a, b) => area(b) - area(a) || a.id.localeCompare(b.id));

  return {
    entries,
    counts: {
      added: entries.filter((entry) => entry.status === 'added').length,
      removed: entries.filter((entry) => entry.status === 'removed').length,
      changed: entries.filter((entry) => entry.status === 'changed').length,
      shifted: entries.filter((entry) => entry.shifted).length,
      total: entries.length,
    },
    levels: [...new Set(entries.map((entry) => entry.levelId))].sort(),
    unmeasured,
  };
}

/** One scallop count in model units, and the radius it implies for a given box. */
export function scallopGeometry(box: BoundingBox, scallopSize = 500): { perAxis: number; radius: number } {
  const width = Math.max(box.max[0] - box.min[0], 1);
  const height = Math.max(box.max[1] - box.min[1], 1);
  const perAxis = Math.max(2, Math.min(24, Math.round(Math.max(width, height) / scallopSize)));
  return { perAxis, radius: (width / (2 * perAxis) + height / (2 * perAxis)) / 2 };
}

/** The scalloped outline of a revision cloud, closed, enclosing the given box. */
export function revisionCloudOutline(box: BoundingBox, scallopSize = 500): Point[] {
  if (!boxIsMeasured(box)) throw Error('A revision cloud needs a box with a finite extent.');
  if (!(scallopSize > 0)) throw Error('A revision cloud needs a positive scallop size.');
  const width = Math.max(box.max[0] - box.min[0], 1);
  // One scallop count for both axes keeps the scallops the same size all the way
  // round, which is what makes a cloud read as a single hand rather than four.
  const { perAxis, radius } = scallopGeometry(box, scallopSize);
  const rx = width / (2 * perAxis);
  const points: Point[] = [];
  const push = (point: Point) => points.push(point);
  const arc = (cx: number, cy: number, from: number, to: number) => {
    // Half a scallop per step: enough that the outline reads as round at any zoom.
    const steps = 6;
    for (let step = 0; step <= steps; step += 1) points.push(arcPoint(cx, cy, radius, from, to, step, steps));
  };
  // Clockwise from the top-left corner: the top edge scallops to the right, the
  // right edge runs straight down, the bottom edge scallops back to the left, and
  // the left edge closes it. Only the long edges bulge, which is the convention a
  // reader expects — a cloud whose short sides also scallop reads as a lozenge.
  push([box.min[0], box.max[1]]);
  for (let i = 0; i < perAxis; i += 1) arc(box.min[0] + rx * (2 * i + 1), box.max[1], Math.PI, 0);
  push([box.max[0], box.max[1]]);
  push([box.max[0], box.min[1]]);
  // Travelling right to left, a bulge toward -y is 0 → -π, not 0 → π: the arc has
  // to sweep back over the box, or the bottom scallops bite into the enclosure.
  for (let i = 0; i < perAxis; i += 1) arc(box.max[0] - rx * (2 * i + 1), box.min[1], 0, -Math.PI);
  push([box.min[0], box.min[1]]);
  push(points[0]);
  return points;
}

function arcPoint(cx: number, cy: number, radius: number, from: number, to: number, step: number, steps: number): Point {
  const angle = from + (to - from) * (step / steps);
  return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)];
}

/** The padded box a cloud encloses, so the scallops bulge clear of the entity. */
export function cloudEnclosure(box: BoundingBox, padding: number): BoundingBox {
  return { min: [box.min[0] - padding, box.min[1] - padding], max: [box.max[0] + padding, box.max[1] + padding] };
}

/**
 * The clouds for a delta register, one per entry, grouped so that a caller can
 * render them and mark them. Deterministic: the same register always produces the
 * same clouds in the same order, which is what makes the box assertions meaningful.
 */
export function revisionClouds(register: DeltaRegister, options: RevisionCloudOptions = {}): RevisionCloud[] {
  const scallopSize = options.scallopSize ?? 500;
  const padding = options.padding ?? 150;
  return register.entries
    .filter((entry) => options.levelId === undefined || entry.levelId === options.levelId)
    .map((entry) => {
      const box = cloudEnclosure(entry.box, padding);
      const points = revisionCloudOutline(box, scallopSize);
      return {
        id: entry.id,
        levelId: entry.levelId,
        status: entry.status,
        box,
        points,
        outlineBox: boxOfPoints(points),
        scallopRadius: scallopGeometry(box, scallopSize).radius,
        boxArea: (box.max[0] - box.min[0]) * (box.max[1] - box.min[1]),
      };
    });
}

/**
 * The delta marks (`Δ Rev B`) beside the clouds. Marks are placed above the box's
 * top-left corner, clear of the cloud line, so a mark never straddles the change
 * it labels or a neighbour's.
 */
export function deltaMarks(clouds: RevisionCloud[], revisionLabel: string): DeltaMark[] {
  const label = revisionLabel.trim() ? `Δ Rev ${revisionLabel.trim()}` : 'Δ';
  const byEntry = new Map<string, RevisionCloud[]>();
  for (const cloud of clouds) {
    const group = byEntry.get(cloud.id);
    if (group) group.push(cloud);
    else byEntry.set(cloud.id, [cloud]);
  }
  return [...byEntry.entries()].map(([id, group]) => {
    const box = group.map((cloud) => cloud.box).reduce(union);
    return {
      id: `mark:${id}`,
      label,
      status: group[0].status,
      box,
      anchor: [box.min[0], box.max[1]] as Point,
      index: clouds.indexOf(group[0]),
      count: group.length,
    };
  }).sort((a, b) => a.index - b.index);
}

/**
 * Everything a plan view needs to draw the clouds for a revision: the clouds, the
 * marks, and the viewport they were drawn for. The caller clips to `viewBox`, so a
 * cloud round an element that has left the visible level still draws its mark
 * rather than a fragment of an outline.
 */
export function cloudedRevision(
  register: DeltaRegister,
  levelId: string,
  project: ArchitectProject,
  revisionLabel: string,
  options: RevisionCloudOptions = {},
): CloudedRevision {
  const clouds = revisionClouds(register, { ...options, levelId });
  let box = EMPTY_BOX;
  for (const item of primitives(project, levelId, 'plan')) {
    for (const point of item.points ?? []) box = union(box, { min: point, max: point });
    for (const ring of item.rings ?? []) for (const point of ring) box = union(box, { min: point, max: point });
    if (item.center) box = union(box, { min: item.center, max: item.center });
  }
  if (!boxIsMeasured(box)) box = drawingBounds([]);
  for (const cloud of clouds) box = union(box, cloud.box);
  const pad = Math.max(box.max[0] - box.min[0], box.max[1] - box.min[1], 1000) * 0.05;
  return {
    revision: revisionLabel,
    clouds,
    marks: deltaMarks(clouds, revisionLabel),
    viewBox: `${box.min[0] - pad} ${box.min[1] - pad} ${box.max[0] - box.min[0] + pad * 2} ${box.max[1] - box.min[1] + pad * 2}`,
    entries: clouds.length,
  };
}
