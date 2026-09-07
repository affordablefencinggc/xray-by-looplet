import { useEffect, useMemo, useState } from "react";
import { useStudio, type Pane } from "./store";
import { BUILDING_CATALOG } from "./sourceBuilding";
import { ALTITUDE_SHA } from "./construction/altitudeTakeoff";
import { WorkspaceDialog } from "./WorkspaceDialog";
type Status = "Available" | "Needs source" | "Limited" | "Planned";
type Capability = {
  id: string;
  group: string;
  title: string;
  detail: string;
  status: Status;
  pane: Pane;
};
export function CapabilitiesChecklist({ onClose }: { onClose: () => void }) {
  const s = useStudio(),
    source = !!s.activePlanBinary,
    model = BUILDING_CATALOG.find((c) => c.sha256 === s.activePlanBinary?.sha256),
    altitude = s.activePlanBinary?.sha256 === ALTITUDE_SHA;
  const [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all"),
    [checks, setChecks] = useState<Record<string, boolean>>({}),
    [ready, setReady] = useState(false),
    [error, setError] = useState("");
  const key = `xray.capabilities-checklist.v1:${s.job.id}`;
  useEffect(() => {
    setReady(false);
    try {
      const value = JSON.parse(localStorage.getItem(key) ?? "{}");
      if (!value || typeof value !== "object" || Array.isArray(value)) throw Error();
      setChecks(
        Object.fromEntries(
          Object.entries(value).filter(([k, v]) => k.length < 100 && typeof v === "boolean"),
        ) as Record<string, boolean>,
      );
    } catch {
      setChecks({});
      setError("Saved checklist could not be read. Your drawing data is unaffected.");
    }
    setReady(true);
  }, [key]);
  const rows = useMemo(() => {
    const result: Capability[] = [];
    const add = (
      group: string,
      id: string,
      title: string,
      detail: string,
      status: Status,
      pane: Pane,
    ) => result.push({ group, id, title, detail, status, pane });
    add(
      "Architectural sketch",
      "architect-model",
      "Layered walls, openings and levels",
      "Sketch ? Architectural workspace. Millimetre geometry, hosted opening healing, levels, slabs and convex roof zones.",
      "Available",
      "sketch",
    );
    add(
      "Architectural sketch",
      "architect-cad",
      "Precision drawing and schedules",
      "Object snaps, exact lengths, polar/ortho tracking, reference-line fillets, trim/extend/mirror/offset, room areas and opening schedules.",
      "Available",
      "sketch",
    );
    add(
      "Architectural sketch",
      "architect-docs",
      "Live drawings and scaled sheets",
      "Plan, four elevations, modelled section, A1/A3 viewports and vector PDF. Print at 100%.",
      "Available",
      "sketch",
    );
    add(
      "Architectural sketch",
      "architect-exchange",
      "DXF and IFC exchange",
      "Unchanged X-Ray DXF round trips retain parametric IDs. External DXF imports reference geometry. IFC exports modelled building elements.",
      "Available",
      "sketch",
    );
    add(
      "Architectural sketch",
      "architect-dwg",
      "Native DWG translation",
      "Windows desktop: local DWG drawing import/export. External CAD becomes supported 2D reference geometry; use DXF or backup for parametric assemblies. Web uses DXF.",
      "Limited",
      "sketch",
    );
    add(
      "Architectural sketch",
      "architect-materials",
      "Live design quantities and material sync",
      "Net geometry, explicit supplier rates and densities. Sync saves a PDF evidence snapshot and updates existing design rows.",
      "Available",
      "sketch",
    );
    add(
      "Architectural sketch",
      "architect-ai",
      "Reviewed Gemini layout proposals",
      "Provider configuration required. Validates geometry before review and apply; no regulatory or structural certification.",
      "Limited",
      "sketch",
    );
    const drawing: Status = source ? "Available" : "Needs source",
      geometry: Status = model ? "Available" : "Needs source";
    add(
      "Plans & evidence",
      "import",
      "Open original plans",
      "Import PDF, DXF or SVG; keep the original bytes and source identity.",
      "Available",
      "sheets",
    );
    add(
      "Plans & evidence",
      "sheets",
      "Browse drawing sheets",
      "Navigate the pages of the active source without mixing document identities.",
      drawing,
      "sheets",
    );
    add(
      "Plans & evidence",
      "sources",
      "Check source identity",
      "Saved drawing hashes and restoration checks protect evidence links.",
      drawing,
      "overview",
    );
    add(
      "Plans & evidence",
      "photos",
      "Attach photo evidence",
      "Record photographs and evidence references for reviewed items.",
      drawing,
      "review",
    );
    add(
      "Plans & evidence",
      "proof",
      "Export proof manifest",
      "Export the current source, evidence and review state.",
      drawing,
      "proof",
    );
    add(
      "Measure & specify",
      "scale",
      "Calibrate drawing scale",
      "Set a known distance and lock the scale before relying on measured quantities.",
      drawing,
      "measure",
    );
    add(
      "Measure & specify",
      "length",
      "Measure length",
      "Trace source-bound runs and inspect their calibrated length.",
      drawing,
      "measure",
    );
    add(
      "Measure & specify",
      "area-volume",
      "Strip area and rectangular volume",
      "Enter width/depth for gross area or volume; missing inputs remain unknown.",
      drawing,
      "measure",
    );
    add(
      "Measure & specify",
      "specify",
      "General construction specifications",
      "Describe wall, slab, conduit and other runs with trade and reference details.",
      drawing,
      "measure",
    );
    add(
      "Measure & specify",
      "trace-edit",
      "Edit traced geometry",
      "Move points, split and merge runs with undo/redo and review invalidation.",
      drawing,
      "measure",
    );
    add(
      "Measure & specify",
      "sketch",
      "Sketch and precision scope",
      "Create manual marks and magnify a small source region. Sketches are not verified quantities.",
      drawing,
      "sketch",
    );
    add(
      "Model & locate",
      "prepared",
      "Prepared source 3D",
      "Crown Wharf, Caroline and Ruffles have curated source-linked reconstructions.",
      "Available",
      "model",
    );
    add(
      "Model & locate",
      "floors",
      "Isolate floors and roof",
      "Inspect a single storey, orbit, zoom, fit and switch to plan projection.",
      geometry,
      "model",
    );
    add(
      "Model & locate",
      "cutaway",
      "Cutaway, wireframe and explode",
      "Inspect internal model geometry and separate the floor stack.",
      geometry,
      "model",
    );
    add(
      "Model & locate",
      "fly",
      "First-person flight",
      "Use WASD and mouse look, Shift to accelerate, Space/Ctrl for altitude and Esc to exit. Desktop mouse capture required.",
      geometry,
      "model",
    );
    add(
      "Model & locate",
      "walk",
      "Cinematic floor walkthrough",
      "Smooth movement at eye height on the selected floor. Navigation does not include collision detection.",
      geometry,
      "model",
    );
    add(
      "Model & locate",
      "parts",
      "Inspect source model parts",
      "Browse the matching model parts by floor/category and inspect drawing references.",
      geometry,
      "components",
    );
    add(
      "Model & locate",
      "maps",
      "Four location maps",
      "Red highlights show floor, assigned room, selected part and source region.",
      geometry,
      "components",
    );
    add(
      "Model & locate",
      "room-notes",
      "Room links and location notes",
      "Mark a room area or choose a modeled room; your annotations stay separate from source evidence.",
      geometry,
      "components",
    );
    add(
      "Model & locate",
      "png",
      "Export model images",
      "Export the real model view as PNG with source and reconstruction information.",
      geometry,
      "model",
    );
    add(
      "Model & locate",
      "auto-bim",
      "Automatic arbitrary-plan BIM",
      "Automatic complete building reconstruction from any PDF is not implemented.",
      "Planned",
      "model",
    );
    add(
      "Engineering & architecture",
      "sections",
      "Dimensioned sections and elevations",
      "Generate source-aligned section cuts with dimensions and drawing exports.",
      "Planned",
      "model",
    );
    add(
      "Engineering & architecture",
      "levels",
      "Editable levels and room schedules",
      "Edit storey datums, room boundaries, areas and architectural room schedules.",
      "Planned",
      "model",
    );
    add(
      "Engineering & architecture",
      "materials",
      "Engineering material specifications",
      "Bind grades, profiles, densities and design properties to verified components.",
      "Planned",
      "model",
    );
    add(
      "Engineering & architecture",
      "clashes",
      "Clash and clearance checks",
      "Check structural and services intersections with recorded review decisions.",
      "Planned",
      "model",
    );
    add(
      "Engineering & architecture",
      "loads",
      "Structural loads and analysis",
      "Connect validated analysis for wind, gravity and lateral loads. Weather effects do not perform analysis.",
      "Planned",
      "model",
    );
    add(
      "Engineering & architecture",
      "ifc",
      "IFC and CAD coordination",
      "Import/export semantic BIM elements, coordinates, classifications and revisions.",
      "Planned",
      "model",
    );
    add(
      "Materials & quantities",
      "register",
      "Actual materials register",
      "Enter actual stock, packaging dimensions and specified weights in the Altitude source workflow.",
      altitude ? "Available" : "Limited",
      "components",
    );
    add(
      "Materials & quantities",
      "packed",
      "Packed volume and specified weight",
      "Totals include only rows with sufficient packaging and weight data; unknown coverage stays visible.",
      altitude ? "Available" : "Limited",
      "components",
    );
    add(
      "Materials & quantities",
      "bulk",
      "Bulk CSV import",
      "Preview validated stock rows and resolve identities before committing an import. Currently in the Altitude workflow.",
      altitude ? "Available" : "Limited",
      "components",
    );
    add(
      "Materials & quantities",
      "backup",
      "Backup and restore inventory",
      "Export and restore a material inventory with previous-snapshot protection. Currently in the Altitude workflow.",
      altitude ? "Available" : "Limited",
      "components",
    );
    add(
      "Materials & quantities",
      "fasteners",
      "Complete building fastener count",
      "Curated render meshes do not prove a complete bolt, anchor or reinforcement schedule.",
      "Planned",
      "components",
    );
    add(
      "Review & delivery",
      "approval",
      "Review and re-review changes",
      "Missing evidence creates blockers; material edits invalidate previous approval.",
      drawing,
      "review",
    );
    add(
      "Review & delivery",
      "cost",
      "Evidence-gated quantity register",
      "Inspect measured quantities and available fencing assembly calculations; general pricing is not provided.",
      "Limited",
      "cost",
    );
    add(
      "Review & delivery",
      "pricing",
      "Supplier pricing and purchase orders",
      "Live supplier pricing and order submission are not implemented.",
      "Planned",
      "cost",
    );
    add(
      "Review & delivery",
      "render-brief",
      "Record a render brief",
      "Record the current source, camera and appearance for a render brief.",
      geometry,
      "render",
    );
    add(
      "Review & delivery",
      "ai-render",
      "Generated photorealistic rendering",
      "The Render workspace does not currently generate finished AI images.",
      "Planned",
      "render",
    );
    add(
      "Workspace & saving",
      "rails",
      "Resize both side menus",
      "Drag the thick edge, use arrow keys or double-click to reset. Widths are remembered on this device.",
      "Available",
      "model",
    );
    add(
      "Workspace & saving",
      "save",
      "Restore saved project work",
      "Original documents and source-bound edits persist locally. Storage errors remain visible.",
      s.persistenceError ? "Limited" : "Available",
      "overview",
    );
    add(
      "Workspace & saving",
      "checklist",
      "Personal capability checklist",
      "Record which available features you have checked in this project. These checks do not grant engineering approval.",
      "Available",
      "overview",
    );
    return result;
  }, [source, model, altitude, s.persistenceError]);
  const visible = rows.filter(
    (r) =>
      `${r.title} ${r.group} ${r.detail}`.toLowerCase().includes(search.toLowerCase()) &&
      (filter === "all" ||
        (filter === "checked" && checks[r.id]) ||
        (filter === "unchecked" && !checks[r.id]) ||
        (filter === "attention" && r.status !== "Available")),
  );
  function toggle(id: string, checked: boolean) {
    const next = { ...checks, [id]: checked };
    try {
      localStorage.setItem(key, JSON.stringify(next));
      setChecks(next);
      setError("");
    } catch {
      setError("Checklist could not be saved. The previous saved checks are preserved.");
    }
  }
  return (
    <WorkspaceDialog title="Capabilities & live checklist" onClose={onClose}>
      <div className="capability-overview">
        <div>
          <span className="kicker">Current workspace</span>
          <h3>{model?.title ?? s.activePlanBinary?.name ?? "No source open"}</h3>
          <p>
            Availability follows the active drawing. Checkboxes record your own testing, not product
            completion or engineering approval.
          </p>
        </div>
        <div className="capability-count">
          <strong>
            {rows.filter((r) => checks[r.id]).length} / {rows.length}
          </strong>
          <span>checked by you</span>
        </div>
        <div className="capability-count">
          <strong>{rows.filter((r) => r.status === "Available").length}</strong>
          <span>available now</span>
        </div>
      </div>
      <div className="capability-toolbar">
        <label>
          Search capabilities
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tools, workflow or limitation…"
          />
        </label>
        <label>
          Show
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">Everything</option>
            <option value="unchecked">Not checked</option>
            <option value="checked">Checked by you</option>
            <option value="attention">Needs attention / planned</option>
          </select>
        </label>
      </div>
      {error && (
        <p className="capability-error" role="alert">
          {error}
        </p>
      )}
      <div className="capability-groups">
        {[...new Set(visible.map((r) => r.group))].map((group) => (
          <section key={group}>
            <h3>{group}</h3>
            {visible
              .filter((r) => r.group === group)
              .map((r) => (
                <article className="capability-row" key={r.id}>
                  <input
                    type="checkbox"
                    aria-label={`I checked ${r.title}`}
                    checked={!!checks[r.id]}
                    disabled={!ready || (r.status !== "Available" && !checks[r.id])}
                    onChange={(e) => toggle(r.id, e.target.checked)}
                  />
                  <div>
                    <h4>{r.title}</h4>
                    <p>{r.detail}</p>
                  </div>
                  <span
                    className={`capability-status status-${r.status.toLowerCase().replaceAll(" ", "-")}`}
                  >
                    {r.status}
                  </span>
                  <button
                    className="pill"
                    disabled={r.status === "Planned"}
                    onClick={() => {
                      s.setPane(r.pane);
                      onClose();
                    }}
                  >
                    Open {r.pane}
                  </button>
                </article>
              ))}
          </section>
        ))}
        {!visible.length && <p>No capabilities match this search.</p>}
      </div>
    </WorkspaceDialog>
  );
}
