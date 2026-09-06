import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  attachMaterialSource,
  createProjectMaterials,
  newProjectMaterial,
  putProjectMaterial,
  projectMaterialsSchema,
  discoverMaterialMentions,
  applySheetDiscovery,
  disposeDiscovery,
  projectMaterialTotals,
  materialCoverage,
  restoreProjectMaterials,
  saveProjectMaterials,
  projectMaterialsKey,
  projectMaterialsExport,
  previewMaterialsBackup,
  type ProjectMaterial,
} from "./projectMaterials.ts";
const source = {
  sha256: "a".repeat(64),
  name: "Construction plans.pdf",
  pageCount: 3,
  discipline: "Structural" as const,
};
const start = () => attachMaterialSource(createProjectMaterials("project"), source);
function material(id = "slab"): ProjectMaterial {
  const m = newProjectMaterial(source, 1, id);
  return {
    ...m,
    physicalKey: `Main/Ground/${id}`,
    category: "Concrete",
    stock: { ...m.stock, stockCode: id, description: "Concrete slab", quantity: 20, unit: "m2" },
    quantityBasis: "measured",
    calculation: "4 m × 5 m net area; dimensioned slab plan",
    materialVolumePerUnitM3: 0.2,
    volumeReference: "200 mm slab thickness, S1.1",
  };
}
const memory = () => {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      data.set(k, v);
    },
  };
};
test("all supplied pages tracked; identical source bytes do not double source coverage", () => {
  const value = start();
  assert.equal(value.sheets.length, 3);
  assert.equal(attachMaterialSource(value, { ...source, name: "Renamed plans.pdf" }), value);
  assert.equal(materialCoverage(value).reviewedSheets, 0);
  assert.ok(materialCoverage(value).missingDisciplines.includes("Architectural"));
});
test("another source revision has independent sheet coverage", () => {
  const value = attachMaterialSource(start(), { ...source, sha256: "b".repeat(64) });
  assert.equal(value.sources.length, 2);
  assert.equal(value.sheets.length, 6);
});
test("material quantities, solid volume, packaged storage and mass are separate", () => {
  const m = material();
  m.stock.unitsPerPackage = 6;
  m.stock.lengthM = 2;
  m.stock.widthM = 1;
  m.stock.heightM = 0.5;
  m.stock.specifiedWeightKg = 4;
  m.stock.weightBasis = "unit";
  const result = projectMaterialTotals(putProjectMaterial(start(), m));
  assert.equal(result.materialVolume.value, 4);
  assert.equal(result.storageVolume.value, 4);
  assert.equal(result.weight.value, 80);
  assert.equal(result.quantities[0].unit, "m2");
});
test("unknown mass/packaging remains null; m3 quantity already represents material volume", () => {
  const m = material();
  m.stock.unit = "m3";
  m.materialVolumePerUnitM3 = null;
  const t = projectMaterialTotals(putProjectMaterial(start(), m));
  assert.equal(t.materialVolume.value, 20);
  assert.equal(t.storageVolume.value, null);
  assert.equal(t.weight.value, null);
});
test("physical scope deduplication ignores record IDs and letter case", () => {
  const v = putProjectMaterial(start(), material()),
    d = material("different-record");
  d.physicalKey = "MAIN/GROUND/SLAB";
  assert.throws(() => putProjectMaterial(v, d), /Duplicate physical/);
});
test("material changes invalidate review and increment revision without dropping evidence", () => {
  let m = material();
  m.review = "reviewed";
  m.reviewNote = "Dimensions and thickness checked";
  let v = putProjectMaterial(start(), m);
  m = { ...v.materials[0], specification: "Changed strength" };
  v = putProjectMaterial(v, m);
  assert.equal(v.materials[0].review, "pending");
  assert.equal(v.materials[0].stock.revision, 2);
  assert.equal(v.materials[0].evidence.length, 1);
  assert.throws(() => putProjectMaterial(v, m), /changed since/);
});
test("negative quantities, unsupported evidence and unproven approvals fail", () => {
  for (const apply of [
    (m: ProjectMaterial) => (m.stock.quantity = -1),
    (m: ProjectMaterial) => (m.evidence[0].page = 4),
    (m: ProjectMaterial) => (m.evidence[0].sha256 = "b".repeat(64)),
    (m: ProjectMaterial) => {
      m.review = "reviewed";
      m.reviewNote = "";
    },
    (m: ProjectMaterial) => (m.calculation = ""),
  ]) {
    const m = material();
    apply(m);
    assert.throws(() => putProjectMaterial(start(), m));
  }
});
test("repeated text matches only increment mentions, never physical quantities", () => {
  const text = "W10X22 beam. W10 x 22 beam. Concrete. Nuts, washers, insulation, doors and pipes.";
  const ds = discoverMaterialMentions(source.sha256, 1, text);
  assert.equal(ds.find((d) => d.label === "W10×22")?.mentions, 2);
  assert.ok(ds.some((d) => d.category === "Envelope & finishes"));
  const v = applySheetDiscovery(start(), source.sha256, 1, "S1.1", text);
  assert.equal(v.materials.length, 0);
  assert.equal(v.sheets[0].scan, "text");
});
test("zero-text page explicitly needs visual review; pending mentions block sheet signoff", () => {
  let v = applySheetDiscovery(start(), source.sha256, 1, "Scanned sheet", "");
  assert.equal(v.sheets[0].scan, "no-text");
  v = applySheetDiscovery(v, source.sha256, 2, "S2.1", "Concrete slab");
  v.sheets[1].reviewed = true;
  v.sheets[1].reviewNote = "Checked";
  assert.equal(projectMaterialsSchema.safeParse(v).success, false);
});
test("linking repeated evidence does not inflate stock; exclusion needs reason; rescans preserve dispositions", () => {
  let v = putProjectMaterial(start(), material());
  v = applySheetDiscovery(v, source.sha256, 2, "S2.1", "CONCRETE");
  const d = v.discoveries[0];
  assert.throws(() => disposeDiscovery(v, d.id, null, ""));
  v = disposeDiscovery(v, d.id, v.materials[0].stock.id, "");
  assert.equal(v.materials.length, 1);
  assert.equal(v.materials[0].stock.quantity, 20);
  assert.equal(v.materials[0].evidence.length, 2);
  v = applySheetDiscovery(v, source.sha256, 2, "S2.1", "CONCRETE CONCRETE");
  assert.equal(v.discoveries[0].status, "linked");
  assert.equal(v.discoveries[0].mentions, 2);
});
test("unreadable future or wrong-project snapshots cannot be overwritten by ordinary saves", () => {
  for (const raw of [
    "broken",
    JSON.stringify({ ...start(), schema: "future" }),
    JSON.stringify({ ...start(), projectId: "other" }),
  ]) {
    const store = memory();
    store.setItem(projectMaterialsKey("project"), raw);
    const session = restoreProjectMaterials(store, "project");
    assert.equal(session.blocked, true);
    saveProjectMaterials(store, session, start());
    assert.equal(store.getItem(projectMaterialsKey("project")), raw);
  }
});
test("persistent restore, rejected writes, and concurrent changes preserve previous bytes", () => {
  const store = memory();
  let session = restoreProjectMaterials(store, "project");
  session = saveProjectMaterials(store, session, putProjectMaterial(start(), material()));
  assert.equal(session.error, null);
  assert.deepEqual(restoreProjectMaterials(store, "project").value, session.value);
  const raw = session.raw;
  const denied = {
    getItem: store.getItem,
    setItem: () => {
      throw Error("quota");
    },
  };
  assert.ok(saveProjectMaterials(denied, session, start()).error);
  assert.equal(store.getItem(projectMaterialsKey("project")), raw);
  store.setItem(projectMaterialsKey("project"), "another session");
  assert.equal(saveProjectMaterials(store, session, start()).blocked, true);
  assert.equal(store.getItem(projectMaterialsKey("project")), "another session");
});
test("backup roundtrip validates project, schema, all evidence and physical identity", () => {
  const v = putProjectMaterial(start(), material()),
    backup = JSON.stringify(projectMaterialsExport(v));
  assert.deepEqual(previewMaterialsBackup(backup, "project"), v);
  assert.throws(() => previewMaterialsBackup(backup, "other"));
  const malformed = JSON.parse(backup);
  malformed.inventory.materials.push({
    ...malformed.inventory.materials[0],
    stock: { ...malformed.inventory.materials[0].stock, id: "other", stockCode: "other" },
  });
  assert.throws(() => previewMaterialsBackup(JSON.stringify(malformed), "project"));
});
test("real structural PDF text discovers multiple material families across all 23 sheets", async () => {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = getDocument({
    data: Uint8Array.from(readFileSync("public/sources/thornton-connection-trial/structural.pdf")),
  });
  const doc = await task.promise,
    pages: { page: number; text: string }[] = [];
  try {
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i),
        content = await page.getTextContent();
      pages.push({
        page: i,
        text: content.items.map((item) => ("str" in item ? item.str : "")).join(" "),
      });
    }
  } finally {
    await task.destroy();
  }
  const ds = pages.flatMap((p) => discoverMaterialMentions(source.sha256, p.page, p.text));
  const categories = new Set(ds.map((d) => d.category));
  assert.equal(pages.length, 23);
  assert.ok(categories.has("Structural steel"));
  assert.ok(categories.has("Masonry"));
  assert.ok(categories.has("Fixings & plates"));
  assert.ok(categories.has("Concrete & reinforcement"));
  assert.ok(ds.some((d) => d.label === "W10×22"));
  assert.ok(ds.length > 100);
});

