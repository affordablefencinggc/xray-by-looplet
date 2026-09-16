import {
  type ArchitectProject,
  type Wall,
  type Opening,
  type Slab,
  type Roof,
  wallThickness,
  area,
  validateProject,
} from "./model.ts";
import {
  resolveAlterationStage,
  type AlterationBasis,
} from "./alterationStage.ts";
import {
  calculateAlterationQuantities,
  type AlterationQuantities,
} from "./alterationQuantities.ts";
import { wallSolids, wallAtHeight, polygonArea, roofFaces } from "./geometry.ts";

/** Demolition Schedule */
export type DemolitionItem = {
  id: string;
  kind: "wall" | "opening" | "slab" | "roof";
  name: string;
  levelId: string;
  levelName: string;
  dimensions: string;
  volumeM3: number | null;
  areaM2: number;
  disposition: string;
  reference: string;
};

export type DemolitionSchedule = {
  ready: boolean;
  blockers: { elementId: string; reason: string }[];
  basisReference: string;
  rows: DemolitionItem[];
  totalDemolishedVolumeM3: number;
  totalDemolishedAreaM2: number;
  unknowns: string[];
};

/** Salvage & Disposal Schedule */
export type DisposalAssumptions = {
  masonryBulkingFactor: number;
  timberBulkingFactor: number;
  defaultRouting: "landfill" | "recycling" | "salvage";
};

export const DEFAULT_DISPOSAL_ASSUMPTIONS: DisposalAssumptions = {
  masonryBulkingFactor: 1.3,
  timberBulkingFactor: 1.2,
  defaultRouting: "recycling",
};

export type SalvageDisposalItem = {
  id: string;
  elementId: string;
  elementName: string;
  materialName: string;
  category: "concrete/masonry" | "timber" | "fixture" | "covering/finish" | "other";
  netVolumeM3: number | null;
  bulkingFactor: number;
  grossDisposalVolumeM3: number | null;
  estimatedWeightKg: number | null;
  routing: "landfill" | "recycling" | "salvage";
  salvageable: boolean;
  notes: string;
};

export type SalvageDisposalSchedule = {
  ready: boolean;
  blockers: { elementId: string; reason: string }[];
  basisReference: string;
  assumptions: DisposalAssumptions;
  rows: SalvageDisposalItem[];
  totalNetVolumeM3: number;
  totalGrossDisposalVolumeM3: number;
  totalEstimatedWeightKg: number;
  unknowns: string[];
};

/** Repair Schedule */
export type RepairItem = {
  id: string;
  kind: "wall" | "opening" | "slab" | "roof";
  name: string;
  levelId: string;
  levelName: string;
  beforeDimensions: string;
  proposedDimensions: string;
  deltaVolumeM3: number;
  repairBasisReference: string;
  notes: string;
};

export type RepairSchedule = {
  ready: boolean;
  blockers: { elementId: string; reason: string }[];
  basisReference: string;
  rows: RepairItem[];
  totalRepairVolumeM3: number;
  unknowns: string[];
};

/** Alteration Material Schedule (Proposed new & repair work) */
export type AlterationMaterialItem = {
  id: string;
  sourceElementId: string;
  sourceElementName: string;
  lifecycleStatus: "new" | "repaired";
  layerId: string;
  materialName: string;
  category: "Wall layer" | "Slab" | "Roof covering" | "Roof trim" | "Opening fixture";
  thicknessMm: number | null;
  netAreaM2: number;
  wastePercent: number;
  orderAreaM2: number;
  netVolumeM3: number | null;
  supplierReference: string;
  rateRevision: string;
  notes: string;
};

export type AlterationMaterialSchedule = {
  ready: boolean;
  blockers: { elementId: string; reason: string }[];
  basisReference: string;
  rows: AlterationMaterialItem[];
  totalNetVolumeM3: number;
  totalOrderAreaM2: number;
  unknowns: string[];
};

