import {ArchitectWorkspace} from './architect/ArchitectWorkspace';
import { WorkspaceRails } from "./WorkspaceRails";
import { SourceComponentsProvider, SourceComponentsList, SourceComponentsInspector, useSourceComponents } from "./SourceComponents";
import { CapabilitiesChecklist } from "./CapabilitiesChecklist";
import { SettingsRail, AccountButton, type SettingsSection } from "./SettingsRail";
import "./workspacePanels.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowUpRight, Check, ChevronDown, ChevronRight, ChevronUp, Download, ExternalLink, FileUp, FolderOpen, RefreshCw, Ruler, ScanLine, Search } from "lucide-react";
import { HOUSE } from "./geometry";
import { IsoCanvas, PlanCanvas } from "./IsoCanvas";
import { detectHost, pickAndImportPlan, PlanImportCancelledError } from "./engine";
import { useStudio, type Pane } from "./store";
import { handleStudioKeyDown, shouldIgnoreShortcuts } from "./shortcuts";
import { WorkspaceDiagnostics } from "./WorkspaceDiagnostics.tsx";
import { ProjectPlanSwitcher } from "./ProjectPlanSwitcher";
import { ProjectBackups } from "./ProjectBackups";
import { ProjectDetails } from "./ProjectDetails";
import { SheetManager } from "./SheetManager";
import { useSheetLifecycle } from "./useSheetLifecycle.ts";
import { PriceBookPanel } from "./pricing/PriceBookPanel";
import { invalidateModelViews } from "./modelViewSnapshot";
import { SourceBuildingViewer } from "./SourceBuildingViewer";
import { SourceTakeoffPanel } from "./SourceTakeoffPanel";
import { ConnectionTrialPanel, OpenConnectionTrial } from "./ConnectionTrialPanel";
import { ProjectMaterialsPanel } from "./ProjectMaterialsPanel";
import { useLiveAssistant } from "./liveAssistantState";
import { CONNECTION_SOURCE } from "./construction/connectionTrial";
import { ALTITUDE_SHA } from "./construction/altitudeTakeoff";
import { RenderStudio } from "./RenderStudio";
import { CalibrationPanel } from "./CalibrationPanel";
import { DocumentPreview } from "./DocumentPreview";
import { SheetBookmarks } from "./SourceSheetBookmarks";
import { PhotoEvidencePanel } from "./PhotoEvidencePanel";
import { SpecificationPanel } from "./SpecificationPanel";
import { constructionRunQuantity } from "./construction/runQuantity";
import { TraceEditorPanel, type TraceEditMode, type TraceMergeEndpoint } from "./TraceEditorPanel";
import { getQuoteReadiness } from "./quoteReadiness";
import type { CalibrationInputUnit } from "./calibration";
import type { GateRecord } from "./domain";
import type { EditableFenceRun, PlacedGate } from "./tracing";
import { BomPanel, type BomEvidenceRef, type BomTransportStatus } from "./BomPanel";
import { compileBomRequest } from "./bomCompiler";
import type { BomIssue, BomRecipeSet } from "./bomContract";
import { acceptRecipeAssumption, createCandidateFencingRecipeSet, reopenRecipeAssumption } from "./fencingRecipes";
import { createTauriBomAdapter } from "./bomTauriAdapter";
import { runBomTransport, sameBomSourceBinding } from "./bomTransport";
import { loadFencingRecipeSet, saveFencingRecipeSet } from "./fencingRecipePersistence";

const PANES: { id: Pane; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "sheets", label: "Sheets" },
  { id: "measure", label: "Measure" },
  { id: "sketch", label: "Sketch" },
  { id: "components", label: "Components" },
  { id: "model", label: "Model" },
  { id: "render", label: "Render" },
  { id: "review", label: "Review" },
  { id: "cost", label: "Cost" },
  { id: "proof", label: "Proof" },
];

export function Studio() {
  const pane = useStudio(s => s.pane);
  return <WorkspaceRails pane={pane}><SourceComponentsProvider><StudioContent /></SourceComponentsProvider></WorkspaceRails>;
}

