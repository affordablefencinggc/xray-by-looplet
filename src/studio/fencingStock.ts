import type { BomBuildRequest, BomRecipeSet } from "./bomContract.ts";
import { deriveBomFacts } from "./bomRules.ts";
import { calculateStockCutLayout, type RequiredCut } from "./industries/roofing/stockNesting.ts";
import { fencingStockRulesSchema, type FencingStockRule } from "./fencingStockContract.ts";
import type { BomPricingSource } from "./pricing/bomPricing.ts";

type Recipe = BomRecipeSet["recipes"][number];
type Component = Recipe["components"][number];
export function stockComponentKind(component: Component): "rail" | "post" | null {
  if (component.basis === "rail-cuts") return "rail";
  return /^per-(ordinary|end|corner|junction|strainer|gate)-post$/.test(component.basis) ? "post" : null;
}

export function fencingStockCandidates(request: BomBuildRequest, source: BomPricingSource) {
  return request.recipeSet.recipes.filter(recipe => request.runs.some(run => run.recipeId === recipe.id)).flatMap(recipe => recipe.components.flatMap(component => {
    const kind = stockComponentKind(component);
    return kind && source.lines.some(line => line.key === component.itemCode) ? [{ recipe, component, kind }] : [];
  }));
}

/** Cuts are quantities from the current compiled source. Source matching is checked by the caller against the committed BOM digest. */
export function buildFencingStockPlan(request: BomBuildRequest, source: BomPricingSource, settings: readonly FencingStockRule[]) {
  const rules = fencingStockRulesSchema.parse(settings), facts = deriveBomFacts(request);
  const groups = rules.flatMap(rule => {
    const recipe = request.recipeSet.recipes.find(r => r.id === rule.recipeId), component = recipe?.components.find(c => c.id === rule.componentId);
    if (!recipe || !component) throw Error("A stock rule refers to a missing recipe component. Review or remove it.");
    if (recipe.revision !== rule.recipeRevision) throw Error(`${recipe.profile}: review stock lengths after the recipe change.`);
    const line = source.lines.find(l => l.key === component.itemCode), kind = stockComponentKind(component), physical = facts.get(recipe.id);
    if (!line || !physical) return []; // This component no longer occurs in the rebuilt job.
    if (!kind || component.factor !== "1" || recipe.allowances.some(a => a.componentIds.includes(component.id)))
      throw Error(`${component.itemCode}: stock cuts need an unscaled component without percentage allowances.`);
    const runs = request.runs.filter(run => run.recipeId === recipe.id);
    if (runs.some(run => run.specification.slope !== "level"))
      throw Error(`${recipe.profile}: stock lengths for sloping runs need a reviewed per-bay cutting schedule.`);
    if (kind === "post" && runs.some(run => run.vertices.some(vertex => vertex.postOverride)))
      throw Error(`${component.itemCode}: individual post overrides need a separate cutting schedule.`);
    let cuts: RequiredCut[];
    if (kind === "rail") {
      const model = recipe.materialModel;
      if (!("railRows" in model)) throw Error("This rail model does not declare cuts per bay.");
      if (Number(line.quantity) !== physical.bayLengthsMm.length * model.railRows) throw Error("Rail count differs from the committed materials.");
      if (physical.bayLengthsMm.length * model.railRows > 20000) throw Error("Limit the cutting plan to 20,000 pieces per component.");
      cuts = physical.bayLengthsMm.flatMap((bay, bayIndex) => Array.from({ length: model.railRows }, (_, row) => ({
        id: `${component.id}:bay:${bayIndex + 1}:row:${row + 1}`, label: `${component.itemCode} bay ${bayIndex + 1}, rail ${row + 1}`,
        lengthM: (bay + rule.railAdjustmentMm) / 1000,
      })));
    } else {
      if (!rule.postLengthMm) throw Error(`${component.itemCode}: enter the finished post length including embedment and any top allowance.`);
      const count = Number(line.quantity);
      if (!Number.isSafeInteger(count) || count < 0 || count > 20000) throw Error("Post cuts require a whole count up to 20,000.");
      const role = component.basis.slice(4, -5) as keyof typeof physical.postRoles;
      if (count !== physical.postRoles[role]) throw Error("Post count differs from the committed materials.");
      cuts = Array.from({ length: count }, (_, index) => ({ id: `${component.id}:${index + 1}`, label: `${component.itemCode} ${index + 1}`, lengthM: rule.postLengthMm! / 1000 }));
    }
    if (cuts.some(cut => cut.lengthM <= 0)) throw Error(`${component.itemCode}: each adjusted cut length must be greater than zero.`);
    const layout = calculateStockCutLayout(cuts, { availableStockLengthsM: rule.stockLengthsMm.map(mm => mm / 1000), kerfMm: rule.kerfMm, reusableOffcutThresholdM: rule.reusableOffcutMm / 1000 });
    const purchases = [...new Set(layout.sheets.map(sheet => sheet.stockLengthM))].sort((a, b) => a - b).map(length => ({
      key: `STOCK:${component.itemCode}:${rule.profile}:${Math.round(length * 1000)}`,
      description: `${rule.profile} · ${length.toFixed(3)} m stock for ${component.itemCode}`,
      quantity: String(layout.sheets.filter(sheet => sheet.stockLengthM === length).length), unit: "ea",
    }));
    const replacedKeys = kind === "rail" ? recipe.components.filter(c => c.basis === "rail-cuts" || c.basis === "rail-lm").map(c => c.itemCode) : [component.itemCode];
    if (kind === "rail" && recipe.allowances.some(a => a.componentIds.some(id => recipe.components.some(c => c.id === id && c.basis === "rail-lm"))))
      throw Error("Rail allowances need a separate reviewed cut schedule before stock can replace them.");
    return [{ rule, component, cuts, layout, purchases, replacedKeys }];
  });
  if (groups.reduce((sum, group) => sum + group.cuts.length, 0) > 20000) throw Error("Limit the complete cutting plan to 20,000 pieces.");
  const replacements = new Map(groups.flatMap(group => group.replacedKeys.map(key => [key, group] as const)));
  if (replacements.size !== groups.reduce((sum, group) => sum + group.replacedKeys.length, 0)) throw Error("Stock rules overlap the same material. Keep one rail rule per recipe.");
  const lines: BomPricingSource["lines"] = [
    ...source.lines.map(line => { const group = replacements.get(line.key); return group ? { ...line,
      noRateReason: `Quantity detail; purchase stock instead: ${group.purchases.map(p => p.key).join(", ")}. Reviewed by ${group.rule.reviewedBy}; ${group.rule.reference}.` } : line; }),
    ...groups.flatMap(group => group.purchases),
  ];
  if (new Set(lines.map(line => line.key)).size !== lines.length) throw Error("Stock purchase keys overlap; give distinct components distinct profiles.");
  return { inputDigest: request.inputDigest, commitRevision: source.commitRevision, groups, lines };
}
export type FencingStockPlan = ReturnType<typeof buildFencingStockPlan>;

export function fencingStockCsv(plan: FencingStockPlan): string {
  const cell = (value: unknown) => { let text = String(value ?? ""); if (/^[\s]*[=+@'-]/.test(text)) text = `'${text}`; return `"${text.replaceAll('"', '""')}"`; };
  const rows: unknown[][] = [["Register", "InputDigest", "Component", "Profile", "StockPiece", "StockMm", "Cut", "LengthMm", "StartMm", "EndMm", "KerfEndMm", "OffcutMm", "OffcutClass", "ReviewedBy", "Reference"]];
  for (const group of plan.groups) for (const sheet of group.layout.sheets) for (const cut of sheet.cuts)
    rows.push([plan.commitRevision, plan.inputDigest, group.component.itemCode, group.rule.profile, sheet.sheetIndex + 1, sheet.stockLengthM * 1000, cut.label,
      cut.lengthM * 1000, cut.startOffsetM * 1000, cut.endOffsetM * 1000, cut.kerfOffsetM * 1000, sheet.offcutLengthM * 1000, sheet.offcutClassification, group.rule.reviewedBy, group.rule.reference]);
  return "\uFEFF" + rows.map(row => row.map(cell).join(",")).join("\r\n") + "\r\n";
}
