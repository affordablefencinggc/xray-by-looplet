import type { Calibration, CalibrationCandidate, CalibrationInputUnit } from "./calibration";

export type CalibrationPanelProps = {
  /** Human-facing sheet number (normally one-based). */
  sheetNumber: number;
  calibration: Calibration | null;
  captureActive: boolean;
  capturedPoints: number;
  distanceValue: string;
  unit: CalibrationInputUnit;
  onDistanceValueChange: (value: string) => void;
  onUnitChange: (unit: CalibrationInputUnit) => void;
  onStartCapture: () => void;
  onCancelCapture: () => void;
  onSelectCandidate: (candidateId: string) => void;
  onLock: () => void;
  onUnlock: () => void;
  disabled?: boolean;
  compatibilityBlocked?: boolean;
  error?: string | null;
};

export type CalibrationPanelState = "uncalibrated" | "needs-resolution" | "ready" | "locked";

const UNITS: readonly CalibrationInputUnit[] = ["m", "cm", "mm", "ft", "in"];

export function deriveCalibrationPanelState(calibration: Calibration | null): CalibrationPanelState {
  if (calibration?.locked) return "locked";
  if (calibration?.conflict && !calibration.selectedCandidateId) return "needs-resolution";
  if (calibration?.candidates.length && calibration.selectedCandidateId) return "ready";
  return "uncalibrated";
}