/** Utility: Safe CSV cell string */
function cell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return '""';
  const text = String(value);
  const safe = /^[\s\u0000-\u001f\u007f-\u009f]*[=+\-@]/u.test(text) ? "'" + text : text;
  return '"' + safe.replace(/"/g, '""') + '"';
}

/** Calculate Demolition Schedule */
export function calculateDemolitionSchedule(
  project: ArchitectProject,
  basis: AlterationBasis | null,
): DemolitionSchedule {
  const q = calculateAlterationQuantities(project, basis);
  if (!q.ready) {
    return {
      ready: false,
      blockers: q.blockers,
      basisReference: basis?.reference ?? "",
      rows: [],
      totalDemolishedVolumeM3: 0,
      totalDemolishedAreaM2: 0,
      unknowns: ["Alteration review incomplete or invalid; demolition schedule blocked."],
    };
  }

  const p = validateProject(project);
  const levels = new Map(p.levels.map((l) => [l.id, l]));
  const rows: DemolitionItem[] = [];
  const unknowns: string[] = [];

  // Demolished walls
  const demolishedWalls = p.walls.filter((w) => w.lifecycle?.status === "demolished");
  for (const w of demolishedWalls) {
    const level = levels.get(w.levelId);
    const th = wallThickness(w);
    const len = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]);
    const areaM2 = (len * w.height) / 1e6;
    const volM3 = (len * th * w.height) / 1e9;
    rows.push({
      id: w.id,
      kind: "wall",
      name: w.name,
      levelId: w.levelId,
      levelName: level?.name ?? w.levelId,
      dimensions: `L: ${(len / 1000).toFixed(3)}m, H: ${(w.height / 1000).toFixed(3)}m, T: ${th}mm`,
      volumeM3: volM3,
      areaM2,
      disposition: "demolish-wall",
      reference: w.lifecycle?.reference ?? "",
    });
  }

  // Demolished openings
  const wallsMap = new Map(p.walls.map((w) => [w.id, w]));
  const demolishedOpenings = p.openings.filter((o) => o.lifecycle?.status === "demolished");
  for (const o of demolishedOpenings) {
    const host = wallsMap.get(o.wallId);
    const level = host ? levels.get(host.levelId) : undefined;
    const th = host ? wallThickness(host) : 0;
    const areaM2 = (o.width * o.height) / 1e6;
    const volM3 = host ? (o.width * th * o.height) / 1e9 : null;
    let disp = "remove-fixture";
    if (o.demolitionDisposition?.kind === "infill") disp = "infill (host layers span opening)";
    else if (o.demolitionDisposition?.kind === "retain-void") disp = "retain-void (preserve aperture cut)";
    else if (o.demolitionDisposition?.kind === "partial-infill") {
      const rv = o.demolitionDisposition.remainingVoid;
      disp = `partial-infill (remaining void ${rv.width}x${rv.height} at sill ${rv.sill})`;
    }
    rows.push({
      id: o.id,
      kind: "opening",
      name: `${o.tag} (${o.kind})`,
      levelId: host?.levelId ?? "",
      levelName: level?.name ?? "Unknown level",
      dimensions: `W: ${(o.width / 1000).toFixed(3)}m, H: ${(o.height / 1000).toFixed(3)}m, Sill: ${(o.sill / 1000).toFixed(3)}m`,
      volumeM3: volM3,
      areaM2,
      disposition: disp,
      reference: o.lifecycle?.reference ?? "",
    });
  }

  // Demolished slabs
  const demolishedSlabs = p.slabs.filter((s) => s.lifecycle?.status === "demolished");
  for (const s of demolishedSlabs) {
    const level = levels.get(s.levelId);
    const areaM2 = area(s.points) / 1e6;
    const volM3 = (areaM2 * s.thickness) / 1000;
    rows.push({
      id: s.id,
      kind: "slab",
      name: `${s.name} (${s.material})`,
      levelId: s.levelId,
      levelName: level?.name ?? s.levelId,
      dimensions: `Area: ${areaM2.toFixed(3)}m², T: ${s.thickness}mm`,
      volumeM3: volM3,
      areaM2,
      disposition: "demolish-slab",
      reference: s.lifecycle?.reference ?? "",
    });
  }

  // Demolished roofs
  const demolishedRoofs = p.roofs.filter((r) => r.lifecycle?.status === "demolished");
  for (const r of demolishedRoofs) {
    const level = levels.get(r.levelId);
    let areaM2 = 0;
    for (const face of roofFaces(r)) {
      for (let i = 1; i < face.points.length - 1; i++) {
        const a = [face.points[i][0] - face.points[0][0], face.points[i][1] - face.points[0][1], face.heights[i] - face.heights[0]];
        const b = [face.points[i + 1][0] - face.points[0][0], face.points[i + 1][1] - face.points[0][1], face.heights[i + 1] - face.heights[0]];
        areaM2 += Math.hypot(a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]) / 2e6;
      }
    }
    rows.push({
      id: r.id,
      kind: "roof",
      name: `${r.name} Covering`,
      levelId: r.levelId,
      levelName: level?.name ?? r.levelId,
      dimensions: `Slope area: ${areaM2.toFixed(3)}m², Eaves: ${r.eaves}mm`,
      volumeM3: null, // covering volume unspecified unless thickness modeled
      areaM2,
      disposition: "demolish-roof-covering",
      reference: r.lifecycle?.reference ?? "",
    });
  }

  // Unknown condition checks
  if (demolishedWalls.length > 0 || demolishedSlabs.length > 0) {
    unknowns.push("Hazardous materials (asbestos, lead paint, synthetic mineral fibres) not assessed by authored CAD model; requires physical hazmat register.");
    unknowns.push("Temporary structural shoring and propping requirements depend on site engineer inspection; not inferred from 2D/3D geometry.");
  }

  const totalDemolishedVolumeM3 = rows.reduce((s, r) => s + (r.volumeM3 ?? 0), 0);
  const totalDemolishedAreaM2 = rows.reduce((s, r) => s + r.areaM2, 0);

  return {
    ready: true,
    blockers: [],
    basisReference: q.basisReference,
    rows,
    totalDemolishedVolumeM3,
    totalDemolishedAreaM2,
    unknowns,
  };
}

