/**
 * disciplines.ts — multi-discipline catalog for X-Ray by Looplet.
 *
 * The studio serves engineers, architects, civil & structural engineers,
 * draftsmen and builders. Each discipline maps to one engine trade pack
 * (engine/python/xray/packs_*.py); the pack id is what the engine's
 * quantity frames report. 'auto' leaves detection to the engine: every
 * registered pack whose detect() matches runs, nothing is pre-filtered.
 */

export type QuantityKind = "ea" | "lm" | "m2" | "m3" | "kg" | "t";

export type Discipline = {
  id: string;
  label: string;
  audience: string;
  /** Engine trade pack id (packs.py registry); null = let the engine decide. */
  packId: string | null;
  blurb: string;
  quantityKinds: QuantityKind[];
};

export const DEFAULT_DISCIPLINE_ID = "auto";

export const DISCIPLINES: Discipline[] = [
  {
    id: "auto",
    label: "Auto-detect",
    audience: "Any discipline",
    packId: null,
    blurb: "Let the engine decide — every registered trade pack whose detection matches the plan runs.",
    quantityKinds: ["ea", "lm", "m2", "m3", "kg", "t"],
  },
  {
    id: "architecture",
    label: "Architecture",
    audience: "Architects",
    packId: "residential",
    blurb: "Residential plans: rooms, areas, doors and windows — GFA and schedules from drawn evidence.",
    quantityKinds: ["ea", "lm", "m2", "m3"],
  },
  {
    id: "structural",
    label: "Structural",
    audience: "Structural Engineers",
    packId: "structural",
    blurb: "Columns, beams and members counted from structural layers — footprint areas and member counts.",
    quantityKinds: ["ea", "lm", "m2", "kg", "t"],
  },
  {
    id: "civil",
    label: "Civil",
    audience: "Civil Engineers",
    packId: "survey",
    blurb: "Survey sheets: points, chains and coverage measured straight from civil and survey drawings.",
    quantityKinds: ["ea", "lm", "m2"],
  },
  {
    id: "electrical",
    label: "Electrical",
    audience: "Electrical Engineers",
    packId: "electrical",
    blurb: "Electrical layouts: fixtures, runs and circuit counts from blocks and symbol placement.",
    quantityKinds: ["ea", "lm"],
  },
  {
    id: "building",
    label: "Building",
    audience: "Builders & Contractors",
    packId: "shed",
    blurb: "Portal-frame sheds and builder takeoffs — bays, pitch, framing and the bill of materials.",
    quantityKinds: ["ea", "lm", "m2", "m3", "kg", "t"],
  },
  {
    id: "fencing",
    label: "Fencing & External Works",
    audience: "Fencing contractors & landscapers",
    packId: "fencing",
    blurb: "Fence runs, gates and posts read from external-works geometry — no block required.",
    quantityKinds: ["ea", "lm"],
  },
];

export function listDisciplines(): Discipline[] {
  return DISCIPLINES;
}

/** Look up a discipline by id; unknown ids fall back to the default (auto). */
export function getDiscipline(id: string | null | undefined): Discipline {
  return DISCIPLINES.find((d) => d.id === id) ?? getDiscipline(DEFAULT_DISCIPLINE_ID);
}