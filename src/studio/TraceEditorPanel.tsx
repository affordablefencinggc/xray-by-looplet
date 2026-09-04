import type { GateRecord, GateSpecification } from "./domain";
import type { EditableFenceRun, PlacedGate } from "./tracing";

export type TraceEditMode = "select" | "move" | "insert";
export type TraceMergeEndpoint = "start" | "end";
export type TraceRunOption = Pick<EditableFenceRun, "id" | "label" | "revision">;

export type TraceEditorPanelProps = {
  selectedRun: EditableFenceRun | null;
  selectedGate: PlacedGate | null;
  selectedVertexIndex: number | null;
  editMode: TraceEditMode;
  canUndo: boolean;
  canRedo: boolean;
  mergeRunOptions: readonly TraceRunOption[];
  mergeTargetRunId: string | null;
  mergeFirstEndpoint: TraceMergeEndpoint;
  mergeSecondEndpoint: TraceMergeEndpoint;
  gateRunOptions: readonly TraceRunOption[];
  onUndo: () => void;
  onRedo: () => void;
  onEditModeChange: (mode: TraceEditMode) => void;
  onSelectVertex: (vertexIndex: number) => void;
  onInsertAfterSelectedVertex: () => void;
  onRemoveSelectedVertex: () => void;
  onSplitAtSelectedVertex: () => void;
  onMergeTargetRunChange: (runId: string | null) => void;
  onMergeFirstEndpointChange: (endpoint: TraceMergeEndpoint) => void;
  onMergeSecondEndpointChange: (endpoint: TraceMergeEndpoint) => void;
  onMergeRuns: () => void;
  onGateSpecificationChange: (gateId: string, expectedRevision: number, patch: Partial<GateSpecification>) => void;
  onGateRunChange: (gateId: string, expectedRevision: number, runId: string | null) => void;
  onRemoveGate: (gateId: string, expectedRevision: number) => void;
  error?: string | null;
};

const GATE_TYPES: readonly { value: GateRecord["type"]; label: string }[] = [
  { value: "unselected", label: "Select type" },
  { value: "single", label: "Single" },
  { value: "double", label: "Double" },
  { value: "sliding", label: "Sliding" },
  { value: "pedestrian", label: "Pedestrian" },
  { value: "custom", label: "Custom" },
];

export function canSplitRunAt(run: EditableFenceRun | null, vertexIndex: number | null) {
  return Boolean(run && vertexIndex !== null && vertexIndex > 0 && vertexIndex < run.points.length - 1);
}

export function canRemoveRunVertex(run: EditableFenceRun | null, vertexIndex: number | null) {
  return Boolean(run && vertexIndex !== null && vertexIndex >= 0 && vertexIndex < run.points.length && run.points.length > 2);
}