/** Calculate Salvage & Disposal Schedule */
export function calculateSalvageDisposalSchedule(
  project: ArchitectProject,
  basis: AlterationBasis | null,
  assumptions: DisposalAssumptions = DEFAULT_DISPOSAL_ASSUMPTIONS,
): SalvageDisposalSchedule {
  const demo = calculateDemolitionSchedule(project, basis);
  if (!demo.ready) {
    return {
      ready: false,
      blockers: demo.blockers,
      basisReference: basis?.reference ?? "",
      assumptions,
      rows: [],
      totalNetVolumeM3: 0,
      totalGrossDisposalVolumeM3: 0,
      totalEstimatedWeightKg: 0,
      unknowns: demo.unknowns,
    };
  }

  const p = validateProject(project);
  const rows: SalvageDisposalItem[] = [];
  const unknowns = [...demo.unknowns];

  for (const item of demo.rows) {
    if (item.kind === "wall") {
      const wall = p.walls.find((w) => w.id === item.id);
      if (!wall) continue;
      for (const layer of wall.layers) {
        if (layer.kind === "void") continue;
        const fraction = layer.thickness / wallThickness(wall);
        const netVol = (item.volumeM3 ?? 0) * fraction;
        const isMasonry = ["concrete", "brick", "block", "stone"].some((k) =>
          layer.hatch.toLowerCase().includes(k) || layer.name.toLowerCase().includes(k),
        );
        const isTimber = ["timber", "wood", "stud"].some((k) =>
          layer.hatch.toLowerCase().includes(k) || layer.name.toLowerCase().includes(k),
        );
        const category = isMasonry ? "concrete/masonry" : isTimber ? "timber" : "other";
        const bulking = isMasonry
          ? assumptions.masonryBulkingFactor
          : isTimber
            ? assumptions.timberBulkingFactor
            : 1.15;
        const grossVol = netVol * bulking;
        const estWeight = layer.densityKgM3 ? netVol * layer.densityKgM3 : null;

        if (!layer.densityKgM3) {
          if (!unknowns.includes(`Layer "${layer.name}" has unspecified density; weight cannot be estimated.`)) {
            unknowns.push(`Layer "${layer.name}" has unspecified density; weight cannot be estimated.`);
          }
        }

        const isTimberSalvageable = isTimber && netVol > 0.5;
        rows.push({
          id: `${wall.id}-${layer.id}`,
          elementId: wall.id,
          elementName: wall.name,
          materialName: layer.name,
          category,
          netVolumeM3: netVol,
          bulkingFactor: bulking,
          grossDisposalVolumeM3: grossVol,
          estimatedWeightKg: estWeight,
          routing: isTimberSalvageable ? "salvage" : assumptions.defaultRouting,
          salvageable: isTimberSalvageable,
          notes: `${layer.name} (${layer.thickness}mm); bulking factor ${bulking.toFixed(2)} applied.`,
        });
      }
    } else if (item.kind === "opening") {
      rows.push({
        id: item.id,
        elementId: item.id,
        elementName: item.name,
        materialName: item.name,
        category: "fixture",
        netVolumeM3: item.volumeM3,
        bulkingFactor: 1.0,
        grossDisposalVolumeM3: item.volumeM3,
        estimatedWeightKg: null,
        routing: "salvage",
        salvageable: true,
        notes: "Demolished fixture; inspect on site for architectural salvage/re-use before disposal.",
      });
    } else if (item.kind === "slab") {
      const slab = p.slabs.find((s) => s.id === item.id);
      const netVol = item.volumeM3 ?? 0;
      const bulking = assumptions.masonryBulkingFactor;
      rows.push({
        id: item.id,
        elementId: item.id,
        elementName: item.name,
        materialName: slab?.material ?? "Concrete slab",
        category: "concrete/masonry",
        netVolumeM3: netVol,
        bulkingFactor: bulking,
        grossDisposalVolumeM3: netVol * bulking,
        estimatedWeightKg: netVol * 2400, // typical reinforced concrete
        routing: "recycling",
        salvageable: false,
        notes: `Crushed concrete recycling; bulking factor ${bulking.toFixed(2)}.`,
      });
    } else if (item.kind === "roof") {
      rows.push({
        id: item.id,
        elementId: item.id,
        elementName: item.name,
        materialName: item.name,
        category: "covering/finish",
        netVolumeM3: null,
        bulkingFactor: 1.2,
        grossDisposalVolumeM3: null,
        estimatedWeightKg: null,
        routing: assumptions.defaultRouting,
        salvageable: false,
        notes: `Roof sheeting / covering removal; area ${(item.areaM2).toFixed(2)} m².`,
      });
    }
  }

  unknowns.push("Disposal facility destination and certified tip/recycling receipts require licensed cartage contractor.");

  const totalNetVolumeM3 = rows.reduce((s, r) => s + (r.netVolumeM3 ?? 0), 0);
  const totalGrossDisposalVolumeM3 = rows.reduce((s, r) => s + (r.grossDisposalVolumeM3 ?? 0), 0);
  const totalEstimatedWeightKg = rows.reduce((s, r) => s + (r.estimatedWeightKg ?? 0), 0);

  return {
    ready: true,
    blockers: [],
    basisReference: demo.basisReference,
    assumptions,
    rows,
    totalNetVolumeM3,
    totalGrossDisposalVolumeM3,
    totalEstimatedWeightKg,
    unknowns,
  };
}