test("physical dimensions require evidence and never imply solid or shipping volume", () => {
  const m = material();
  m.materialVolumePerUnitM3 = null;
  m.dimensionsM = { length: 2, width: 1, height: 0.1, depth: null };
  assert.throws(() => putProjectMaterial(start(), m), /Physical dimensions/);
  m.dimensionReference = "Dimensioned opening, A8.0";
  const totals = projectMaterialTotals(putProjectMaterial(start(), m));
  assert.equal(totals.materialVolume.value, null);
  assert.equal(totals.storageVolume.value, null);
});
test("text rescans cannot erase locally recognized image evidence", () => {
  let v = applySheetDiscovery(start(), source.sha256, 1, "Image sheet", "DOOR HARDWARE", 51);
  assert.equal(v.sheets[0].scan, "ocr");
  assert.equal(v.sheets[0].ocrConfidence, 51);
  assert.equal(applySheetDiscovery(v, source.sha256, 1, "Image sheet", ""), v);
});
test("linking another view invalidates review of every affected evidence sheet without changing quantity", () => {
  let v = putProjectMaterial(start(), material());
  v = applySheetDiscovery(v, source.sha256, 1, "S1.1", "Footing");
  v = disposeDiscovery(v, v.discoveries[0].id, null, "Not this slab");
  v.sheets[0].reviewed = true;
  v.sheets[0].reviewNote = "Previously reconciled";
  v = applySheetDiscovery(v, source.sha256, 2, "S2.1", "Concrete");
  v = disposeDiscovery(v, v.discoveries.find((d) => d.page === 2)!.id, v.materials[0].stock.id, "");
  assert.equal(v.sheets[0].reviewed, false);
  assert.equal(v.materials[0].stock.quantity, 20);
});

