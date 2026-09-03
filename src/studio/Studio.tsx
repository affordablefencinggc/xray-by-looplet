import { useEffect, useRef, useState } from "react";
import { ChevronUp, Download, Network } from "lucide-react";
import { HOUSE, SHEETS } from "./geometry";
import { IsoCanvas, PlanCanvas } from "./IsoCanvas";
import { pickAndRunTakeoff } from "./engine";
import { useStudio, type Pane } from "./store";
import { buildLoopletQuoteLines, pushToLoopletCrm } from "./crmBridge";
import { handleStudioKeyDown, shouldIgnoreShortcuts } from "./shortcuts";

const PANES: { id: Pane; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "sheets", label: "Sheets" },
  { id: "measure", label: "Measure" },
  { id: "sketch", label: "Sketch" },
  { id: "components", label: "Components" },
  { id: "model", label: "Model" },
  { id: "review", label: "Review" },
  { id: "cost", label: "Cost" },
  { id: "proof", label: "Proof" },
];

export function Studio() {
  const s = useStudio();
  const sheet = SHEETS[s.sheet];

  // Global keyboard shortcuts for tool switching and navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (shouldIgnoreShortcuts(document.activeElement)) {
        return;
      }
      handleStudioKeyDown(
        e,
        {
          setPane: s.setPane,
          setTool: s.setTool,
          toggleSnapping: s.toggleSnapping,
          clearPending: s.clearPending,
          commitPending: s.commitPending,
          pendingLength: s.pending.length,
        },
        PANES
      );
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [s]);

  async function openPlan() {
    try {
      const r = await pickAndRunTakeoff();
      if (r.name) s.setPlan(r.name, r.takeoff, r.note);
    } catch (err) {
      s.setPlan(s.planName ?? "open failed", null, err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="flex h-dvh flex-col bg-bg text-ink">
      <header className="flex items-center gap-2.5 border-b border-line bg-header px-3 py-2">
        <div className="flex min-w-0 items-center gap-2 font-mono text-[11px] tracking-[0.12em]">
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-navy text-[10px] text-paper">XR</span>
          <span className="hidden truncate sm:inline">X-RAY BY LOOPLET</span>
        </div>
        <nav className="flex flex-1 justify-center gap-0.5" aria-label="Panes">
          {PANES.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`pane-tab ${s.pane === p.id ? "active" : ""}`}
              onClick={() => s.setPane(p.id)}
            >
              {p.label}
            </button>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <a
            className="pill inline-flex items-center gap-1.5 no-underline"
            href="/mindmap-topdown.html"
            target="_blank"
            rel="noreferrer"
            title="Open top-down architecture mind map & editable TODO"
          >
            <Network className="size-3.5 text-cyan" />
            Mind Map
          </a>
          <button type="button" className="pill" aria-pressed={s.capsOpen} onClick={() => s.toggle("capsOpen")}>
            Capabilities
          </button>
          <button
            type="button"
            className="pill"
            aria-pressed={s.skin === "navy"}
            onClick={() => s.setSkin(s.skin === "navy" ? "paper" : "navy")}
          >
            Charcoal
          </button>
          <a
            className="pill inline-flex items-center gap-1.5 no-underline bg-[#7fdbff]/20 text-[#7fdbff] border border-[#7fdbff]/40 hover:bg-[#7fdbff]/30 font-semibold"
            href="/X-Ray-by-Looplet-Setup.exe"
            download="X-Ray-by-Looplet-Setup.exe"
            title="Download official Windows installer"
          >
            <Download className="size-3.5" />
            Install Windows App (.exe)
          </a>
          <button type="button" className="pill-dark" onClick={() => void openPlan()}>
            Open plan
          </button>
        </div>
      </header>

      <div className="flex items-center gap-2 px-3 py-2 font-mono text-[10px] tracking-[0.18em] text-muted">
        {s.pane === "model" && (
          <>
            MODEL PIPELINE
            <button type="button" className="pill tracking-normal">
              Export plan nodes
            </button>
            <button type="button" className="pill tracking-normal">
              Sketch guidance
            </button>
          </>
        )}
        {s.pane === "measure" && <>MEASURE · scale first · then length / area / count</>}
        {s.pane === "sketch" && <>SKETCH · manual traces only · never quantities</>}
        {s.pane === "overview" && <>STUDIO · evidence-first takeoff</>}
        {s.pane === "sheets" && <>SHEETS · {s.planName ?? "no plan"}</>}
        {s.pane === "components" && <>COMPONENTS · open-ended trades</>}
        {s.pane === "review" && <>REVIEW · flags from missing evidence</>}
        {s.pane === "cost" && <>COST · BOM from measured markups only</>}
        {s.pane === "proof" && <>PROOF · export the evidence pack</>}
      </div>

      <div
        className={`grid min-h-0 flex-1 ${s.lifted ? "grid-cols-1" : s.rightCollapsed ? "grid-cols-[168px_1fr]" : "grid-cols-[168px_minmax(0,1fr)_260px]"}`}
      >
        {!s.lifted && (
          <aside className="overflow-auto border-r border-line p-3">
            <h2 className="kicker mb-2">
              Project sheets <span className="float-right">{SHEETS.length}</span>
            </h2>
            <div className="mb-2 flex gap-1">
              <button type="button" className="pill" onClick={() => void openPlan()}>
                Open plan
              </button>
              <button type="button" className="pill" onClick={() => s.fit()}>
                Fit sheet
              </button>
            </div>
            {SHEETS.map((sh) => (
              <button
                key={sh.index}
                type="button"
                className={`sheet-btn ${s.sheet === sh.index ? "active" : ""}`}
                onClick={() => s.setSheet(sh.index)}
              >
                {String(sh.n).padStart(2, "0")} {sh.title}
              </button>
            ))}
            <h2 className="kicker mt-4">
              Evidence layers <span className="float-right">Live</span>
            </h2>
            <p className="mt-2 flex justify-between text-muted">
              Measurements <b className="text-ink">{s.markups.filter((m) => m.kind !== "sketch").length}</b>
            </p>
            <p className="flex justify-between text-muted">
              Takeoff evidence <b className="text-ink">{s.markups.length}</b>
            </p>
            <p className="flex justify-between text-muted">
              Review flags <b className="text-ink">{s.scaleM === 1 && s.markups.length ? 1 : 0}</b>
            </p>
          </aside>
        )}

        <section className={`flex min-w-0 flex-col gap-2.5 ${s.lifted ? "overflow-hidden p-0" : "overflow-auto p-3"}`}>
          {s.pane === "overview" && <Overview />}
          {s.pane === "sheets" && <SheetsPane />}
          {s.pane === "measure" && <MeasurePane />}
          {s.pane === "sketch" && <SketchPane />}
          {s.pane === "components" && <ComponentsPane />}
          {s.pane === "model" && <ModelPane />}
          {s.pane === "review" && <ReviewPane />}
          {s.pane === "cost" && <CostPane />}
          {s.pane === "proof" && <ProofPane />}
        </section>

        {!s.lifted && !s.rightCollapsed && <RightRail />}
      </div>

      <footer className="flex flex-wrap gap-3.5 border-t border-line px-3 py-1.5 font-mono text-[10px] tracking-wider text-muted">
        <span>Mode {s.pane} readiness</span>
        <span>
          Sheet {sheet.n} / 24
        </span>
        <span>Markups {s.markups.length}</span>
        <span>Evidence-first — quantities never re-derived here</span>
        <span>{s.planName ?? "no plan"}</span>
        <a className="ml-auto inline-flex items-center gap-1 text-ink underline" href="/xray-model-pipeline.html" download="xray-by-looplet.html">
          <Download className="size-3" />
          Download
        </a>
      </footer>

      {s.capsOpen && <Capabilities onClose={() => s.toggle("capsOpen")} />}
    </div>
  );
}

function InstallButton() {
  const [help, setHelp] = useState(false);

  function insideGrokShell() {
    try {
      return window.self !== window.top || /grok\.com$/i.test(window.location.hostname);
    } catch {
      return true;
    }
  }

  return (
    <>
      <button type="button" className="pill" onClick={() => setHelp(true)}>
        Install on this PC
      </button>
      {help && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-navy/40 p-6" onClick={() => setHelp(false)}>
          <div className="max-w-md rounded-2xl bg-paper p-6 text-ink shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-mono text-sm tracking-[0.16em]">THAT WAS GROK, NOT X-RAY</h2>
            <p className="mt-3 text-muted">
              Chrome’s “Install Grok app · Publisher: grok.com” is the chat site. This studio is running inside it, so
              the install icon always offers Grok. Click <b>Not now</b>.
            </p>
            <p className="mt-3 text-muted">
              To put X-Ray on your PC, use <b>Download</b> in the header. That saves <code>xray-by-looplet.html</code> —
              open that file. It is not a Grok install.
            </p>
            {insideGrokShell() ? null : (
              <p className="mt-3 text-muted">If you opened this studio on its own tab (not grok.com), Chrome can then install *this* site as an app.</p>
            )}
            <div className="mt-4 flex gap-2">
              <a className="pill-dark inline-flex items-center gap-1.5 no-underline" href="/xray-model-pipeline.html" download="xray-by-looplet.html">
                <Download className="size-3.5" />
                Download X-Ray
              </a>
              <button type="button" className="pill" onClick={() => setHelp(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Stat({ k, v, n }: { k: string; v: string; n: string }) {
  return (
    <div className="rounded-2xl bg-card px-3.5 py-3">
      <div className="kicker">{k}</div>
      <b className="mt-1 block text-[28px] tracking-tight">{v}</b>
      <small className="text-muted">{n}</small>
    </div>
  );
}

function Overview() {
  const s = useStudio();
  return (
    <>
      <p className="max-w-prose text-muted">
        X-Ray by Looplet is an evidence-first takeoff studio. Open a construction PDF, set scale, mark length /
        area / count, then hand a BOM to Looplet. The model never invents quantities.
      </p>
      <div className="grid grid-cols-4 gap-2.5">
        <Stat k="Qualified plan" v={s.planName ? "Yes" : "No"} n={s.planName ? "24 source sheets · OCR off" : "Open a plan"} />
        <Stat k="Source vectors" v="demo" n="Native line segments on this sheet" />
        <Stat k="Manual geometry" v={String(s.markups.length)} n="Measured lines, areas and markers" />
        <Stat k="Semantic instances" v="0" n="Required for exact recursive assembly identity" />
      </div>
      <div className="relative min-h-[320px] flex-1 overflow-hidden rounded-[18px]">
        <Stage />
      </div>
    </>
  );
}

function SheetsPane() {
  const s = useStudio();
  const sh = SHEETS[s.sheet];
  return (
    <>
      <p className="text-muted">
        {sh.title} · {sh.kind} · Use scroll wheel to zoom, click & drag to pan.
      </p>
      <div className="relative min-h-[420px] flex-1 overflow-hidden rounded-[18px]">
        <div className={`stage absolute inset-0 ${s.skin === "paper" ? "paper" : ""}`}>
          {sh.kind === "elev" ? <IsoCanvas /> : <PlanCanvas interactive={false} />}
        </div>
      </div>
    </>
  );
}

function MeasurePane() {
  const s = useStudio();
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="pill" aria-pressed={s.tool === "length"} onClick={() => s.setTool("length")}>
          Length <kbd className="ml-1 text-[9px] opacity-70 font-mono bg-white/10 px-1 py-0.5 rounded">L</kbd>
        </button>
        <button type="button" className="pill" aria-pressed={s.tool === "area"} onClick={() => s.setTool("area")}>
          Area <kbd className="ml-1 text-[9px] opacity-70 font-mono bg-white/10 px-1 py-0.5 rounded">A</kbd>
        </button>
        <button type="button" className="pill" aria-pressed={s.tool === "count"} onClick={() => s.setTool("count")}>
          Count <kbd className="ml-1 text-[9px] opacity-70 font-mono bg-white/10 px-1 py-0.5 rounded">C</kbd>
        </button>
        <label className="kicker ml-2">
          Scale m / drawing unit
          <input
            className="ml-2 w-20 rounded-full bg-navy px-2 py-1 text-paper"
            type="number"
            step="0.01"
            min="0.001"
            value={s.scaleM}
            onChange={(e) => s.setScale(Number(e.target.value) || 1)}
          />
        </label>
        <button type="button" className="pill" onClick={() => s.commitPending()}>
          Close area <kbd className="ml-1 text-[9px] opacity-70 font-mono bg-white/10 px-1 py-0.5 rounded">Enter</kbd>
        </button>
        <button type="button" className="pill" onClick={() => { s.clearPending(); s.setTool("none"); }}>
          Cancel <kbd className="ml-1 text-[9px] opacity-70 font-mono bg-white/10 px-1 py-0.5 rounded">Esc</kbd>
        </button>
      </div>
      <p className="text-muted">
        Shortcuts: <span className="font-mono text-cyan">L</span> Length · <span className="font-mono text-cyan">A</span> Area · <span className="font-mono text-cyan">C</span> Count · <span className="font-mono text-amber-400">S</span> Snap · <span className="font-mono text-muted">Esc</span> Cancel. Two clicks for length. Polygon then Close area.
      </p>
      <div className="relative min-h-[360px] flex-1 overflow-hidden rounded-[18px]">
        <div className={`stage absolute inset-0 ${s.skin === "paper" ? "paper" : ""}`}>
          <PlanCanvas interactive />
        </div>
      </div>
      <MarkupList />
    </>
  );
}

function SketchPane() {
  const s = useStudio();
  return (
    <>
      <div className="flex gap-2">
        <button type="button" className="pill" aria-pressed={s.tool === "sketch"} onClick={() => s.setTool("sketch")}>
          Manual layer <kbd className="ml-1 text-[9px] opacity-70 font-mono bg-white/10 px-1 py-0.5 rounded">M</kbd>
        </button>
        <button type="button" className="pill" onClick={() => s.commitPending()}>
          Commit trace <kbd className="ml-1 text-[9px] opacity-70 font-mono bg-white/10 px-1 py-0.5 rounded">Enter</kbd>
        </button>
        <button type="button" className="pill" onClick={() => s.clearPending()}>
          Cancel <kbd className="ml-1 text-[9px] opacity-70 font-mono bg-white/10 px-1 py-0.5 rounded">Esc</kbd>
        </button>
      </div>
      <p className="text-muted">Click a polyline on the plan, then Commit. Height in Model only raises these traces after scale.</p>
      <div className="relative min-h-[360px] flex-1 overflow-hidden rounded-[18px]">
        <div className={`stage absolute inset-0 ${s.skin === "paper" ? "paper" : ""}`}>
          <PlanCanvas interactive />
        </div>
      </div>
      <MarkupList />
    </>
  );
}

function ComponentsPane() {
  const s = useStudio();
  const [name, setName] = useState("");
  return (
    <>
      <p className="text-muted">
        Right rail is open-ended. No default fence, Colorbond, or trade pack. Add only what this sheet evidences.
      </p>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          s.addTrade(name);
          setName("");
        }}
      >
        <input
          className="flex-1 rounded-full border border-line bg-card px-3 py-2"
          placeholder="Trade or assembly name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button type="submit" className="pill-dark">
          Add trade
        </button>
      </form>
      <ul className="space-y-2">
        {s.trades.length === 0 && <li className="rounded-2xl bg-card p-4 text-muted">Nothing listed. That is correct until you add it.</li>}
        {s.trades.map((t) => (
          <li key={t.id} className="flex items-center justify-between rounded-2xl bg-card px-4 py-3">
            <div>
              <b>{t.name}</b>
              <p className="text-muted">{t.note}</p>
            </div>
            <button type="button" className="pill" onClick={() => s.removeTrade(t.id)}>
              Remove
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

function ModelPane() {
  const s = useStudio();
  return (
    <>
      {!s.lifted && (
        <>
          <p className="max-w-prose text-muted">
            This workspace shows exactly how far the current source can travel—from plan geometry to a labelled
            graph, wireframe, solid model and optional render.
          </p>
          <div className="grid grid-cols-4 gap-2.5">
            <Stat k="Qualified plan" v={s.planName ? "Yes" : "No"} n={s.engineNote} />
            <Stat k="Source vectors" v={String(HOUSE.B.length + HOUSE.R.length)} n="Demo mesh segments on this sheet — not a PDF parse" />
            <Stat k="Manual geometry" v={String(s.markups.length)} n="Measured lines, areas and component markers" />
            <Stat k="Semantic instances" v="0" n="Required for exact recursive assembly identity" />
          </div>
        </>
      )}
      <div className={`relative min-h-[280px] flex-1 ${s.lifted ? "min-h-0" : ""}`}>
        <Stage />
      </div>
      {!s.lifted && (
        <p className="rounded-xl bg-card px-3 py-2.5 text-muted">
          <b className="text-ink">Truth boundary:</b> this is an interactive wireframe of native plan paths, not a
          semantic BIM reconstruction. Buildings first, roofs second. Exact bolts, brackets and concealed hardware
          still need CAD instances or explicit manual evidence.
        </p>
      )}
    </>
  );
}

function Stage() {
  const s = useStudio();
  const canvasRef = useRef<HTMLDivElement>(null);

  function saveStill() {
    const canvas = canvasRef.current?.querySelector("canvas");
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `xray-sheet-${s.sheet + 1}.png`;
    a.click();
  }

  return (
    <div
      ref={canvasRef}
      className={`stage relative h-full min-h-[320px] overflow-hidden rounded-[18px] ${s.skin === "paper" ? "paper bg-paper text-ink" : "bg-navy text-paper"}`}
    >
      {!s.chromeHidden && (
        <div className="absolute inset-x-0 top-0 z-10 flex flex-wrap items-center gap-1.5 bg-gradient-to-b from-navy/90 to-transparent px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em]">
          <span className="text-cbar">Source sheet</span>
          <select
            className="rounded-full bg-navy px-2.5 py-1.5 text-paper"
            value={s.sheet}
            onChange={(e) => s.setSheet(Number(e.target.value))}
          >
            {SHEETS.map((sh) => (
              <option key={sh.index} value={sh.index}>
                {sh.title}
              </option>
            ))}
          </select>
          <span className="text-cbar">Presentation height (m)</span>
          <input
            className="w-16 rounded-full bg-navy px-2.5 py-1.5 text-paper"
            type="number"
            min={0}
            step={0.1}
            value={s.height}
            onChange={(e) => s.setHeight(Number(e.target.value) || 0)}
          />
          <button type="button" className="stage-btn" aria-pressed={s.showSrc} onClick={() => s.toggle("showSrc")}>
            Source vectors
          </button>
          <button type="button" className="stage-btn" aria-pressed={s.showBld} onClick={() => s.toggle("showBld")}>
            Building
          </button>
          <button type="button" className="stage-btn" aria-pressed={s.showRoof} onClick={() => s.toggle("showRoof")}>
            Roof
          </button>
          <button type="button" className="stage-btn" aria-pressed={s.showSurfaces} onClick={() => s.toggleSurfaces()}>
            Shaded Surfaces
          </button>
          <button type="button" className="stage-btn" aria-pressed={s.showMan} onClick={() => s.toggle("showMan")}>
            Manual layer
          </button>
          <span className="text-cbar ml-1">Storeys</span>
          <select
            className="rounded-full bg-navy px-2 py-1 text-paper"
            value={s.floors}
            onChange={(e) => s.setFloors(Number(e.target.value))}
          >
            <option value={1}>1 Storey</option>
            <option value={2}>2 Storeys</option>
            <option value={3}>3 Storeys</option>
            <option value={4}>4 Storeys</option>
            <option value={8}>8 Storeys (Midrise)</option>
            <option value={16}>16 Storeys (Highrise)</option>
            <option value={25}>25 Storeys (Tower)</option>
            <option value={40}>40 Storeys (Skyscraper)</option>
          </select>
          {s.floors > 1 && (
            <>
              <button
                type="button"
                className="stage-btn"
                aria-pressed={s.explodeFloors > 0}
                onClick={() => s.setExplodeFloors(s.explodeFloors > 0 ? 0 : 1.2)}
                title="Explode storeys vertically"
              >
                Explode {s.explodeFloors > 0 ? "ON" : "OFF"}
              </button>
              <select
                className="rounded-full bg-navy px-2 py-1 text-paper"
                value={s.activeFloor === null ? "all" : String(s.activeFloor)}
                onChange={(e) => s.setActiveFloor(e.target.value === "all" ? null : Number(e.target.value))}
                title="Isolate specific storey level"
              >
                <option value="all">All Levels</option>
                {Array.from({ length: s.floors }, (_, i) => (
                  <option key={i} value={i}>
                    {i === 0 ? "Ground (L0)" : `Level ${i} (L${i})`}
                  </option>
                ))}
              </select>
            </>
          )}
          <button type="button" className="stage-btn" aria-pressed={s.pose === "standing"} onClick={() => s.stand()}>
            Stand 3D
          </button>
          <button type="button" className="stage-btn" aria-pressed={s.pose === "laid"} onClick={() => s.lay()}>
            Lay Flat
          </button>
          <span className="flex-1" />
          <button type="button" className="stage-btn" aria-pressed={s.cam === "plan"} onClick={() => s.setCam("plan")}>
            Plan
          </button>
          <button type="button" className="stage-btn" aria-pressed={s.cam === "iso"} onClick={() => s.setCam("iso")}>
            Isometric
          </button>
          <button type="button" className="stage-btn" onClick={() => s.fit()}>
            Fit
          </button>
          <button type="button" className="stage-btn" onClick={saveStill}>
            Save still
          </button>
          <a
            className="stage-btn inline-flex items-center no-underline"
            href="/X-Ray-by-Looplet-Setup.exe"
            download="X-Ray-by-Looplet-Setup.exe"
            title="Download Windows App"
          >
            Download App
          </a>
          <span className="flex items-center gap-1" title="Canvas colour">
            <button
              type="button"
              className={`size-3.5 rounded-full border-2 bg-navy ${s.skin === "navy" ? "border-cyan" : "border-transparent"}`}
              aria-label="Charcoal canvas"
              onClick={() => s.setSkin("navy")}
            />
            <button
              type="button"
              className={`size-3.5 rounded-full border-2 bg-paper ${s.skin === "paper" ? "border-cyan" : "border-transparent"}`}
              aria-label="Paper canvas"
              onClick={() => s.setSkin("paper")}
            />
          </span>
          <button type="button" className="stage-btn grid size-7 place-items-center p-0" title="Lift menu — full canvas" onClick={() => s.lift()}>
            <ChevronUp className="size-3.5" />
          </button>
        </div>
      )}
      {s.chromeHidden && (
        <button
          type="button"
          className="stage-btn absolute top-2 right-2 z-10 grid size-7 place-items-center p-0"
          title="Restore menu"
          onClick={() => s.lift()}
        >
          <ChevronUp className="size-3.5 rotate-180" />
        </button>
      )}
      {!s.chromeHidden && (
        <>
          <p className="pointer-events-none absolute top-16 left-3.5 z-[2] font-mono text-[10px] tracking-wider text-cbar">
            Height only raises measured geometry after page-scale calibration. It never creates quantities.
          </p>
          <div className="pointer-events-none absolute top-[86px] left-3.5 z-[2] font-mono text-[10px] uppercase tracking-[0.16em] text-cbar">
            <div>Qualified source geometry</div>
            <div>{s.pose === "standing" ? "3D wireframe · building then roof" : "Plan · laid on ground"}</div>
            <div className="pointer-events-auto mt-2 flex gap-3 text-paper">
              <Swatch on={s.showSrc} onClick={() => s.toggle("showSrc")} color="bg-cyan" label="PDF vectors" />
              <Swatch on={s.showBld} onClick={() => s.toggle("showBld")} color="bg-cyan" label="building" />
              <Swatch on={s.showRoof} onClick={() => s.toggle("showRoof")} color="bg-roof" label="roof" />
              <Swatch on={s.showMan} onClick={() => s.toggle("showMan")} color="bg-manual" label="manual" />
              <span className={s.height > 0 && s.showMan ? "" : "opacity-35"}>
                <i className="mr-1.5 inline-block size-2 bg-extrude" />
                extruded
              </span>
            </div>
          </div>
        </>
      )}
      <IsoCanvas />
    </div>
  );
}

function Swatch({ on, onClick, color, label }: { on: boolean; onClick: () => void; color: string; label: string }) {
  return (
    <button type="button" className={`bg-transparent p-0 tracking-inherit ${on ? "" : "opacity-35"}`} onClick={onClick}>
      <i className={`mr-1.5 inline-block size-2 ${color}`} />
      {label}
    </button>
  );
}

function RightRail() {
  const s = useStudio();
  return (
    <aside className="overflow-auto border-l border-line p-3">
      <div className="mb-2 flex items-start justify-between">
        <h2 className="kicker">Model readiness</h2>
        <button type="button" className="pill" onClick={() => s.toggle("rightCollapsed")}>
          Collapse
        </button>
      </div>
      <p className="text-muted">Track the validated path from source geometry.</p>
      <div className="mt-2.5 rounded-[14px] bg-card p-3">
        <Row a="Source" b={s.planName ? "Qualified" : "Missing"} />
        <Row a="Source viewer" b="Available" />
        <Row a="Semantic graph" b="Not evidenced" />
      </div>
      <div className="mt-2.5 rounded-[14px] bg-card p-3">
        <div className="kicker">Current boundary</div>
        <p className="mt-2">
          The interactive source viewer is connected. PDF paths remain unlabelled line evidence; semantic solids still
          need CAD/IFC objects or explicit manual evidence.
        </p>
        <div className="kicker mt-2.5">On this sheet</div>
        <p className="mt-2">
          {SHEETS[s.sheet].kind === "elev"
            ? "Elevation · building mass + roof prism. No fence pack unless the sheet shows fence."
            : "Plan · rooms as native walls. Trades only appear if you add them."}
        </p>
        {s.trades.length > 0 && (
          <>
            <div className="kicker mt-2.5">Trades on this job</div>
            <ul className="mt-1">
              {s.trades.map((t) => (
                <li key={t.id}>{t.name}</li>
              ))}
            </ul>
          </>
        )}
      </div>
    </aside>
  );
}

function Row({ a, b }: { a: string; b: string }) {
  return (
    <div className="flex justify-between border-b border-line py-1.5 last:border-0">
      <span>{a}</span>
      <b>{b}</b>
    </div>
  );
}

function MarkupList() {
  const s = useStudio();
  if (!s.markups.length) return <p className="text-muted">No markups yet.</p>;
  return (
    <ul className="space-y-1">
      {s.markups.map((m) => (
        <li key={m.id} className="flex justify-between rounded-xl bg-card px-3 py-2">
          <span>
            {m.label} · sheet {m.sheet + 1}
          </span>
          <span>
            {m.value.toFixed(m.kind === "count" ? 0 : 2)} {m.unit}
            <button type="button" className="pill ml-2" onClick={() => s.removeMarkup(m.id)}>
              ×
            </button>
          </span>
        </li>
      ))}
    </ul>
  );
}

function ReviewPane() {
  const s = useStudio();
  const flags: string[] = [];
  if (!s.planName) flags.push("No plan file attached.");
  if (s.markups.length && s.scaleM === 1) flags.push("Scale still at 1 m / unit — confirm against a drawn bar.");
  if (s.trades.length === 0) flags.push("No trades listed. Right rail stays empty on purpose.");
  if (s.markups.filter((m) => m.kind === "area").length === 0) flags.push("No area marks. GFA is not invented.");
  return (
    <>
      <p className="text-muted">Review flags come from missing evidence, never from a language model.</p>
      <ul className="space-y-2">
        {flags.map((f) => (
          <li key={f} className="rounded-2xl bg-card px-4 py-3">
            {f}
          </li>
        ))}
        {flags.length === 0 && <li className="rounded-2xl bg-card px-4 py-3">No flags.</li>}
      </ul>
      <MarkupList />
    </>
  );
}

function CostPane() {
  const s = useStudio();
  const [pushed, setPushed] = useState(false);
  const lengths = s.markups.filter((m) => m.kind === "length" || m.kind === "sketch");
  const areas = s.markups.filter((m) => m.kind === "area");
  const counts = s.markups.filter((m) => m.kind === "count");
  const sum = (arr: typeof s.markups) => arr.reduce((a, m) => a + m.value, 0);

  const staged = buildLoopletQuoteLines(s.markups, s.trades, s.planName, s.sheet);

  function handlePushToCrm() {
    const res = pushToLoopletCrm(staged);
    if (res.success && res.url) {
      if (typeof window !== "undefined") {
        const opened = window.open(res.url, "_blank");
        if (!opened) {
          console.warn("Popup blocked, redirecting in current tab.");
          window.location.href = res.url;
        }
      }
    }
    setPushed(true);
    setTimeout(() => setPushed(false), 4000);
  }

  function handleDownloadQuoteJson() {
    const blob = new Blob([JSON.stringify(staged, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `looplet-quote-${s.planName || "takeoff"}-sheet-${s.sheet + 1}.json`;
    a.click();
  }

  return (
    <>
      <p className="text-muted">
        Bill of quantities is the sum of your marks. Direct push converts your takeoffs into live Looplet CRM Quote Line Items.
      </p>
      <table className="w-full border-collapse">
        <thead>
          <tr className="kicker text-left">
            <th className="py-2">Item</th>
            <th>Qty</th>
            <th>Unit</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-t border-line">
            <td className="py-2">Measured length</td>
            <td>{sum(lengths).toFixed(2)}</td>
            <td>m</td>
            <td>markups</td>
          </tr>
          <tr className="border-t border-line">
            <td className="py-2">Measured area</td>
            <td>{sum(areas).toFixed(2)}</td>
            <td>m²</td>
            <td>markups</td>
          </tr>
          <tr className="border-t border-line">
            <td className="py-2">Counted items</td>
            <td>{sum(counts).toFixed(0)}</td>
            <td>ea</td>
            <td>markups</td>
          </tr>
        </tbody>
      </table>

      {s.trades.map((t) => (
        <p key={t.id} className="mt-2 rounded-xl bg-card px-3 py-2">
          {t.name} — no qty until you mark it
        </p>
      ))}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="pill bg-cyan text-navy font-bold hover:brightness-110 cursor-pointer"
          onClick={handlePushToCrm}
        >
          {pushed ? "✓ Staged for Looplet CRM!" : "Push to Looplet CRM Quote Composer"}
        </button>
        <button
          type="button"
          className="pill cursor-pointer"
          onClick={handleDownloadQuoteJson}
        >
          Download Quote Lines JSON
        </button>
      </div>

      {staged.lines.length > 0 && (
        <div className="mt-3 rounded-xl bg-card p-3 font-mono text-[11px]">
          <div className="flex justify-between text-muted">
            <span>Estimated Subtotal (ex GST):</span>
            <span className="text-paper">${staged.subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-muted">
            <span>GST (10%):</span>
            <span className="text-paper">${staged.tax.toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-bold text-cyan mt-1 pt-1 border-t border-line">
            <span>Estimated Total:</span>
            <span>${staged.total.toFixed(2)} AUD</span>
          </div>
        </div>
      )}
    </>
  );
}

function ProofPane() {
  const s = useStudio();
  function download() {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            product: "xray-by-looplet",
            plan: s.planName,
            sheet: s.sheet + 1,
            scaleM: s.scaleM,
            markups: s.markups,
            trades: s.trades,
            note: "Quantities are only the markups. Nothing else was derived.",
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "xray-evidence.json";
    a.click();
  }
  return (
    <>
      <p className="text-muted">Proof is the evidence pack: plan name, scale, markups, trades. No regenerated numbers.</p>
      <button type="button" className="pill-dark inline-flex items-center gap-2" onClick={download}>
        <Download className="size-4" /> Export evidence JSON
      </button>
      <pre className="mt-3 overflow-auto rounded-2xl bg-navy p-4 text-cyan">
        {JSON.stringify({ plan: s.planName, markups: s.markups.length, trades: s.trades.map((t) => t.name) }, null, 2)}
      </pre>
    </>
  );
}

function Capabilities({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-navy/40 p-6" onClick={onClose}>
      <div className="max-w-lg rounded-2xl bg-paper p-6 text-ink shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-mono text-sm tracking-[0.16em]">CAPABILITIES</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5">
          <li>Open a construction plan (PDF name recorded; vector takeoff is a later engine pass)</li>
          <li>24-sheet job, elevation and plan poses</li>
          <li>3D isometric wireframe — building first, roof second</li>
          <li>Stand 3D / Lay Flat / Plan / Isometric / Fit</li>
          <li>Canvas colour (charcoal navy or paper) and lift-up full canvas</li>
          <li>Measure length, area, count after you set scale</li>
          <li>Manual sketch layer, raised only by presentation height</li>
          <li>Open-ended trades — nothing defaulted</li>
          <li>BOM and proof from markups only. LLM never writes a quantity.</li>
        </ul>
        <p className="mt-3 text-muted">
          Download a static Model page:{" "}
          <a className="underline" href="/xray-model-pipeline.html" download>
            xray-model-pipeline.html
          </a>
        </p>
        <button type="button" className="pill-dark mt-4" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