/** Calculate Repair Schedule */
export function calculateRepairSchedule(
  project: ArchitectProject,
  basis: AlterationBasis | null,
): RepairSchedule {
  const q = calculateAlterationQuantities(project, basis);
  if (!q.ready) {
    return {
      ready: false,
      blockers: q.blockers,
      basisReference: basis?.reference ?? "",
      rows: [],
      totalRepairVolumeM3: 0,
      unknowns: ["Alteration review incomplete or invalid; repair schedule blocked."],
    };
  }

  const p = validateProject(project);
  const levels = new Map(p.levels.map((l) => [l.id, l]));
  const rows: RepairItem[] = [];
  const unknowns: string[] = [];

  const repairedWalls = p.walls.filter((w) => w.lifecycle?.status === "repaired");
  for (const w of repairedWalls) {
    const level = levels.get(w.levelId);
    const th = wallThickness(w);
    const len = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]);
    const beforeH = w.repairBasis?.height ?? w.height;
    const proposedH = w.height;
    const deltaH = proposedH - beforeH;
    const deltaVol = (len * th * Math.abs(deltaH)) / 1e9;
    const notes = deltaH === 0
      ? "Wall height unchanged; surface repair / refinishing / re-pointing."
      : deltaH > 0
        ? `Wall raised by ${deltaH} mm; extension repair.`
        : `Wall lowered by ${Math.abs(deltaH)} mm; reduction repair.`;

    rows.push({
      id: w.id,
      kind: "wall",
      name: w.name,
      levelId: w.levelId,
      levelName: level?.name ?? w.levelId,
      beforeDimensions: `L: ${(len / 1000).toFixed(3)}m, H: ${(beforeH / 1000).toFixed(3)}m, T: ${th}mm`,
      proposedDimensions: `L: ${(len / 1000).toFixed(3)}m, H: ${(proposedH / 1000).toFixed(3)}m, T: ${th}mm`,
      deltaVolumeM3: deltaVol,
      repairBasisReference: w.repairBasis?.reference ?? w.lifecycle?.reference ?? "",
      notes,
    });
  }

  // Other repaired elements
  for (const [kind, elements] of [
    ["opening", p.openings],
    ["slab", p.slabs],
    ["roof", p.roofs],
  ] as const) {
    for (const el of elements.filter((e) => e.lifecycle?.status === "repaired")) {
      const levelId = "levelId" in el ? el.levelId : "";
      const level = levels.get(levelId);
      rows.push({
        id: el.id,
        kind,
        name: "tag" in el ? el.tag : el.name,
        levelId,
        levelName: level?.name ?? "General",
        beforeDimensions: "Existing dimensions",
        proposedDimensions: "Remediated in-situ",
        deltaVolumeM3: 0,
        repairBasisReference: el.lifecycle?.reference ?? "",
        notes: "In-situ repair / maintenance without dimensional alteration.",
      });
    }
  }

  if (repairedWalls.length > 0) {
    unknowns.push("Existing structural substrate adequacy (footings, load-bearing capacity) requires registered structural engineer certification.");
    unknowns.push("Historical mortar/brick match and damp-proof course continuity must be verified on site prior to commencement.");
  }

  const totalRepairVolumeM3 = rows.reduce((s, r) => s + r.deltaVolumeM3, 0);

  return {
    ready: true,
    blockers: [],
    basisReference: q.basisReference,
    rows,
    totalRepairVolumeM3,
    unknowns,
  };
}

