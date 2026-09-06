import { THORNTON_LIBRARY } from "./thorntonLibrary.ts";
import {
  attachMaterialSource,
  newProjectMaterial,
  putProjectMaterial,
  type ProjectMaterials,
  type ProjectMaterial,
} from "./projectMaterials.ts";
// Manual transcription from the rendered A8.0 door schedule (PDF page 23).
// Entries are physical door marks, not occurrences of their text in other views.
const DOORS = [
  ["100", "Aluminium", 1, "A", 1, 36, 106, 1.75],
  ["102", "Stained wood", 2, "1A", 12, 36, 94, 1.75],
  ["103", "Stained wood", 2, "1A", 8, 36, 94, 1.75],
  ["104", "Stained wood", 2, "1A", 14, 36, 94, 1.75],
  ["107A", "Stained wood", 5, "X1", 19, 36, 94, 1.75],
  ["107B", "Painted hollow metal", 5, "1A", 4, 36, 94, 1.75],
  ["108", "Aluminium", 1, "E", 2, 42, 106, 1.75],
  ["109", "Stained wood", 3, "1A", 15, 36, 94, 1.75],
  ["110", "Stained wood", 2, "1A", 5, 36, 94, 1.75],
  ["111", "Stained wood", 2, "1A", 10, 36, 94, 1.75],
  ["112", "Stained wood", 2, "1A", 10, 36, 94, 1.75],
  ...["113", "114", "115", "116", "117", "118"].map(
    (mark) => [mark, "Stained wood", 2, "1A", 11, 36, 94, 1.75] as const,
  ),
  ["119A", "Stained wood", 4, "1A", 17, 36, 94, 1.75],
  ["119B", "Aluminium", 6, "", 21, 120, 120, 2],
  ["119C", "Aluminium", 1, "L", 3, 36, 106, 1.75],
  ["120", "Aluminium", 1, "G", 3, 36, 106, 1.75],
  ["121A", "Stained wood", 5, "1A", 19, 36, 94, 1.75],
  ["121B", "Painted hollow metal", 5, "1A", 4, 36, 94, 1.75],
  ["123", "Stained wood", 2, "1A", 15, 36, 94, 1.75],
  ["124", "Painted hollow metal", 2, "1A", 7, 34, 94, 1.75],
  ["125A", "Stained wood", 2, "1A", 10, 36, 94, 1.75],
  ["125B", "Painted hollow metal", 2, "1A", 13, 36, 94, 1.75],
  ["126", "Painted hollow metal", 3, "1A", 18, 36, 94, 1.75],
  ["127", "Painted hollow metal", 2, "1A", 9, 36, 94, 1.75],
  ...["128A", "128B", "128C", "128D"].map(
    (mark) => [mark, "Aluminium", 7, "", 21, 168, 168, 2] as const,
  ),
  ["128E", "Aluminium", 1, "N", 3, 36, 106, 1.75],
  ["128F", "Aluminium", 1, "N opposite hand", 3, 36, 106, 1.75],
  ["129", "Painted hollow metal", 3, "1A", 20, 44, 94, 1.75],
  ["130", "Painted hollow metal", 3, "1A", 18, 44, 94, 1.75],
  ["132", "Painted hollow metal", 2, "1A", 16, 44, 94, 1.75],
  ["201", "Painted hollow metal", 2, "1A", 6, 34, 94, 1.75],
  ["202", "Painted hollow metal", 2, "1A", 16, 44, 94, 1.75],
] as const;
export function thorntonPreparedMaterials(): ProjectMaterial[] {
  const architecture = THORNTON_LIBRARY.find((d) => d.discipline === "Architectural")!,
    structure = THORNTON_LIBRARY.find((d) => d.discipline === "Structural")!,
    mechanical = THORNTON_LIBRARY.find((d) => d.discipline === "Mechanical")!;
  const rows: ProjectMaterial[] = [];
  for (const [mark, material, type, frame, hardware, width, height, depth] of DOORS) {
    const overhead = type === 6 || type === 7,
      pair = mark === "124" || mark === "201",
      m = newProjectMaterial(architecture, 23, `fs8-door-${mark}`);
    Object.assign(m, {
      physicalKey: `FS8/${mark}/door`,
      floor: mark.startsWith("2") ? "Mezzanine" : "Main level",
      location: `Door mark ${mark}`,
      category: overhead ? "Overhead door assemblies" : "Door leaves",
      quantityBasis: "scheduled",
      calculation: pair
        ? "A8.0 lists one pair at this unique door mark: two leaves."
        : "A8.0 lists this unique door mark once; one scheduled door unit.",
      specification: `${material}; door type ${type}; hardware group ${hardware}; ${width} × ${height} × ${depth} inches${pair ? " per leaf; paired opening" : ""}.`,
      dimensionsM: {
        length: null,
        width: width * 0.0254,
        height: height * 0.0254,
        depth: depth * 0.0254,
      },
      dimensionReference: "A8.0 door schedule; inch dimensions converted using 0.0254 m/in.",
      unresolved:
        "Hardware group contents, glazing/cores, fixings, procurement weight and packaging remain uncounted. Overall door dimensions do not establish solid material volume.",
    });
    Object.assign(m.stock, {
      stockCode: `FS8-DR-${mark}`,
      description: `${material} ${overhead ? "overhead door assembly" : "door leaf"} · ${mark}`,
      quantity: pair ? 2 : 1,
      reference:
        "Architectural A8.0 / PDF page 23, door schedule; reconcile with floor plans and hardware specifications.",
    });
    rows.push(m);
    if (frame) {
      const f = newProjectMaterial(architecture, 23, `fs8-frame-${mark}`);
      Object.assign(f, {
        physicalKey: `FS8/${mark}/frame`,
        floor: m.floor,
        location: m.location,
        category: "Door frame assemblies",
        quantityBasis: "scheduled",
        calculation:
          "One scheduled frame assembly at this unique door mark; frame sections are not separately quantified.",
        specification: `Frame ${frame}; ${material === "Aluminium" ? "aluminium" : "painted hollow metal"}.`,
        unresolved: "Frame section lengths, anchors, grout, seals and hardware remain unresolved.",
      });
      Object.assign(f.stock, {
        stockCode: `FS8-FR-${mark}`,
        description: `${material === "Aluminium" ? "Aluminium" : "Painted hollow-metal"} frame assembly · ${mark}`,
        quantity: 1,
        reference: "Architectural A8.0 / PDF page 23, corresponding frame schedule column.",
      });
      rows.push(f);
    }
  }
  for (const [code, description, quantity, category, calculation] of [
    [
      "BEAMS",
      "W10×22 interior roof beams",
      8,
      "Structural steel",
      "Eight interior beam lines in the second apparatus-bay span from north; outermost lines excluded.",
    ],
    [
      "PLATES",
      "Single shear plates for selected beam ends",
      16,
      "Connection plates",
      "Eight beams × two ends; detail 1/S5.1 specifies one shear plate per connection.",
    ],
    [
      "BOLTS",
      "7/8-inch ASTM A325N bolts for selected beam ends",
      32,
      "Fasteners",
      "Eight beams × two ends × two bolts using lesser nominal depth D=10 in, S0.6.",
    ],
  ] as const) {
    const m = newProjectMaterial(structure, 10, `fs8-roof-${code}`);
    Object.assign(m, {
      physicalKey: `FS8/roof/selected-interior-span/${code}`,
      floor: "High roof",
      location: "S2.2 second apparatus-bay span, eight interior beam lines",
      category,
      quantityBasis: "derived",
      calculation,
      specification: description,
      unresolved:
        "Remaining roof spans and connections excluded. Length, complete section dimensions, mass and packaging are unresolved.",
    });
    Object.assign(m.stock, {
      stockCode: `FS8-ROOF-${code}`,
      description,
      quantity,
      reference: "S2.2 page 10; S0.6 page 6; S5.1 detail 1 page 18. Bounded source trial.",
    });
    m.evidence.push(
      { sha256: structure.sha256, page: 6, reference: "S0.6", x: null, y: null },
      { sha256: structure.sha256, page: 18, reference: "1/S5.1", x: null, y: null },
    );
    rows.push(m);
  }
  const rtu = newProjectMaterial(mechanical, 2, "fs8-RTU-1");
  Object.assign(rtu, {
    physicalKey: "FS8/roof/RTU-1",
    floor: "Roof",
    location: "RTU-1, M2.1 / M2.2",
    category: "HVAC equipment",
    quantityBasis: "scheduled",
    calculation:
      "One unique equipment tag RTU-1 in M1.1 schedule, referenced from M2.1 and M2.2. Repeated callouts are not additional units.",
    specification:
      "Rooftop heating/cooling unit. M1.1 scheduled unit weight 2200 lb, including 24-inch roof curb, economizer and hail guard per schedule note 4.",
    unresolved:
      "Ducts, pipework, cables, supports and installation fixings are additional materials. Shipping packaging and material volume unknown.",
  });
  Object.assign(rtu.stock, {
    stockCode: "FS8-RTU-1",
    description: "Rooftop heating and cooling unit RTU-1",
    quantity: 1,
    specifiedWeightKg: 2200 * 0.45359237,
    reference:
      "M1.1 mechanical schedules, PDF page 2; 2200 lb × 0.45359237 kg/lb. This is scheduled operating/unit weight, not shipping package weight.",
  });
  rtu.evidence.push(
    { sha256: mechanical.sha256, page: 5, reference: "M2.1 RTU-1 on roof", x: null, y: null },
    { sha256: mechanical.sha256, page: 6, reference: "M2.2 RTU-1 on roof", x: null, y: null },
  );
  rows.push(rtu);
  return rows;
}
export function addThorntonPreparedMaterials(value: ProjectMaterials): ProjectMaterials {
  let next = value;
  for (const d of THORNTON_LIBRARY.filter((s) =>
    ["Architectural", "Structural", "Mechanical"].includes(s.discipline),
  ))
    next = attachMaterialSource(next, {
      name: d.name,
      sha256: d.sha256,
      pageCount: d.pageCount,
      discipline: d.discipline,
    });
  for (const material of thorntonPreparedMaterials())
    if (
      !next.materials.some(
        (m) => m.physicalKey.toLowerCase() === material.physicalKey.toLowerCase(),
      )
    )
      next = putProjectMaterial(next, material);
  return next;
}
