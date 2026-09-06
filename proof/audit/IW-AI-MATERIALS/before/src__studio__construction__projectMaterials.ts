import { z } from "zod";
import { materialLineSchema, materialLineTotals, newMaterialLine } from "./materialRegister.ts";

export const DISCIPLINES = [
  "Structural",
  "Architectural",
  "Mechanical",
  "Electrical",
  "Plumbing",
  "Fire protection",
  "Civil",
  "Landscape",
  "General",
] as const;
const id = z.string().trim().min(1).max(240),
  hash = z.string().regex(/^[a-f0-9]{64}$/),
  note = z.string().max(3000);
const positive = z.number().finite().positive().max(1e9).nullable();
export const materialSourceSchema = z
  .object({
    sha256: hash,
    name: id,
    pageCount: z.number().int().positive().max(5000),
    discipline: z.enum(DISCIPLINES),
  })
  .strict();
export type MaterialSource = z.infer<typeof materialSourceSchema>;
export const materialEvidenceSchema = z
  .object({
    sha256: hash,
    page: z.number().int().positive(),
    reference: id,
    x: z.number().min(0).max(1).nullable(),
    y: z.number().min(0).max(1).nullable(),
  })
  .strict();
export const projectMaterialSchema = z
  .object({
    stock: materialLineSchema,
    physicalKey: id,
    discipline: z.enum(DISCIPLINES),
    category: id,
    building: id,
    floor: id,
    location: id,
    specification: note,
    quantityBasis: z.enum(["counted", "scheduled", "measured", "derived", "unresolved"]),
    calculation: note,
    dimensionsM: z
      .object({ length: positive, width: positive, height: positive, depth: positive })
      .strict()
      .default({ length: null, width: null, height: null, depth: null }),
    dimensionReference: note.default(""),
    unresolved: note.default(""),
    materialVolumePerUnitM3: positive,
    volumeReference: note,
    evidence: z.array(materialEvidenceSchema).min(1).max(500),
    review: z.enum(["pending", "reviewed"]),
    reviewNote: note,
  })
  .strict()
  .superRefine((v, c) => {
    if (v.stock.quantity !== null && (v.quantityBasis === "unresolved" || !v.calculation.trim()))
      c.addIssue({
        code: "custom",
        message: "A known quantity needs a counting method and calculation/source explanation.",
      });
    if (v.review === "reviewed" && (v.stock.quantity === null || !v.reviewNote.trim()))
      c.addIssue({ code: "custom", message: "Review needs a known quantity and a review note." });
    if (v.materialVolumePerUnitM3 !== null && !v.volumeReference.trim())
      c.addIssue({
        code: "custom",
        message: "Material volume needs a dimensional calculation or specification reference.",
      });
    if (Object.values(v.dimensionsM).some((n) => n !== null) && !v.dimensionReference.trim())
      c.addIssue({
        code: "custom",
        message: "Physical dimensions need a drawing or specification reference.",
      });
  });
export type ProjectMaterial = z.infer<typeof projectMaterialSchema>;
export const discoverySchema = z
  .object({
    id,
    sha256: hash,
    page: z.number().int().positive(),
    label: id,
    category: id,
    excerpt: z.string().max(800),
    mentions: z.number().int().positive(),
    status: z.enum(["pending", "linked", "excluded"]),
    materialId: id.nullable(),
    reason: note,
  })
  .strict();
export type MaterialDiscovery = z.infer<typeof discoverySchema>;
const sheetSchema = z
  .object({
    sha256: hash,
    page: z.number().int().positive(),
    title: z.string().max(240),
    scan: z.enum(["not-scanned", "text", "ocr", "no-text", "failed"]),
    textCharacters: z.number().int().nonnegative(),
    ocrConfidence: z.number().min(0).max(100).nullable().default(null),
    reviewed: z.boolean(),
    reviewNote: note,
  })
  .strict();
