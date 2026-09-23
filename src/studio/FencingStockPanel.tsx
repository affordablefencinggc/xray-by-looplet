import { useState } from "react";
import type { BomBuildRequest } from "./bomContract.ts";
import { fencingStockCandidates, fencingStockCsv, type FencingStockPlan } from "./fencingStock.ts";
import { fencingStockRuleSchema, type FencingStockRule } from "./fencingStockContract.ts";
import type { BomPricingSource } from "./pricing/bomPricing.ts";
import { priceBookError } from "./pricing/priceBooks.ts";

export function FencingStockPanel({ request, source, rules, plan, error, disabled, onSave }: {
  request: BomBuildRequest | null; source: BomPricingSource & { current: boolean }; rules: readonly FencingStockRule[];
  plan: FencingStockPlan | null; error: string; disabled: boolean; onSave: (rules: FencingStockRule[]) => Promise<void>;
}) {
  const candidates = request ? fencingStockCandidates(request, source) : [];
  const [selected, setSelected] = useState("");
  const [notice, setNotice] = useState("");
  const candidate = candidates.find(c => `${c.recipe.id}:${c.component.id}` === selected) ?? candidates[0];
  const saved = candidate ? rules.find(r => r.recipeId === candidate.recipe.id && r.componentId === candidate.component.id) : undefined;
  function download() {
    if (!plan) return;
    const url = URL.createObjectURL(new Blob([fencingStockCsv(plan)], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `fencing-cuts-register-${plan.commitRevision}.csv`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <details className="price-review" aria-label="Fencing stock cutting">
    <summary>Fencing stock lengths and cutting plan</summary>
    <p>Enter supplier stock lengths and finished cuts. Rails use bay spacing plus your joint/post adjustment. Post lengths include embedment and top allowance. Each component is nested separately.</p>
    <p className="price-help">Largest cuts are placed first into the smallest suitable stock; this is a repeatable packing heuristic, not an optimal purchasing guarantee. Exact stock-end use needs no trailing kerf. Reusable offcuts receive no automatic credit.</p>
    {error && <p role="alert">{error}</p>}
    {notice && <p role="alert">{notice}</p>}
    {!request && <p>Cutting requires a current material register matched to its source and reviewed recipe.</p>}
    {candidate && <><label>Material to cut<select aria-label="Stock component" value={`${candidate.recipe.id}:${candidate.component.id}`} disabled={disabled || !source.current} onChange={e => setSelected(e.target.value)}>
      {candidates.map(c => <option key={`${c.recipe.id}:${c.component.id}`} value={`${c.recipe.id}:${c.component.id}`}>{c.component.itemCode} · {c.component.description}</option>)}
    </select></label><StockRuleForm key={`${candidate.recipe.id}:${candidate.component.id}:${JSON.stringify(saved)}`} candidate={candidate} saved={saved} disabled={disabled || !source.current}
      onSave={rule => onSave([...rules.filter(r => !(r.recipeId === rule.recipeId && r.componentId === rule.componentId)), rule])} /></>}
    {!!rules.length && <div className="price-actions">{rules.map(rule => <button className="pill" key={`${rule.recipeId}:${rule.componentId}`} disabled={disabled}
      onClick={() => void onSave(rules.filter(r => r !== rule)).catch(failure => setNotice(failure instanceof Error ? failure.message : String(failure)))}>Remove stock rule: {rule.profile} ({rule.componentId})</button>)}</div>}
    {plan && plan.groups.length > 0 && <div aria-label="Fencing cutting result" data-register-revision={plan.commitRevision}>
      <h3>Stock to buy · register {plan.commitRevision}</h3>
      <p>Purchase lines are available in the rate mapping below. Their underlying cut and linear-metre quantities have no separate price, avoiding a second material charge.</p>
      <button className="pill" onClick={download}>Download fencing cut list CSV</button>
      {plan.groups.map(group => <div className="price-book-card" key={`${group.rule.recipeId}:${group.rule.componentId}`}>
        <h3>{group.component.itemCode} · {group.rule.profile}</h3>
        <p>{group.purchases.map(p => `${p.quantity} × ${p.description}`).join("; ")}</p>
        <p>{group.layout.totalRequiredCutLengthM.toFixed(3)} m cuts · {group.layout.totalKerfLossM.toFixed(4)} m kerf · {group.layout.totalReusableOffcutM.toFixed(4)} m reusable offcut · {group.layout.totalScrapM.toFixed(4)} m scrap.</p>
        <p className="price-help">Reviewed by {group.rule.reviewedBy} · {group.rule.reference} · {group.rule.reviewedAt}</p>
        <details><summary>View {group.cuts.length} cuts in {group.layout.totalStockSheets} stock pieces</summary>
          <div className="price-table-wrap"><table><thead><tr><th>Stock piece</th><th>Cuts and positions (mm)</th><th>Kerf / offcut (mm)</th></tr></thead><tbody>
            {group.layout.sheets.map(sheet => <tr key={sheet.sheetIndex}><td>#{sheet.sheetIndex + 1} · {sheet.stockLengthM * 1000} mm</td>
              <td>{sheet.cuts.map(cut => <p key={cut.cutId}>{cut.label}: {(cut.lengthM * 1000).toFixed(1)} · {(cut.startOffsetM * 1000).toFixed(1)}–{(cut.endOffsetM * 1000).toFixed(1)}</p>)}</td>
              <td>{(sheet.kerfLossM * 1000).toFixed(1)} / {(sheet.offcutLengthM * 1000).toFixed(1)} · {sheet.offcutClassification}</td></tr>)}
          </tbody></table></div>
        </details>
      </div>)}
    </div>}
  </details>;
}

function StockRuleForm({ candidate, saved, disabled, onSave }: { candidate: ReturnType<typeof fencingStockCandidates>[number]; saved?: FencingStockRule; disabled: boolean; onSave: (rule: FencingStockRule) => Promise<void> }) {
  const [profile, setProfile] = useState(saved?.profile ?? ""), [lengths, setLengths] = useState(saved?.stockLengthsMm.join(", ") ?? "");
  const [kerf, setKerf] = useState(saved ? String(saved.kerfMm) : ""), [offcut, setOffcut] = useState(saved ? String(saved.reusableOffcutMm) : "");
  const [adjustment, setAdjustment] = useState(saved ? String(saved.railAdjustmentMm) : ""), [post, setPost] = useState(saved?.postLengthMm ? String(saved.postLengthMm) : "");
  const [reviewer, setReviewer] = useState(saved?.reviewedBy ?? ""), [reference, setReference] = useState(saved?.reference ?? ""), [error, setError] = useState("");
  async function save() {
    try {
      if (![lengths, kerf, offcut, candidate.kind === "rail" ? adjustment : post].every(value => value.trim())) throw Error("Enter each dimension explicitly, including zero kerf or rail adjustment where intended.");
      const rule = fencingStockRuleSchema.parse({ recipeId: candidate.recipe.id, recipeRevision: candidate.recipe.revision, componentId: candidate.component.id,
        profile, stockLengthsMm: lengths.split(",").map(value => value.trim() ? Number(value) : NaN), kerfMm: Number(kerf), reusableOffcutMm: Number(offcut),
        railAdjustmentMm: candidate.kind === "rail" ? Number(adjustment) : 0, postLengthMm: candidate.kind === "post" ? Number(post) : null,
        reference, reviewedBy: reviewer, reviewedAt: new Date().toISOString() });
      await onSave(rule); setError("");
    } catch (failure) { setError(priceBookError(failure)); }
  }
  return <fieldset disabled={disabled}><legend>Review {candidate.component.itemCode} stock rule</legend>
    <div className="price-fields">
      <label>Stock profile / grade<input aria-label="Stock profile" value={profile} maxLength={120} onChange={e => setProfile(e.target.value)} /></label>
      <label>Available lengths (mm, comma separated)<input aria-label="Available stock lengths mm" value={lengths} onChange={e => setLengths(e.target.value)} placeholder="2400, 4800" /></label>
      <label>Saw kerf (mm)<input aria-label="Stock kerf mm" inputMode="decimal" value={kerf} onChange={e => setKerf(e.target.value)} /></label>
      <label>Minimum reusable offcut (mm)<input aria-label="Reusable offcut mm" inputMode="numeric" value={offcut} onChange={e => setOffcut(e.target.value)} /></label>
      {candidate.kind === "rail" ? <label>Rail cut adjustment to bay spacing (mm)<input aria-label="Rail cut adjustment mm" inputMode="decimal" value={adjustment} onChange={e => setAdjustment(e.target.value)} placeholder="Enter 0 if no adjustment" /></label>
        : <label>Finished post length (mm)<input aria-label="Finished post length mm" inputMode="numeric" value={post} onChange={e => setPost(e.target.value)} /></label>}
      <label>Reviewed by<input aria-label="Stock reviewed by" value={reviewer} maxLength={120} onChange={e => setReviewer(e.target.value)} /></label>
      <label className="price-wide">Supplier / cutting schedule reference<input aria-label="Stock schedule reference" value={reference} maxLength={1000} onChange={e => setReference(e.target.value)} /></label>
    </div>
    {error && <p role="alert">{error}</p>}
    <button className="pill" onClick={() => void save()}>Save reviewed stock rule</button>
  </fieldset>;
}
