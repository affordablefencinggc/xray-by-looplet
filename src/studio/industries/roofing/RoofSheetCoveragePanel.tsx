import { useId } from "react";
import { calculateSheetCoverage, type SheetCoverageForm } from "./sheetCoverage.ts";
import { roofFormError } from "./roofForm.ts";
import type { IndustryDraftPanelProps } from "../draftPanel.ts";

export function RoofSheetCoveragePanel({ value, onChange, disabled }: IndustryDraftPanelProps<SheetCoverageForm>) {
  const prefix = useId();
  let result: ReturnType<typeof calculateSheetCoverage> | null = null;
  let error: string | null = null;
  if (value.calculated) { try { result = calculateSheetCoverage(value); } catch (cause) { error = roofFormError(cause); } }
  const fields = [
    ["developedWidthM", "Developed roof width across sheets (m)"],
    ["developedRunM", "Developed roof run along sheets (m)"],
    ["effectiveCoverM", "Effective sheet cover after side lap (m)"],
    ["orderLengthM", "Ordered length of each sheet (m)"],
    ["endLapM", "End lap between courses (m; enter 0 if none)"],
    ["measurementReference", "Roof dimension reference"],
    ["supplierReference", "Sheet and lap supplier / specification reference"],
  ] as const;
  return <details className="industry-sheet-coverage">
    <summary>Roof sheet coverage</summary>
    <p className="industry-note">For one rectangular roof surface. Enter developed dimensions along the surface, including any overhangs you want covered. Effective cover already includes side lap; end lap applies between courses. All sheets use the same ordered length.</p>
    <fieldset disabled={disabled}>
      <legend>Explicit sheet coverage inputs</legend>
      <div className="industry-fields">{fields.map(([key, label], index) => <label key={key} htmlFor={`${prefix}-${key}`}>{label}
        <input id={`${prefix}-${key}`} type="text" inputMode={index < 5 ? "decimal" : undefined} maxLength={index < 5 ? 80 : 1000}
          value={value[key]} onChange={event => onChange({ ...value, [key]: event.target.value, calculated: false })} />
      </label>)}</div>
      <button type="button" onClick={() => onChange({ ...value, calculated: true })}>Calculate draft sheet coverage</button>
    </fieldset>
    {error && <p className="industry-error" role="alert">{error}</p>}
    {result && <section className="industry-result" aria-label="Draft roof sheet coverage result" aria-live="polite">
      <p><strong>{result.sheets} sheets · {result.columns} columns × {result.courses} courses</strong></p>
      <dl>
        <dt>Total ordered sheet length</dt><dd>{result.orderedLinearM} m</dd>
        <dt>Covered width × run</dt><dd>{result.coveredWidthM} m × {result.coveredRunM} m</dd>
        <dt>Excess width / run</dt><dd>{result.excessWidthM} m / {result.excessRunM} m</dd>
        <dt>Dimension reference</dt><dd>{result.measurementReference}</dd>
        <dt>Sheet and lap reference</dt><dd>{result.supplierReference}</dd>
      </dl>
      <p className="industry-note">Draft only; not eligible for verified quotes. Excess dimensions are coverage beyond the rectangle, not a reusable offcut schedule. Openings, hips, valleys, cuts, fixings and product suitability are not calculated. This result does not change roof areas or measured quantities.</p>
    </section>}
  </details>;
}