/** Calculate Alteration Material Schedule (New & Repaired Proposed Work) */
export function calculateAlterationMaterialSchedule(
  project: ArchitectProject,
  basis: AlterationBasis | null,
): AlterationMaterialSchedule {
  const q = calculateAlterationQuantities(project, basis);
  if (!q.ready) {
    return {
      ready: false,
      blockers: q.blockers,
      basisReference: basis?.reference ?? "",
      rows: [],
      totalNetVolumeM3: 0,
      totalOrderAreaM2: 0,
      unknowns: ["Alteration review incomplete or invalid; material schedule blocked."],
    };
  }

  const proposedResolution = resolveAlterationStage(project, basis, "proposed");
  if (!proposedResolution.ready) {
    return {
      ready: false,
      blockers: proposedResolution.blockers,
      basisReference: basis?.reference ?? "",
      rows: [],
      totalNetVolumeM3: 0,
      totalOrderAreaM2: 0,
      unknowns: ["Proposed alteration model could not be resolved."],
    };
  }

  const p = proposedResolution.model;
  const solids = wallSolids(p);
  const rows: AlterationMaterialItem[] = [];
  const unknowns: string[] = [];

  // Walls: new walls, plus infill on existing walls, plus repaired extensions
  for (const w of p.walls) {
    const status = w.lifecycle?.status;
    if (status !== "new" && status !== "repaired") continue;

    for (const l of w.layers) {
      if (l.kind === "void") continue;
      const pieces = solids.filter((s) => s.wallId === w.id && s.layerId === l.id);
      const envelope = pieces.reduce((s, v) => s + v.volumeM3, 0);
      const areaM2 = envelope / (l.thickness / 1000);
      const waste = l.wastePercent ?? 0;
      const orderArea = areaM2 * (1 + waste / 100);

      if (l.kind === "assembly") {
        unknowns.push(`Wall "${w.name}" layer "${l.name}" is an unspecified assembly; detailed material breakdown is blocked.`);
      }
      if (l.densityKgM3 === null && l.kind === "solid") {
        if (!unknowns.includes(`Layer "${l.name}" has unspecified density.`)) {
          unknowns.push(`Layer "${l.name}" has unspecified density.`);
        }
      }

      rows.push({
        id: `${w.id}/${l.id}`,
        sourceElementId: w.id,
        sourceElementName: w.name,
        lifecycleStatus: status,
        layerId: l.id,
        materialName: l.name,
        category: "Wall layer",
        thicknessMm: l.thickness,
        netAreaM2: areaM2,
        wastePercent: waste,
        orderAreaM2: orderArea,
        netVolumeM3: l.kind === "solid" ? envelope : null,
        supplierReference: l.supplierReference || "",
        rateRevision: l.rateRevision || "",
        notes: `${status === "new" ? "New construction" : "Repaired wall layer"}; ${waste}% waste included in order area.`,
      });
    }
  }

  // Slabs: new slabs
  for (const s of p.slabs.filter((s) => s.lifecycle?.status === "new")) {
    const areaM2 = area(s.points) / 1e6;
    const volM3 = (areaM2 * s.thickness) / 1000;
    rows.push({
      id: s.id,
      sourceElementId: s.id,
      sourceElementName: s.name,
      lifecycleStatus: "new",
      layerId: "slab",
      materialName: `${s.name} (${s.material})`,
      category: "Slab",
      thicknessMm: s.thickness,
      netAreaM2: areaM2,
      wastePercent: 0,
      orderAreaM2: areaM2,
      netVolumeM3: volM3,
      supplierReference: "",
      rateRevision: "",
      notes: "New concrete/substrate slab.",
    });
  }

  // Roofs: new roofs
  for (const r of p.roofs.filter((r) => r.lifecycle?.status === "new")) {
    let areaM2 = 0;
    for (const face of roofFaces(r)) {
      for (let i = 1; i < face.points.length - 1; i++) {
        const a = [face.points[i][0] - face.points[0][0], face.points[i][1] - face.points[0][1], face.heights[i] - face.heights[0]];
        const b = [face.points[i + 1][0] - face.points[0][0], face.points[i + 1][1] - face.points[0][1], face.heights[i + 1] - face.heights[0]];
        areaM2 += Math.hypot(a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]) / 2e6;
      }
    }
    rows.push({
      id: r.id,
      sourceElementId: r.id,
      sourceElementName: r.name,
      lifecycleStatus: "new",
      layerId: "roof-covering",
      materialName: `${r.name} Covering`,
      category: "Roof covering",
      thicknessMm: null,
      netAreaM2: areaM2,
      wastePercent: 5,
      orderAreaM2: areaM2 * 1.05,
      netVolumeM3: null,
      supplierReference: "",
      rateRevision: "",
      notes: "New roof covering; 5% standard pitch/cutting allowance applied.",
    });
  }

  const totalNetVolumeM3 = rows.reduce((s, r) => s + (r.netVolumeM3 ?? 0), 0);
  const totalOrderAreaM2 = rows.reduce((s, r) => s + r.orderAreaM2, 0);

  return {
    ready: true,
    blockers: [],
    basisReference: q.basisReference,
    rows,
    totalNetVolumeM3,
    totalOrderAreaM2,
    unknowns,
  };
}