import { addThorntonPreparedMaterials, thorntonPreparedMaterials } from "./thorntonMaterials.ts";
import { projectMaterialsCsv } from "./projectMaterials.ts";
test("real prepared schedule: 40 door marks, 37 swinging leaves, five overhead assemblies and 35 frames", () => {
  const v = addThorntonPreparedMaterials(createProjectMaterials("thornton"));
  assert.equal(v.materials.length, 79);
  assert.equal(v.sources.length, 3);
  assert.equal(v.sheets.length, 60);
  const count = (category: string) =>
    v.materials.filter((m) => m.category === category).reduce((n, m) => n + m.stock.quantity!, 0);
  assert.equal(count("Door leaves"), 37);
  assert.equal(count("Overhead door assemblies"), 5);
  assert.equal(count("Door frame assemblies"), 35);
  for (const mark of ["124", "201"]) {
    const m = v.materials.find((m) => m.stock.stockCode === "FS8-DR-" + mark)!;
    assert.equal(m.stock.quantity, 2);
    assert.equal(m.dimensionsM.width, 34 * 0.0254);
  }
  assert.ok(v.materials.every((m) => m.review === "pending" && m.unresolved));
  assert.equal(materialCoverage(v).reviewedSheets, 0);
});
test("unique RTU tag appears in three views but counts once; scheduled mass stays separate from shipping", () => {
  const v = addThorntonPreparedMaterials(createProjectMaterials("thornton")),
    m = v.materials.find((m) => m.stock.stockCode === "FS8-RTU-1")!;
  assert.equal(m.stock.quantity, 1);
  assert.equal(m.evidence.length, 3);
  assert.equal(m.stock.specifiedWeightKg, 997.903214);
  const t = projectMaterialTotals(v);
  assert.equal(t.weight.value, 997.903214);
  assert.equal(t.weight.known, 1);
  assert.equal(t.materialVolume.value, null);
  assert.equal(t.storageVolume.value, null);
});
test("prepared import is idempotent and preserves edits to an existing physical item", () => {
  let v = addThorntonPreparedMaterials(createProjectMaterials("thornton"));
  const m = { ...v.materials[0], specification: "User revision" };
  v = putProjectMaterial(v, m);
  const next = addThorntonPreparedMaterials(v);
  assert.deepEqual(next, v);
  assert.equal(thorntonPreparedMaterials().length, 79);
});
test("flat materials export retains dimensions, actual drawing hashes, unresolved detail and formula protection", () => {
  let v = addThorntonPreparedMaterials(createProjectMaterials("thornton"));
  v = putProjectMaterial(v, { ...v.materials[0], specification: "=UNSAFE()" });
  const csv = projectMaterialsCsv(v);
  assert.match(csv, /Physical width m/);
  assert.match(csv, /Unresolved components/);
  assert.ok(csv.includes(v.sources[0].sha256));
  assert.match(csv, /'=UNSAFE/);
  assert.match(csv, /997.903214/);
  assert.match(csv, /Preliminary/);
});