export function TraceEditorPanel(props: TraceEditorPanelProps) {
  const {
    selectedRun,
    selectedGate,
    selectedVertexIndex,
    editMode,
    canUndo,
    canRedo,
    mergeRunOptions,
    mergeTargetRunId,
    mergeFirstEndpoint,
    mergeSecondEndpoint,
    gateRunOptions,
    onUndo,
    onRedo,
    onEditModeChange,
    onSelectVertex,
    onInsertAfterSelectedVertex,
    onRemoveSelectedVertex,
    onSplitAtSelectedVertex,
    onMergeTargetRunChange,
    onMergeFirstEndpointChange,
    onMergeSecondEndpointChange,
    onMergeRuns,
    onGateSpecificationChange,
    onGateRunChange,
    onRemoveGate,
    error = null,
  } = props;
  const canSplit = canSplitRunAt(selectedRun, selectedVertexIndex);
  const canRemove = canRemoveRunVertex(selectedRun, selectedVertexIndex);

  return (
    <aside className="trace-editor-panel" aria-labelledby="trace-editor-heading">
      <header className="trace-editor-heading-row">
        <div>
          <span className="eyebrow">Geometry editor</span>
          <h2 id="trace-editor-heading">Trace details</h2>
        </div>
        <div className="trace-history-actions" aria-label="Edit history">
          <button type="button" onClick={onUndo} disabled={!canUndo} aria-label="Undo last trace edit">Undo</button>
          <button type="button" onClick={onRedo} disabled={!canRedo} aria-label="Redo trace edit">Redo</button>
        </div>
      </header>

      {error ? <div className="trace-editor-error" role="alert"><strong>Trace edit needs attention</strong><span>{error}</span></div> : null}

      {!selectedRun && !selectedGate ? (
        <div className="trace-editor-empty" role="status">
          <strong>Select a run or gate</strong>
          <span>Choose geometry on the plan to inspect and edit it.</span>
        </div>
      ) : null}

      {selectedRun ? (
        <section className="trace-editor-section" aria-labelledby="selected-run-heading">
          <div className="trace-editor-section-heading">
            <div><span>Selected run</span><h3 id="selected-run-heading">{selectedRun.label}</h3></div>
            <span className="trace-revision">Revision {selectedRun.revision}</span>
          </div>

          <dl className="trace-length-summary">
            <div><dt>Gross</dt><dd>{formatMetres(selectedRun.grossLengthM)}</dd></div>
            <div><dt>Gate deduction</dt><dd>−{formatMetres(selectedRun.gateDeductionM)}</dd></div>
            <div className="net"><dt>Net run</dt><dd>{formatMetres(selectedRun.netLengthM)}</dd></div>
          </dl>

          <fieldset className="trace-edit-modes">
            <legend>Edit mode</legend>
            <div>
              {(["select", "move", "insert"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={editMode === mode ? "active" : ""}
                  aria-pressed={editMode === mode}
                  onClick={() => onEditModeChange(mode)}
                >
                  {mode === "select" ? "Select" : mode === "move" ? "Move vertex" : "Insert vertex"}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="trace-vertex-editor">
            <label className="field">
              Vertex
              <select value={selectedVertexIndex ?? ""} onChange={(event) => onSelectVertex(Number(event.currentTarget.value))}>
                <option value="" disabled>Select a vertex</option>
                {selectedRun.points.map((_, index) => (
                  <option key={index} value={index}>Vertex {index + 1}{index === 0 ? " · start" : index === selectedRun.points.length - 1 ? " · end" : ""}</option>
                ))}
              </select>
            </label>
            <div className="trace-vertex-actions">
              <button type="button" className="button button-secondary" onClick={onInsertAfterSelectedVertex} disabled={selectedVertexIndex === null}>Insert after</button>
              <button type="button" className="button button-secondary" onClick={onRemoveSelectedVertex} disabled={!canRemove}>Remove vertex</button>
              <button type="button" className="button button-secondary" onClick={onSplitAtSelectedVertex} disabled={!canSplit}>Split here</button>
            </div>
            <small>{selectedVertexIndex === null ? "Select a vertex to edit." : canSplit ? "This internal vertex can split the run." : "Splits require an internal vertex."}</small>
          </div>

          <fieldset className="trace-merge-editor">
            <legend>Merge runs</legend>
            <p>Merge is always manual. Select a second run and the two endpoints that already meet.</p>
            <label className="field">
              Second run
              <select value={mergeTargetRunId ?? ""} onChange={(event) => onMergeTargetRunChange(event.currentTarget.value || null)}>
                <option value="">Select a run</option>
                {mergeRunOptions.filter((run) => run.id !== selectedRun.id).map((run) => <option key={run.id} value={run.id}>{run.label} · rev {run.revision}</option>)}
              </select>
            </label>
            <div className="trace-endpoint-grid">
              <EndpointSelect label={`${selectedRun.label} endpoint`} value={mergeFirstEndpoint} onChange={onMergeFirstEndpointChange} />
              <EndpointSelect label="Second run endpoint" value={mergeSecondEndpoint} onChange={onMergeSecondEndpointChange} />
            </div>
            <button type="button" className="button button-secondary trace-merge-action" onClick={onMergeRuns} disabled={!mergeTargetRunId}>Merge selected endpoints</button>
          </fieldset>
        </section>
      ) : null}

      {selectedGate ? (
        <section className="trace-editor-section gate-editor" aria-labelledby="selected-gate-heading">
          <div className="trace-editor-section-heading">
            <div><span>Selected gate</span><h3 id="selected-gate-heading">{selectedGate.label}</h3></div>
            <span className="trace-revision">Revision {selectedGate.revision}</span>
          </div>
          <div className="trace-gate-grid">
            <label className="field">
              Gate type
              <select value={selectedGate.type} onChange={(event) => onGateSpecificationChange(selectedGate.id, selectedGate.revision, { type: event.currentTarget.value as GateRecord["type"] })}>
                {GATE_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
              </select>
            </label>
            <label className="field">
              Clear width (m)
              <input
                type="number"
                inputMode="decimal"
                min="0.01"
                max="30"
                step="0.01"
                value={selectedGate.widthM ?? ""}
                onChange={(event) => onGateSpecificationChange(selectedGate.id, selectedGate.revision, { widthM: numberOrNull(event.currentTarget.value) })}
                placeholder="Not set"
              />
            </label>
            <label className="field field-wide">
              Associated run
              <select value={selectedGate.runId ?? ""} onChange={(event) => onGateRunChange(selectedGate.id, selectedGate.revision, event.currentTarget.value || null)}>
                <option value="" disabled>Select a run</option>
                {gateRunOptions.map((run) => <option key={run.id} value={run.id}>{run.label} · rev {run.revision}</option>)}
              </select>
            </label>
          </div>
          {selectedGate.type === "custom" ? <GateTextField label="Custom gate type" value={selectedGate.customType} onChange={(customType) => onGateSpecificationChange(selectedGate.id, selectedGate.revision, { customType })} /> : null}
          <div className="trace-gate-grid">
            <GateNumberField label="Gate height (m)" value={selectedGate.heightM} max={10} onChange={(heightM) => onGateSpecificationChange(selectedGate.id, selectedGate.revision, { heightM })} />
            <GateNumberField label="Ground clearance (m)" value={selectedGate.clearanceM} min={0} max={5} onChange={(clearanceM) => onGateSpecificationChange(selectedGate.id, selectedGate.revision, { clearanceM })} />
            <GateSelectField label="Opening direction" value={selectedGate.openingDirection} options={[["unselected", "Select direction"], ["inward", "Inward"], ["outward", "Outward"], ["sliding-left", "Sliding left"], ["sliding-right", "Sliding right"], ["reversible", "Reversible"], ["not-applicable", "Not applicable"]]} onChange={(openingDirection) => onGateSpecificationChange(selectedGate.id, selectedGate.revision, { openingDirection: openingDirection as GateSpecification["openingDirection"] })} />
            <GateSelectField label="Hinge side" value={selectedGate.hingeSide} options={[["unselected", "Select hinge"], ["left", "Left"], ["right", "Right"], ["double", "Double"], ["not-applicable", "Not applicable"]]} onChange={(hingeSide) => onGateSpecificationChange(selectedGate.id, selectedGate.revision, { hingeSide: hingeSide as GateSpecification["hingeSide"] })} />
            <GateTextField label="Hardware" value={selectedGate.hardware} onChange={(hardware) => onGateSpecificationChange(selectedGate.id, selectedGate.revision, { hardware })} />
            <GateTextField label="Latch" value={selectedGate.latch} onChange={(latch) => onGateSpecificationChange(selectedGate.id, selectedGate.revision, { latch })} />
            <GateTextField label="Gate post size" value={selectedGate.postSize} onChange={(postSize) => onGateSpecificationChange(selectedGate.id, selectedGate.revision, { postSize })} />
            <GateTextField label="Finish" value={selectedGate.finish} onChange={(finish) => onGateSpecificationChange(selectedGate.id, selectedGate.revision, { finish })} />
          </div>
          <label className="check-row"><input type="checkbox" checked={selectedGate.motorised} onChange={(event) => onGateSpecificationChange(selectedGate.id, selectedGate.revision, { motorised: event.currentTarget.checked })} /><span><strong>Motorised gate</strong><small>Include motor and electrical allowance</small></span></label>
          <label className="field"><span>Gate notes</span><textarea rows={2} value={selectedGate.notes} onChange={(event) => onGateSpecificationChange(selectedGate.id, selectedGate.revision, { notes: event.currentTarget.value })} placeholder="Opening, hardware or installation notes" /></label>
          <p className="trace-gate-impact">Changing gate width or association recalculates the affected run’s net length.</p>
          <button type="button" className="trace-remove-gate" onClick={() => onRemoveGate(selectedGate.id, selectedGate.revision)}>Remove gate</button>
        </section>
      ) : null}
    </aside>
  );
}

function EndpointSelect({ label, value, onChange }: { label: string; value: TraceMergeEndpoint; onChange: (endpoint: TraceMergeEndpoint) => void }) {
  return (
    <label className="field">
      {label}
      <select value={value} onChange={(event) => onChange(event.currentTarget.value as TraceMergeEndpoint)}>
        <option value="start">Start</option>
        <option value="end">End</option>
      </select>
    </label>
  );
}

function formatMetres(value: number) {
  return `${value.toFixed(2)} m`;
}

function GateTextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="field"><span>{label}</span><input value={value} onChange={(event) => onChange(event.currentTarget.value)} /></label>;
}

function GateNumberField({ label, value, min = 0.01, max, onChange }: { label: string; value: number | null; min?: number; max: number; onChange: (value: number | null) => void }) {
  return <label className="field"><span>{label}</span><input type="number" inputMode="decimal" min={min} max={max} step="0.01" value={value ?? ""} onChange={(event) => onChange(numberOrNull(event.currentTarget.value))} /></label>;
}

function GateSelectField({ label, value, options, onChange }: { label: string; value: string; options: readonly (readonly [string, string])[]; onChange: (value: string) => void }) {
  return <label className="field"><span>{label}</span><select value={value} onChange={(event) => onChange(event.currentTarget.value)}>{options.map(([option, text]) => <option key={option} value={option}>{text}</option>)}</select></label>;
}

function numberOrNull(value: string) {
  return value === "" ? null : Number(value);
}
