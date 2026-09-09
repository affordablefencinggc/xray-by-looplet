import { useDesignConfirmation } from "./useDesignConfirmation";
import { SyncDesignMaterials } from "./SyncDesignMaterials";
import { prepareArchitectEdits, prepareArchitectElements, registerArchitectController } from "../assistant/architectBridge.ts";
import { ArchitectAi } from "./ArchitectAi";
import { ArchitectSheets } from "./ArchitectSheets";
import { csv } from "./exchange";
import { ArchitectCadExchange } from "./ArchitectCadExchange";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  MousePointer2,
  PenTool,
  DoorOpen,
  AppWindow,
  Layers,
  Home,
  Undo2,
  Redo2,
  Maximize,
  Download,
  Upload,
  Plus,
  Save,
  Scissors,
  MoveHorizontal,
  FlipHorizontal,
} from "lucide-react";
import { useStudio } from "../store";
import {
  emptyProject,
  demonstration,
  validateProject,
  revise,
  removeEntity,
  newWall,
  uuid,
  distance,
  projectPoint,
  add,
  sub,
  mul,
  unit,
  type Point,
  type ArchitectProject,
} from "./model";
import { architectKey, loadArchitect, saveArchitect, type ArchitectSession } from "./persistence";
import {
  snapPoint,
  constrainPoint,
  SNAP_KINDS,
  offsetSegment,
  mirrorPoint,
  trimSegment,
  extendSegment,
  fillet,
  type SnapKind,
} from "./precision";
import { primitives, projectBounds, type View } from "./drawing";
import { rooms, designQuantities } from "./geometry";
import { DrawingPrimitives } from "./DrawingPrimitives";
import { Architect3D } from "./Architect3D";
import { ArchitectInspector, NumberField } from "./ArchitectInspector";
import "./architect.css";
type Tool =
  | "select"
  | "wall"
  | "door"
  | "window"
  | "slab"
  | "roof"
  | "line"
  | "circle"
  | "dimension"
  | "room"
  | "section"
  | "grid";