/** CSV Exporters */

export function demolitionScheduleCsv(project: ArchitectProject, basis: AlterationBasis | null): string {
  const sched = calculateDemolitionSchedule(project, basis);
  const headers = ["Project ID", "Revision", "Element ID", "Kind", "Name", "Level", "Dimensions", "Net Area m2", "Volume m3", "Disposition", "Reference"];
  return [
    headers.map(cell).join(","),
    ...sched.rows.map((r) => [
      project.id, project.revision, r.id, r.kind, r.name, r.levelName,
      r.dimensions, r.areaM2.toFixed(3), r.volumeM3 !== null ? r.volumeM3.toFixed(3) : "", r.disposition, r.reference,
    ].map(cell).join(",")),
  ].join("\r\n") + "\r\n";
}

export function salvageDisposalScheduleCsv(
  project: ArchitectProject,
  basis: AlterationBasis | null,
  assumptions: DisposalAssumptions = DEFAULT_DISPOSAL_ASSUMPTIONS,
): string {
  const sched = calculateSalvageDisposalSchedule(project, basis, assumptions);
  const headers = ["Project ID", "Revision", "Element ID", "Element Name", "Material Name", "Category", "Net Volume m3", "Bulking Factor", "Gross Disposal Volume m3", "Est Weight kg", "Routing", "Salvageable", "Notes"];
  return [
    headers.map(cell).join(","),
    ...sched.rows.map((r) => [
      project.id, project.revision, r.elementId, r.elementName, r.materialName, r.category,
      r.netVolumeM3 !== null ? r.netVolumeM3.toFixed(3) : "", r.bulkingFactor.toFixed(2),
      r.grossDisposalVolumeM3 !== null ? r.grossDisposalVolumeM3.toFixed(3) : "",
      r.estimatedWeightKg !== null ? r.estimatedWeightKg.toFixed(1) : "",
      r.routing, r.salvageable ? "Yes" : "No", r.notes,
    ].map(cell).join(",")),
  ].join("\r\n") + "\r\n";
}

