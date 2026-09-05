import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, ChevronUp, Download } from "lucide-react";
import { HOUSE, SHEETS } from "./geometry";
import { IsoCanvas, PlanCanvas } from "./IsoCanvas";
import { detectHost, pickAndImportPlan, PlanImportCancelledError } from "./engine";
import { useStudio, type Pane } from "./store";
import { handleStudioKeyDown, shouldIgnoreShortcuts } from "./shortcuts";
import { WorkspaceDiagnostics } from "./WorkspaceDiagnostics.tsx";
import { ProjectPlanSwitcher } from "./ProjectPlanSwitcher";
import { invalidateModelViews } from "./modelViewSnapshot";
import { SourceBuildingViewer } from "./SourceBuildingViewer";
import { RenderStudio } from "./RenderStudio";
import { CalibrationPanel } from "./CalibrationPanel";
import { DocumentPreview } from "./DocumentPreview";
import { PhotoEvidencePanel } from "./PhotoEvidencePanel";
import { SpecificationPanel } from "./SpecificationPanel";
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
  const s = useStudio();
  const activePaneTabRef = useRef<HTMLButtonElement>(null);
  const activeDocument = s.job.documents.find((document) => document.id === s.job.activeDocumentId && document.source !== "sample");
  const pageCount = activeDocument?.pageCount ?? 1;
  useEffect(() => { invalidateModelViews(s.activePlanBinary?.documentId, s.activePlanBinary?.sha256); }, [s.activePlanBinary?.documentId, s.activePlanBinary?.sha256]);

  useEffect(() => {
    void useStudio.getState().hydratePersistence().then(() => {
      if (new URLSearchParams(window.location.search).get("pane") === "model") useStudio.getState().setPane("model");
    });
  }, []);

  useEffect(() => {
    activePaneTabRef.current?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [s.pane]);

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
    <div className="workbench flex h-dvh flex-col bg-bg text-ink" data-hydration-status={s.hydrationStatus} data-skin={s.skin}>
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
          <button type="button" className="pill" aria-pressed={s.capsOpen} onClick={() => s.toggle("capsOpen")}>
            Capabilities
          </button>
          <button
            type="button"
            className="pill"
            aria-pressed={s.skin === "navy"}
            onClick={() => s.setSkin(s.skin === "navy" ? "paper" : "navy")}
          >
            {s.skin === "navy" ? "Cream" : "Charcoal"}
          </button>
          <button type="button" className="pill-dark" onClick={() => void openPlan()} disabled={!s.persistenceHydrated}>
            Open plan
          </button>
        </div>
      </header>

      <div className="studio-modebar flex items-center gap-2 px-3 py-2 font-mono text-[10px] tracking-[0.18em] text-muted">
        {s.pane === "model" && (
          <>MODEL · source-linked architectural reconstruction</>
        )}
        {s.pane === "measure" && <>MEASURE · scale first · then length / area / count</>}
        {s.pane === "sketch" && <>SKETCH · manual traces only · never quantities</>}
        {s.pane === "overview" && <>STUDIO · evidence-first takeoff</>}
        {s.pane === "sheets" && <>SHEETS · {s.activePlanBinary?.name ?? "no verified plan"}</>}
        {s.pane === "components" && <>COMPONENTS · open-ended trades</>}
        {s.pane === "review" && <>REVIEW · flags from missing evidence</>}
        {s.pane === "cost" && <>COST · QUANTITY REGISTER · EVIDENCE BOUND</>}
        {s.pane === "proof" && <>PROOF · export the evidence pack</>}
      </div>

      <div className={`studio-layout grid min-h-0 flex-1 ${s.pane === "model" ? "source-model-layout" : ""} ${s.lifted ? "grid-cols-1" : s.pane === "measure" || s.rightCollapsed ? "grid-cols-[168px_minmax(0,1fr)]" : "grid-cols-[168px_minmax(620px,1fr)_320px]"}`}>
        {!s.lifted && s.pane !== "model" && (
          <aside className="studio-left-rail overflow-auto border-r border-line p-3">
            <h2 className="kicker mb-2">Models</h2>
            <button type="button" className="sheet-btn mb-4" onClick={() => s.setPane("model")}>Source building</button>
            <h2 className="kicker mb-2">
              Project sheets <span className="float-right">{pageCount}</span>
            </h2>
            <div className="mb-2 flex gap-1">
              <button type="button" className="pill" onClick={() => void openPlan()}>
                Open plan
              </button>
              <button type="button" className="pill" onClick={() => s.fit()}>
                Fit sheet
              </button>
            </div>
            {Array.from({ length: pageCount }, (_, index) => (
              <button
                key={index}
                type="button"
                className={`sheet-btn ${s.sheet === index ? "active" : ""}`}
                aria-label={`Open source page ${index + 1}`}
                title={activeDocument?.name ?? "No source plan"}
                onClick={() => s.setSheet(index)}
              >
                {String(index + 1).padStart(2, "0")} {activeDocument ? `Sheet ${index + 1}` : "No source plan"}
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

        {!s.lifted && !s.rightCollapsed && s.pane !== "measure" && s.pane !== "model" && <RightRail />}
      </div>



      {s.capsOpen && <Capabilities onClose={() => s.toggle("capsOpen")} />}
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
  return (
    <>
      <div className="pane-heading-row">
        <div><span className="kicker">Verified source</span><h1>Sheet {s.sheet + 1}</h1></div>
        <span className={`asset-state ${s.assetReadiness.document.state}`}>{s.assetReadiness.document.state}</span>
      </div>
      {s.documentError ? <IntegrityNotice title="Plan source needs attention" message={s.documentError} /> : null}
      {s.activePlanBinary ? (
        <DocumentPreview binary={s.activePlanBinary} pageIndex={s.sheet} className="sheets-document-preview" />
      ) : (
        <section className="source-ingest" aria-labelledby="source-ingest-title">
          <div className="source-ingest-grid" aria-hidden="true">
            <span className="source-ingest-line source-ingest-line-a" />
            <span className="source-ingest-line source-ingest-line-b" />
            <span className="source-ingest-line source-ingest-line-c" />
            <span className="source-ingest-axis">SOURCE / 00</span>
          </div>
          <div className="source-ingest-content">
            <span className="source-ingest-index">01</span>
            <span className="kicker">Source qualification</span>
            <h2 id="source-ingest-title">Bring the drawing into the workbench</h2>
            <p>Open the original PDF, DXF or SVG. X-Ray checks the bytes first, then exposes the sheet for measurement without inventing geometry.</p>
            <button type="button" className="source-ingest-action" onClick={onOpenPlan} disabled={!s.persistenceHydrated}>Open source plan</button>
          </div>
          <ol className="source-ingest-steps" aria-label="Source verification sequence">
            <li><span>01</span><strong>Original bytes</strong><small>Attach locally</small></li>
            <li><span>02</span><strong>Integrity</strong><small>Record SHA-256</small></li>
            <li><span>03</span><strong>Sheets</strong><small>Inspect before measure</small></li>
          </ol>
        </section>
      )}
      <dl className="source-metadata">
        <div><dt>File</dt><dd>{activeDocument?.name ?? "No source imported"}</dd></div>
        <div><dt>Pages</dt><dd>{activeDocument?.pageCount ?? 0}</dd></div>
        <div><dt>SHA-256</dt><dd>{activeDocument?.sha256 ?? "Unavailable"}</dd></div>
      </dl>
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
      {selectedRun ? <SpecificationPanel run={selectedRun} onUpdate={s.updateRunSpecification} /> : (
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
  const s = useStudio();
  const [sourceReady, setSourceReady] = useState(false);
  const calibration = s.currentCalibration;
  const legacyReadOnly = calibration.coordinateSpace !== "source-page-v1" && (calibration.candidates.length > 0 || calibration.locked || s.job.runs.some(run => run.sheet === s.sheet));
  return (
    <>
      <div className="flex gap-2">
        <button type="button" className="pill" disabled={!sourceReady || legacyReadOnly || !calibration.locked} aria-pressed={s.tool === "sketch"} onClick={() => s.setTool("sketch")}>
          Manual layer <kbd className="ml-1 text-[9px] opacity-70 font-mono bg-white/10 px-1 py-0.5 rounded">M</kbd>
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
      <DocumentPreview binary={s.activePlanBinary} pageIndex={s.sheet} className="measure-document-preview" zoom={s.zoom2d} pan={s.pan2d} showSource={s.showSrc} onSourceReady={setSourceReady}>
        {(page) => <PlanCanvas interactive sourceMode="overlay" sourceBounds={page?.bounds ?? null} legacyReadOnly={legacyReadOnly} />}
      </DocumentPreview>
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
        The component list is open-ended. Nothing is preloaded; add only what this job actually evidences.
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
  if (s.pane === "proof") return <ProofRightRail />;
  if (s.pane === "cost") return <CostRightRail />;
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
          {SHEETS[s.sheet].kind === "elev"
            ? "Elevation · local building and roof presentation layers."
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

function CostRightRail() {
  const s = useStudio();
  const snapshot = s.bomState.snapshot;
  const document = s.job.documents.find((entry) => entry.id === s.job.activeDocumentId && entry.source !== "sample");
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
        <div><span className="kicker">Entity decisions</span><h2>Runs and gates</h2></div>
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
          {s.job.runs.length + s.job.gates.length === 0 ? <p>No measured runs or gates are available for review.</p> : null}
        </div>
      </section>
    </div>
  );
}

function CostPane() {
  const s = useStudio();
  const [recipeSet, setRecipeSet] = useState<BomRecipeSet | null>(null);
  const [compileIssues, setCompileIssues] = useState<readonly BomIssue[]>([]);
  const [transportStatus, setTransportStatus] = useState<BomTransportStatus>({ phase: "idle" });
  const [recipePersistenceError, setRecipePersistenceError] = useState<string | null>(null);
  const [reviewer, setReviewer] = useState("");
  const buildToken = useRef(0);
  const buildAbort = useRef<AbortController | null>(null);

  useEffect(() => {
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
  }, [s.job.id]);

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
    setTransportStatus({ phase: "pending", message: "Checking evidence and applying the local versioned fencing rules." });
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
      <BomPanel
        state={s.bomState}
        compileIssues={compileIssues}
        transportStatus={transportStatus}
        recipeAssumptions={recipeAssumptions}
        generationAvailable={bomHost === "tauri"}
        onGenerate={() => void generateBom()}
        onCancel={cancelBom}
        onRetry={() => void generateBom()}
        onAcceptAssumption={(assumptionId) => void acceptAssumption(assumptionId)}
        onReopenAssumption={(assumptionId) => void reopenAssumption(assumptionId)}
        onOpenEvidence={openBomEvidence}
      />
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

function Capabilities({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    dialog?.querySelector<HTMLButtonElement>("button")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        closeRef.current();
      } else if (event.key === "Tab") {
        const controls = Array.from(dialog?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]') ?? []);
        const first = controls[0], last = controls.at(-1);
        if (event.shiftKey && (document.activeElement === first || !dialog?.contains(document.activeElement))) {
          event.preventDefault(); last?.focus();
        } else if (!event.shiftKey && (document.activeElement === last || !dialog?.contains(document.activeElement))) {
          event.preventDefault(); first?.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => { window.removeEventListener("keydown", onKey, true); previousFocus?.focus(); };
  }, []);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-navy/40 p-6" onClick={onClose}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="capabilities-title" className="max-w-lg rounded-2xl bg-paper p-6 text-ink shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 id="capabilities-title" className="font-mono text-sm tracking-[0.16em]">CAPABILITIES</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5">
          <li>Open PDF, DXF and SVG plans and check original source bytes.</li>
          <li>Browse source sheets and inspect job readiness in Overview.</li>
          <li>Inspect the matched source building in Model with Solid / Wireframe, floor, roof and cutaway controls.</li>
          <li>Use the three-post precision scope in Model, Measure and Sketch; wheel inside the circle changes lens magnification.</li>
          <li>Choose model palettes and wire appearance in Visual settings.</li>
          <li>Calibrate source scale, then record runs, areas, markers and manual traces.</li>
          <li>Add trade names from job evidence; nothing is preloaded.</li>
          <li>Review source-linked evidence and export the current proof manifest.</li>
          <li>Render exports a camera and appearance brief; generated images are unavailable.</li>
          <li>Cost shows evidence-gated quantities; pricing is unavailable.</li>
          <li>Saved work stays linked to its source plan; diagnostics are session-only.</li>
        </ul>
        <button type="button" className="pill-dark mt-4" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