export const projectMaterialsSchema = z
  .object({
    schema: z.literal("xray.project-materials/v1"),
    projectId: id,
    revision: z.number().int().positive(),
    sources: z.array(materialSourceSchema).max(100),
    sheets: z.array(sheetSchema).max(20000),
    materials: z.array(projectMaterialSchema).max(5000),
    discoveries: z.array(discoverySchema).max(20000),
    scope: z
      .array(
        z.object({ discipline: z.enum(DISCIPLINES), excluded: z.boolean(), reason: note }).strict(),
      )
      .length(DISCIPLINES.length),
  })
  .strict()
  .superRefine((v, c) => {
    const issue = (message: string) => c.addIssue({ code: "custom", message });
    const unique = (values: string[], label: string) => {
      if (new Set(values).size !== values.length) issue(`Duplicate ${label}.`);
    };
    unique(
      v.sources.map((s) => s.sha256),
      "source revision",
    );
    unique(
      v.sheets.map((s) => `${s.sha256}:${s.page}`),
      "sheet",
    );
    unique(
      v.materials.map((m) => m.stock.id),
      "material record",
    );
    unique(
      v.materials.map((m) => m.physicalKey.trim().toLowerCase()),
      "physical material scope",
    );
    unique(
      v.materials.map((m) => m.stock.stockCode.toLowerCase()),
      "stock/order line code",
    );
    unique(
      v.discoveries.map((d) => d.id),
      "discovery",
    );
    unique(
      v.scope.map((s) => s.discipline),
      "discipline scope",
    );
    const validPage = (sha: string, page: number) =>
      v.sources.some((s) => s.sha256 === sha && page <= s.pageCount);
    for (const s of v.sources)
      if (v.sheets.filter((p) => p.sha256 === s.sha256).length !== s.pageCount)
        issue("Every supplied source page must have a coverage record.");
    for (const sheet of v.sheets) {
      if (!validPage(sheet.sha256, sheet.page)) issue("Sheet source/page is unavailable.");
      if (
        sheet.reviewed &&
        (!sheet.reviewNote.trim() || sheet.scan === "not-scanned" || sheet.scan === "failed")
      )
        issue("Sheet review needs a scan and a visual review note.");
      if (
        sheet.reviewed &&
        v.discoveries.some(
          (d) => d.sha256 === sheet.sha256 && d.page === sheet.page && d.status === "pending",
        )
      )
        issue("Resolve candidate materials before reviewing the sheet.");
    }
    for (const m of v.materials)
      for (const e of m.evidence)
        if (!validPage(e.sha256, e.page)) issue("Material evidence source/page is unavailable.");
    for (const d of v.discoveries) {
      if (!validPage(d.sha256, d.page)) issue("Discovery source/page is unavailable.");
      if (
        d.status === "linked" &&
        !v.materials.some(
          (m) =>
            m.stock.id === d.materialId &&
            m.evidence.some((e) => e.sha256 === d.sha256 && e.page === d.page),
        )
      )
        issue("Linked discovery needs an existing material with evidence on this sheet.");
      if (d.status === "excluded" && !d.reason.trim()) issue("Excluded discovery needs a reason.");
    }
    for (const s of v.scope)
      if (s.excluded && !s.reason.trim()) issue("Excluded discipline needs a scope reason.");
  });