export function repairScheduleCsv(project: ArchitectProject, basis: AlterationBasis | null): string {
  const sched = calculateRepairSchedule(project, basis);
  const headers = ["Project ID", "Revision", "Element ID", "Kind", "Name", "Level", "Before Dimensions", "Proposed Dimensions", "Delta Volume m3", "Repair Reference", "Notes"];
  return [
    headers.map(cell).join(","),
    ...sched.rows.map((r) => [
      project.id, project.revision, r.id, r.kind, r.name, r.levelName,
      r.beforeDimensions, r.proposedDimensions, r.deltaVolumeM3.toFixed(3), r.repairBasisReference, r.notes,
    ].map(cell).join(",")),
  ].join("\r\n") + "\r\n";
}

export function alterationMaterialScheduleCsv(project: ArchitectProject, basis: AlterationBasis | null): string {
  const sched = calculateAlterationMaterialSchedule(project, basis);
  const headers = ["Project ID", "Revision", "Material ID", "Source Element", "Lifecycle", "Material Name", "Category", "Thickness mm", "Net Area m2", "Waste %", "Order Area m2", "Net Volume m3", "Supplier Reference", "Notes"];
  return [
    headers.map(cell).join(","),
    ...sched.rows.map((r) => [
      project.id, project.revision, r.id, r.sourceElementName, r.lifecycleStatus, r.materialName, r.category,
      r.thicknessMm !== null ? r.thicknessMm : "", r.netAreaM2.toFixed(3), r.wastePercent, r.orderAreaM2.toFixed(3),
      r.netVolumeM3 !== null ? r.netVolumeM3.toFixed(3) : "", r.supplierReference, r.notes,
    ].map(cell).join(",")),
  ].join("\r\n") + "\r\n";
}
