import { useEffect, useState } from "react";
import {
  type ArchitectProject,
  type Layer,
  type Point,
  uuid,
  distance,
  unit,
  add,
  mul,
  defaultLayers,
  wallThickness,
  newWall,
} from "./model";
import { rooms, designQuantities } from "./geometry";
export function NumberField({
  label,
  value,
  onCommit,
  step = 1,
}: {
  label: string;
  value: number;
  onCommit: (n: number) => void;
  step?: number;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  return (
    <label className="arch-field">
      {label}
      <input
        type="number"
        value={text}
        step={step}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          const n = Number(text);
          if (text.trim() && Number.isFinite(n) && n !== value) onCommit(n);
          else setText(String(value));
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
      />
    </label>
  );
}
export function TextField({
  label,
  value,
  onCommit,
  className,
}: {
  label: string;
  value: string;
  onCommit: (s: string) => void;
  className?: string;
}) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <label className={`arch-field ${className ?? ""}`.trim()}>
      {label}
      <input
        className={className}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={(e) => {
          const committed = e.currentTarget.value.trim();
          if (committed !== value) onCommit(committed);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
      />
    </label>
  );
}
export function ArchitectInspector({
  project,
  selected,
  levelId,
  onChange,
  onSelect,
  onDelete,
}: {
  project: ArchitectProject;
  selected: string | null;
  levelId: string;
  onChange: (p: ArchitectProject) => void;
  onSelect: (id: string | null) => void;
  onDelete: () => void;
}) {
  const p = project,
    w = p.walls.find((w) => w.id === selected),
    o = p.openings.find((o) => o.id === selected),
    slab = p.slabs.find((s) => s.id === selected),
    roof = p.roofs.find((r) => r.id === selected),
    line = p.lines.find((l) => l.id === selected),
    circle = p.circles.find((c) => c.id === selected),
    grid = p.grids.find((g) => g.id === selected),
    dimension = p.dimensions.find((d) => d.id === selected),
    arc = p.arcs.find((a) => a.id === selected),
    room = rooms(p, levelId).find((r) => r.id === selected),
    level = p.levels.find((l) => l.id === levelId)!;
  const change = (key: keyof ArchitectProject, id: string, patch: Record<string, unknown>) => {
    const next = structuredClone(p),
      list = next[key] as { id: string }[];
    Object.assign(
      list.find((e) => e.id === id)!,
      patch,
    );
    onChange(next);
  };
  const entity = w ?? o ?? slab ?? roof ?? line ?? circle ?? grid ?? dimension ?? arc;
  const layers = (w?.layers ?? []).map((l, i) => (
    <div className="arch-layer" key={l.id}>
      <div className="arch-layer-heading">
        <b>
          {i + 1}. {l.name}
        </b>
        <button
          onClick={() => change("walls", w!.id, { layers: w!.layers.filter((x) => x.id !== l.id) })}
          disabled={w!.layers.length === 1}
          aria-label={"Remove layer " + l.name}
        >
          ×
        </button>
      </div>
      <TextField label="Layer name" value={l.name} onCommit={(v) => editLayer(l.id, { name: v })} />
      <NumberField
        label="Thickness mm"
        value={l.thickness}
        onCommit={(v) => editLayer(l.id, { thickness: v })}
      />
      <label className="arch-field">
        Layer calculation
        <select
          value={l.kind}
          onChange={(e) => editLayer(l.id, { kind: e.target.value as Layer["kind"] })}
        >
          <option value="solid">Continuous material</option>
          <option value="assembly">Assembly / contents unresolved</option>
          <option value="void">Cavity / no material</option>
        </select>
      </label>
      <label className="arch-field">
        Material hatch
        <select
          value={l.hatch}
          onChange={(e) => editLayer(l.id, { hatch: e.target.value as Layer["hatch"] })}
        >
          {["brick", "concrete", "timber", "insulation", "none"].map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      </label>
      <TextField
        label="Specification / supplier reference"
        value={l.supplierReference}
        onCommit={(v) => editLayer(l.id, { supplierReference: v })}
      />
      <TextField
        label="Rate revision"
        value={l.rateRevision}
        onCommit={(v) => editLayer(l.id, { rateRevision: v })}
      />
      <NumberField
        label="Rate per m² (0 = unknown)"
        value={l.rateM2 ?? 0}
        step={0.01}
        onCommit={(v) => editLayer(l.id, { rateM2: v === 0 ? null : v })}
      />
      <NumberField
        label="Specified density kg/m³ (0 = unknown)"
        value={l.densityKgM3 ?? 0}
        onCommit={(v) => editLayer(l.id, { densityKgM3: v === 0 ? null : v })}
      />
      <NumberField
        label="Waste allowance %"
        value={l.wastePercent}
        step={0.1}
        onCommit={(v) => editLayer(l.id, { wastePercent: v })}
      />
    </div>
  ));
  function editLayer(id: string, patch: Partial<Layer>) {
    if (w)
      change("walls", w.id, {
        layers: w.layers.map((l) => (l.id === id ? { ...l, ...patch } : l)),
      });
  }
  return (
    <aside className="arch-inspector">
      <header>
        <span className="kicker">PARAMETRIC INSPECTOR</span>
        <h2>
          {w?.name ??
            o?.tag ??
            slab?.name ??
            roof?.name ??
            (line
              ? "Reference line"
              : circle
                ? "Reference circle"
                : grid
                  ? "Grid " + grid.label
                  : (room?.name ?? "Design settings"))}
        </h2>
        {entity && (
          <small>
            Revision {entity.revision} · stable ID {entity.id.slice(0, 8)}
          </small>
        )}
      </header>
      {selected && (
        <button className="arch-secondary" onClick={() => onSelect(null)}>
          Clear selection
        </button>
      )}
      {w && (
        <>
          <TextField
            label="Wall name"
            value={w.name}
            onCommit={(v) => change("walls", w.id, { name: v })}
          />
          <div className="arch-field-pair">
            <NumberField
              label="Start X mm"
              value={w.a[0]}
              onCommit={(v) => change("walls", w.id, { a: [v, w.a[1]] })}
            />
            <NumberField
              label="Start Y mm"
              value={w.a[1]}
              onCommit={(v) => change("walls", w.id, { a: [w.a[0], v] })}
            />
            <NumberField
              label="End X mm"
              value={w.b[0]}
              onCommit={(v) => change("walls", w.id, { b: [v, w.b[1]] })}
            />
            <NumberField
              label="End Y mm"
              value={w.b[1]}
              onCommit={(v) => change("walls", w.id, { b: [w.b[0], v] })}
            />
          </div>
          <NumberField
            label="Wall length mm"
            value={distance(w.a, w.b)}
            onCommit={(v) => change("walls", w.id, { b: add(w.a, mul(unit(w.a, w.b), v)) })}
          />
          <NumberField
            label="Wall height mm"
            value={w.height}
            onCommit={(v) => change("walls", w.id, { height: v })}
          />
          <p className="arch-note">
            {wallThickness(w)} mm assembly · openings move with this wall. Edits that would strand
            an opening are rejected.
          </p>
          <details>
            <summary>Wall layers & supplier rates</summary>
            {layers}
            <button
              onClick={() =>
                change("walls", w.id, {
                  layers: [...w.layers, { ...defaultLayers()[3], id: uuid() }],
                })
              }
            >
              Add layer
            </button>
          </details>
        </>
      )}
      {o && (
        <>
          <TextField
            label="Opening tag"
            value={o.tag}
            onCommit={(v) => change("openings", o.id, { tag: v })}
          />
          <label className="arch-field">
            Host wall
            <select
              value={o.wallId}
              onChange={(e) => change("openings", o.id, { wallId: e.target.value })}
            >
              {p.walls.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </label>
          <NumberField
            label="Opening centre along wall mm"
            value={o.offset}
            onCommit={(v) => change("openings", o.id, { offset: v })}
          />
          <NumberField
            label="Opening width mm"
            value={o.width}
            onCommit={(v) => change("openings", o.id, { width: v })}
          />
          <NumberField
            label="Opening height mm"
            value={o.height}
            onCommit={(v) => change("openings", o.id, { height: v })}
          />
          {o.kind === "window" && (
            <NumberField
              label="Sill height mm"
              value={o.sill}
              onCommit={(v) => change("openings", o.id, { sill: v })}
            />
          )}
          <p className="arch-note">
            Head height {o.sill + o.height} mm · deleting or moving heals the host wall.
          </p>
          {o.kind === "door" && (
            <>
              <label className="arch-field">
                Hinge
                <select
                  value={o.hinge}
                  onChange={(e) => change("openings", o.id, { hinge: e.target.value })}
                >
                  <option>left</option>
                  <option>right</option>
                </select>
              </label>
              <label className="arch-field">
                Door swing
                <select
                  value={o.swing}
                  onChange={(e) => change("openings", o.id, { swing: e.target.value })}
                >
                  <option>in</option>
                  <option>out</option>
                </select>
              </label>
            </>
          )}
        </>
      )}
      {slab && (
        <>
          <TextField
            label="Slab name"
            value={slab.name}
            onCommit={(v) => change("slabs", slab.id, { name: v })}
          />
          <NumberField
            label="Slab thickness mm"
            value={slab.thickness}
            onCommit={(v) => change("slabs", slab.id, { thickness: v })}
          />
          <NumberField
            label="Slab step / level offset mm"
            value={slab.offset}
            onCommit={(v) => change("slabs", slab.id, { offset: v })}
          />
          <TextField
            label="Slab material"
            value={slab.material}
            onCommit={(v) => change("slabs", slab.id, { material: v })}
          />
        </>
      )}
      {roof && (
        <>
          <TextField
            label="Roof name"
            value={roof.name}
            onCommit={(v) => change("roofs", roof.id, { name: v })}
          />
          <NumberField
            label="Roof bearing above level mm"
            value={roof.offset}
            onCommit={(v) => change("roofs", roof.id, { offset: v })}
          />
          <NumberField
            label="Eave overhang mm"
            value={roof.eaves}
            onCommit={(v) => change("roofs", roof.id, { eaves: v })}
          />
          <details>
            <summary>Fascia & gutters / authored profiles</summary>
            <p className="arch-note">
              Nominal rectangular fascia and open U-channel gutters. Set the design profile
              dimensions; supplier density and rates remain unspecified.
            </p>
            {(
              [
                ["fasciaHeight", "Fascia height mm"],
                ["fasciaThickness", "Fascia thickness mm"],
                ["gutterWidth", "Gutter width mm"],
                ["gutterDepth", "Gutter depth mm"],
                ["gutterThickness", "Gutter material thickness mm"],
              ] as const
            ).map(([key, label]) => (
              <NumberField
                key={key}
                label={label}
                value={roof[key]}
                step={0.1}
                onCommit={(v) => change("roofs", roof.id, { [key]: v })}
              />
            ))}
            <label>
              <input
                type="checkbox"
                checked={roof.gutterEnabled}
                onChange={(e) => change("roofs", roof.id, { gutterEnabled: e.target.checked })}
              />{" "}
              Gutters on eave edges
            </label>
          </details>
          <div className="arch-button-row">
            {["Hip", "Gable", "Skillion", "Flat"].map((kind) => (
              <button
                key={kind}
                onClick={() =>
                  change("roofs", roof.id, {
                    edges: roof.edges.map((e, i) => ({
                      pitch: kind === "Flat" ? 0 : kind === "Skillion" ? 15 : 22.5,
                      gable: kind === "Hip" ? false : kind === "Gable" ? i % 2 === 1 : i !== 0,
                    })),
                  })
                }
              >
                {kind}
              </button>
            ))}
          </div>
          {roof.edges.map((e, i) => (
            <div className="arch-layer" key={i}>
              <NumberField
                label={"Edge " + (i + 1) + " pitch degrees"}
                value={e.pitch}
                step={0.5}
                onCommit={(v) =>
                  change("roofs", roof.id, {
                    edges: roof.edges.map((a, j) => (i === j ? { ...a, pitch: v } : a)),
                  })
                }
              />
              <label>
                <input
                  type="checkbox"
                  checked={e.gable}
                  onChange={(v) =>
                    change("roofs", roof.id, {
                      edges: roof.edges.map((a, j) =>
                        i === j ? { ...a, gable: v.target.checked } : a,
                      ),
                    })
                  }
                />{" "}
                Gable / no slope on edge {i + 1}
              </label>
            </div>
          ))}
          <p className="arch-note">
            Convex roof zones. Divide an L-shaped footprint into zones; structural members remain
            unspecified.
          </p>
        </>
      )}
      {line && (
        <button
          onClick={() => {
            const q = structuredClone(p);
            q.lines = q.lines.filter((l) => l.id !== line.id);
            q.walls.push({
              ...newWall(q, line.levelId, line.a, line.b),
              id: line.id,
              revision: line.revision,
            });
            onChange(q);
          }}
        >
          Convert reference line to layered wall
        </button>
      )}
      {line && (
        <div className="arch-field-pair">
          {(["a", "b"] as const).flatMap((end) =>
            ([0, 1] as const).map((axis) => (
              <NumberField
                key={end + axis}
                label={(end === "a" ? "Start " : "End ") + (axis === 0 ? "X" : "Y") + " mm"}
                value={line[end][axis]}
                onCommit={(v) => {
                  const pt = [...line[end]] as Point;
                  pt[axis] = v;
                  change("lines", line.id, { [end]: pt });
                }}
              />
            )),
          )}
        </div>
      )}
      {(slab || roof) && (
        <details>
          <summary>Boundary vertices / millimetres</summary>
          {(slab ?? roof)!.points.map((pt, i) => (
            <div className="arch-field-pair" key={i}>
              {([0, 1] as const).map((axis) => (
                <NumberField
                  key={axis}
                  label={"Vertex " + (i + 1) + " " + (axis === 0 ? "X" : "Y")}
                  value={pt[axis]}
                  onCommit={(v) =>
                    change(slab ? "slabs" : "roofs", (slab ?? roof)!.id, {
                      points: (slab ?? roof)!.points.map((p, j) =>
                        j === i ? (axis === 0 ? [v, p[1]] : [p[0], v]) : p,
                      ),
                    })
                  }
                />
              ))}
            </div>
          ))}
        </details>
      )}
      {dimension && (
        <NumberField
          label="Dimension offset mm"
          value={dimension.offset}
          onCommit={(v) => change("dimensions", dimension.id, { offset: v })}
        />
      )}
      {arc && (
        <>
          <NumberField
            label="Arc radius mm"
            value={arc.radius}
            onCommit={(v) => change("arcs", arc.id, { radius: v })}
          />
          <NumberField
            label="Arc start angle °"
            value={(arc.startAngle * 180) / Math.PI}
            onCommit={(v) => change("arcs", arc.id, { startAngle: (v * Math.PI) / 180 })}
          />
          <NumberField
            label="Arc end angle °"
            value={(arc.endAngle * 180) / Math.PI}
            onCommit={(v) => change("arcs", arc.id, { endAngle: (v * Math.PI) / 180 })}
          />
        </>
      )}
      {(circle || arc) && (
        <div className="arch-field-pair">
          {([0, 1] as const).map((axis) => (
            <NumberField
              key={axis}
              label={"Centre " + (axis === 0 ? "X" : "Y") + " mm"}
              value={(circle ?? arc)!.center[axis]}
              onCommit={(v) => {
                const c = [...(circle ?? arc)!.center] as Point;
                c[axis] = v;
                change(circle ? "circles" : "arcs", (circle ?? arc)!.id, { center: c });
              }}
            />
          ))}
        </div>
      )}
      {circle && (
        <NumberField
          label="Circle radius mm"
          value={circle.radius}
          onCommit={(v) => change("circles", circle.id, { radius: v })}
        />
      )}
      {grid && (
        <>
          <TextField
            label="Grid label"
            value={grid.label}
            onCommit={(v) => change("grids", grid.id, { label: v })}
          />
          <NumberField
            label="Grid position mm"
            value={grid.position}
            onCommit={(v) => change("grids", grid.id, { position: v })}
          />
        </>
      )}
      {room && (
        <>
          <TextField
            label="Room name"
            value={room.name}
            onCommit={(v) => {
              const q = structuredClone(p),
                tag = q.roomTags.find((r) => r.id === room.id);
              if (tag) tag.name = v;
              else
                q.roomTags.push({ id: uuid(), revision: 1, name: v, levelId, point: room.point });
              onChange(q);
            }}
          />
          <dl className="arch-stats">
            <dt>Net area</dt>
            <dd>{room.areaM2.toFixed(3)} m²</dd>
            <dt>Perimeter</dt>
            <dd>{room.perimeterM.toFixed(3)} m</dd>
            <dt>Ceiling height</dt>
            <dd>{room.height} mm</dd>
          </dl>
        </>
      )}
      {!selected && (
        <>
          <TextField
            label="Design name"
            value={p.name}
            onCommit={(v) => onChange({ ...p, name: v })}
          />
          <TextField
            label="Project address"
            value={p.address}
            onCommit={(v) => onChange({ ...p, address: v })}
          />
          <TextField
            label="Drawing revision"
            value={p.designRevision}
            onCommit={(v) => onChange({ ...p, designRevision: v })}
          />
          <TextField
            label="Level name"
            value={level.name}
            onCommit={(v) => change("levels", level.id, { name: v })}
          />
          <NumberField
            label="Level FFL mm"
            value={level.elevation}
            onCommit={(v) => change("levels", level.id, { elevation: v })}
          />
          <NumberField
            label="Default ceiling height mm"
            value={level.height}
            onCommit={(v) => change("levels", level.id, { height: v })}
          />
          <p className="arch-note">
            Select a wall, opening, roof or room to edit its dimensions. The plan, 3D and schedules
            share these objects.
          </p>
        </>
      )}
      {entity && (
        <button className="arch-delete" onClick={onDelete}>
          Delete selected {o?.kind ?? (w ? "wall" : "element")}
        </button>
      )}
      <details className="arch-design-tree">
        <summary>
          Design objects ({p.walls.length + p.openings.length + p.slabs.length + p.roofs.length})
        </summary>
        {[
          ...p.walls,
          ...p.openings,
          ...p.slabs,
          ...p.roofs,
          ...p.lines,
          ...p.circles,
          ...p.arcs,
          ...p.dimensions,
        ].map((e) => (
          <button key={e.id} aria-pressed={e.id === selected} onClick={() => onSelect(e.id)}>
            {"tag" in e
              ? String(e.tag)
              : "name" in e
                ? String(e.name)
                : ("wallId" in e ? "Dimension " : "center" in e ? "Curve " : "Line ") +
                  e.id.slice(0, 6)}
          </button>
        ))}
      </details>
    </aside>
  );
}
