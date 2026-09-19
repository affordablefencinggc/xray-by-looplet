/**
 * SC-03's fixture: one project, issued as Rev A, then altered to Rev B so the plan
 * carries a clouded doorway and a relocated partition.
 *
 * The altered work is what the ledger's human criterion names — an altered doorway
 * and a relocated partition wall — plus one demolished wall, so the cloud layer has
 * to enclose a change that is no longer in the later drawing at all. That is the
 * case a naive implementation gets wrong: it clouds only what it can still see.
 *
 * Run from the repo root: node --experimental-strip-types .temp/live-rig/sc03-seed-project.mjs [outfile]
 */
import fs from 'node:fs';
import { emptyProject, newWall, validateProject } from '../../../src/studio/architect/model.ts';
import { createAlterationBasis } from '../../../src/studio/architect/alterationStage.ts';
import { createAlterationIssueRecord } from '../../../src/studio/architect/alterationIssues.ts';
import { compareGeometry } from '../../../src/studio/architect/revisionDelta.ts';
import { revisionDeltaRegister } from '../../../src/studio/architect/revisionClouding.ts';

const OUT = process.argv[2] ?? 'proof/growth/2026-09-18-sc03-revision-clouding/seeded-project.json';
const JOB = 'job-sc03-proof';

const brick = (n) => ({ id: `s${n}`, name: 'Brick', thickness: 230, kind: 'solid', hatch: 'brick', densityKgM3: 1900, rateM2: 120, supplierReference: 'SUP-01', rateRevision: 'R1', wastePercent: 5 });

/** Rev A: the surveyed building as it stands, every element classified. */
function surveyed() {
  const p = emptyProject(JOB);
  const lid = p.levels[0].id;
  const walls = [
    ['w-north', [0, 0], [7000, 0], 'North wall'],
    ['w-east', [7000, 0], [7000, 5000], 'East wall'],
    ['w-south', [0, 5000], [7000, 5000], 'South wall'],
    ['w-partition', [0, 2500], [4500, 2500], 'Partition'],
    ['w-enclosure', [4500, 0], [4500, 2500], 'Enclosure wall'],
  ];
  let n = 0;
  for (const [id, a, b, name] of walls) {
    const wall = newWall(p, lid, a, b, [brick(++n)]);
    wall.id = id;
    wall.name = name;
    wall.lifecycle = { status: 'existing', reference: 'Survey S01' };
    p.walls.push(wall);
  }
  p.openings = [{
    id: 'op-front', revision: 1, wallId: 'w-north', tag: 'D01', kind: 'door',
    offset: 1500, width: 900, height: 2100, sill: 0, hinge: 'left', swing: 'in',
    lifecycle: { status: 'existing', reference: 'Survey S01' },
  }, {
    id: 'op-window', revision: 1, wallId: 'w-east', tag: 'W01', kind: 'window',
    offset: 1500, width: 1200, height: 1200, sill: 1000, hinge: 'left', swing: 'out',
    lifecycle: { status: 'existing', reference: 'Survey S01' },
  }];
  p.slabs = [{
    id: 'sl-ground', revision: 1, levelId: lid, name: 'Ground slab',
    points: [[0, 0], [7000, 0], [7000, 5000], [0, 5000]], thickness: 150, offset: 0, material: 'Concrete',
    lifecycle: { status: 'existing', reference: 'Survey S01' },
  }];
  return validateProject(p);
}

const baseline = surveyed();
const basisA = createAlterationBasis(baseline, 'Survey Basis S01');
const issued = createAlterationIssueRecord(baseline, basisA, {
  purpose: 'For Client Review',
  metadata: { id: 'issue-sc03-rev-a', issuedAt: '2026-09-17T09:00:00.000Z' },
});
const issueRevA = {
  id: 'issue-sc03-rev-a',
  issuedAt: '2026-09-17T09:00:00.000Z',
  purpose: 'For Client Review',
  designRevision: 'A',
  modelRevision: 1,
  projectName: baseline.name,
  projectAddress: baseline.address,
  status: 'current',
  sheets: [{
    sheetId: 's-01',
    number: 'A-01',
    name: 'Floor Plan',
    size: 'A3',
    scale: '100',
    viewports: 1,
    layoutHash: 'hash-01',
    layout: baseline.sheet,
    status: 'current',
  }],
  snapshot: {
    revision: 1,
    designRevision: 'A',
    units: baseline.units,
    section: structuredClone(baseline.section),
    levels: structuredClone(baseline.levels),
    walls: structuredClone(baseline.walls),
    openings: structuredClone(baseline.openings),
    slabs: structuredClone(baseline.slabs),
    roofs: structuredClone(baseline.roofs),
    lines: structuredClone(baseline.lines ?? []),
    circles: structuredClone(baseline.circles ?? []),
    arcs: structuredClone(baseline.arcs ?? []),
    grids: structuredClone(baseline.grids ?? []),
    roomTags: structuredClone(baseline.roomTags ?? []),
    dimensions: structuredClone(baseline.dimensions ?? []),
    notes: baseline.notes,
  },
};
const withIssue = validateProject({ ...structuredClone(baseline), alterationIssues: [issued], issues: [issueRevA] });

/* Rev B: the front doorway widened, the partition shifted north and lengthened,
   and the enclosure wall demolished. Nothing else moves. */
const target = structuredClone(withIssue);
target.revision = 2;
target.designRevision = 'B';
const doorway = target.openings.find((o) => o.id === 'op-front');
doorway.width = 1800;
doorway.revision = 2;
doorway.lifecycle = { status: 'repaired', reference: 'Alteration A01' };
const partition = target.walls.find((wall) => wall.id === 'w-partition');
partition.a = [0, 3400];
partition.b = [5200, 3400];
partition.revision = 2;
partition.lifecycle = { status: 'repaired', reference: 'Alteration A01' };
const enclosure = target.walls.find((wall) => wall.id === 'w-enclosure');
enclosure.lifecycle = { status: 'demolished', reference: 'Demolition D01' };
enclosure.revision = 2;
const design = validateProject(target);

const report = compareGeometry(baseline, design);
const register = revisionDeltaRegister(report, baseline, design);
console.log(`delta: +${report.counts.totalAdded} / -${report.counts.totalRemoved} / ${report.counts.totalChanged}`);
console.log(`register: ${register.entries.length} entries; unmeasured ${register.unmeasured.length}`);
for (const entry of register.entries) {
  const size = `${Math.round(entry.box.max[0] - entry.box.min[0])}×${Math.round(entry.box.max[1] - entry.box.min[1])}`;
  console.log(`  ${entry.status.padEnd(8)} ${entry.category.padEnd(14)} ${entry.name.padEnd(18)} box ${size}mm` + (entry.shifted ? '  (shifted)' : ''));
}
if (register.unmeasured.length) console.log('unmeasured: ' + register.unmeasured.join(' | '));

const json = JSON.stringify({
  design,
  expectation: {
    clouds: register.entries.length,
    statuses: register.counts,
    removed: register.entries.filter((entry) => entry.status === 'removed').map((entry) => entry.name),
    shifted: register.entries.filter((entry) => entry.shifted).map((entry) => entry.name),
  },
});
fs.writeFileSync(OUT, json);
console.log(`\nwritten  ${OUT}  (${json.length} chars)`);
