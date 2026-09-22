/** Reviewed source metadata, bound to exact bytes and page; never a filename guess. */
export const REDBURN_SCALE_SOURCE = 'b57956f76b5dc893ac2b28a021f3f92e345807e326d6b1f8313e373f9145ad38';
export function reviewedPrintedScale(sha256: string, sheet: number) {
  return sha256.toLowerCase() === REDBURN_SCALE_SOURCE && sheet === 11
    ? { denominator: 250, evidence: 'PDF page 12, Q865#03 Contour & Detail Survey: printed 1:250 at A3 (1190.55 × 841.89 PDF points); checked against the 0–12.5 m scale bar.' }
    : null;
}
export function printedScaleMetresPerPoint(denominator: number) {
  if (!Number.isFinite(denominator) || denominator < 1 || denominator > 100000) throw Error('Enter a printed scale between 1:1 and 1:100000.');
  return denominator * 0.0254 / 72;
}
