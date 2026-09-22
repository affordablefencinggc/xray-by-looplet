import { useState } from 'react';
import { useStudio } from './store';
import { reviewedPrintedScale } from './printedScale';

export function PrintedScaleAction() {
  const s = useStudio();
  const [ratio, setRatio] = useState('');
  const [error, setError] = useState('');
  const source = s.activePlanBinary;
  const reviewed = source ? reviewedPrintedScale(source.sha256, s.sheet) : null;
  if (!source || source.kind !== 'pdf' || (s.currentCalibration.locked && s.currentCalibration.coordinateSpace === 'source-page-v1')) return null;
  function apply() {
    try {
      const state = useStudio.getState();
      const key = `xray:scale-recovery:${state.job.id}:${state.job.revision}:${state.sheet}`;
      localStorage.setItem(key, JSON.stringify({ projectId: state.job.id, revision: state.job.revision, sha256: source!.sha256, calibration: state.currentCalibration }));
      state.applyPrintedSheetScale(reviewed?.denominator ?? Number(ratio), reviewed?.evidence ?? `User selected printed PDF scale 1:${ratio} on sheet ${state.sheet + 1}; original PDF page size assumed.`, state.job.revision, key);
      const failure = useStudio.getState().calibrationError;
      setError(failure || '');
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not preserve the previous scale.'); }
  }
  return <section className="integrity-notice printed-scale-action" aria-label="Use the drawing scale">
    <strong>{reviewed ? `Drawing scale found: 1:${reviewed.denominator}` : 'Use the scale printed on this PDF'}</strong>
    <span>{reviewed ? 'Page 12 survey scale and metres bar checked against this exact source. Apply it here, then click Manual layer or Run to draw.' : 'For an original-size PDF with one scale, enter its printed ratio. For a resized scan or mixed scales, use two points on the scale bar instead.'}</span>
    {!reviewed && <label>Scale 1:<input type="number" min="1" max="100000" value={ratio} onChange={e => setRatio(e.target.value)} aria-label="Printed scale denominator" /></label>}
    <button className="pill" type="button" disabled={!reviewed && !(Number(ratio) >= 1)} onClick={apply}>{reviewed ? `Use drawing scale 1:${reviewed.denominator}` : 'Apply printed scale'}</button>
    {error && <span role="alert">{error}</span>}
  </section>;
}