export function CalibrationPanel({
  sheetNumber,
  calibration,
  captureActive,
  capturedPoints,
  distanceValue,
  unit,
  onDistanceValueChange,
  onUnitChange,
  onStartCapture,
  onCancelCapture,
  onSelectCandidate,
  onLock,
  onUnlock,
  disabled = false,
  compatibilityBlocked = false,
  error = null,
}: CalibrationPanelProps) {
  const panelState = compatibilityBlocked ? "uncalibrated" : deriveCalibrationPanelState(calibration);
  const selectedCandidateId = calibration?.selectedCandidateId ?? null;
  const candidates = calibration?.candidates ?? [];
  const distance = Number(distanceValue);
  const validDistance = Number.isFinite(distance) && distance > 0;
  const canLock = !disabled && !captureActive && Boolean(selectedCandidateId) && !calibration?.locked;
  const captured = Math.min(2, Math.max(0, Math.floor(capturedPoints)));

  return (
    <section className={`calibration-panel is-${panelState}`} aria-labelledby="calibration-heading" aria-busy={disabled || undefined}>
      <header className="calibration-heading-row">
        <div>
          <span className="eyebrow">Scale · Sheet {sheetNumber}</span>
          <h2 id="calibration-heading">Calibration</h2>
        </div>
        <CalibrationStatus state={panelState} />
      </header>

      <p className="calibration-trust-copy">
        {compatibilityBlocked ? "Legacy coordinates are preserved, but their source alignment is unverified. Export the current manifest in Proof before a reviewed retrace." : panelState === "locked"
          ? "Scale is locked for measurements on this sheet."
          : "Measurements remain untrusted until you choose evidence and lock the scale."}
      </p>

      {error ? <div className="calibration-conflict" role="alert"><strong>Calibration needs attention</strong><span>{error}</span></div> : null}

      {!calibration?.locked ? (
        <div className="calibration-capture" aria-label="Manual two-point calibration">
          <ol className="calibration-guide">
            <li>Find a labelled dimension on this sheet and enter its real distance and unit below.</li>
            <li>Choose Pick two points, then click the two ends of that same dimension on the plan.</li>
            <li>Check the scale evidence below, then Lock scale before measuring. Repeat for each sheet.</li>
          </ol>
          <div className="calibration-distance-row">
            <label className="field calibration-distance-field">
              Known distance
              <input
                type="text"
                inputMode="decimal"
                value={distanceValue}
                onChange={(event) => onDistanceValueChange(event.currentTarget.value)}
                aria-invalid={distanceValue.length > 0 && !validDistance}
                placeholder="e.g. 5.4"
                disabled={disabled || captureActive}
              />
            </label>
            <label className="field calibration-unit-field">
              Unit
              <select value={unit} onChange={(event) => onUnitChange(event.currentTarget.value as CalibrationInputUnit)} disabled={disabled || captureActive}>
                {UNITS.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
          </div>
          {captureActive ? (
            <div className="calibration-capture-active" role="status" aria-live="polite">
              <div>
                <strong>Select two points on the plan</strong>
                <span>{captured} of 2 points captured</span>
              </div>
              <div className="calibration-point-progress" aria-hidden="true">
                {[0, 1].map((point) => <span key={point} className={captured > point ? "complete" : ""} />)}
              </div>
              <button type="button" className="button button-secondary calibration-action" onClick={onCancelCapture} disabled={disabled}>Cancel</button>
            </div>
          ) : (
            <button type="button" className="button button-secondary calibration-action" onClick={onStartCapture} disabled={disabled || !validDistance}>
              Pick two points
            </button>
          )}
          {!validDistance && distanceValue.length > 0 ? <span className="calibration-field-error">Enter a distance greater than zero.</span> : null}
        </div>
      ) : null}

      {calibration?.conflict ? (
        <div className="calibration-conflict" role="alert">
          <strong>{selectedCandidateId ? "Conflict resolution selected" : "Scale evidence conflicts"}</strong>
          <span>
            {selectedCandidateId
              ? `Candidate scales differ by up to ${formatPercent(calibration.conflict.maxRelativeDifference)}. Locking will explicitly resolve the conflict with your selected evidence.`
              : `Candidate scales differ by up to ${formatPercent(calibration.conflict.maxRelativeDifference)}. Select the evidence you trust before locking.`}
          </span>
        </div>
      ) : null}

      {candidates.length ? (
        <fieldset className="calibration-candidates" disabled={disabled}>
          <legend>Scale evidence</legend>
          <div className="calibration-candidate-list">
            {candidates.map((candidate) => (
              <CandidateOption
                key={candidate.id}
                candidate={candidate}
                selected={selectedCandidateId === candidate.id}
                disabled={Boolean(calibration?.locked)}
                onSelect={onSelectCandidate}
              />
            ))}
          </div>
        </fieldset>
      ) : (
        <div className="calibration-empty">
          <strong>No scale evidence yet</strong>
          <span>Enter a known distance, then mark its two endpoints on the plan.</span>
        </div>
      )}

      <footer className="calibration-footer">
        {calibration?.locked ? (
          <>
            <div className="calibration-locked-scale">
              <span>Locked scale</span>
              <strong>1 unit = {formatScale(calibration.metresPerUnit)} m</strong>
            </div>
            <button type="button" className="button button-secondary calibration-action" onClick={onUnlock} disabled={disabled}>Unlock to change</button>
          </>
        ) : (
          <>
            <span className="calibration-lock-hint">
              {selectedCandidateId ? "Selection made. Lock it to trust measurements." : "Choose one evidence source to continue."}
            </span>
            <button type="button" className="button button-primary calibration-action" onClick={onLock} disabled={!canLock}>Lock scale</button>
          </>
        )}
      </footer>
    </section>
  );
}

function CalibrationStatus({ state }: { state: CalibrationPanelState }) {
  const label = state === "needs-resolution" ? "Needs resolution" : state === "ready" ? "Ready to lock" : state === "locked" ? "Locked" : "Uncalibrated";
  return <span className={`calibration-status ${state}`}><span aria-hidden="true" />{label}</span>;
}

function CandidateOption({ candidate, selected, disabled, onSelect }: { candidate: CalibrationCandidate; selected: boolean; disabled: boolean; onSelect: (candidateId: string) => void }) {
  return (
    <label className={`calibration-candidate${selected ? " selected" : ""}`}>
      <input
        type="radio"
        name="calibration-candidate"
        value={candidate.id}
        checked={selected}
        disabled={disabled}
        onChange={() => onSelect(candidate.id)}
      />
      <span className="calibration-candidate-copy">
        <span className="calibration-candidate-title">
          <strong>{candidate.provenance.method}</strong>
          <span className={`calibration-source ${candidate.source}`}>{candidate.source}</span>
        </span>
        <span className="calibration-scale">1 unit = {formatScale(candidate.metresPerUnit)} m</span>
        <span className="calibration-evidence">{candidate.provenance.evidence}</span>
        <span className="calibration-confidence">Confidence {formatPercent(candidate.confidence)}</span>
      </span>
    </label>
  );
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatScale(value: number) {
  return value.toLocaleString(undefined, { maximumSignificantDigits: 5 });
}
