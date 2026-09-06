import { EvidenceGallery } from "./EvidenceGallery";
import { BuildingLocationPreview } from "./BuildingLocationPreview";
import { useEffect, useMemo, useRef, useState } from "react";
import { Expand, MapPin } from "lucide-react";
import type { BuildingPart, SourceBuilding } from "./sourceBuilding";
import {
  emptyLocation,
  floorKey,
  locationKey,
  planBounds,
  partMapBounds,
  validateLocation,
  type LocationNote,
  type PlanBounds,
} from "./componentLocation";
import { WorkspaceDialog } from "./WorkspaceDialog";

type MapKind = "building" | "room" | "part" | "source";
const titles: Record<MapKind, string> = {
  building: "Floor in building",
  room: "Room on floor",
  part: "Part location",
  source: "Drawing evidence",
};

function GeometryMap({
  model,
  part,
  kind,
  location,
  markRoom,
  onMark,
}: {
  model: SourceBuilding;
  part: BuildingPart;
  kind: MapKind;
  location: LocationNote;
  markRoom?: boolean;
  onMark?: (bounds: PlanBounds) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    start = useRef<[number, number] | null>(null),
    transform = useRef({ scale: 1, ox: 0, oz: 0, height: 1 });
  const floor = useMemo(
    () => model.objects.filter((p) => floorKey(p) === floorKey(part)),
    [model, part],
  );
  useEffect(() => {
    const node = canvas.current;
    if (!node) return;
    const draw = () => {
      const width = node.clientWidth,
        height = node.clientHeight,
        dpr = Math.min(devicePixelRatio, 2);
      if (!width || !height) return;
      node.width = width * dpr;
      node.height = height * dpr;
      const ctx = node.getContext("2d")!;
      ctx.scale(dpr, dpr);
      const css = getComputedStyle(node),
        ink = css.getPropertyValue("--map-ink").trim(),
        fill = css.getPropertyValue("--map-fill").trim(),
        red = css.getPropertyValue("--map-red").trim();
      ctx.fillStyle = css.getPropertyValue("--map-paper").trim();
      ctx.fillRect(0, 0, width, height);
      const building = kind === "building";
      let bounds: PlanBounds = building
        ? [model.bounds.min[0], model.bounds.min[1], model.bounds.max[0], model.bounds.max[1]]
        : planBounds(floor);
      if (kind === "part") {
        bounds = partMapBounds(part, location.roomBounds);
      }
      const scale = Math.min(
        (width - 28) / Math.max(0.1, bounds[2] - bounds[0]),
        (height - 28) / Math.max(0.1, bounds[3] - bounds[1]),
      );
      const ox = (width - (bounds[2] - bounds[0]) * scale) / 2 - bounds[0] * scale,
        oz = (height - (bounds[3] - bounds[1]) * scale) / 2 - bounds[1] * scale;
      transform.current = { scale, ox, oz, height };
      const project = (x: number, z: number) => [
        ox + x * scale,
        building ? height - (oz + z * scale) : oz + z * scale,
      ];
      const paint = (p: BuildingPart, highlight: boolean) => {
        ctx.strokeStyle = highlight ? red : ink;
        ctx.fillStyle = highlight ? red : fill;
        ctx.globalAlpha = highlight ? 0.86 : 0.32;
        ctx.lineWidth = highlight ? 1.4 : 0.65;
        for (let i = 0; i < p.indices.length; i += 3) {
          ctx.beginPath();
          for (let j = 0; j < 3; j++) {
            const idx = p.indices[i + j] * 3;
            const q = project(p.positions[idx], p.positions[idx + (building ? 1 : 2)]);
            if (j === 0) ctx.moveTo(q[0], q[1]);
            else ctx.lineTo(q[0], q[1]);
          }
          ctx.closePath();
          ctx.fill();
        }
        // Boundaries remain readable without drawing every internal triangle edge.
        const b = building ? null : planBounds([p]);
        if (b && highlight) {
          const a = project(b[0], b[1]),
            z = project(b[2], b[3]);
          ctx.globalAlpha = 1;
          ctx.strokeRect(a[0], a[1], Math.max(2, z[0] - a[0]), Math.max(2, z[1] - a[1]));
        }
      };
      const parts = building
        ? model.objects.filter((p) => ["slab", "roof"].includes(p.category))
        : floor.filter((p) => ["slab", "room", "wall", "column", "door"].includes(p.category));
      for (const p of parts) paint(p, false);
      if (building) {
        const selectedFloor = model.objects.filter((p) => floorKey(p) === floorKey(part));
        const slab = selectedFloor.filter((p) => ["slab", "roof", "room"].includes(p.category));
        for (const p of slab.length ? slab : [part]) paint(p, true);
        // Keep a thin slab identifiable even when a whole tower fits in a tiny tile.
        const footprint = planBounds(selectedFloor);
        let elevation = Infinity;
        for (const p of slab.length ? slab : [part])
          for (let i = 1; i < p.positions.length; i += 3)
            elevation = Math.min(elevation, p.positions[i]);
        const left = project(footprint[0], elevation),
          right = project(footprint[2], elevation);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = red;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(left[0], left[1]);
        ctx.lineTo(right[0], right[1]);
        ctx.stroke();
      }
      if (location.roomBounds && !building) {
        const b = location.roomBounds,
          a = project(b[0], b[1]),
          z = project(b[2], b[3]);
        ctx.globalAlpha = kind === "room" ? 0.32 : 0.1;
        ctx.fillStyle = red;
        ctx.fillRect(a[0], a[1], z[0] - a[0], z[1] - a[1]);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = red;
        ctx.lineWidth = 2;
        ctx.strokeRect(a[0], a[1], z[0] - a[0], z[1] - a[1]);
      }
      if (kind === "part") paint(part, true);
      ctx.globalAlpha = 1;
      node.dataset.highlight = building
        ? floorKey(part)
        : kind === "room"
          ? location.roomBounds
            ? "manual-room"
            : "unavailable"
          : part.id;
    };
    const observer = new ResizeObserver(draw);
    observer.observe(node);
    draw();
    return () => observer.disconnect();
  }, [model, part, floor, kind, location]);
  function world(e: React.PointerEvent<HTMLCanvasElement>): [number, number] {
    const r = e.currentTarget.getBoundingClientRect(),
      t = transform.current;
    const f = planBounds(floor);
    return [
      Math.max(f[0], Math.min(f[2], (e.clientX - r.left - t.ox) / t.scale)),
      Math.max(f[1], Math.min(f[3], (e.clientY - r.top - t.oz) / t.scale)),
    ];
  }
  if (kind === "building") return <BuildingLocationPreview model={model} part={part} />;
  return (
    <canvas
      ref={canvas}
      className={`location-map ${markRoom ? "is-marking" : ""}`}
      role="img"
      aria-label={`${titles[kind]}: ${part.label}`}
      data-map-kind={kind}
      onPointerDown={(e) => {
        if (!markRoom) return;
        start.current = world(e);
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerUp={(e) => {
        if (!markRoom || !start.current) return;
        const end = world(e),
          a = start.current;
        start.current = null;
        e.currentTarget.releasePointerCapture(e.pointerId);
        const b: PlanBounds = [
          Math.min(a[0], end[0]),
          Math.min(a[1], end[1]),
          Math.max(a[0], end[0]),
          Math.max(a[1], end[1]),
        ];
        if (b[2] - b[0] > 0.1 && b[3] - b[1] > 0.1) onMark?.(b);
      }}
    />
  );
}

export function ComponentLocationMaps({
  model,
  part,
}: {
  model: SourceBuilding;
  part: BuildingPart;
}) {
  const [location, setLocation] = useState<LocationNote>(emptyLocation),
    [draft, setDraft] = useState<LocationNote>(emptyLocation),
    [open, setOpen] = useState<MapKind | null>(null),
    [activeMap, setActiveMap] = useState<MapKind>("building"),
    [marking, setMarking] = useState(false),
    [error, setError] = useState("");
  const key = locationKey(model, part);
  useEffect(() => {
    let next = emptyLocation();
    try {
      const raw = localStorage.getItem(key);
      if (raw) next = validateLocation(JSON.parse(raw), model, part);
    } catch {
      setError("Saved location could not be read. Original drawing evidence remains available.");
    }
    setLocation(next);
    setDraft(next);
    setOpen(null);
  }, [key, model, part]);
  const reference = part.sourceRefs[0],
    sheet = model.sourceSheets.find((s) => s.page === reference.page)!;
  const knownRooms = model.objects.filter(
    (p) => p.category === "room" && floorKey(p) === floorKey(part),
  );
  const floorLabel =
    model.storeys?.find((s) => s.id === part.storey)?.label ?? part.level ?? "Floor not assigned";
  function sourceImage() {
    return (
      <div className="location-source">
        <img src={sheet.image} alt={`Source page ${sheet.page}: ${sheet.title}`} />
        <span
          className="location-source-highlight"
          style={{
            left: `${(reference.region[0] / sheet.width) * 100}%`,
            top: `${(reference.region[1] / sheet.height) * 100}%`,
            width: `${((reference.region[2] - reference.region[0]) / sheet.width) * 100}%`,
            height: `${((reference.region[3] - reference.region[1]) / sheet.height) * 100}%`,
          }}
        />
      </div>
    );
  }
  function save() {
    try {
      const next = validateLocation({ ...draft, updatedAt: new Date().toISOString() }, model, part);
      localStorage.setItem(key, JSON.stringify(next));
      setLocation(next);
      setDraft(next);
      setError("");
      setMarking(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }
  return (
    <section className="component-location" aria-label="Component location maps">
      <div className="location-heading">
        <MapPin size={16} />
        <strong>Locate this part</strong>
        <span>{floorLabel}</span>
      </div>
      <div className="location-tiles">
        {[activeMap].map((kind) => (
          <button
            key={kind}
            type="button"
            className="location-tile"
            aria-label={`Expand ${titles[kind]}`}
            onClick={() => {
              setDraft(location);
              setOpen(kind);
              setError("");
              setMarking(false);
            }}
          >
            {kind === "source" ? (
              sourceImage()
            ) : (
              <GeometryMap model={model} part={part} kind={kind} location={location} />
            )}
            <span className="location-tile-caption">
              <b>{titles[kind]}</b>
              <Expand size={13} />
            </span>
            <small>
              {kind === "building"
                ? floorLabel
                : kind === "room"
                  ? location.roomBounds
                    ? location.roomName
                    : "Room not assigned"
                  : kind === "part"
                    ? part.category
                    : `Page ${sheet.page}`}
            </small>
          </button>
        ))}
        <div className="location-thumbnails" aria-label="Location previews">
          {(["building", "room", "part", "source"] as MapKind[]).map((kind) => (
            <button
              key={kind}
              type="button"
              className="location-thumbnail"
              title={titles[kind]}
              aria-label={`Show ${titles[kind]}`}
              aria-pressed={activeMap === kind}
              onClick={() => setActiveMap(kind)}
            >
              {kind === "source" ? (
                sourceImage()
              ) : (
                <GeometryMap model={model} part={part} kind={kind} location={location} />
              )}
            </button>
          ))}
        </div>
      </div>
      {open && (
        <WorkspaceDialog title={titles[open]} onClose={() => setOpen(null)}>
          <EvidenceGallery
            activeId={open}
            onSelect={(id) => {
              setOpen(id as MapKind);
              setMarking(false);
            }}
            items={(["building", "room", "part", "source"] as MapKind[]).map((kind) => ({
              id: kind,
              title: titles[kind],
              preview:
                kind === "source" ? (
                  sourceImage()
                ) : (
                  <GeometryMap model={model} part={part} kind={kind} location={draft} />
                ),
            }))}
            tools={
              <div className="location-details">
                <div>
                  <span className="kicker">Selected component</span>
                  <h3>{part.label}</h3>
                  <p>
                    {floorLabel} · {part.category} · {part.evidenceState}
                  </p>
                  <p>{part.note ?? reference.note}</p>
                  <p>
                    Drawing: {sheet.title}, page {sheet.page}. Red indicates the selected floor,
                    assigned room area or part.
                  </p>
                </div>
                <div className="location-edit">
                  <h3>Location details</h3>
                  <p>
                    Room links and marked boundaries are your annotations, separate from verified
                    drawing evidence.
                  </p>
                  <label>
                    Room name
                    <input
                      value={draft.roomName}
                      maxLength={100}
                      onChange={(e) => setDraft((d) => ({ ...d, roomName: e.target.value }))}
                    />
                  </label>
                  {knownRooms.length > 0 && (
                    <label>
                      Use a modeled room
                      <select
                        aria-label="Modeled room"
                        defaultValue=""
                        onChange={(e) => {
                          const room = knownRooms.find((p) => p.id === e.target.value);
                          if (room)
                            setDraft((d) => ({
                              ...d,
                              roomName: room.label,
                              roomBounds: planBounds([room]),
                            }));
                        }}
                      >
                        <option value="">Choose a room…</option>
                        {knownRooms.map((p) => (
                          <option value={p.id} key={p.id}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <div className="location-actions">
                    <button
                      className="pill"
                      onClick={() => {
                        setOpen("room");
                        setMarking(true);
                      }}
                    >
                      Mark room area
                    </button>
                    <button
                      className="pill"
                      onClick={() => setDraft((d) => ({ ...d, roomBounds: null, roomName: "" }))}
                    >
                      Clear room link
                    </button>
                  </div>
                  {marking && (
                    <p role="status">
                      Drag from one corner to the opposite corner on the floor map above. Name the
                      room before saving.
                    </p>
                  )}
                  {draft.roomBounds && (
                    <p>
                      Marked room area: {(draft.roomBounds[2] - draft.roomBounds[0]).toFixed(2)} ×{" "}
                      {(draft.roomBounds[3] - draft.roomBounds[1]).toFixed(2)} m (approximate).
                    </p>
                  )}
                  <label>
                    Component / location notes
                    <textarea
                      rows={3}
                      maxLength={2000}
                      value={draft.note}
                      onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
                    />
                  </label>
                  {error && <p role="alert">{error}</p>}
                  <div className="location-actions">
                    <button className="pill-dark" onClick={save}>
                      Save location details
                    </button>
                    <span role="status">
                      {location.updatedAt && JSON.stringify(location) === JSON.stringify(draft)
                        ? "Saved on this device"
                        : "Unsaved details"}
                    </span>
                  </div>
                </div>
              </div>
            }
          >
            <div className="location-modal-map">
              {open === "source" ? (
                sourceImage()
              ) : (
                <GeometryMap
                  model={model}
                  part={part}
                  kind={open}
                  location={draft}
                  markRoom={marking && open === "room"}
                  onMark={(roomBounds) => {
                    setDraft((d) => ({ ...d, roomBounds }));
                    setMarking(false);
                  }}
                />
              )}
            </div>
          </EvidenceGallery>
        </WorkspaceDialog>
      )}
    </section>
  );
}
