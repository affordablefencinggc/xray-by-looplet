import { z } from "zod";

const positive = z.number().finite().min(.000001).max(1e9).nullable();
export const materialLineSchema = z.object({
  id: z.string().min(1).max(100),
  stockCode: z.string().trim().min(1, "Enter a unique stock code or order line.").max(100),
  description: z.string().trim().min(1, "Enter a material description.").max(300),
  quantity: z.number().finite().nonnegative().max(1e9).nullable(),
  unit: z.enum(["each", "m", "m2", "m3", "kg"]),
  unitsPerPackage: positive,
  lengthM: positive, widthM: positive, heightM: positive,
  specifiedWeightKg: positive,
  weightBasis: z.enum(["unit", "package"]),
  reference: z.string().trim().min(1, "Add the source schedule, order or supplier reference.").max(2000),
  revision: z.number().int().positive(),
}).strict().superRefine((line, ctx) => {
  if (line.unit === "each" && line.quantity !== null && !Number.isInteger(line.quantity))
    ctx.addIssue({ code: "custom", path: ["quantity"], message: "Each quantities must be whole numbers." });
  if (line.unit === "each" && line.unitsPerPackage !== null && !Number.isInteger(line.unitsPerPackage))
    ctx.addIssue({ code: "custom", path: ["unitsPerPackage"], message: "A package must cover a whole number of items." });
  if (line.unit === "kg" && line.weightBasis === "unit" && line.specifiedWeightKg !== null && line.specifiedWeightKg !== 1)
    ctx.addIssue({ code: "custom", path: ["specifiedWeightKg"], message: "Stock measured in kg already specifies its unit weight. Use package weight for gross packed weight." });
});
export type MaterialLine = z.infer<typeof materialLineSchema>;
export function materialErrorMessage(error: unknown): string {
  return error instanceof z.ZodError ? error.issues.map(issue => issue.message).join(" ") : error instanceof Error ? error.message : String(error);
}
export const materialLinesSchema = z.array(materialLineSchema).max(5000).superRefine((lines, ctx) => {
  const ids = new Set<string>(), codes = new Set<string>();
  for (const line of lines) {
    const code = line.stockCode.toLowerCase();
    if (ids.has(line.id) || codes.has(code)) ctx.addIssue({ code: "custom", message: `Duplicate material line: ${line.stockCode}. Edit the existing line or use its distinct order-line reference.` });
    ids.add(line.id); codes.add(code);
  }
});
export function newMaterialLine(id: string): MaterialLine {
  return { id, stockCode: "", description: "", quantity: null, unit: "each", unitsPerPackage: null, lengthM: null, widthM: null,
    heightM: null, specifiedWeightKg: null, weightBasis: "unit", reference: "", revision: 1 };
}
export function saveMaterialLine(lines: MaterialLine[], draft: MaterialLine): MaterialLine[] {
  const previous = lines.find(line => line.id === draft.id);
  if (previous && previous.revision !== draft.revision) throw Error("This material changed since it was opened. Cancel changes and reopen the latest line.");
  const next = materialLineSchema.parse({ ...draft, revision: previous ? previous.revision + 1 : 1 });
  return materialLinesSchema.parse(previous ? lines.map(line => line.id === next.id ? next : line) : [...lines, next]);
}
export function materialLineTotals(line: MaterialLine) {
  const q = line.quantity;
  const ratio = q === null || line.unitsPerPackage === null ? null : q / line.unitsPerPackage;
  // Decimal stock units can put an exact whole-pack quotient just above an integer.
  const roundedRatio = ratio === null ? null : Math.abs(ratio - Math.round(ratio)) <= Number.EPSILON * Math.max(1, Math.abs(ratio)) * 4 ? Math.round(ratio) : Math.ceil(ratio);
  const packageCount = q === 0 ? 0 : roundedRatio;
  const volumeM3 = q === 0 ? 0 : packageCount === null || line.lengthM === null || line.widthM === null || line.heightM === null ? null : packageCount * line.lengthM * line.widthM * line.heightM;
  const weightMultiplier = line.weightBasis === "unit" ? q : packageCount;
  const weightKg = q === 0 ? 0 : line.weightBasis === "unit" && line.unit === "kg" ? q : line.specifiedWeightKg === null || weightMultiplier === null ? null : line.specifiedWeightKg * weightMultiplier;
  const packageCapacityQuantity = packageCount === null || line.unitsPerPackage === null ? null : packageCount * line.unitsPerPackage;
  return { packageCount, volumeM3, weightKg, packageCapacityQuantity };
}
export function materialRegisterTotals(lines: MaterialLine[]) {
  const calculated = lines.map(line => ({ id: line.id, ...materialLineTotals(line) }));
  const volumes = calculated.filter(line => line.volumeM3 !== null), weights = calculated.filter(line => line.weightKg !== null);
  return {
    lineCount: lines.length, volumeCoverage: volumes.length, weightCoverage: weights.length,
    knownVolumeM3: volumes.length ? volumes.reduce((sum, line) => sum + line.volumeM3!, 0) : null,
    knownWeightKg: weights.length ? weights.reduce((sum, line) => sum + line.weightKg!, 0) : null,
    volumeComplete: lines.length > 0 && volumes.length === lines.length,
    weightComplete: lines.length > 0 && weights.length === lines.length,
  };
}
export const MATERIAL_UNITS = { each: "each", m: "m", m2: "m²", m3: "m³", kg: "kg" } as const;
export function materialRegisterCsv(lines: MaterialLine[], context: { projectId: string; sourceSha256: string }): string {
  const cell = (value: unknown) => {
    let text = value === null || value === undefined ? "" : String(value);
    // Spreadsheet programs must treat user descriptions as data, not formulas.
    if (/^[\s]*[=+@'-]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  const headers = ["Stock code", "Description", "Stock quantity", "Unit", "Units per package", "Package length m", "Package width m", "Package height m", "Package count", "Capacity of counted packages", "Storage m3", "Specified kg", "Weight basis", "Calculated weight kg", "Source reference", "Revision", "Project", "Drawing SHA-256", "Text encoding"];
  return "\uFEFF" + [headers, ...lines.map(line => {
    const t = materialLineTotals(line);
    return [line.stockCode, line.description, line.quantity, line.unit, line.unitsPerPackage, line.lengthM, line.widthM, line.heightM,
      t.packageCount, t.packageCapacityQuantity, t.volumeM3, line.specifiedWeightKg, line.weightBasis, t.weightKg, line.reference, line.revision, context.projectId, context.sourceSha256, "xray-apostrophe/v1"];
  })].map(row => row.map(cell).join(",")).join("\r\n") + "\r\n";
}