const toolNames: Record<Tool, string> = {
  select: "Select",
  wall: "Wall",
  door: "Door",
  window: "Window",
  slab: "Slab",
  roof: "Roof",
  line: "Line",
  circle: "Circle",
  dimension: "Dimension",
  room: "Room tag",
  section: "Section",
  grid: "Grid",
};
function download(data: string, name: string, type = "application/json") {
  const url = URL.createObjectURL(new Blob([data], { type })),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function loadBrowserArchitect(jobId: string): ArchitectSession {
  try { return loadArchitect(jobId, window.localStorage); }
  catch (error) {
    return { value: emptyProject(jobId), raw: null, blocked: true,
      error: "Saved design storage is unavailable. Editing and autosave are blocked. " + (error instanceof Error ? error.message : String(error)) };
  }
}
export function ArchitectWorkspace() {
  const { confirmDesign, confirmation } = useDesignConfirmation();
  const jobId = useStudio((s) => s.job.id),
    [session, setSession] = useState<ArchitectSession>(() => ({
      value: emptyProject(jobId),
      raw: null,
      blocked: true,
      error: null,
    })),
    [ready, setReady] = useState(false),
    [tool, setTool] = useState<Tool>("select"),
    [selected, setSelected] = useState<string | null>(null),
    [levelId, setLevelId] = useState(""),
    [view, setView] = useState<View>("plan"),
    [panel, setPanel] = useState<"draw" | "schedule" | "materials" | "sheets" | "ai">("draw"),
    [show3D, setShow3D] = useState(true),
    [showRoof, setShowRoof] = useState(true),
    [allLevels, setAllLevels] = useState(false),
    [fitToken, setFitToken] = useState(0),
    [error, setError] = useState<string | null>(null),
    [notice, setNotice] = useState(""),
    [anchor, setAnchor] = useState<Point | null>(null),
    [points, setPoints] = useState<Point[]>([]),
    [cursor, setCursor] = useState<Point>([0, 0]),
    [snapKind, setSnapKind] = useState<string | null>(null),
    [tracking, setTracking] = useState<"free" | "ortho" | "polar">("ortho"),
    [angle, setAngle] = useState(45),
    [length, setLength] = useState(""),
    [snaps, setSnaps] = useState<SnapKind[]>(SNAP_KINDS),
    [viewBox, setViewBox] = useState([-1500, -1500, 12000, 9000]),
    [operationDistance, setOperationDistance] = useState(1500),
    [boundary, setBoundary] = useState(""),
    [gridAxis, setGridAxis] = useState<"x" | "y">("x");
  const svg = useRef<SVGSVGElement>(null),
    restore = useRef<HTMLInputElement>(null),
    undo = useRef<ArchitectProject[]>([]),
    redo = useRef<ArchitectProject[]>([]),
    sessionRef = useRef(session);
  sessionRef.current = session;
  const p = session.value;
  useEffect(() => {
    const s = loadBrowserArchitect(jobId);
    setSession(s);
    setLevelId(s.value.levels[0].id);
    setReady(true);
    undo.current = [];
    redo.current = [];
  }, [jobId]);
  useEffect(() => {
    const listener = (e: StorageEvent) => {
      if (
        e.key === "xray:architect:v1:" + encodeURIComponent(jobId) &&
        e.newValue !== sessionRef.current.raw
      )
        setSession((s) => ({
          ...s,
          blocked: true,
          error: "Design changed in another window. Reload before editing.",
        }));
    };
    window.addEventListener("storage", listener);
    return () => window.removeEventListener("storage", listener);
  }, [jobId]);
  function commit(draft: ArchitectProject, history = true, recovery = false) {
    try {
      if (session.blocked && !recovery) throw Error(session.error ?? "Design is not ready.");
      const value = revise(p, draft),
        saved = saveArchitect(session, value, localStorage, recovery);
      if (saved.error) {
        sessionRef.current = saved;
        setSession(saved);
        throw Error(saved.error);
      }
      try {
        if (window.localStorage.getItem(architectKey(value.id)) !== saved.raw) throw Error("Saved design readback differed.");
      } catch {
        const rejected = { ...session, blocked: true, error: "Design save could not be verified. Reload the saved design before editing; the open design has been retained." };
        sessionRef.current = rejected;
        setSession(rejected);
        throw Error(rejected.error);
      }
      if (history) {
        undo.current.push(p);
        if (undo.current.length > 60) undo.current.shift();
        redo.current = [];
      }
      sessionRef.current = saved;
      setSession(saved);
      setLevelId((current) =>
        value.levels.some((level) => level.id === current) ? current : value.levels[0].id,
      );
      setError(null);
      setNotice("Saved · revision " + value.revision);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    }
  }
  function apply(fn: (next: ArchitectProject) => void) {
    const next = structuredClone(p);
    fn(next);
    return commit(next);
  }
  function resetDrawing() {
    setAnchor(null);
    setPoints([]);
    setLength("");
    setSnapKind(null);
  }
  function historyStep(back: boolean) {
    const source = back ? undo.current : redo.current,
      destination = back ? redo.current : undo.current,
      next = source[source.length - 1];
    if (next && commit(next, false)) {
      source.pop();
      destination.push(p);
      setSelected(null);
      resetDrawing();
    }
  }
  function fit() {
    const b = projectBounds(p),
      w = Math.max(b.max[0] - b.min[0], 3000),
      h = Math.max(b.max[1] - b.min[1], 3000);
    setViewBox([b.min[0] - 1200, b.min[1] - 1200, w + 2400, h + 2400]);
    setFitToken((n) => n + 1);
  }
  const drawing = useMemo(() => (levelId ? primitives(p, levelId, view) : []), [p, levelId, view]),
    roomList = useMemo(() => (levelId ? rooms(p, levelId) : []), [p, levelId]),
    quantities = useMemo(() => designQuantities(p), [p]);
  const toPoint = (e: { clientX: number; clientY: number }): Point => {
    const m = svg.current?.getScreenCTM();
    if (!m) return [0, 0];
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return [pt.x, pt.y];
  };
  function resolved(raw: Point) {
    const scale = svg.current?.getScreenCTM()?.a ?? 0.1,
      result = snapPoint(raw, p, levelId, 12 / Math.max(scale, 0.001), snaps, anchor);
    let point = result.point;
    if (anchor && !result.kind) point = constrainPoint(anchor, point, tracking, angle);
    const direct = Number(length);
    if (anchor && length.trim() && Number.isFinite(direct) && direct > 0)
      point = constrainPoint(anchor, point, tracking, angle, direct);
    return { point: point.map((n) => Math.round(n * 1000) / 1000) as Point, kind: result.kind };
  }
  function completeBoundary() {
    if (points.length < 3) {
      setError("Pick at least three boundary points.");
      return;
    }
    const id = uuid(),
      level = p.levels.find((l) => l.id === levelId)!;
    if (
      apply((q) => {
        const base = {
          id,
          revision: 1,
          levelId,
          name:
            (tool === "roof" ? "Roof " : "Slab ") +
            (tool === "roof" ? q.roofs.length + 1 : q.slabs.length + 1),
          points,
        };
        if (tool === "roof")
          q.roofs.push({
            ...base,
            offset: level.height,
            eaves: 450,
            fasciaHeight: 140,
            fasciaThickness: 20,
            gutterEnabled: true,
            gutterWidth: 125,
            gutterDepth: 90,
            gutterThickness: 1.2,
            edges: points.map(() => ({ pitch: 22.5, gable: false })),
          });
        else q.slabs.push({ ...base, thickness: 150, offset: 0, material: "Concrete" });
      })
    ) {
      setSelected(id);
      resetDrawing();
      setTool("select");
    }
  }
  function place(raw: Point, target: string | null) {
    if (session.blocked || view !== "plan") return;
    const result = resolved(raw),
      pt = result.point;
    if (tool === "select") {
      setSelected(target);
      return;
    }
    if (tool === "room") {
      const room = roomList.find((r) => {
        let inside = false;
        for (let i = 0, j = r.ring.length - 1; i < r.ring.length; j = i++) {
          const a = r.ring[i],
            b = r.ring[j];
          if (
            a[1] > pt[1] !== b[1] > pt[1] &&
            pt[0] < ((b[0] - a[0]) * (pt[1] - a[1])) / (b[1] - a[1]) + a[0]
          )
            inside = !inside;
        }
        return inside;
      });
      if (!room) {
        setError("Room tags need a closed wall boundary.");
        return;
      }
      const tag = p.roomTags.find((t) => t.id === room.id);
      if (tag) setSelected(tag.id);
      else {
        const id = uuid();
        if (apply((q) => q.roomTags.push({ id, revision: 1, levelId, point: pt, name: room.name })))
          setSelected(id);
      }
      setTool("select");
      return;
    }
    if (tool === "door" || tool === "window" || tool === "dimension") {
      const hosts = p.walls
          .filter((w) => w.levelId === levelId)
          .map((w) => ({ w, at: projectPoint(pt, w.a, w.b) }))
          .sort((a, b) => distance(a.at, pt) - distance(b.at, pt)),
        host = hosts[0];
      if (!host || distance(host.at, pt) > 600) {
        setError("Click the wall that should host this " + tool + ".");
        return;
      }
      const id = uuid();
      if (tool === "dimension") {
        if (apply((q) => q.dimensions.push({ id, revision: 1, wallId: host.w.id, offset: 650 })))
          setSelected(id);
      } else {
        const kind = tool,
          width = kind === "door" ? 900 : 1800,
          offset = Math.max(
            width / 2,
            Math.min(distance(host.w.a, host.at), distance(host.w.a, host.w.b) - width / 2),
          );
        let tag =
          (kind === "door" ? "D" : "W") +
          String(p.openings.filter((o) => o.kind === kind).length + 1).padStart(2, "0");
        while (p.openings.some((o) => o.tag === tag))
          tag = (kind === "door" ? "D" : "W") + Math.floor(Math.random() * 999);
        if (
          apply((q) =>
            q.openings.push({
              id,
              revision: 1,
              wallId: host.w.id,
              tag,
              kind,
              offset,
              width,
              height: kind === "door" ? 2100 : 1200,
              sill: kind === "door" ? 0 : 900,
              hinge: "left",
              swing: "in",
            }),
          )
        )
          setSelected(id);
      }
      return;
    }
    if (tool === "grid") {
      const id = uuid();
      if (
        apply((q) =>
          q.grids.push({
            id,
            revision: 1,
            label:
              gridAxis === "x"
                ? String.fromCharCode(65 + q.grids.filter((g) => g.axis === "x").length)
                : String(1 + q.grids.filter((g) => g.axis === "y").length),
            axis: gridAxis,
            position: pt[gridAxis === "x" ? 0 : 1],
          }),
        )
      )
        setSelected(id);
      return;
    }
    if (tool === "slab" || tool === "roof") {
      if (points.length >= 3 && distance(pt, points[0]) < 100) {
        completeBoundary();
        return;
      }
      setPoints((a) => [...a, pt]);
      setAnchor(pt);
      return;
    }
    if (!anchor) {
      setAnchor(pt);
      return;
    }
    const id = uuid();
    if (distance(anchor, pt) < 1) return;
    if (
      apply((q) => {
        if (tool === "wall") q.walls.push({ ...newWall(q, levelId, anchor, pt), id });
        else if (tool === "line") q.lines.push({ id, revision: 1, levelId, a: anchor, b: pt });
        else if (tool === "circle")
          q.circles.push({
            id,
            revision: 1,
            levelId,
            center: anchor,
            radius: distance(anchor, pt),
          });
        else if (tool === "section") q.section = { a: anchor, b: pt };
      })
    ) {
      setSelected(tool === "section" ? "section" : id);
      setAnchor(tool === "wall" ? pt : null);
      setLength("");
    }
  }
  const pan = useRef<{ x: number; y: number; box: number[] } | null>(null);
  function pointerDown(e: ReactPointerEvent<SVGSVGElement>) {
    svg.current?.focus({ preventScroll: true });
    if (e.button === 1 || e.button === 2) {
      pan.current = { x: e.clientX, y: e.clientY, box: viewBox };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }
    if (e.button !== 0) return;
    const target =
      (e.target as Element).closest("[data-entity-id]")?.getAttribute("data-entity-id") ?? null;
    place(toPoint(e), target);
  }
  function pointerMove(e: ReactPointerEvent<SVGSVGElement>) {
    if (pan.current) {
      const scale = svg.current?.getScreenCTM()?.a ?? 0.1;
      setViewBox([
        pan.current.box[0] - (e.clientX - pan.current.x) / scale,
        pan.current.box[1] - (e.clientY - pan.current.y) / scale,
        pan.current.box[2],
        pan.current.box[3],
      ]);
      return;
    }
    const r = resolved(toPoint(e));
    setCursor(r.point);
    setSnapKind(r.kind);
  }
  function editOperation(kind: "offset" | "mirror" | "trim" | "extend" | "fillet") {
    try {
      const source =
        p.walls.find((w) => w.id === selected) ?? p.lines.find((l) => l.id === selected);
      if (!source) throw Error("Select a wall or reference line first.");
      const bound =
          p.walls.find((w) => w.id === boundary) ?? p.lines.find((l) => l.id === boundary),
        isWall = "layers" in source;
      const q = structuredClone(p),
        list = isWall ? q.walls : q.lines,
        index = list.findIndex((e) => e.id === source.id);
      if (kind === "offset" || kind === "mirror") {
        const coords =
            kind === "offset"
              ? offsetSegment(source.a, source.b, operationDistance)
              : {
                  a: mirrorPoint(source.a, bound?.a ?? [0, 0], bound?.b ?? [0, 1000]),
                  b: mirrorPoint(source.b, bound?.a ?? [0, 0], bound?.b ?? [0, 1000]),
                },
          copy = { ...structuredClone(source), ...coords, id: uuid(), revision: 1 };
        if (isWall) q.walls.push(copy as (typeof q.walls)[number]);
        else q.lines.push(copy as (typeof q.lines)[number]);
        if (commit(q)) setSelected(copy.id);
        return;
      }
      if (!bound) throw Error("Choose a boundary segment.");
      if (kind === "fillet") {
        if (isWall || "layers" in bound)
          throw Error(
            "Fillet edits reference lines. Curved structural walls need a defined assembly.",
          );
        const f = fillet(source.a, source.b, bound.a, bound.b, operationDistance);
        Object.assign(
          q.lines.find((l) => l.id === source.id)!,
          { a: f.a, b: f.b },
        );
        Object.assign(
          q.lines.find((l) => l.id === bound.id)!,
          { a: f.c, b: f.d },
        );
        q.arcs.push({
          id: uuid(),
          revision: 1,
          levelId,
          center: f.center,
          radius: f.radius,
          startAngle: f.startAngle,
          endAngle: f.endAngle,
          clockwise: f.clockwise,
        });
      } else
        Object.assign(
          list[index],
          kind === "trim"
            ? trimSegment(source.a, source.b, bound.a, bound.b, source.a)
            : extendSegment(source.a, source.b, bound.a, bound.b),
        );
      commit(q);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }
  useEffect(() => registerArchitectController({
    read(args) {
      const current = sessionRef.current;
      if (useStudio.getState().job.id !== args.expectedJobId || current.value.id !== args.expectedJobId)
        throw Error("The active architectural project changed. Read project context again.");
      return { project: structuredClone(current.value), ready, blocked: current.blocked, error: current.error || error,
        pendingDraft: !!anchor || points.length > 0 || !!length.trim(), canUndo: undo.current.length > 0 };
    },
    draw(args) {
      const current = sessionRef.current;
      if (!ready || useStudio.getState().pane !== "sketch" || useStudio.getState().job.id !== args.expectedJobId || current.value.id !== args.expectedJobId)
        throw Error("Open the current project's Architectural workspace before drawing.");
      if (current.blocked || current.error || error) throw Error(current.error || error || "Architectural design recovery must finish before drawing.");
      if (current.value.revision !== args.expectedRevision) throw Error("The design revision changed. Read the design again before drawing.");
      if (current.value !== p) throw Error("The design view is updating. Read the design again after it renders.");
      if (anchor || points.length || length.trim()) throw Error("Finish or cancel the current drawing gesture before applying assistant edits.");
      const prepared = prepareArchitectElements(current.value, args);
      if (!commit(prepared.draft)) throw Error(sessionRef.current.error || "The drawing change was not saved. Existing design remains active.");
      setPanel("draw"); setTool("select"); setSelected(prepared.created.at(-1)?.id ?? null);
      resetDrawing();
      const bounds = projectBounds(prepared.draft);
      setViewBox([bounds.min[0] - 1200, bounds.min[1] - 1200, Math.max(bounds.max[0] - bounds.min[0], 3000) + 2400, Math.max(bounds.max[1] - bounds.min[1], 3000) + 2400]);
      setFitToken(value => value + 1);
      return { projectId: sessionRef.current.value.id, designRevision: sessionRef.current.value.revision, saved: true, readbackVerified: true,
        created: prepared.created, notices: prepared.notices, counts: { walls: sessionRef.current.value.walls.length, openings: sessionRef.current.value.openings.length, lines: sessionRef.current.value.lines.length, roomTags: sessionRef.current.value.roomTags.length } };
    },
    edit(args) {
      const current = sessionRef.current;
      if (!ready || useStudio.getState().pane !== "sketch" || useStudio.getState().job.id !== args.expectedJobId || current.value.id !== args.expectedJobId)
        throw Error("Open the current project's Architectural workspace before editing.");
      if (current.blocked || current.error || error) throw Error(current.error || error || "Architectural design recovery must finish before editing.");
      if (current.value.revision !== args.expectedRevision) throw Error("The design revision changed. Read the design again before editing.");
      if (current.value !== p) throw Error("The design view is updating. Read the design again after it renders.");
      if (anchor || points.length || length.trim()) throw Error("Finish or cancel the current drawing gesture before applying assistant edits.");
      const prepared = prepareArchitectEdits(current.value, args);
      if (!commit(prepared.draft)) throw Error(sessionRef.current.error || "The edit was not saved. Existing design remains active.");
      const saved = sessionRef.current.value;
      const revisionOf = (id: string) => {
        if (id === saved.id) return saved.revision;
        for (const key of ["walls", "openings", "slabs", "roofs", "lines", "circles", "arcs", "grids", "roomTags", "dimensions"] as const) {
          const found = saved[key].find(item => item.id === id);
          if (found) return found.revision;
        }
        return null;
      };
      const present = (id: string) => id !== saved.id && (revisionOf(id) !== null || saved.levels.some(level => level.id === id));
      setPanel("draw"); setTool("select"); setSelected([...prepared.changed].reverse().find(item => present(item.id))?.id ?? null);
      resetDrawing();
      const bounds = projectBounds(prepared.draft);
      setViewBox([bounds.min[0] - 1200, bounds.min[1] - 1200, Math.max(bounds.max[0] - bounds.min[0], 3000) + 2400, Math.max(bounds.max[1] - bounds.min[1], 3000) + 2400]);
      setFitToken(value => value + 1);
      return { projectId: saved.id, designRevision: saved.revision, saved: true, readbackVerified: true,
        changed: prepared.changed.map(item => ({ ...item, revision: revisionOf(item.id) })), removed: prepared.removed, notices: prepared.notices,
        counts: { walls: saved.walls.length, openings: saved.openings.length, lines: saved.lines.length, roomTags: saved.roomTags.length, slabs: saved.slabs.length, roofs: saved.roofs.length, levels: saved.levels.length } };
    },
    undo(args) {
      const current = sessionRef.current;
      if (!ready || useStudio.getState().pane !== "sketch" || useStudio.getState().job.id !== args.expectedJobId || current.value.id !== args.expectedJobId)
        throw Error("Open the current project's Architectural workspace before undoing.");
      if (current.blocked || current.error || error) throw Error(current.error || error || "Architectural design recovery must finish before undoing.");
      if (current.value.revision !== args.expectedRevision) throw Error("The design revision changed. Read the design again before undoing.");
      if (current.value !== p) throw Error("The design view is updating. Wait for the current revision to render.");
      if (anchor || points.length || length.trim()) throw Error("Finish or cancel the current drawing gesture before undoing.");
      if (!undo.current.length) throw Error("No architectural change is available to undo in this session.");
      historyStep(true);
      const saved = sessionRef.current;
      if (saved.error || saved.blocked || saved.value.revision !== args.expectedRevision + 1) throw Error(saved.error || "Undo was not saved.");
      setPanel("draw");
      return { projectId: saved.value.id, designRevision: saved.value.revision, undone: true, saved: true, readbackVerified: true };
    },
  }));
  if (!ready || !levelId)
    return <div className="architect-loading">Restoring architectural design…</div>;
  return (
    <section
      className="architect-workspace"
      data-design-revision={p.revision}
      data-design-id={p.id}
      tabIndex={-1}
      onKeyDown={(e) => {
        e.stopPropagation();
        if ((e.target as HTMLElement).matches("input,textarea,select")) return;
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
          e.preventDefault();
          historyStep(!e.shiftKey);
        } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
          e.preventDefault();
          historyStep(false);
        } else if (e.key === "Escape") {
          resetDrawing();
          setTool("select");
        } else if (e.key === "Delete" && selected) {
          commit(removeEntity(p, selected));
          setSelected(null);
        } else if (e.key === "Enter" && (tool === "slab" || tool === "roof")) completeBoundary();
        else if (e.key.toLowerCase() === "w") {
          setView("plan");
          setTool("wall");
        }
      }}
    >
      <header className="architect-header">
        <div>
          <span className="kicker">ARCHITECTURAL SKETCH · MILLIMETRES</span>
          <h1>{p.name}</h1>
          <p>
            {p.walls.length} walls · {p.openings.length} openings · {p.levels.length} levels{" "}
            <span className="arch-saved">{notice || "Saved design workspace"}</span>
          </p>
        </div>
        <div className="arch-button-row">
          <button
            onClick={async () => {
              if (
                (p.walls.length || p.lines.length) &&
                !(await confirmDesign(
                  "Replace this design with the labelled demonstration? Undo will remain available.",
                ))
              )
                return;
              const q = demonstration(p.id);
              if (commit(q)) {
                setLevelId(q.levels[0].id);
                setSelected(null);
                setNotice("Demonstration design loaded · not your PDF");
                setFitToken((n) => n + 1);
                setViewBox([-1500, -1500, 12000, 9000]);
              }
            }}
            disabled={session.blocked}
          >
            Load demonstration
          </button>
          <button
            onClick={() => download(JSON.stringify(p, null, 2), "architect-design-backup.json")}
            disabled={session.blocked}
          >
            <Save size={15} /> Backup
          </button>
          <button onClick={() => restore.current?.click()}>
            <Upload size={15} /> Restore
          </button>
          <input
            ref={restore}
            type="file"
            accept=".json"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                if (f.size > 8 * 1024 * 1024) throw Error("Design backup exceeds 8 MB.");
                const incoming = validateProject(JSON.parse(await f.text()));
                if (
                  !(await confirmDesign(
                    "Replace this design with the validated backup? The current saved snapshot will be preserved for recovery.",
                  ))
                )
                  return;
                const q = { ...incoming, id: p.id };
                if (commit(q, true, true)) {
                  setLevelId(q.levels[0].id);
                  setSelected(null);
                  resetDrawing();
                }
              } catch (err) {
                setError(err instanceof Error ? err.message : String(err));
              }
              e.target.value = "";
            }}
          />
        </div>
      </header>
      {(error || session.error) && (
        <div className="arch-error" role="alert">
          {error || session.error}
          <button onClick={() => setError(null)} aria-label="Dismiss drafting error">
            ×
          </button>
          {session.blocked && (
            <>
              <button
                onClick={() => {
                  const restored = loadBrowserArchitect(jobId);
                  setSession(restored);
                  setLevelId(restored.value.levels[0].id);
                  setSelected(null);
                  undo.current = [];
                  redo.current = [];
                  setError(null);
                }}
              >
                Reload saved design
              </button>
              {session.raw !== null && (
                <button onClick={() => download(session.raw!, "unreadable-design-original.json")}>
                  Download preserved original
                </button>
              )}
            </>
          )}
        </div>
      )}
      <nav className="arch-tabs" aria-label="Architectural views">
        {(["draw", "schedule", "materials", "sheets", "ai"] as const).map((tab) => (
          <button key={tab} aria-pressed={panel === tab} onClick={() => setPanel(tab)}>
            {tab === "draw"
              ? "Drawing studio"
              : tab === "schedule"
                ? "Door & window schedule"
                : tab === "materials"
                  ? "Materials & cost"
                  : tab === "ai"
                    ? "AI layout"
                    : "Drawing sheets"}
          </button>
        ))}
        <select
          aria-label="Design level"
          value={levelId}
          onChange={(e) => {
            setLevelId(e.target.value);
            setSelected(null);
            resetDrawing();
          }}
        >
          {p.levels.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name} · FFL {(l.elevation / 1000).toFixed(3)}
            </option>
          ))}
        </select>
        <button
          onClick={() => {
            const last = p.levels[p.levels.length - 1],
              id = uuid();
            if (
              apply((q) =>
                q.levels.push({
                  id,
                  name: "Level " + p.levels.length,
                  elevation: last.elevation + last.height + 300,
                  height: last.height,
                }),
              )
            )
              setLevelId(id);
          }}
        >
          <Plus size={14} /> Level
        </button>
      </nav>
      {panel === "draw" && (
        <>
          <div className="arch-toolbar" aria-label="Architectural drawing tools">
            {(Object.keys(toolNames) as Tool[]).map((t) => (
              <button
                key={t}
                aria-pressed={tool === t}
                onClick={() => {
                  setTool(t);
                  setView("plan");
                  resetDrawing();
                }}
                disabled={session.blocked}
              >
                {t === "select" ? (
                  <MousePointer2 size={14} />
                ) : t === "wall" ? (
                  <PenTool size={14} />
                ) : t === "door" ? (
                  <DoorOpen size={14} />
                ) : t === "window" ? (
                  <AppWindow size={14} />
                ) : t === "slab" ? (
                  <Layers size={14} />
                ) : t === "roof" ? (
                  <Home size={14} />
                ) : null}
                {toolNames[t]}
              </button>
            ))}
            <button
              onClick={() => historyStep(true)}
              disabled={!undo.current.length || session.blocked}
              aria-label="Undo design edit"
            >
              <Undo2 size={15} />
            </button>
            <button
              onClick={() => historyStep(false)}
              disabled={!redo.current.length || session.blocked}
              aria-label="Redo design edit"
            >
              <Redo2 size={15} />
            </button>
            <button onClick={fit}>
              <Maximize size={14} /> Fit
            </button>
          </div>
          <div className="arch-precision">
            <label>
              Tracking
              <select
                value={tracking}
                onChange={(e) => setTracking(e.target.value as typeof tracking)}
              >
                <option value="free">Free angle</option>
                <option value="ortho">Ortho 90°</option>
                <option value="polar">Polar</option>
              </select>
            </label>
            {tracking === "polar" && (
              <NumberField
                label="Polar angle"
                value={angle}
                onCommit={(v) => {
                  if (v > 0 && v <= 180) setAngle(v);
                }}
              />
            )}
            <label>
              Exact length mm
              <input
                aria-label="Exact drawing length mm"
                type="number"
                min="1"
                value={length}
                onChange={(e) => setLength(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && anchor) {
                    e.preventDefault();
                    place(cursor, null);
                  }
                }}
                placeholder="Aim, type 4500, Enter"
              />
            </label>
            <details>
              <summary>Object snaps ({snaps.length})</summary>
              {SNAP_KINDS.map((k) => (
                <label key={k}>
                  <input
                    type="checkbox"
                    checked={snaps.includes(k)}
                    onChange={(e) =>
                      setSnaps((s) => (e.target.checked ? [...s, k] : s.filter((a) => a !== k)))
                    }
                  />
                  {k}
                </label>
              ))}
            </details>
            {tool === "grid" && (
              <select
                aria-label="Grid axis"
                value={gridAxis}
                onChange={(e) => setGridAxis(e.target.value as "x" | "y")}
              >
                <option value="x">Vertical / alphabetic</option>
                <option value="y">Horizontal / numeric</option>
              </select>
            )}
            {(tool === "slab" || tool === "roof") && (
              <button onClick={completeBoundary} disabled={points.length < 3}>
                Finish boundary ({points.length})
              </button>
            )}
            <span>
              {anchor
                ? "Pick the next point · Enter accepts exact length · Esc finishes"
                : tool === "door" || tool === "window"
                  ? "Click a host wall"
                  : tool === "select"
                    ? "Select an element · wheel zoom · right-drag pan"
                    : "Pick a start point"}
            </span>
          </div>
          <div className="architect-body">
            <div className="arch-drawing-column">
              <div className="arch-viewbar">
                <select
                  aria-label="Drawing projection"
                  value={view}
                  onChange={(e) => {
                    setView(e.target.value as View);
                    resetDrawing();
                    const b = projectBounds(p);
                    if (e.target.value === "plan") fit();
                    else
                      setViewBox([
                        Math.min(b.min[0], -b.max[0]) - 1800,
                        -10000,
                        Math.max(b.max[0] - b.min[0], b.max[1] - b.min[1]) + 5000,
                        14000,
                      ]);
                  }}
                >
                  {["plan", "north", "south", "east", "west", "section"].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
                <label>
                  <input
                    type="checkbox"
                    checked={show3D}
                    onChange={(e) => setShow3D(e.target.checked)}
                  />{" "}
                  Live 3D
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={showRoof}
                    onChange={(e) => setShowRoof(e.target.checked)}
                  />{" "}
                  Roof
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={allLevels}
                    onChange={(e) => setAllLevels(e.target.checked)}
                  />{" "}
                  All levels in 3D
                </label>
              </div>
              <div className={"arch-canvases " + (show3D ? "with-three" : "")}>
                <svg
                  ref={svg}
                  className="architect-plan"
                  role="img"
                  aria-label="Editable architectural plan"
                  tabIndex={0}
                  viewBox={viewBox.join(" ")}
                  onPointerDown={pointerDown}
                  onPointerMove={pointerMove}
                  onPointerUp={(e) => {
                    pan.current = null;
                    if (e.currentTarget.hasPointerCapture(e.pointerId))
                      e.currentTarget.releasePointerCapture(e.pointerId);
                  }}
                  onContextMenu={(e) => e.preventDefault()}
                  onWheel={(e) => {
                    const center = toPoint(e),
                      factor = e.deltaY > 0 ? 1.12 : 0.89;
                    setViewBox((b) => {
                      const width = Math.max(500, Math.min(2e6, b[2] * factor)),
                        ratio = width / b[2];
                      return [
                        center[0] + (b[0] - center[0]) * ratio,
                        center[1] + (b[1] - center[1]) * ratio,
                        width,
                        b[3] * ratio,
                      ];
                    });
                  }}
                >
                  <defs>
                    <pattern
                      id="architect-grid"
                      width="100"
                      height="100"
                      patternUnits="userSpaceOnUse"
                    >
                      <circle cx="0" cy="0" r="5" fill="#c8ccce" />
                    </pattern>
                  </defs>
                  <rect
                    x={viewBox[0]}
                    y={viewBox[1]}
                    width={viewBox[2]}
                    height={viewBox[3]}
                    fill="url(#architect-grid)"
                  />
                  <DrawingPrimitives
                    items={drawing}
                    selected={selected}
                    onPick={view === "plan" ? undefined : setSelected}
                  />
                  {points.length > 0 && (
                    <polyline
                      points={[...points, cursor].map((p) => p.join(",")).join(" ")}
                      stroke="#ad553d"
                      strokeWidth="18"
                      fill="none"
                    />
                  )}
                  {anchor && tool !== "slab" && tool !== "roof" && (
                    <line
                      x1={anchor[0]}
                      y1={anchor[1]}
                      x2={cursor[0]}
                      y2={cursor[1]}
                      stroke="#ad553d"
                      strokeWidth="15"
                      strokeDasharray="70 35"
                    />
                  )}
                  {snapKind && (
                    <rect
                      x={cursor[0] - 45}
                      y={cursor[1] - 45}
                      width="90"
                      height="90"
                      fill="none"
                      stroke="#287e75"
                      strokeWidth="14"
                    />
                  )}
                </svg>
                {show3D && (
                  <Architect3D
                    project={p}
                    levelId={allLevels ? "all" : levelId}
                    selected={selected}
                    onSelect={setSelected}
                    roofVisible={showRoof}
                    fitToken={fitToken}
                  />
                )}
              </div>
              <div className="arch-status">
                <b>{toolNames[tool]}</b>
                <span>
                  X {cursor[0].toFixed(1)} · Y {cursor[1].toFixed(1)} mm
                </span>
                <span>{snapKind ?? tracking}</span>
                <span>{anchor ? "L " + distance(anchor, cursor).toFixed(1) + " mm" : ""}</span>
                <span>{roomList.length} closed rooms</span>
              </div>
              <details className="arch-modify">
                <summary>Precision modify · offset / trim / extend / mirror / fillet</summary>
                <div className="arch-button-row">
                  <NumberField
                    label="Offset / fillet radius mm"
                    value={operationDistance}
                    onCommit={setOperationDistance}
                  />
                  <label className="arch-field">
                    Boundary / mirror axis
                    <select
                      aria-label="Boundary / mirror axis"
                      value={boundary}
                      onChange={(e) => setBoundary(e.target.value)}
                    >
                      <option value="">Vertical origin axis for mirror</option>
                      {[...p.walls, ...p.lines]
                        .filter((e) => e.id !== selected)
                        .map((e) => (
                          <option key={e.id} value={e.id}>
                            {"name" in e ? String(e.name) : "Line " + e.id.slice(0, 6)}
                          </option>
                        ))}
                    </select>
                  </label>
                  {(["offset", "trim", "extend", "mirror", "fillet"] as const).map((k) => (
                    <button
                      key={k}
                      onClick={() => editOperation(k)}
                      disabled={!selected || session.blocked}
                    >
                      {k}
                    </button>
                  ))}
                </div>
                <p className="arch-note">
                  Trim retains the start side of the selected segment. Fillet creates a true
                  circular arc between reference lines. Hosting checks still apply to modified
                  walls.
                </p>
              </details>
            </div>
            <ArchitectInspector
              project={p}
              selected={selected}
              levelId={levelId}
              onChange={commit}
              onSelect={setSelected}
              onDelete={() => {
                if (selected && commit(removeEntity(p, selected))) setSelected(null);
              }}
            />
          </div>
        </>
      )}
      {panel === "schedule" && (
        <div className="arch-table-panel">
          <header>
            <h2>Opening schedule</h2>
            <p>Live sizes in millimetres. Select a row to edit its host and opening.</p>
            <button
              onClick={() =>
                download(
                  csv([
                    [
                      "Tag",
                      "Type",
                      "Level",
                      "Host",
                      "Width mm",
                      "Height mm",
                      "Sill mm",
                      "Head mm",
                      "Hinge",
                      "Swing",
                    ],
                    ...p.openings.map((o) => {
                      const w = p.walls.find((w) => w.id === o.wallId)!;
                      return [
                        o.tag,
                        o.kind,
                        p.levels.find((l) => l.id === w.levelId)!.name,
                        w.name,
                        o.width,
                        o.height,
                        o.sill,
                        o.sill + o.height,
                        o.hinge,
                        o.swing,
                      ];
                    }),
                  ]),
                  "opening-schedule.csv",
                  "text/csv",
                )
              }
            >
              Export schedule CSV
            </button>
          </header>
          <div className="arch-table-scroll">
            <table>
              <thead>
                <tr>
                  {["Tag", "Type", "Level / host", "Width", "Height", "Sill", "Head", "Swing"].map(
                    (s) => (
                      <th key={s}>{s}</th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {p.openings.map((o) => {
                  const w = p.walls.find((w) => w.id === o.wallId)!;
                  return (
                    <tr
                      key={o.id}
                      onClick={() => {
                        setSelected(o.id);
                        setLevelId(w.levelId);
                        setPanel("draw");
                      }}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          setSelected(o.id);
                          setLevelId(w.levelId);
                          setPanel("draw");
                        }
                      }}
                    >
                      <td>
                        <b>{o.tag}</b>
                      </td>
                      <td>{o.kind}</td>
                      <td>
                        {p.levels.find((l) => l.id === w.levelId)!.name} / {w.name}
                      </td>
                      <td>{o.width}</td>
                      <td>{o.height}</td>
                      <td>{o.sill}</td>
                      <td>{o.sill + o.height}</td>
                      <td>
                        {o.hinge} / {o.swing}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!p.openings.length && (
            <p className="arch-empty">Place a door or window in a wall to begin the schedule.</p>
          )}
          <h2>Room schedule</h2>
          <table>
            <thead>
              <tr>
                <th>Level / room</th>
                <th>Net floor area m²</th>
                <th>Perimeter m</th>
                <th>Ceiling mm</th>
              </tr>
            </thead>
            <tbody>
              {p.levels.flatMap((l) =>
                rooms(p, l.id).map((r) => (
                  <tr key={r.id}>
                    <td>
                      {l.name} / {r.name}
                    </td>
                    <td>{r.areaM2.toFixed(3)}</td>
                    <td>{r.perimeterM.toFixed(3)}</td>
                    <td>{r.height}</td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      )}
      {panel === "materials" && (
        <div className="arch-table-panel">
          <header>
            <h2>Design quantities & cost</h2>
            <SyncDesignMaterials project={p} onError={setError} />
            <p>
              Net geometry with openings deducted and wall junction overlaps removed. Authored
              design quantities require review.
            </p>
            <button
              onClick={() =>
                download(
                  csv([
                    [
                      "Design material",
                      "Net area m2",
                      "Material volume m3",
                      "Weight kg",
                      "Order area m2",
                      "Waste %",
                      "Cost",
                      "Rate reference",
                      "Rate revision",
                    ],
                    ...quantities.rows.map((r) => [
                      r.name,
                      r.areaM2,
                      r.materialVolumeM3,
                      r.weightKg,
                      r.orderAreaM2,
                      r.allowancePercent,
                      r.cost,
                      r.supplierReference,
                      r.rateRevision,
                    ]),
                  ]),
                  "design-materials.csv",
                  "text/csv",
                )
              }
            >
              Export quantities CSV
            </button>
          </header>
          <div className="arch-metrics">
            <div>
              <span>Known material volume</span>
              <strong>{quantities.knownVolumeM3.toFixed(3)} m³</strong>
              <small>{quantities.unknownVolume} unspecified assemblies</small>
            </div>
            <div>
              <span>Known weight</span>
              <strong>{quantities.knownWeightKg.toFixed(1)} kg</strong>
              <small>{quantities.unknownWeight} missing material densities</small>
            </div>
            <div>
              <span>Priced subtotal</span>
              <strong>{quantities.knownCost.toFixed(2)}</strong>
              <small>{quantities.unpriced} unpriced rows · currency per supplier</small>
            </div>
          </div>
          <p className="arch-note">
            Material volume is not packed storage volume. Stud assemblies remain unknown until
            members are specified; roof cover thickness, packing and unspecified densities are not
            invented. Edit wall-layer rates with supplier reference and revision.
          </p>
          <div className="arch-table-scroll">
            <table>
              <thead>
                <tr>
                  {[
                    "Material",
                    "Net m²",
                    "Material m³",
                    "Weight kg",
                    "Order m²",
                    "Cost",
                    "Rate source",
                  ].map((s) => (
                    <th key={s}>{s}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {quantities.rows.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => {
                      setSelected(r.wallId);
                      setPanel("draw");
                    }}
                  >
                    <td>{r.name}</td>
                    <td>{r.areaM2.toFixed(3)}</td>
                    <td>{r.materialVolumeM3?.toFixed(3) ?? "Unspecified"}</td>
                    <td>{r.weightKg?.toFixed(1) ?? "Unspecified"}</td>
                    <td>{r.orderAreaM2.toFixed(3)}</td>
                    <td>{r.cost?.toFixed(2) ?? "Unpriced"}</td>
                    <td>
                      {r.supplierReference || "—"} {r.rateRevision}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {panel === "ai" && <ArchitectAi project={p} levelId={levelId} onChange={commit} />}
      {panel === "sheets" && <ArchitectSheets project={p} onChange={commit} onError={setError} disabled={!ready || session.blocked} />}
      <ArchitectCadExchange
        project={p}
        confirm={confirmDesign}
        onError={setError}
        onImport={(result) => {
          if (commit(result.project)) {
            setLevelId(result.project.levels[0].id);
            setNotice(
              result.parametric
                ? "Parametric DXF restored with stable identities"
                : result.warnings.join(" "),
            );
            setSelected(null);
            setFitToken((n) => n + 1);
          }
        }}
      />
      {confirmation}
    </section>
  );
}