export type ProjectMaterials = z.infer<typeof projectMaterialsSchema>;
export const createProjectMaterials = (projectId: string): ProjectMaterials => ({
  schema: "xray.project-materials/v1",
  projectId,
  revision: 1,
  sources: [],
  sheets: [],
  materials: [],
  discoveries: [],
  scope: DISCIPLINES.map((discipline) => ({ discipline, excluded: false, reason: "" })),
});
export function attachMaterialSource(
  value: ProjectMaterials,
  source: MaterialSource,
): ProjectMaterials {
  const parsed = materialSourceSchema.parse(source),
    existing = value.sources.find((s) => s.sha256 === parsed.sha256);
  if (existing) {
    if (existing.pageCount !== parsed.pageCount) throw Error("Existing source page count differs.");
    return value;
  }
  return projectMaterialsSchema.parse({
    ...value,
    revision: value.revision + 1,
    sources: [...value.sources, parsed],
    sheets: [
      ...value.sheets,
      ...Array.from({ length: source.pageCount }, (_, i) => ({
        sha256: source.sha256,
        page: i + 1,
        title: `Page ${i + 1}`,
        scan: "not-scanned",
        textCharacters: 0,
        reviewed: false,
        reviewNote: "",
      })),
    ],
  });
}
export function newProjectMaterial(
  source: MaterialSource,
  page: number,
  recordId: string,
): ProjectMaterial {
  return {
    stock: { ...newMaterialLine(recordId), reference: `${source.name}, page ${page}` },
    physicalKey: "",
    discipline: source.discipline,
    category: "Material",
    building: "Main building",
    floor: "Unspecified",
    location: "Unspecified",
    specification: "",
    quantityBasis: "unresolved",
    calculation: "",
    dimensionsM: { length: null, width: null, height: null, depth: null },
    dimensionReference: "",
    unresolved: "",
    materialVolumePerUnitM3: null,
    volumeReference: "",
    evidence: [{ sha256: source.sha256, page, reference: `Page ${page}`, x: null, y: null }],
    review: "pending",
    reviewNote: "",
  };
}
export function putProjectMaterial(
  value: ProjectMaterials,
  draft: ProjectMaterial,
): ProjectMaterials {
  const previous = value.materials.find((m) => m.stock.id === draft.stock.id);
  if (previous && previous.stock.revision !== draft.stock.revision)
    throw Error("Material changed since it was opened. Reopen the latest revision.");
  const { review: _r, reviewNote: _n, ...content } = draft;
  const old = previous ? (({ review: _r, reviewNote: _n, ...m }) => m)(previous) : null;
  const changed = previous && JSON.stringify(content) !== JSON.stringify(old);
  const next = projectMaterialSchema.parse({
    ...draft,
    stock: { ...draft.stock, revision: previous ? previous.stock.revision + 1 : 1 },
    review: changed ? "pending" : draft.review,
    reviewNote: changed ? "" : draft.reviewNote,
  });
  const affected = new Set(
    [...(previous?.evidence ?? []), ...next.evidence].map((e) => `${e.sha256}:${e.page}`),
  );
  return projectMaterialsSchema.parse({
    ...value,
    revision: value.revision + 1,
    materials: previous
      ? value.materials.map((m) => (m.stock.id === next.stock.id ? next : m))
      : [...value.materials, next],
    sheets: value.sheets.map((s) =>
      affected.has(`${s.sha256}:${s.page}`) ? { ...s, reviewed: false, reviewNote: "" } : s,
    ),
  });
}
export function applySheetDiscovery(
  value: ProjectMaterials,
  sha256: string,
  page: number,
  title: string,
  text: string,
  ocrConfidence: number | null = null,
): ProjectMaterials {
  // Rescans are deterministic and retain explicit dispositions. Never interpret text matches as physical counts.
  if (
    ocrConfidence === null &&
    !text.trim() &&
    value.sheets.some((s) => s.sha256 === sha256 && s.page === page && s.scan === "ocr")
  )
    return value;
  const discovered = discoverMaterialMentions(sha256, page, text),
    old = value.discoveries.filter((d) => d.sha256 === sha256 && d.page === page);
  const next = discovered.map((d) => {
    const prior = old.find((p) => p.id === d.id);
    return prior
      ? { ...d, status: prior.status, materialId: prior.materialId, reason: prior.reason }
      : d;
  });
  return projectMaterialsSchema.parse({
    ...value,
    revision: value.revision + 1,
    discoveries: [
      ...value.discoveries.filter((d) => d.sha256 !== sha256 || d.page !== page),
      ...next,
    ],
    sheets: value.sheets.map((s) =>
      s.sha256 === sha256 && s.page === page
        ? {
            ...s,
            title: title.slice(0, 240),
            scan: text.trim() ? (ocrConfidence === null ? "text" : "ocr") : "no-text",
            ocrConfidence,
            textCharacters: text.length,
            reviewed: false,
            reviewNote: "",
          }
        : s,
    ),
  });
}
const patterns: [string, RegExp][] = [
  [
    "Structural steel",
    /\b(?:W\s*\d+\s*[x×]\s*\d+(?:\.\d+)?|HSS\s*\d+(?:\.\d+)?\s*[x×]\s*\d+(?:\.\d+)?(?:\s*[x×]\s*[\d/.]+)?|L\d+\s*[x×]\s*[\d/]+\s*[x×]\s*[\d/]+)\b/gi,
  ],
  [
    "Concrete & reinforcement",
    /\b(?:CONCRETE|REBAR|REINFORC(?:EMENT|ING)|WIRE MESH|GROUT|FOOTING|GRADE BEAM)S?\b/gi,
  ],
  ["Masonry", /\b(?:CMU|MASONRY|BRICK|MORTAR|BLOCKWORK)\b/gi],
  [
    "Fixings & plates",
    /\b(?:ANCHOR (?:ROD|BOLT)S?|BOLTS?|NUTS?|WASHERS?|SCREWS?|SHEAR PLATES?|BASE ?PLATES?|WELDS?|STUDS?)\b/gi,
  ],
  [
    "Envelope & finishes",
    /\b(?:INSULATION|GYPSUM|DRYWALL|PLASTERBOARD|PLYWOOD|SHEATHING|MEMBRANE|VAPO[UR]+ BARRIER|FLASHING|SEALANT|PAINT|TILES?|CARPET|CLADDING|ROOF DECK|METAL DECK|CEILING|TIMBER|WOOD)\b/gi,
  ],
  [
    "Openings & fittings",
    /\b(?:DOORS?|WINDOWS?|GLAZING|LOUVERS?|LOUVRES?|HARDWARE|HINGES?|HANDRAILS?|RAILINGS?|CABINETS?|COUNTERTOPS?)\b/gi,
  ],
  [
    "Services & equipment",
    /\b(?:DUCTS?|DIFFUSERS?|DAMPERS?|PIPES?|VALVES?|PUMPS?|SPRINKLERS?|CONDUITS?|CABLES?|LUMINAIRES?|LIGHT FIXTURES?|RECEPTACLES?|SWITCHES|TRANSFORMERS?|SINKS?|TOILETS?|FANS?|BOILERS?|WATER HEATER)\b/gi,
  ],
  [
    "Site & landscape",
    /\b(?:ASPHALT|PAVING|PAVERS?|KERBS?|CURBS?|FENCES?|GATES?|DRAINAGE|TOPSOIL|TURF|IRRIGATION|TREES?)\b/gi,
  ],
];
export function discoverMaterialMentions(
  sha256: string,
  page: number,
  text: string,
): MaterialDiscovery[] {
  const found = new Map<string, MaterialDiscovery>();
  for (const [category, regex] of patterns)
    for (const match of text.matchAll(regex)) {
      const label = match[0]
          .toUpperCase()
          .replace(/\s*[X×]\s*/g, "×")
          .replace(/\s+/g, " "),
        key = `${sha256}:${page}:${label}`;
      const current = found.get(key);
      if (current) {
        current.mentions++;
        continue;
      }
      found.set(key, {
        id: key,
        sha256,
        page,
        label,
        category,
        excerpt: text
          .slice(Math.max(0, match.index - 110), match.index + match[0].length + 150)
          .replace(/\s+/g, " ")
          .slice(0, 800),
        mentions: 1,
        status: "pending",
        materialId: null,
        reason: "",
      });
    }
  return [...found.values()];
}
export function disposeDiscovery(
  value: ProjectMaterials,
  discoveryId: string,
  materialId: string | null,
  reason: string,
): ProjectMaterials {
  const d = value.discoveries.find((d) => d.id === discoveryId);
  if (!d) throw Error("Discovery no longer exists.");
  let materials = value.materials;
  if (materialId) {
    const material = materials.find((m) => m.stock.id === materialId);
    if (!material) throw Error("Choose an existing physical material.");
    if (!material.evidence.some((e) => e.sha256 === d.sha256 && e.page === d.page))
      materials = materials.map((m) =>
        m.stock.id === materialId
          ? {
              ...m,
              stock: { ...m.stock, revision: m.stock.revision + 1 },
              review: "pending" as const,
              reviewNote: "",
              evidence: [
                ...m.evidence,
                { sha256: d.sha256, page: d.page, reference: d.label, x: null, y: null },
              ],
            }
          : m,
      );
  }
  const affected = new Set([
    `${d.sha256}:${d.page}`,
    ...(materials !== value.materials
      ? materials
          .find((m) => m.stock.id === materialId)!
          .evidence.map((e) => `${e.sha256}:${e.page}`)
      : []),
  ]);
  return projectMaterialsSchema.parse({
    ...value,
    revision: value.revision + 1,
    materials,
    discoveries: value.discoveries.map((x) =>
      x.id === d.id ? { ...x, status: materialId ? "linked" : "excluded", materialId, reason } : x,
    ),
    sheets: value.sheets.map((s) =>
      affected.has(`${s.sha256}:${s.page}`) ? { ...s, reviewed: false, reviewNote: "" } : s,
    ),
  });
}
export function projectMaterialTotals(value: ProjectMaterials) {
  const rows = value.materials.map((m) => ({
    id: m.stock.id,
    quantity: m.stock.quantity,
    unit: m.stock.unit,
    materialVolumeM3:
      m.stock.quantity === 0
        ? 0
        : m.stock.unit === "m3"
          ? m.stock.quantity
          : m.stock.quantity === null || m.materialVolumePerUnitM3 === null
            ? null
            : m.stock.quantity * m.materialVolumePerUnitM3,
    ...materialLineTotals(m.stock),
  }));
  const subtotal = (key: "materialVolumeM3" | "volumeM3" | "weightKg") => {
    const known = rows.filter((r) => r[key] !== null);
    return {
      value: known.length ? known.reduce((s, r) => s + r[key]!, 0) : null,
      known: known.length,
      total: rows.length,
    };
  };
  const quantities = [...new Set(rows.map((r) => r.unit))].map((unit) => ({
    unit,
    known: rows
      .filter((r) => r.unit === unit && r.quantity !== null)
      .reduce((s, r) => s + r.quantity!, 0),
    unknown: rows.filter((r) => r.unit === unit && r.quantity === null).length,
  }));
  return {
    rows,
    quantities,
    materialVolume: subtotal("materialVolumeM3"),
    storageVolume: subtotal("volumeM3"),
    weight: subtotal("weightKg"),
    unknownQuantities: rows.filter((r) => r.quantity === null).length,
  };
}
export function materialCoverage(value: ProjectMaterials) {
  const missing = value.scope
    .filter(
      (d) =>
        !d.excluded &&
        d.discipline !== "General" &&
        !value.sources.some((s) => s.discipline === d.discipline),
    )
    .map((d) => d.discipline);
  return {
    missingDisciplines: missing,
    sheets: value.sheets.length,
    reviewedSheets: value.sheets.filter((s) => s.reviewed).length,
    pendingDiscoveries: value.discoveries.filter((d) => d.status === "pending").length,
    unreviewedMaterials: value.materials.filter((m) => m.review !== "reviewed").length,
    unknownQuantities: value.materials.filter((m) => m.stock.quantity === null).length,
    status:
      "Coverage requires visual reconciliation; automated discovery does not establish completeness",
  };
}
export const projectMaterialsKey = (projectId: string) =>
  `xray:project-materials:v1:${encodeURIComponent(projectId)}`;