function StudioContent() {
  const s = useStudio();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<SettingsSection>("Appearance");
  useEffect(() => {
    const inspect = () => setSettingsOpen(false);
    window.addEventListener("xray:inspect-component", inspect);
    return () => window.removeEventListener("xray:inspect-component", inspect);
  }, []);
  const activePaneTabRef = useRef<HTMLButtonElement>(null);
  const activeDocument = s.job.documents.find((document) => document.id === s.job.activeDocumentId && document.source !== "sample");
  const pageCount = activeDocument?.pageCount ?? 1;
  const { value: sheetOrganisation } = useSheetLifecycle(s.job.id, activeDocument);
  const navigationSheets = sheetOrganisation ? sheetOrganisation.pages.filter(page => !page.archived)
    : Array.from({ length: pageCount }, (_, pageIndex) => ({ pageIndex, name: activeDocument ? `Sheet ${pageIndex + 1}` : "No source plan" }));
  const archivedSheetCount = sheetOrganisation?.pages.filter(page => page.archived).length ?? 0;
  const sourceTakeoffActive = s.pane === "components" && (activeDocument?.sha256 === ALTITUDE_SHA || activeDocument?.sha256 === CONNECTION_SOURCE.sha256);
  useEffect(() => { invalidateModelViews(s.activePlanBinary?.documentId, s.activePlanBinary?.sha256); }, [s.activePlanBinary?.documentId, s.activePlanBinary?.sha256]);

  useEffect(() => {
    void useStudio.getState().hydratePersistence().then(() => {
      if (new URLSearchParams(window.location.search).get("pane") === "model") useStudio.getState().setPane("model");
    });
  }, []);

  useEffect(() => {
    const tab = activePaneTabRef.current, nav = tab?.parentElement;
    if (!tab || !nav) return;
    const reveal = () => { nav.scrollLeft = Math.max(0, tab.offsetLeft - nav.offsetLeft - (nav.clientWidth - tab.offsetWidth) / 2); };
    reveal();
    const observer = new ResizeObserver(reveal); observer.observe(nav);
    return () => observer.disconnect();
  }, [s.pane]);

  // Global keyboard shortcuts for tool switching and navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.pointerLockElement || document.querySelector("dialog[open]") || shouldIgnoreShortcuts(document.activeElement)) {
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
      const imported = await pickAndImportPlan();
      await s.importPlan(imported);
    } catch (err) {
      if (err instanceof PlanImportCancelledError) return;
      useStudio.setState({
        documentError: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return (
    <div className="workbench flex h-dvh flex-col bg-bg text-ink" data-hydration-status={s.hydrationStatus} data-skin={s.skin} data-settings-open={settingsOpen}>
      <header className="studio-header flex items-center gap-2.5 border-b border-line bg-header px-3 py-2">
        <div className="studio-brand flex min-w-0 items-center gap-2 font-mono text-[11px] tracking-[0.12em]">
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-navy text-[10px] text-paper">XR</span>
          <span className="truncate font-semibold">X-RAY BY LOOPLET</span>
        </div>
        <ProjectPlanSwitcher onSelect={s.selectDocument} />
        <nav className="studio-pane-nav flex flex-1 justify-center gap-0.5" aria-label="Panes">
          {PANES.map((p) => (
            <button
              key={p.id}
              ref={s.pane === p.id ? activePaneTabRef : undefined}
              type="button"
              className={`pane-tab ${s.pane === p.id ? "active" : ""}`}
              onClick={() => s.setPane(p.id)}
            >
              {p.label}
            </button>
          ))}
        </nav>
        <span className="nav-scroll-instruction sr-only">More workbench modes are available by scrolling horizontally.</span>
        <span className="nav-scroll-cue" aria-hidden="true">More <b>›</b></span>
        <div className="studio-header-actions ml-auto flex items-center gap-2">
          <ProjectBackups />
          <button type="button" className="pill" aria-pressed={settingsOpen} onClick={() => setSettingsOpen(v=>!v)}>Settings</button>
          <AccountButton onClick={()=>{setSettingsSection("Account");setSettingsOpen(true);}} />
        </div>
      </header>

      <div className="studio-modebar flex items-center gap-2 px-3 py-2 font-mono text-[10px] tracking-[0.18em] text-muted">
        {s.pane === "model" && (
          <>MODEL · source-linked architectural reconstruction</>
        )}
        {s.pane === "measure" && <>MEASURE · scale first · then length / area / count</>}
        {s.pane === "sketch" && <>SKETCH · architectural design & source annotations</>}
        {s.pane === "overview" && <>STUDIO · evidence-first takeoff</>}
        {s.pane === "sheets" && <>SHEETS · {s.activePlanBinary?.name ?? "no verified plan"}</>}
        {s.pane === "components" && <>COMPONENTS · Evidence-Backed Hierarchy</>}
        {s.pane === "review" && <>REVIEW · flags from missing evidence</>}
        {s.pane === "cost" && <>COST · QUANTITY REGISTER · EVIDENCE BOUND</>}
        {s.pane === "proof" && <>PROOF · export the evidence pack</>}
      </div>

      <div className={`studio-layout grid min-h-0 flex-1 ${s.pane === "model" ? "source-model-layout" : ""} ${s.lifted ? "grid-cols-1" : s.pane === "measure" || s.rightCollapsed || sourceTakeoffActive ? "grid-cols-[168px_minmax(0,1fr)]" : "grid-cols-[168px_minmax(620px,1fr)_320px]"}`}>
        {!s.lifted && s.pane !== "model" && (
          <aside className="studio-left-rail overflow-auto border-r border-line p-3">
            <h2 className="kicker mb-2">Models</h2>
            <button type="button" className="sheet-btn mb-4" onClick={() => s.setPane("model")}>Source building</button>
            <h2 className="kicker mb-2">
              Project sheets <span className="float-right">{navigationSheets.length}</span>
            </h2>
            <div className="mb-2 flex gap-1">
              <button type="button" className="pill" onClick={() => void openPlan()}>
                Open plan
              </button>
              <button type="button" className="pill" onClick={() => s.fit()}>
                Fit sheet
              </button>
            </div>
            {navigationSheets.map(({ pageIndex: index, name }) => (
              <button
                key={index}
                type="button"
                className={`sheet-btn ${s.sheet === index ? "active" : ""}`}
                aria-label={`Open source page ${index + 1}`}
                title={activeDocument?.name ?? "No source plan"}
                onClick={() => s.setSheet(index)}
              >
                {String(index + 1).padStart(2, "0")} {name}
              </button>
            ))}
            {archivedSheetCount > 0 && <button className="pill" onClick={() => s.setPane("sheets")}>Sheet register · {archivedSheetCount} archived</button>}
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

        <section className={`studio-main flex min-w-0 flex-col gap-2.5 ${s.pane === "model" ? "source-model-main" : ""} ${s.lifted ? "overflow-hidden p-0" : "overflow-auto p-3"}`}>
          <div className="workspace-central-content">
          {!s.persistenceHydrated ? <HydrationState /> : (
            <>
              {s.persistenceError ? <IntegrityNotice title="Saved work needs attention" message={s.persistenceError} /> : null}
              {s.pane === "overview" && <Overview />}
              {s.pane === "sheets" && <SheetsPane onOpenPlan={() => void openPlan()} />}
              {s.pane === "measure" && <MeasurePane />}
              {s.pane === "sketch" && <SketchPane />}
              {s.pane === "components" && <ComponentsPane />}
              {s.pane === "model" && <ModelPane />}
              {s.pane === "render" && <RenderStudio />}
              {s.pane === "review" && <ReviewPane />}
              {s.pane === "cost" && <CostPane />}
              {s.pane === "proof" && <ProofPane />}
            </>
          )}
          </div>
          <WorkspaceDiagnostics />
        </section>

        {!s.lifted && !sourceTakeoffActive && s.pane !== "measure" && s.pane !== "model" && <RightRail />}
        {settingsOpen && <SettingsRail section={settingsSection} setSection={setSettingsSection} onClose={()=>setSettingsOpen(false)} onOpenPlan={()=>void openPlan()} />}
      </div>



      {s.capsOpen && <CapabilitiesChecklist onClose={() => s.toggle("capsOpen")} />}
    </div>
  );
}

function HydrationState() {
  const status = useStudio((state) => state.hydrationStatus);
  return <div className="workbench-loading" role="status"><span className="kicker">Restoring workbench</span><strong>{status === "error" ? "Saved work could not be restored" : "Checking saved evidence and original files"}</strong><p>Editing becomes available after document and photo integrity checks finish.</p></div>;
}

function IntegrityNotice({ title, message }: { title: string; message: string }) {
  return <div className="integrity-notice" role="alert"><AlertTriangle className="size-4" aria-hidden="true" /><div><strong>{title}</strong><span>{message}</span></div></div>;
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
  const source = s.activePlanBinary;
  const document = s.job.documents.find((item) => item.id === s.job.activeDocumentId);
  return (
    <>
      <div className="pane-heading-row">
        <div><span className="kicker">Project overview</span><h1>{source?.name ?? "Start with your source drawing"}</h1></div>
        <span className={`asset-state ${s.assetReadiness.document.state}`}>{s.assetReadiness.document.state}</span>
      </div>
      <p className="max-w-prose text-muted">Inspect the original sheets, establish their scale, then record your measurements and drawing evidence.</p>
      <div className="grid grid-cols-4 gap-2.5">
        <Stat k="Original sheets" v={String(source ? document?.pageCount ?? 1 : 0)} n={source ? "From the attached source" : "No source attached"} />
        <Stat k="Measured runs" v={String(s.job.runs.length)} n="Saved measurement paths" />
        <Stat k="Sketch traces" v={String(s.markups.filter((item) => item.kind === "sketch").length)} n="Saved drawing annotations" />
        <Stat k="Photo evidence" v={String(s.job.photos.length)} n="Attached evidence records" />
      </div>
      <nav className="flex flex-wrap gap-2" aria-label="Project next actions">
        <button type="button" className="pill" onClick={() => s.setPane("sheets")}>{source ? "Inspect source sheets" : "Open source sheets"}</button>
        <button type="button" className="pill" disabled={!source} onClick={() => s.setPane("measure")}>Calibrate and measure</button>
        <button type="button" className="pill" onClick={() => s.setPane("model")}>Model workspace</button>
        <button type="button" className="pill" onClick={() => s.setPane("proof")}>Review evidence</button>
      </nav>
      {s.documentError && <IntegrityNotice title="Source needs attention" message={s.documentError} />}
      <DocumentPreview binary={source} pageIndex={s.sheet} pageCount={document?.pageCount} className="sheets-document-preview" />
    </>
  );
}

function SheetsPane({ onOpenPlan }: { onOpenPlan: () => void }) {
  const s = useStudio();
  const activeDocument = s.job.documents.find((document) => document.id === s.job.activeDocumentId && document.source !== "sample");
  const { value: organisation } = useSheetLifecycle(s.job.id, activeDocument);
  const pageName = organisation?.pages.find(page => page.pageIndex === s.sheet)?.name ?? `Sheet ${s.sheet + 1}`;
  return (
    <>
      <ProjectDetails />
      <SheetManager />
      <div className="pane-heading-row">
        <div><span className="kicker">Source drawings</span><h1>{s.activePlanBinary ? pageName : "Your drawing starts here"}</h1></div>
        {s.activePlanBinary ? <span className={`asset-state ${s.assetReadiness.document.state}`}>{s.assetReadiness.document.state}</span> : null}
      </div>
      {s.documentError ? <IntegrityNotice title="Plan source needs attention" message={s.documentError} /> : null}
      {s.activePlanBinary ? (
        <DocumentPreview binary={s.activePlanBinary} pageIndex={s.sheet} className="sheets-document-preview" />
      ) : (
        <section className="source-ingest" aria-labelledby="source-ingest-title">
          <div className="source-ingest-content">
            <span className="source-ingest-icon"><FileUp aria-hidden="true" /></span>
            <h2 id="source-ingest-title">Open a drawing</h2>
            <p>Choose a plan to view its sheets, set the scale and start measuring.</p>
            <button type="button" className="source-ingest-action" onClick={onOpenPlan} disabled={!s.persistenceHydrated}><FolderOpen size={18} aria-hidden="true" />Choose a file<ArrowUpRight size={16} aria-hidden="true" /></button>
            <span className="source-ingest-formats">PDF, DXF or SVG <span aria-hidden="true">·</span> Up to 100 MB</span>
          </div>
          <ol className="source-ingest-steps" aria-label="From drawing to measurement">
            <li><FolderOpen aria-hidden="true" /><strong>Open your plan</strong><small>Keep the original intact</small></li>
            <li><ScanLine aria-hidden="true" /><strong>Check the sheets</strong><small>Find the detail you need</small></li>
            <li><Ruler aria-hidden="true" /><strong>Set scale & measure</strong><small>Work from known dimensions</small></li>
          </ol>
        </section>
      )}
      {s.activePlanBinary ? <dl className="source-metadata">
        <div><dt>File</dt><dd>{activeDocument?.name ?? "No source imported"}</dd></div>
        <div><dt>Pages</dt><dd>{activeDocument?.pageCount ?? 0}</dd></div>
        <div><dt>SHA-256</dt><dd>{activeDocument?.sha256 ?? "Unavailable"}</dd></div>
      </dl> : null}
    </>
  );
}

function MeasurePane() {
  const s = useStudio();
  const [editMode, setEditMode] = useState<TraceEditMode>("select");
  const [sourceReady,setSourceReady]=useState(false);
  const calibration=s.currentCalibration;
  const legacyReadOnly=calibration.coordinateSpace !== "source-page-v1" && (calibration.candidates.length>0 || calibration.locked || s.job.runs.some(run=>run.sheet===s.sheet) || s.job.gates.some(gate=>gate.sheet===s.sheet));
  const selectedRunRecord = s.selectedRunId ? s.job.runs.find((run) => run.id === s.selectedRunId) ?? null : null;
  const selectedRun = selectedRunRecord ? editableRun(selectedRunRecord) : null;
  return (
    <div className="measure-workspace">
      <div className="measure-main-column">
        <fieldset className="measure-tools" aria-label="Measurement tools" disabled={!sourceReady || legacyReadOnly}>
          <button type="button" className="pill" aria-pressed={s.tool === "length"} onClick={() => s.setTool("length")}>Run <kbd>L</kbd></button>
          <button type="button" className="pill" aria-pressed={s.tool === "area"} onClick={() => s.setTool("area")}>Area <kbd>A</kbd></button>
          <button type="button" className="pill" aria-pressed={s.tool === "count"} onClick={() => s.setTool("count")}>Gate <kbd>C</kbd></button>
          <button type="button" className="pill" aria-pressed={s.snappingEnabled} onClick={s.toggleSnapping}>Snap <kbd>S</kbd></button>
          <span className="measure-tools-spacer" />
          <button type="button" className="pill" onClick={s.commitPending} disabled={s.pending.length < 2}>Finish trace</button>
          <button type="button" className="pill" onClick={() => { s.clearPending(); s.setTool("none"); }}>Cancel</button>
        </fieldset>
        {legacyReadOnly ? <div className="integrity-notice" role="status"><strong>Saved measurements need source-coordinate recovery</strong><span>These older coordinates are preserved read-only. They cannot prove alignment to this source or authorize quantities. Export the current manifest in Proof before a reviewed retrace; automatic conversion is unavailable.</span><button type="button" className="pill" onClick={()=>s.setPane("proof")}>Open Proof for export</button></div> : null}
        {s.calibrationError ? <IntegrityNotice title="Calibration needs attention" message={s.calibrationError} /> : null}
        {s.traceError ? <IntegrityNotice title="Trace needs attention" message={s.traceError} /> : null}
        {s.documentError ? <IntegrityNotice title="Plan source needs attention" message={s.documentError} /> : null}
        <SheetBookmarks />
        <DocumentPreview binary={s.activePlanBinary} pageIndex={s.sheet} className="measure-document-preview" zoom={s.zoom2d} pan={s.pan2d} showSource={s.showSrc} onSourceReady={setSourceReady}>
          {(page)=><PlanCanvas
            interactive
            sourceMode="overlay"
            sourceBounds={page?.bounds ?? null}
            legacyReadOnly={legacyReadOnly}
            calibrationCaptureActive={Boolean(s.calibrationCapture)}
            calibrationPoints={s.calibrationCapture?.points ?? []}
            onCalibrationPoint={s.addCalibrationPoint}
            selectedRunId={s.selectedRunId}
            selectedVertexIndex={s.selectedVertexIndex}
            editMode={editMode}
            onSelectRun={s.selectRun}
            onSelectVertex={s.selectVertex}
            onMoveVertex={s.moveRunVertex}
          />}
        </DocumentPreview>
        <MarkupList />
      </div>
      <fieldset className="measure-inspector-boundary" disabled={!sourceReady || legacyReadOnly}><MeasureInspector selectedRun={selectedRun} sourceReady={sourceReady} legacyReadOnly={legacyReadOnly} editMode={editMode} onEditModeChange={(mode) => { s.setTool("none"); setEditMode(mode); }} /></fieldset>
    </div>
  );
}

function editableRun(run: ReturnType<typeof useStudio.getState>["job"]["runs"][number]): EditableFenceRun {
  return { ...run, revision: run.revision ?? 1, grossLengthM: run.grossLengthM ?? run.lengthM, gateDeductionM: run.gateDeductionM ?? 0, netLengthM: run.netLengthM ?? run.lengthM };
}

function placedGate(gate: GateRecord): PlacedGate {
  return { ...gate, revision: gate.revision ?? 1, segmentIndex: gate.segmentIndex ?? null, segmentT: gate.segmentT ?? null };
}

function MeasureInspector({ selectedRun, sourceReady = false, legacyReadOnly = false, editMode, onEditModeChange }: { selectedRun: EditableFenceRun | null; sourceReady?: boolean; legacyReadOnly?: boolean; editMode: TraceEditMode; onEditModeChange: (mode: TraceEditMode) => void }) {
  const s = useStudio();
  const [distanceValue, setDistanceValue] = useState("");
  const [unit, setUnit] = useState<CalibrationInputUnit>("m");
  const [mergeTargetRunId, setMergeTargetRunId] = useState<string | null>(null);
  const [mergeFirstEndpoint, setMergeFirstEndpoint] = useState<TraceMergeEndpoint>("end");
  const [mergeSecondEndpoint, setMergeSecondEndpoint] = useState<TraceMergeEndpoint>("start");
  const selectedGateRecord = s.selectedGateId ? s.job.gates.find((gate) => gate.id === s.selectedGateId) ?? null : null;
  const selectedGate = selectedGateRecord ? placedGate(selectedGateRecord) : null;
  const sheetRuns = s.job.runs.filter((run) => run.sheet === s.sheet).map(editableRun);
  const sheetGates = s.job.gates.filter((gate) => gate.sheet === s.sheet);

  function createCalibrationCandidate() {
    if (s.calibrationCapture?.points.length !== 2) return;
    s.upsertManualCalibrationCandidate({
      distance: { value: Number(distanceValue), unit },
      coordinateSpace: "source-page-v1",
      provenance: { method: "two-point", evidence: `Sheet ${s.sheet + 1} manual known distance`, documentId: s.job.activeDocumentId },
    });
  }

  useEffect(() => {
    if (s.calibrationCapture?.points.length === 2) createCalibrationCandidate();
  }, [s.calibrationCapture?.points.length]);

  function insertAfterSelected() {
    if (!selectedRun || s.selectedVertexIndex === null) return;
    const segmentIndex = Math.min(s.selectedVertexIndex, selectedRun.points.length - 2);
    const first = selectedRun.points[segmentIndex];
    const second = selectedRun.points[segmentIndex + 1];
    if (!first || !second) return;
    s.insertRunVertex(selectedRun.id, segmentIndex, { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 });
  }

  return (
    <aside className="measure-inspector" aria-label="Measure inspector">
      <CalibrationPanel
        disabled={!sourceReady || legacyReadOnly}
        compatibilityBlocked={legacyReadOnly}
        sheetNumber={s.sheet + 1}
        calibration={s.currentCalibration}
        captureActive={Boolean(s.calibrationCapture)}
        capturedPoints={s.calibrationCapture?.points.length ?? 0}
        distanceValue={distanceValue}
        unit={unit}
        onDistanceValueChange={setDistanceValue}
        onUnitChange={setUnit}
        onStartCapture={s.startCalibrationCapture}
        onCancelCapture={s.cancelCalibrationCapture}
        onSelectCandidate={s.resolveCalibrationCandidate}
        onLock={() => s.lockCurrentCalibration()}
        onUnlock={s.unlockCurrentCalibration}
      />
      {s.tool !== "none" ? <p className="text-xs text-muted" role="status">Drawing tool active; choose an edit mode to leave drawing.</p> : null}
      <TraceEditorPanel
        selectedRun={selectedRun}
        selectedGate={selectedGate}
        selectedVertexIndex={s.selectedVertexIndex}
        editMode={editMode}
        canUndo={s.traceUndoStack.length > 0}
        canRedo={s.traceRedoStack.length > 0}
        mergeRunOptions={sheetRuns}
        mergeTargetRunId={mergeTargetRunId}
        mergeFirstEndpoint={mergeFirstEndpoint}
        mergeSecondEndpoint={mergeSecondEndpoint}
        gateRunOptions={sheetRuns}
        onUndo={s.undoTrace}
        onRedo={s.redoTrace}
        onEditModeChange={onEditModeChange}
        onSelectVertex={(vertexIndex) => selectedRun && s.selectVertex(selectedRun.id, vertexIndex)}
        onInsertAfterSelectedVertex={insertAfterSelected}
        onRemoveSelectedVertex={() => selectedRun && s.selectedVertexIndex !== null && s.removeRunVertex(selectedRun.id, s.selectedVertexIndex)}
        onSplitAtSelectedVertex={() => selectedRun && s.selectedVertexIndex !== null && s.splitRun(selectedRun.id, s.selectedVertexIndex)}
        onMergeTargetRunChange={setMergeTargetRunId}
        onMergeFirstEndpointChange={setMergeFirstEndpoint}
        onMergeSecondEndpointChange={setMergeSecondEndpoint}
        onMergeRuns={() => selectedRun && mergeTargetRunId && s.mergeRuns({ firstRunId: selectedRun.id, firstEndpoint: mergeFirstEndpoint, secondRunId: mergeTargetRunId, secondEndpoint: mergeSecondEndpoint })}
        onGateSpecificationChange={s.updateGateSpecification}
        onGateRunChange={(gateId, _expectedRevision, runId) => {
          const gate = sheetGates.find((entry) => entry.id === gateId);
          if (gate && runId) s.upsertGate({ ...gate, id: gate.id, runId, widthM: gate.widthM ?? 1, point: gate.point });
        }}
        onRemoveGate={(gateId) => s.removeGate(gateId)}
      />
      {editMode === "insert" && s.tool === "none" ? <p className="text-xs text-muted">Select a vertex, then use Insert after to add a midpoint next to it.</p> : null}
      {selectedRun ? <SpecificationPanel run={selectedRun} onUpdate={s.updateRunSpecification} error={s.photoError} quantity={constructionRunQuantity(s.job, selectedRun, s.persistenceHydrated && s.assetReadiness.document.state === "ready")} /> : (
        <section className="inspector-empty"><span className="eyebrow">Run specification</span><strong>Select a run</strong><p>Choose a measured run on the plan to record the construction evidence required for review.</p></section>
      )}
      <section className="measure-photo-summary">
        <span className="eyebrow">Photo evidence</span>
        <strong>{s.job.photos.length} attached</strong>
        <p>{s.photoError ?? "Full captions, links, hashes and ordering are managed in Proof."}</p>
        <button type="button" className="button button-secondary" onClick={() => s.setPane("proof")}>Open Proof</button>
      </section>
    </aside>
  );
}

function SketchPane() {
  const [architect, setArchitect] = useState(false);
  return <><nav className="takeoff-filters" aria-label="Sketch workspaces"><button className="pill" aria-pressed={architect} onClick={()=>setArchitect(true)}>Architectural workspace</button><button className="pill" aria-pressed={!architect} onClick={()=>setArchitect(false)}>Source annotations</button></nav>{architect?<ArchitectWorkspace/>:<SourceSketchPane/>}</>;
}

function SourceSketchPane() {
  const s = useStudio();
  const [sourceReady, setSourceReady] = useState(false);
  const calibration = s.currentCalibration;
  const legacyReadOnly = calibration.coordinateSpace !== "source-page-v1" && (calibration.candidates.length > 0 || calibration.locked || s.job.runs.some(run => run.sheet === s.sheet));
  return (
    <>
      <div className="flex gap-2">
        <button type="button" className="pill" disabled={!sourceReady || legacyReadOnly || !calibration.locked} aria-pressed={s.tool === "sketch"} onClick={() => s.setTool("sketch")}>
          Manual layer
        </button>
        <button type="button" className="pill" disabled={!sourceReady || legacyReadOnly || !calibration.locked} onClick={() => s.commitPending()}>
          Commit trace <kbd className="ml-1 text-[9px] opacity-70 font-mono bg-white/10 px-1 py-0.5 rounded">Enter</kbd>
        </button>
        <button type="button" className="pill" onClick={() => s.clearPending()}>
          Cancel <kbd className="ml-1 text-[9px] opacity-70 font-mono bg-white/10 px-1 py-0.5 rounded">Esc</kbd>
        </button>
      </div>
      <p className="text-muted">Draw source-linked annotation paths on the original plan, then commit the trace.</p>
      {(!calibration.locked || legacyReadOnly) && <div className="integrity-notice" role="status"><strong>Calibrate this source before drawing</strong><span>Sketch points use the original page coordinates and its locked scale.</span><button type="button" className="pill" onClick={() => s.setPane("measure")}>Open Measure to calibrate</button></div>}
      {s.calibrationError && <IntegrityNotice title="Calibration needs attention" message={s.calibrationError} />}
      <SheetBookmarks />
      <DocumentPreview binary={s.activePlanBinary} pageIndex={s.sheet} className="measure-document-preview" zoom={s.zoom2d} pan={s.pan2d} showSource={s.showSrc} onSourceReady={setSourceReady}>
        {(page) => <PlanCanvas interactive sourceMode="overlay" sourceBounds={page?.bounds ?? null} legacyReadOnly={legacyReadOnly} />}
      </DocumentPreview>
      <MarkupList />
    </>
  );
}

function ComponentsPane() {
  const s = useStudio();
  const [projectMaterials, setProjectMaterials] = useState(false);
  const assistantReview = useLiveAssistant(state => state.review);
  useEffect(() => { if (assistantReview) setProjectMaterials(true); }, [assistantReview]);
  const source = useSourceComponents();
  const active = s.job.documents.find(d => d.id === s.job.activeDocumentId);
  const switcher=<nav className="takeoff-filters" aria-label="Component workspaces"><button className="pill" aria-pressed={projectMaterials} onClick={()=>setProjectMaterials(true)}>Project material takeoff</button><button className="pill" aria-pressed={!projectMaterials} onClick={()=>setProjectMaterials(false)}>Components & source trials</button></nav>;
  if(projectMaterials)return <>{switcher}<ProjectMaterialsPanel key={s.job.id}/></>;
  if (active?.sha256 === CONNECTION_SOURCE.sha256) return <>{switcher}<ConnectionTrialPanel key={`${s.job.id}:${active.id}`} /></>;
  if (active?.sha256 === ALTITUDE_SHA) return <>{switcher}<OpenConnectionTrial /><SourceTakeoffPanel key={`${s.job.id}:${active.id}`} /></>;
  if (source.available) return <>{switcher}<OpenConnectionTrial /><SourceComponentsList /></>;
  return <>{switcher}<OpenConnectionTrial /><DemonstrationComponentsPane /></>;
}

function DemonstrationComponentsPane() {
  const s = useStudio();
  const [expandedConnections, setExpandedConnections] = useState<Record<string, boolean>>({
    "conn-c1-01": true,
    "conn-c1-02": true,
  });
  const [tradeInput, setTradeInput] = useState("");

  const inventory = s.componentInventory;
  const typesMap = useMemo(() => new Map(inventory.types.map((t) => [t.id, t])), [inventory.types]);
  const evidenceMap = useMemo(() => new Map(inventory.evidence.map((e) => [e.id, e])), [inventory.evidence]);

  const toggleConnection = (id: string) => {
    setExpandedConnections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const connections = useMemo(
    () => inventory.instances.filter((inst) => inst.parentAssemblyInstanceId === null),
    [inventory.instances],
  );

  const fasteners = useMemo(
    () => inventory.instances.filter((inst) => inst.parentAssemblyInstanceId !== null),
    [inventory.instances],
  );

  const childBoltsByParent = useMemo(() => {
    const map = new Map<string, typeof inventory.instances>();
    for (const inst of inventory.instances) {
      if (inst.parentAssemblyInstanceId) {
        const list = map.get(inst.parentAssemblyInstanceId) ?? [];
        list.push(inst);
        map.set(inst.parentAssemblyInstanceId, list);
      }
    }
    return map;
  }, [inventory.instances]);

  // Total unresolved properties across all inventory instances
  const totalUnresolved = useMemo(() => {
    return inventory.instances.reduce((sum, inst) => sum + inst.unresolvedProperties.length, 0);
  }, [inventory.instances]);

  const unresolvedInstancesCount = useMemo(() => {
    return inventory.instances.filter((inst) => inst.unresolvedProperties.length > 0).length;
  }, [inventory.instances]);

  // Filter logic: hierarchical so fastener filtering retains parent connections with child fasteners
  const filteredConnections = useMemo(() => {
    return connections.filter((conn) => {
      const compType = typesMap.get(conn.typeId);
      const children = childBoltsByParent.get(conn.id) ?? [];

      // Discipline check: matches if parent matches OR any child matches
      if (s.componentFilterDiscipline !== "all") {
        const parentMatches = compType?.discipline === s.componentFilterDiscipline;
        const childMatches = children.some(
          (c) => typesMap.get(c.typeId)?.discipline === s.componentFilterDiscipline,
        );
        if (!parentMatches && !childMatches) return false;
      }

      // Category check: matches if parent matches OR any child matches
      if (s.componentFilterCategory !== "all") {
        const parentMatches = compType?.category === s.componentFilterCategory;
        const childMatches = children.some(
          (c) => typesMap.get(c.typeId)?.category === s.componentFilterCategory,
        );
        if (!parentMatches && !childMatches) return false;
      }

      if (s.componentSearchQuery.trim()) {
        const q = s.componentSearchQuery.toLowerCase().trim();
        const markMatch = conn.displayMark.toLowerCase().includes(q);
        const nameMatch = compType?.standardName.toLowerCase().includes(q) ?? false;
        const gridMatch = conn.spatial.nearestGrid?.toLowerCase().includes(q) ?? false;
        const childMatch = children.some(
          (c) =>
            c.displayMark.toLowerCase().includes(q) ||
            (typesMap.get(c.typeId)?.standardName.toLowerCase().includes(q) ?? false),
        );
        if (!markMatch && !nameMatch && !gridMatch && !childMatch) return false;
      }
      return true;
    });
  }, [connections, typesMap, s.componentFilterDiscipline, s.componentFilterCategory, s.componentSearchQuery, childBoltsByParent]);

  return (
    <div className="components-workspace flex flex-col gap-3">
      {/* Persistence Error Recovery Banner */}
      {s.inventoryPersistenceError && (
        <div className="rounded-2xl border border-amber-500/50 bg-amber-500/15 p-3 text-xs flex flex-wrap items-center justify-between gap-2 text-amber-900 dark:text-amber-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-amber-500 shrink-0" />
            <div>
              <p className="font-semibold">{s.inventoryPersistenceError}</p>
              <p className="text-[11px] text-muted">
                {s.inventoryRecoveryBlocked
                  ? "Saved data is protected. Edits stay in this session until you restore it or explicitly replace it with demo data."
                  : "Your latest edits are still in this session. Retry saving to keep them after reload."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="pill text-xs bg-paper hover:bg-paper/80 font-medium"
              onClick={() => s.inventoryRecoveryBlocked ? s.loadCurrentInventory() : s.saveCurrentInventory()}
            >
              {s.inventoryRecoveryBlocked ? "Retry restore" : "Retry save"}
            </button>
            <button
              type="button"
              className="pill text-xs bg-amber-600 text-white hover:bg-amber-700 font-medium"
              onClick={() => s.resetSampleInventory()}
            >
              Reset to demo data
            </button>
          </div>
        </div>
      )}

      {/* Demonstration Dataset Banner */}
      <div className="rounded-2xl border border-line bg-card p-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-semibold uppercase tracking-wider text-muted">Demonstration Dataset</span>
            <span className="rounded bg-navy/10 px-1.5 py-0.5 text-[10px] font-medium text-ink">AS 4100 / AS 3678</span>
            <span className="rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 text-[10px] font-medium">Multi-View Verified</span>
          </div>
          <p className="mt-1 text-xs text-muted">
            12 Column Baseplates (Grid B) with 4-Bolt Detail Assembly Rule (Detail 4/S-501) &bull; Verified across S-101 (Framing Plan), S-201 (Section B-B), and S-501 (Detail).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="pill text-xs flex items-center gap-1.5" onClick={() => s.resetSampleInventory()}>
            <RefreshCw className="size-3" /> Reset demo data
          </button>
        </div>
      </div>

      {/* KPI Metrics */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <div className="rounded-2xl bg-card p-3">
          <span className="kicker">Total instances</span>
          <b className="mt-1 block text-2xl tracking-tight">{inventory.instances.length}</b>
          <span className="text-[11px] text-muted">spatial entities</span>
        </div>
        <div className="rounded-2xl bg-card p-3">
          <span className="kicker">Baseplate connections</span>
          <b className="mt-1 block text-2xl tracking-tight">{connections.length}</b>
          <span className="text-[11px] text-muted">12 on Grid B</span>
        </div>
        <div className="rounded-2xl bg-card p-3">
          <span className="kicker">Anchor bolts</span>
          <b className="mt-1 block text-2xl tracking-tight">{fasteners.length}</b>
          <span className="text-[11px] text-muted">4x per baseplate (48 total)</span>
        </div>
        <div className="rounded-2xl bg-card p-3">
          <span className="kicker">Linked sheets</span>
          <b className="mt-1 block text-2xl tracking-tight">{inventory.evidence.length}</b>
          <span className="text-[11px] text-muted">S-101, S-201, S-501</span>
        </div>
        <div className={`rounded-2xl p-3 border transition-colors ${
          totalUnresolved > 0 ? "bg-amber-500/10 border-amber-500/30" : "bg-card border-line"
        }`}>
          <span className="kicker">Unresolved RFIs</span>
          <b className={`mt-1 block text-2xl tracking-tight ${totalUnresolved > 0 ? "text-amber-600 dark:text-amber-400" : ""}`}>
            {totalUnresolved}
          </b>
          <span className={`text-[11px] ${totalUnresolved > 0 ? "text-amber-700 dark:text-amber-300 font-medium" : "text-muted"}`}>
            {totalUnresolved === 0 ? "fully parameterized" : `${unresolvedInstancesCount} item${unresolvedInstancesCount > 1 ? "s" : ""} pending`}
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-card px-3 py-2 border border-line">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="kicker mr-1">Discipline:</span>
          {(["all", "structural", "architectural", "mechanical"] as const).map((d) => (
            <button
              key={d}
              type="button"
              className={`pill text-xs capitalize ${s.componentFilterDiscipline === d ? "bg-navy text-on-navy font-semibold" : ""}`}
              onClick={() => s.setComponentFilterDiscipline(d)}
            >
              {d}
            </button>
          ))}
          <span className="kicker mx-1">|</span>
          <span className="kicker mr-1">Category:</span>
          {(["all", "connection", "fastener"] as const).map((c) => (
            <button
              key={c}
              type="button"
              className={`pill text-xs capitalize ${s.componentFilterCategory === c ? "bg-navy text-on-navy font-semibold" : ""}`}
              onClick={() => s.setComponentFilterCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted pointer-events-none" />
            <input
              className="rounded-full border border-line bg-paper pl-8 pr-3 py-1.5 text-xs text-ink placeholder:text-muted focus:outline-none focus:border-cyan"
              placeholder="Search marks, types, grids..."
              value={s.componentSearchQuery}
              onChange={(e) => s.setComponentSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Hierarchical Component Tree */}
      <div className="space-y-2">
        {filteredConnections.length === 0 ? (
          <div className="rounded-2xl bg-card p-6 text-center text-muted">
            No components match the selected discipline or search filter.
          </div>
        ) : (
          filteredConnections.map((conn) => {
            const compType = typesMap.get(conn.typeId);
            const childBolts = childBoltsByParent.get(conn.id) ?? [];
            const appliedRuleIds = new Set(childBolts.flatMap((child) =>
              child.quantityBasis.method === "detail-rule" ? [child.quantityBasis.ruleId] : [],
            ));
            const ruleSummary = inventory.assemblyRules
              .filter((rule) => appliedRuleIds.has(rule.id))
              .flatMap((rule) => rule.childQuotas.map((quota) =>
                `${quota.count}× ${typesMap.get(quota.typeId)?.standardName ?? quota.typeId}`,
              ))
              .join("; ");
            const isAutoExpanded = s.componentFilterCategory === "fastener" || Boolean(s.componentSearchQuery.trim());
            const isExpanded = expandedConnections[conn.id] ?? isAutoExpanded;
            const isSelected = s.selectedComponentId === conn.id;

            const displayedChildBolts = childBolts.filter((c) => {
              const cType = typesMap.get(c.typeId);
              if (s.componentFilterDiscipline !== "all" && cType?.discipline !== s.componentFilterDiscipline) return false;
              if (s.componentFilterCategory !== "all" && cType?.category !== s.componentFilterCategory) return false;
              if (s.componentSearchQuery.trim()) {
                const q = s.componentSearchQuery.toLowerCase().trim();
                const markMatch = c.displayMark.toLowerCase().includes(q);
                const nameMatch = cType?.standardName.toLowerCase().includes(q) ?? false;
                const parentMarkMatch = conn.displayMark.toLowerCase().includes(q);
                if (!markMatch && !nameMatch && !parentMarkMatch) return false;
              }
              return true;
            });

            const connUnresolved = conn.unresolvedProperties.length;
            const childUnresolved = childBolts.reduce((sum, c) => sum + c.unresolvedProperties.length, 0);
            const branchUnresolved = connUnresolved + childUnresolved;

            return (
              <div
                key={conn.id}
                className={`rounded-2xl border transition-colors ${
                  isSelected ? "border-cyan bg-card/80 shadow-plane" : "border-line bg-card"
                }`}
              >
                {/* Connection Row */}
                <div
                  className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between p-3.5 cursor-pointer hover:bg-paper/40 rounded-t-2xl"
                  onClick={() => s.selectComponent(conn.id)}
                >
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className="p-1 text-muted hover:text-ink rounded"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleConnection(conn.id);
                      }}
                      aria-label={isExpanded ? "Collapse bolts" : "Expand bolts"}
                    >
                      {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                    </button>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <b className="font-mono text-sm tracking-tight">{conn.displayMark}</b>
                        <span className="rounded bg-navy/10 dark:bg-white/10 px-2 py-0.5 text-[11px] font-medium">
                          {compType?.standardName ?? "Column Connection"}
                        </span>
                        <span className="text-[11px] font-mono text-muted">
                          Grid {conn.spatial.nearestGrid ?? "B-?"} &bull; EL +12.00m
                        </span>
                        {branchUnresolved > 0 && (
                          <span className="rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 px-2 py-0.5 text-[10px] font-medium flex items-center gap-1">
                            <AlertTriangle className="size-3 text-amber-500" />
                            {branchUnresolved} RFI{branchUnresolved > 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                        <span>{compType?.materialGrade}</span>
                        <span>&bull;</span>
                        <span>{ruleSummary ? `Detail Rule: ${ruleSummary}` : "Direct component count"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {conn.evidenceIds.map((eId) => {
                      const ev = evidenceMap.get(eId);
                      if (!ev) return null;
                      return (
                        <span
                          key={eId}
                          className="rounded-full border border-line bg-paper px-2.5 py-0.5 text-[11px] font-mono text-muted"
                          title={ev.notes}
                        >
                          {ev.viewKind === "plan" ? "S-101 (Plan)" : ev.viewKind === "section" ? "S-201 (Section)" : "Detail"}
                        </span>
                      );
                    })}
                    <span className="rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 px-2.5 py-0.5 text-[11px] font-medium">
                      Verified
                    </span>
                  </div>
                </div>

                {/* Child Bolts (1:N Expansion) */}
                {isExpanded && (displayedChildBolts.length > 0 || (s.componentFilterCategory === "all" && childBolts.length > 0)) && (
                  <div className="border-t border-line/60 bg-paper/30 px-4 py-2.5 rounded-b-2xl">
                    <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted flex items-center justify-between">
                      <span>
                        {s.componentFilterCategory === "fastener"
                          ? `Filtered Fasteners (${displayedChildBolts.length} anchor bolts per Detail 4/S-501)`
                          : `Expanded Assembly Children (${childBolts.length} anchor bolts per Detail 4/S-501)`}
                      </span>
                      <span className="font-mono text-[10px] text-muted">Quantity Basis: DETAIL_RULE (1:N)</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {(displayedChildBolts.length > 0 ? displayedChildBolts : childBolts).map((bolt) => {
                        const boltType = typesMap.get(bolt.typeId);
                        const isBoltSelected = s.selectedComponentId === bolt.id;
                        return (
                          <div
                            key={bolt.id}
                            className={`flex items-center justify-between rounded-xl px-3 py-2 cursor-pointer transition-colors border ${
                              isBoltSelected ? "border-cyan bg-card font-medium" : "border-line/60 bg-card/60 hover:bg-card"
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              s.selectComponent(bolt.id);
                            }}
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold text-ink">{bolt.displayMark}</span>
                              <span className="text-xs text-muted">{boltType?.standardName ?? "M20 Bolt"}</span>
                              {bolt.unresolvedProperties.length > 0 && (
                                <span className="rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 text-[9px] font-medium flex items-center gap-0.5">
                                  <AlertTriangle className="size-2.5" />
                                  {bolt.unresolvedProperties.length} RFI
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="rounded bg-navy/10 dark:bg-white/10 px-2 py-0.5 text-[10px] font-mono text-muted">
                                S-501 (Detail 4)
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Ad-hoc Trades & Specifications (Preserving backward compatibility) */}
      <div className="mt-4 rounded-2xl border border-line bg-card p-4">
        <h3 className="kicker mb-1">Ad-hoc Trade & Assembly Notes</h3>
        <p className="text-muted text-xs mb-3">
          Custom trades from job evidence. Retained for job notes and manual component registries.
        </p>
        <form
          className="flex gap-2 mb-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (tradeInput.trim()) {
              s.addTrade(tradeInput.trim());
              setTradeInput("");
            }
          }}
        >
          <input
            className="flex-1 rounded-full border border-line bg-paper px-3 py-1.5 text-xs"
            placeholder="Add trade or specification note"
            value={tradeInput}
            onChange={(e) => setTradeInput(e.target.value)}
          />
          <button type="submit" className="pill-dark text-xs">
            Add note
          </button>
        </form>
        {s.trades.length > 0 && (
          <ul className="space-y-1.5">
            {s.trades.map((t) => (
              <li key={t.id} className="flex items-center justify-between rounded-xl bg-paper px-3 py-2 text-xs">
                <div>
                  <b>{t.name}</b>
                  <p className="text-muted text-[11px]">{t.note}</p>
                </div>
                <button type="button" className="pill text-xs" onClick={() => s.removeTrade(t.id)}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ModelPane() {
  return <SourceBuildingViewer />;
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
          <span className="text-cbar">Local presentation geometry</span>
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
            Reference lines
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
            <option value={8}>8 Storeys</option>
            <option value={16}>16 Storeys</option>
            <option value={25}>25 Storeys</option>
            <option value={40}>40 Storeys</option>
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
            Presentation controls affect only this local wireframe. They never create quantities or source evidence.
          </p>
          <div className="pointer-events-none absolute top-[86px] left-3.5 z-[2] font-mono text-[10px] uppercase tracking-[0.16em] text-cbar">
            <div>Local presentation geometry</div>
            <div>{s.pose === "standing" ? "3D wireframe · standing" : "Wireframe · laid flat"}</div>
            <div className="pointer-events-auto mt-2 flex gap-3 text-paper">
              <Swatch on={s.showSrc} onClick={() => s.toggle("showSrc")} color="bg-cyan" label="reference lines" />
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
  const source = useSourceComponents();
  if (s.pane === "proof") return <ProofRightRail />;
  if (s.pane === "cost") return <CostRightRail />;
  if (s.pane === "components") return source.available ? <SourceComponentsInspector /> : <ComponentsRightRail />;
  return (
    <aside className="studio-right-rail overflow-auto border-l border-line p-3">
      <div className="mb-2 flex items-start justify-between">
        <h2 className="kicker">Model readiness</h2>
        <button type="button" className="pill" onClick={() => s.toggle("rightCollapsed")}>
          Collapse
        </button>
      </div>
      <p className="text-muted">Track what the current pane can prove.</p>
      <div className="mt-2.5 rounded-[14px] bg-card p-3">
        <Row a="Verified plan bytes" b={s.activePlanBinary ? "Ready" : "Missing"} />
        <Row a="Source verification" b={s.activePlanBinary ? "SHA-256" : "Pending"} />
        <Row a="Semantic graph" b="Not evidenced" />
      </div>
      <div className="mt-2.5 rounded-[14px] bg-card p-3">
        <div className="kicker">Current boundary</div>
        <p className="mt-2">
          The local presentation viewer is available. It does not prove that plan bytes, vector identities, or semantic
          solids are verified; those require the source-integrity and CAD/IFC contracts.
        </p>
        <div className="kicker mt-2.5">On this sheet</div>
        <p className="mt-2">
          {s.activePlanBinary
            ? `Source page ${s.sheet + 1}. Drawing type and material quantities require review of this source.`
            : "Open a source drawing to inspect its pages and evidence."}
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

function ComponentsRightRail() {
  const s = useStudio();
  const inventory = s.componentInventory;
  const typesMap = useMemo(() => new Map(inventory.types.map((t) => [t.id, t])), [inventory.types]);
  const evidenceMap = useMemo(() => new Map(inventory.evidence.map((e) => [e.id, e])), [inventory.evidence]);

  const selected = useMemo(
    () => inventory.instances.find((i) => i.id === s.selectedComponentId) ?? null,
    [inventory.instances, s.selectedComponentId],
  );

  const selectedType = selected ? typesMap.get(selected.typeId) : null;

  return (
    <aside className="studio-right-rail overflow-auto border-l border-line p-3" aria-label="Component inspector">
      <div className="mb-2 flex items-start justify-between">
        <div>
          <span className="kicker">Component Inspector</span>
          <h2 className="text-sm font-semibold">{selected ? selected.displayMark : "No selection"}</h2>
        </div>
        <button type="button" className="pill text-xs" onClick={() => s.toggle("rightCollapsed")}>
          Collapse
        </button>
      </div>

      {!selected ? (
        <div className="rounded-2xl bg-card p-4 text-center text-muted text-xs">
          Select any connection or bolt in the component tree to inspect its engineering properties and multi-view drawing provenance.
        </div>
      ) : (
        <div className="space-y-3 text-xs">
          {/* Status and Identification Card */}
          <div className="rounded-2xl bg-card p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-ink">{selected.displayMark}</span>
              <div className="flex items-center gap-1.5">
                {selected.unresolvedProperties.length > 0 && (
                  <span className="rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 px-2 py-0.5 text-[10px] font-medium flex items-center gap-1">
                    <AlertTriangle className="size-2.5" />
                    {selected.unresolvedProperties.length} RFI
                  </span>
                )}
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${
                  selected.review.status === "verified"
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                    : "bg-amber-500/20 text-amber-700 dark:text-amber-300"
                }`}>
                  {selected.review.status === "stale_revision" ? "Needs re-review" : selected.review.status}
                </span>
              </div>
            </div>
            <Row a="Type Name" b={selectedType?.standardName ?? selected.typeId} />
            <Row a="Category" b={selectedType?.category ?? "Structural"} />
            <Row a="Material" b={selectedType?.materialGrade ?? "Grade 350"} />
            <Row a="Revision" b={`Rev ${selected.revision}`} />
            <Row a="Stable ID" b={selected.stableIdentifier} />
            <Row
              a="RFI Status"
              b={
                selected.unresolvedProperties.length > 0
                  ? `${selected.unresolvedProperties.length} unresolved property requirement${selected.unresolvedProperties.length > 1 ? "s" : ""}`
                  : "Fully parameterized (0 RFIs)"
              }
            />
          </div>

          {/* Unresolved Engineering Properties / RFIs Alert Card */}
          {selected.unresolvedProperties.length > 0 && (
            <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 space-y-2 text-amber-900 dark:text-amber-200">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs flex items-center gap-1.5">
                  <AlertTriangle className="size-3.5 text-amber-500" />
                  Unresolved Properties ({selected.unresolvedProperties.length})
                </span>
                <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-mono font-medium">RFI Required</span>
              </div>
              <p className="text-[11px] text-muted">
                This component has unresolved engineering parameters that require clarification:
              </p>
              <ul className="space-y-1">
                {selected.unresolvedProperties.map((prop) => (
                  <li key={prop} className="flex items-center gap-2 text-xs font-mono bg-paper/70 dark:bg-black/30 rounded-lg px-2.5 py-1.5 border border-amber-500/20">
                    <span className="size-1.5 rounded-full bg-amber-500 shrink-0" />
                    <span className="break-all">{prop}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Spatial Coordinates Card */}
          <div className="rounded-2xl bg-card p-3 space-y-1.5">
            <span className="kicker">Spatial Location</span>
            <Row a="Building" b="Main Hospital Building" />
            <Row a="Storey" b="Level 03 (Storey-Lvl3)" />
            <Row a="Elevation" b={selected.spatial.position ? `+${selected.spatial.position.z.toFixed(2)}m` : "+12.00m"} />
            <Row a="Nearest Grid" b={selected.spatial.nearestGrid ?? "B-Line"} />
            {selected.spatial.position && (
              <Row
                a="Coordinates (X,Y,Z)"
                b={`${selected.spatial.position.x.toFixed(1)}, ${selected.spatial.position.y.toFixed(1)}, ${selected.spatial.position.z.toFixed(1)}`}
              />
            )}
          </div>

          {/* Quantity & Rule Topology */}
          <div className="rounded-2xl bg-card p-3 space-y-1.5">
            <span className="kicker">Quantity Basis</span>
            <Row
              a="Method"
              b={selected.quantityBasis.method === "detail-rule" ? "Detail Assembly Rule (1:N)" : "Direct Drawing Count"}
            />
            {selected.quantityBasis.method === "detail-rule" && (
              <>
                <Row a="Assembly Rule" b={selected.quantityBasis.ruleId} />
                <Row a="Parent Connection" b={selected.parentAssemblyInstanceId ?? "None"} />
              </>
            )}
          </div>

          {/* Multi-View Drawing Evidence */}
          <div className="rounded-2xl bg-card p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="kicker">Drawing Evidence ({selected.evidenceIds.length})</span>
              <span className="text-[10px] text-muted">Multi-view linked</span>
            </div>
            {selected.evidenceIds.map((eId) => {
              const ev = evidenceMap.get(eId);
              if (!ev) return null;
              const targetDoc = s.job.documents.find((d) => d.id === ev.documentId);
              const isCurrentDoc = s.job.activeDocumentId === ev.documentId;
              const hashMatch = !targetDoc?.sha256 || !ev.sha256 || targetDoc.sha256 === ev.sha256;
              const canNavigate = Boolean(targetDoc && hashMatch);

              return (
                <div key={eId} className="rounded-xl border border-line/70 bg-paper/60 p-2.5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-ink">
                      {ev.viewKind === "plan" ? "Sheet S-101 (Framing Plan)" : ev.viewKind === "section" ? "Sheet S-201 (Section B-B)" : "Sheet S-501 (Detail 4)"}
                    </span>
                    <button
                      type="button"
                      disabled={!canNavigate}
                      title={
                        !targetDoc
                          ? `Document '${ev.documentId}' is not imported in this project workspace.`
                          : !hashMatch
                            ? `Document hash mismatch. Expected: ${ev.sha256}`
                            : isCurrentDoc
                              ? `Navigate to page ${ev.pageIndex + 1}`
                              : `Switch to '${targetDoc.name}' and open page ${ev.pageIndex + 1}`
                      }
                      className={`pill text-[11px] flex items-center gap-1 ${
                        canNavigate
                          ? "text-cyan hover:underline cursor-pointer"
                          : "text-muted/60 cursor-not-allowed opacity-60"
                      }`}
                      onClick={async () => {
                        if (!canNavigate) return;
                        if (!isCurrentDoc && targetDoc) {
                          try {
                            await s.selectDocument(ev.documentId);
                          } catch {
                            return;
                          }
                        }
                        s.setSheet(ev.pageIndex);
                        s.setPane("sheets");
                      }}
                    >
                      <ExternalLink className="size-3" />
                      {!targetDoc ? "Doc not imported" : !hashMatch ? "Hash mismatch" : "View in Sheets"}
                    </button>
                  </div>
                  <p className="text-[11px] text-muted">{ev.notes}</p>
                  <div className="text-[10px] font-mono text-muted/80 flex items-center justify-between">
                    <span>Page index: {ev.pageIndex + 1}</span>
                    <span>View: {ev.viewKind}</span>
                  </div>
                  <div className="text-[9px] font-mono text-muted/60 truncate" title={`Document ID: ${ev.documentId}`}>
                    Doc ID: {ev.documentId} {ev.sha256 ? `(${ev.sha256.slice(0, 8)}...)` : ""}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </aside>
  );
}

function CostRightRail() {
  const s = useStudio();
  const snapshot = s.bomState.snapshot;
  const document = s.job.documents.find((entry) => entry.id === s.job.activeDocumentId && entry.source !== "sample");
  const generalRuns = s.job.runs.filter((run) => run.specification.construction && run.specification.constructionEnabled !== false);
  if (!s.job.runs.length) return <aside className="studio-right-rail overflow-auto border-l border-line p-3">
    <h2 className="kicker">Project pricing</h2>
    <p>Import supplier rates, review their units and commercial basis, then apply selected rates to a priced worksheet.</p>
    <p>Enter quantities explicitly. Each worksheet line retains its supplier and price-book revision. Drawing measurements and assembly calculations remain separate until reviewed.</p>
    <div className="rail-register mt-2.5"><Row a="Project" b={s.job.name} /><Row a="Source" b={document?.name ?? "No drawing required for a price book"} /></div>
  </aside>;
  if (generalRuns.length) return <aside className="studio-right-rail overflow-auto border-l border-line p-3">
    <h2 className="kicker">Quantity scope</h2>
    <p>General runs report gross measured geometry. Material assemblies, waste, package dimensions and specified weights require separate inputs.</p>
    <div className="rail-register mt-2.5">
      <Row a="General runs" b={String(generalRuns.length)} />
      <Row a="Approved runs" b={String(generalRuns.filter((run) => run.review.status === "approved").length)} />
      <Row a="Assembly quantities" b="Require reviewed rules" />
    </div>
    <p>{document?.name ?? "Import a source drawing."}</p>
  </aside>;
  return (
    <aside className="studio-right-rail overflow-auto border-l border-line p-3">
      <div className="mb-2 flex items-start justify-between">
        <h2 className="kicker">BOM readiness</h2>
        <button type="button" className="pill" onClick={() => s.toggle("rightCollapsed")}>Collapse</button>
      </div>
      <p className="text-muted">The current quantity result stays bound to its evidence and recipe revisions.</p>
      <div className="rail-register mt-2.5">
        <Row a="Verified plan" b={document?.sha256 ? "SHA-256" : "Missing"} />
        <Row a="Job revision" b={snapshot ? String(snapshot.binding.jobRevision) : String(s.job.revision)} />
        <Row a="Ruleset" b={snapshot ? `${snapshot.binding.ruleset.id}@${snapshot.binding.ruleset.version}` : "Not run"} />
        <Row a="Quantity state" b={snapshot ? (s.bomState.invalidation ? "Stale" : "Current") : "Not built"} />
      </div>
      <div className="rail-register mt-2.5">
        <div className="kicker">Commercial boundary</div>
        <p className="mt-2">This mode proves material quantities and their calculation lineage. It does not apply supplier rates, tax, margins, or send anything externally.</p>
        <div className="kicker mt-2.5">Source</div>
        <p className="mt-2">{document?.name ?? "Import and verify a source plan before preparing quantities."}</p>
      </div>
    </aside>
  );
}

function ProofRightRail() {
  const s = useStudio();
  const document = s.job.documents.find((entry) => entry.id === s.job.activeDocumentId && entry.source !== "sample");
  return (
    <aside className="studio-right-rail proof-right-rail overflow-auto border-l border-line p-3">
      <div className="rail-heading">
        <div><span className="kicker">Proof inspector</span><h2>Asset integrity</h2></div>
        <button type="button" className="technical-button" onClick={() => s.toggle("rightCollapsed")}>Collapse</button>
      </div>
      <dl className="proof-rail-metrics">
        <Row a="Document" b={s.assetReadiness.document.state} />
        <Row a="Plan hash" b={document?.sha256 ? "Recorded" : "Missing"} />
        <Row a="Photos" b={String(s.job.photos.length)} />
        <Row a="Revisions" b={String(s.job.revisionHistory.length)} />
      </dl>
      <section className="proof-rail-section">
        <span className="kicker">Current blockers</span>
        {s.quoteReadiness.blockers.length ? <ol>{s.quoteReadiness.blockers.slice(0, 8).map((blocker, index) => <li key={`${blocker.code}-${blocker.entityId ?? index}`}>{blocker.message}</li>)}</ol> : <p>Canonical job and original asset checks currently pass.</p>}
      </section>
      <section className="proof-rail-section">
        <span className="kicker">Export boundary</span>
        <p>The manifest records current evidence and blockers. It is not a priced quote or external handoff receipt.</p>
      </section>
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
            {(m.kind === "length"
              ? s.job.runs.find((run) => run.id === m.id)?.netLengthM ?? m.value
              : m.value).toFixed(m.kind === "count" ? 0 : 2)} {m.unit}
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
  const [actor, setActor] = useState("");
  const [note, setNote] = useState("");
  const selectedRun = s.selectedRunId ? s.job.runs.find((run) => run.id === s.selectedRunId) ?? null : null;
  const selectedGate = s.selectedGateId ? s.job.gates.find((gate) => gate.id === s.selectedGateId) ?? null : null;
  const canDecide = actor.trim().length > 0;
  return (
    <div className="review-workspace">
      <section className="review-blockers">
        <div className="pane-heading-row"><div><span className="kicker">Canonical readiness</span><h1>{s.quoteReadiness.blockers.length} blockers</h1></div><span className={`asset-state ${s.quoteReadiness.ready ? "ready" : "unverified"}`}>{s.quoteReadiness.ready ? "ready" : "blocked"}</span></div>
        <p>Every issue below comes from the saved job plus runtime verification of the original document and photo bytes.</p>
        <ul>
          {s.quoteReadiness.blockers.map((blocker, index) => (
            <li key={`${blocker.code}-${blocker.entityId ?? index}`}>
              <button type="button" onClick={() => {
                const run = blocker.entityId && s.job.runs.find((entry) => entry.id === blocker.entityId);
                const gate = blocker.entityId && s.job.gates.find((entry) => entry.id === blocker.entityId);
                if (run) { s.selectRun(run.id); s.setSheet(run.sheet); s.setPane("measure"); }
                else if (gate) { s.selectGate(gate.id); s.setSheet(gate.sheet); s.setPane("measure"); }
              }}>
                <span>{blocker.code}</span><strong>{blocker.message}</strong>
              </button>
            </li>
          ))}
          {s.quoteReadiness.blockers.length === 0 ? <li className="review-clear"><Check className="size-4" aria-hidden="true" /> All current evidence checks pass.</li> : null}
        </ul>
      </section>
      <section className="review-decisions">
        <div><span className="kicker">Entity decisions</span><h2>Takeoff runs and openings</h2></div>
        <label className="field"><span>Reviewer</span><input value={actor} onChange={(event) => setActor(event.currentTarget.value)} placeholder="Required for approve or reject" /></label>
        <label className="field"><span>Decision note</span><textarea rows={2} value={note} onChange={(event) => setNote(event.currentTarget.value)} placeholder="Evidence checked, exception or reason" /></label>
        <div className="review-entity-list">
          {[...s.job.runs, ...s.job.gates].map((entity) => {
            const isRun = "specification" in entity;
            const selected = isRun ? selectedRun?.id === entity.id : selectedGate?.id === entity.id;
            return <article key={entity.id} className={selected ? "selected" : ""}>
              <button type="button" className="review-entity-select" onClick={() => isRun ? s.selectRun(entity.id) : s.selectGate(entity.id)}><strong>{entity.label}</strong><span>Rev {entity.revision} · {entity.review.status}</span></button>
              <div><button type="button" disabled={!canDecide} onClick={() => isRun ? s.approveRun(entity.id, entity.revision ?? 1, actor.trim(), note) : s.approveGate(entity.id, entity.revision ?? 1, actor.trim(), note)}>Approve</button><button type="button" disabled={!canDecide} onClick={() => isRun ? s.rejectRun(entity.id, entity.revision ?? 1, actor.trim(), note) : s.rejectGate(entity.id, entity.revision ?? 1, actor.trim(), note)}>Reject</button></div>
            </article>;
          })}
          {s.job.runs.length + s.job.gates.length === 0 ? <p>No measured runs or openings are available for review.</p> : null}
        </div>
      </section>
    </div>
  );
}

function CostPane() {
  const s = useStudio();
  const generalRuns = s.job.runs.filter((run) => run.specification.construction && run.specification.constructionEnabled !== false);
  const hasGeneralRuns = generalRuns.length > 0;
  const hasRecipeRuns = !hasGeneralRuns && s.job.runs.length > 0;
  const [recipeSet, setRecipeSet] = useState<BomRecipeSet | null>(null);
  const [compileIssues, setCompileIssues] = useState<readonly BomIssue[]>([]);
  const [transportStatus, setTransportStatus] = useState<BomTransportStatus>({ phase: "idle" });
  const [recipePersistenceError, setRecipePersistenceError] = useState<string | null>(null);
  const [reviewer, setReviewer] = useState("");
  const buildToken = useRef(0);
  const buildAbort = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!hasRecipeRuns) {
      setRecipeSet(null);
      setRecipePersistenceError(null);
      return;
    }
    let current = true;
    void (async () => {
      const loaded = await loadFencingRecipeSet(s.job.id);
      const value = loaded.ok ? loaded.recipeSet : await createCandidateFencingRecipeSet();
      if (!current) return;
      if (!loaded.ok && loaded.reason !== "not-found") {
        setRecipePersistenceError(`Saved recipe decisions could not be restored (${loaded.reason}).`);
      } else {
        setRecipePersistenceError(null);
      }
      if (!loaded.ok) {
        const saved = await saveFencingRecipeSet(s.job.id, value);
        if (!saved.ok && current) setRecipePersistenceError(`Recipe decisions could not be saved (${saved.reason}).`);
      }
      if (current) {
        setRecipeSet(value);
        useStudio.getState().reconcileBomRecipeSet(value);
      }
    })();
    return () => {
      current = false;
      buildToken.current += 1;
    };
  }, [s.job.id, hasRecipeRuns]);

  const activeRecipes = useMemo(() => {
    if (!recipeSet || s.job.runs.length === 0) return [];
    const ids = new Set(
      s.job.runs.flatMap((run) =>
        recipeSet.recipes
          .filter((recipe) => recipe.system === run.specification.system && recipe.profile === run.specification.profile)
          .map((recipe) => recipe.id),
      ),
    );
    return recipeSet.recipes.filter((recipe) => ids.has(recipe.id));
  }, [recipeSet, s.job.runs]);
  const recipeAssumptions = activeRecipes.length > 0 ? activeRecipes.flatMap((recipe) => recipe.assumptions) : null;
  const bomHost = detectHost();

  async function generateBom() {
    if (!recipeSet) return;
    const token = ++buildToken.current;
    setCompileIssues([]);
    setTransportStatus({ phase: "pending", message: "Checking evidence and applying the local versioned takeoff rules." });
    const compiled = await compileBomRequest({
      job: s.job,
      runtimeAssets: s.assetReadiness,
      hydrationSettled: s.persistenceHydrated,
      recipeSet,
      requestId: crypto.randomUUID(),
    });
    if (token !== buildToken.current) return;
    if (!compiled.ok) {
      setCompileIssues(compiled.issues);
      setTransportStatus({ phase: "idle" });
      return;
    }
    s.beginBomGeneration(compiled.request);
    try {
      let response;
      if (bomHost === "tauri") {
        const source = useStudio.getState().activePlanBinary;
        if (!source || source.sha256 !== compiled.request.document.sha256) {
          throw new Error("The verified source bytes no longer match this BOM request.");
        }
        const { invoke } = await import("@tauri-apps/api/core");
        const controller = new AbortController();
        buildAbort.current = controller;
        const result = await runBomTransport(
          compiled.request,
          createTauriBomAdapter(invoke, source.bytes),
          {
            signal: controller.signal,
            isCurrent: (binding) => {
              const current = useStudio.getState();
              const pendingBinding = current.bomState.pending?.binding;
              return pendingBinding !== undefined &&
                sameBomSourceBinding(pendingBinding, binding) &&
                current.job.id === binding.jobId &&
                current.job.revision === binding.jobRevision &&
                current.activePlanBinary?.sha256 === binding.documentSha256;
            },
          },
        );
        if (!result.ok) throw new Error(result.error.safeMessage);
        response = result.response;
      } else throw new Error("BOM generation requires the X-Ray desktop quantity engine.");
      if (token !== buildToken.current) return;
      s.completeBomGeneration(response);
      setTransportStatus({ phase: "idle" });
    } catch (error) {
      if (token !== buildToken.current) return;
      const message = error instanceof Error ? error.message : "The local quantity build was interrupted.";
      s.failBomGeneration(message);
      setTransportStatus({ phase: "failed", message });
    } finally {
      buildAbort.current = null;
    }
  }

  async function acceptAssumption(assumptionId: string) {
    if (!recipeSet) return;
    const actor = reviewer.trim();
    if (!actor) {
      setTransportStatus({ phase: "failed", message: "Enter the reviewer responsible for accepting this project assumption." });
      return;
    }
    const recipe = activeRecipes.find((entry) => entry.assumptions.some((assumption) => assumption.id === assumptionId));
    if (!recipe) return;
    try {
      const transition = await acceptRecipeAssumption(recipeSet, {
        recipeId: recipe.id,
        assumptionId,
        expectedSetRevision: recipeSet.revision,
        expectedRecipeRevision: recipe.revision,
        actor,
        at: new Date().toISOString(),
      });
      const saved = await saveFencingRecipeSet(s.job.id, transition.recipeSet);
      if (!saved.ok) throw new Error(`Recipe decision could not be saved (${saved.reason}).`);
      setRecipeSet(transition.recipeSet);
      useStudio.getState().reconcileBomRecipeSet(transition.recipeSet);
      setRecipePersistenceError(null);
      setTransportStatus({ phase: "idle" });
    } catch (error) {
      setTransportStatus({ phase: "failed", message: error instanceof Error ? error.message : "The assumption decision could not be recorded." });
    }
  }

  async function reopenAssumption(assumptionId: string) {
    if (!recipeSet) return;
    const actor = reviewer.trim();
    if (!actor) {
      setRecipePersistenceError("Enter the reviewer responsible for reopening this project assumption.");
      return;
    }
    const recipe = activeRecipes.find((entry) => entry.assumptions.some((assumption) => assumption.id === assumptionId));
    if (!recipe) return;
    try {
      const transition = await reopenRecipeAssumption(recipeSet, {
        recipeId: recipe.id,
        assumptionId,
        expectedSetRevision: recipeSet.revision,
        expectedRecipeRevision: recipe.revision,
        actor,
        at: new Date().toISOString(),
      });
      const saved = await saveFencingRecipeSet(s.job.id, transition.recipeSet);
      if (!saved.ok) throw new Error(`Recipe decision could not be saved (${saved.reason}).`);
      setRecipeSet(transition.recipeSet);
      useStudio.getState().reconcileBomRecipeSet(transition.recipeSet);
      setRecipePersistenceError(null);
    } catch (error) {
      setRecipePersistenceError(error instanceof Error ? error.message : "The assumption decision could not be reopened.");
    }
  }

  function cancelBom() {
    buildToken.current += 1;
    buildAbort.current?.abort();
    buildAbort.current = null;
    if (s.bomState.pending) s.failBomGeneration("Quantity build cancelled by the estimator.");
    setTransportStatus({ phase: "idle" });
  }

  function openBomEvidence(reference: BomEvidenceRef) {
    if (reference.kind === "run") {
      s.selectRun(reference.id);
      s.setPane("measure");
    } else if (reference.kind === "gate") {
      s.selectGate(reference.id);
      s.setPane("measure");
    } else if (reference.kind === "photo") {
      s.setPane("proof");
    } else if (reference.kind === "calibration") {
      s.setPane("measure");
    } else if (reference.kind === "document") {
      s.setPane("sheets");
    } else if (reference.kind === "approval") {
      s.setPane("review");
    }
  }

  return (
    <div className="cost-workspace">
      {s.persistenceHydrated && !s.persistenceError ? <PriceBookPanel key={s.job.id} jobId={s.job.id} />
        : <IntegrityNotice title="Project storage needs attention" message={s.persistenceError ?? "Restoring the project before opening its price books."} />}
      {generalRuns.length ? <section className="specification-panel" aria-label="General construction quantities">
        <header className="specification-heading-row"><div><span className="eyebrow">Measured geometry</span><h2>General construction quantities</h2></div></header>
        <p>Gross quantities by run. Openings, overlap and waste are not deducted. Review assembly rules, material specifications and unit conversions before ordering.</p>
        {generalRuns.map((run) => {
          const quantity = constructionRunQuantity(s.job, run, s.persistenceHydrated && s.assetReadiness.document.state === "ready");
          return <div className="specification-group" key={run.id}>
            <strong>{run.label}: {quantity.value === null ? "Quantity unavailable" : `${Number(quantity.value.toPrecision(10))} ${quantity.unit}`}</strong>
            <p>{quantity.reason ?? quantity.formula}</p>
            <p>{run.specification.construction!.trade} · {run.specification.construction!.reference}</p>
            <small>Revision {run.revision} · {run.review.status}</small>
            <button className="button button-secondary" onClick={() => { s.selectRun(run.id); s.setPane("measure"); }}>Edit {run.label}</button>
          </div>;
        })}
      </section> : null}
      {recipePersistenceError ? <IntegrityNotice title="Recipe decisions need attention" message={recipePersistenceError} /> : null}
      {recipeAssumptions?.length ? (
        <div className="cost-controlbar">
          <span className="kicker">Recipe review</span>
          <label className="field cost-reviewer-field">
            <span>Responsible estimator</span>
            <input value={reviewer} onChange={(event) => setReviewer(event.currentTarget.value)} placeholder="Name required to accept or reopen assumptions" />
          </label>
          <span className="cost-control-note">Every accepted input is revisioned and remains visible in the calculation trace.</span>
        </div>
      ) : null}
      {hasRecipeRuns ? <BomPanel
        state={s.bomState}
        compileIssues={compileIssues}
        transportStatus={transportStatus}
        recipeAssumptions={recipeAssumptions}
        generationAvailable={bomHost === "tauri" && generalRuns.length === 0}
        onGenerate={() => void generateBom()}
        onCancel={cancelBom}
        onRetry={() => void generateBom()}
        onAcceptAssumption={(assumptionId) => void acceptAssumption(assumptionId)}
        onReopenAssumption={(assumptionId) => void reopenAssumption(assumptionId)}
        onOpenEvidence={openBomEvidence}
      /> : null}
    </div>
  );
}

function ProofPane() {
  const s = useStudio();
  const activeDocument = s.job.documents.find((document) => document.id === s.job.activeDocumentId && document.source !== "sample");
  function download() {
    const current = useStudio.getState();
    const readiness = getQuoteReadiness(current.job, current.assetReadiness, current.persistenceHydrated);
    const blob = new Blob(
      [
        JSON.stringify(
          {
            schema: "xray-evidence-manifest/v1",
            product: "xray-by-looplet",
            exportedAt: new Date().toISOString(),
            job: current.job,
            assetReadiness: current.assetReadiness,
            readiness,
            note: "This manifest records canonical evidence and current blockers. It is not a priced quote.",
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
    <div className="proof-workspace">
      <div className="proof-heading pane-heading-row"><div><span className="kicker">Revisioned evidence</span><h1>Proof manifest</h1><p>Original availability, SHA-256 metadata, links and revision history stay visible with every export.</p></div><button type="button" className="pill-dark inline-flex items-center gap-2" onClick={download}><Download className="size-4" /> Export current manifest</button></div>
      <details className="proof-revisions">
        <summary>Professional A–Z delivery checklist · 364 requirements across 68 industry profiles</summary>
        <iframe title="Professional A to Z requirements and proof" src="/industry-coverage/index.html" loading="lazy" style={{ width: "100%", height: "75vh", border: "1px solid var(--border, #ccd4c8)", marginTop: 12 }} />
      </details>
      <div className="proof-artifact-grid">
        <section className="proof-source-artifact">
          <span className="kicker">Source artifact</span>
          <strong>{activeDocument?.name ?? "No verified plan attached"}</strong>
          <dl><Row a="Original bytes" b={s.assetReadiness.document.state} /><Row a="Pages" b={String(activeDocument?.pageCount ?? 0)} /><Row a="SHA-256" b={activeDocument?.sha256 ? `${activeDocument.sha256.slice(0, 16)}…` : "Unavailable"} /></dl>
        </section>
        <section className="proof-summary">
          <Row a="Job revision" b={String(s.job.revision)} />
          <Row a="Photo originals" b={`${Object.values(s.assetReadiness.photos).filter((entry) => entry.state === "ready").length} / ${s.job.photos.length} ready`} />
          <Row a="Measured runs" b={String(s.job.runs.length)} />
          <Row a="Readiness blockers" b={String(s.quoteReadiness.blockers.length)} />
        </section>
      </div>
      <PhotoEvidencePanel photos={s.job.photos} photoPreviewUrls={s.photoPreviewUrls} runs={s.job.runs} gates={s.job.gates} error={s.photoError} onAddPhotos={s.addPhotos} onUpdatePhoto={s.updatePhotoEvidence} onReorderPhoto={s.reorderPhoto} onRemovePhoto={s.removePhoto} />
      <details className="proof-revisions"><summary>Revision history <span>{s.job.revisionHistory.length}</span></summary><ol>{[...s.job.revisionHistory].reverse().map((event) => <li key={event.id}><span>#{event.sequence}</span><strong>{event.summary}</strong><time>{new Date(event.occurredAt).toLocaleString()}</time></li>)}</ol></details>
    </div>
  );
}