type StoragePort = Pick<Storage, "getItem" | "setItem">;
export type ProjectMaterialsSession = {
  value: ProjectMaterials;
  raw: string | null;
  blocked: boolean;
  error: string | null;
};
export function restoreProjectMaterials(
  storage: StoragePort,
  projectId: string,
): ProjectMaterialsSession {
  let raw: string | null = null;
  try {
    raw = storage.getItem(projectMaterialsKey(projectId));
    const value =
      raw === null
        ? createProjectMaterials(projectId)
        : projectMaterialsSchema.parse(JSON.parse(raw));
    if (value.projectId !== projectId) throw Error("Wrong project");
    return { value, raw, blocked: false, error: null };
  } catch {
    return {
      value: createProjectMaterials(projectId),
      raw,
      blocked: true,
      error:
        "Saved material inventory could not be restored. Original data is preserved; writes and exports are blocked until recovery.",
    };
  }
}
export function saveProjectMaterials(
  storage: StoragePort,
  session: ProjectMaterialsSession,
  value: ProjectMaterials,
): ProjectMaterialsSession {
  if (session.blocked) return session;
  try {
    const parsed = projectMaterialsSchema.parse(value);
    if (parsed.projectId !== session.value.projectId) throw Error("Project identity changed.");
    const key = projectMaterialsKey(parsed.projectId);
    if (storage.getItem(key) !== session.raw)
      return {
        ...session,
        blocked: true,
        error: "Inventory changed in another session. Retry restore before writing.",
      };
    const raw = JSON.stringify(parsed);
    storage.setItem(key, raw);
    return { value: parsed, raw, blocked: false, error: null };
  } catch (e) {
    return {
      ...session,
      error: `Inventory was not saved: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}
export function projectMaterialsExport(value: ProjectMaterials) {
  const parsed = projectMaterialsSchema.parse(value);
  return {
    inventory: parsed,
    coverage: materialCoverage(parsed),
    totals: projectMaterialTotals(parsed),
    status:
      "Preliminary source-linked material takeoff; incomplete quantities and disciplines remain explicit",
  };
}
export function previewMaterialsBackup(text: string, projectId: string): ProjectMaterials {
  if (text.length > 20 * 1024 * 1024) throw Error("Backup exceeds the 20 MB limit.");
  const parsed = projectMaterialsSchema.parse(JSON.parse(text).inventory);
  if (parsed.projectId !== projectId) throw Error("Backup belongs to a different project.");
  return parsed;
}

// A flat handoff keeps source identity and all dimensional assumptions alongside quantities.
export function projectMaterialsCsv(value: ProjectMaterials): string {
  const parsed = projectMaterialsSchema.parse(value),
    totals = projectMaterialTotals(parsed);
  const cell = (v: unknown) => {
    let s = v == null ? "" : String(v);
    if (/^[\s]*[=+@'-]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  const headers = [
    "Stock code",
    "Description",
    "Physical scope",
    "Discipline",
    "Category",
    "Building",
    "Floor",
    "Location",
    "Quantity",
    "Unit",
    "Quantity basis",
    "Calculation",
    "Physical length m",
    "Physical width m",
    "Physical height m",
    "Physical depth m",
    "Dimension reference",
    "Specification",
    "Material volume m3",
    "Volume reference",
    "Specified kg",
    "Weight basis",
    "Calculated weight kg",
    "Units per package",
    "Package length m",
    "Package width m",
    "Package height m",
    "Package count",
    "Storage m3",
    "Unresolved components / properties",
    "Source reference",
    "Drawing SHA-256",
    "Evidence pages and references",
    "Review",
    "Review note",
    "Revision",
    "Project",
    "Status",
    "Text encoding",
  ];
  const rows = parsed.materials.map((m) => {
    const s = m.stock,
      t = totals.rows.find((t) => t.id === s.id)!;
    return [
      s.stockCode,
      s.description,
      m.physicalKey,
      m.discipline,
      m.category,
      m.building,
      m.floor,
      m.location,
      s.quantity,
      s.unit,
      m.quantityBasis,
      m.calculation,
      m.dimensionsM.length,
      m.dimensionsM.width,
      m.dimensionsM.height,
      m.dimensionsM.depth,
      m.dimensionReference,
      m.specification,
      t.materialVolumeM3,
      m.volumeReference,
      s.specifiedWeightKg,
      s.weightBasis,
      t.weightKg,
      s.unitsPerPackage,
      s.lengthM,
      s.widthM,
      s.heightM,
      t.packageCount,
      t.volumeM3,
      m.unresolved,
      s.reference,
      [...new Set(m.evidence.map((e) => e.sha256))].join("; "),
      m.evidence.map((e) => e.sha256 + ": page " + e.page + " (" + e.reference + ")").join("; "),
      m.review,
      m.reviewNote,
      s.revision,
      parsed.projectId,
      "Preliminary; whole-project coverage requires reconciliation",
      "xray-apostrophe/v1",
    ];
  });
  return "\uFEFF" + [headers, ...rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}
