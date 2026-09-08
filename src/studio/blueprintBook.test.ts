import test from "node:test";
import assert from "node:assert/strict";
import { PDFDict, PDFDocument, PDFName, PDFRawStream, PageSizes } from "pdf-lib";
import { BLUEPRINT_NOTICE, buildBlueprintPdf, generatePlanBook, prepareBlueprintBook } from "./blueprintBook.ts";
import { parseSourceBuilding, type SourceBuilding } from "./sourceBuilding.ts";

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1cAAAAASUVORK5CYII=";
function fixture(): SourceBuilding {
  const sourceRefs = [{ page: 1, region: [0, 0, 100, 100] as [number, number, number, number], evidenceState: "inferred" as const, note: "Synthetic unit fixture, not a project drawing." }];
  const part = (id: string, category: "wall" | "slab", positions: number[]) => ({ id, label: id, category, material: "concrete", positions, indices: [0, 1, 2], sourceRefs: structuredClone(sourceRefs), evidenceState: "inferred" as const });
  return {
    schema: "xray.source-building/v1", units: "m", coordinateSystem: "Local X/Y/Z; Y up; no surveyed datum",
    source: { name: "unit-fixture.pdf", title: "Synthetic triangle fixture", sha256: "a".repeat(64), pageCount: 1 },
    bounds: { min: [0, 0, 0], max: [10, 6, 8] },
    materials: { concrete: { color: "#cccccc" } },
    objects: [part("ground", "slab", [1, 0, 2, 4, 0, 2, 1, 0, 6]), part("wall", "wall", [1, 0, 2, 1, 3, 2, 4, 3, 2]), part("upper", "slab", [1, 3, 2, 4, 3, 2, 1, 3, 6])],
    assumptions: ["Synthetic test data; inferred geometry."],
    sourceSheets: [{ page: 1, title: "Fixture", image: "/models/unit-fixture/source-page-1.png", width: 100, height: 100, role: "unit test" }],
    summary: { wallRuns: 1, openings: 0, roofFaces: 0, objects: 3, visibleNamedRooms: 0, method: "Synthetic fixture", status: "inferred" },
  };
}
const levels = () => [{ label: "Ground", elevation: 0, progress: 0 }, { label: "Upper", elevation: 3, progress: 1 }];

test("valid evidenced triangles project from actual coordinates; no generated core, walls or grids", () => {
  const model = fixture(); assert.deepEqual(parseSourceBuilding(model), model);
  const prepared = prepareBlueprintBook({ model, storeys: levels() });
  const lowest = prepared.pages.find(p => p.id === "S-101")!;
  assert.deepEqual(lowest.triangles.map(t => t.partId), ["ground", "wall"]);
  assert.deepEqual(lowest.triangles[0], { partId: "ground", evidenceState: "inferred", points: [[1, 2], [4, 2], [1, 6]] });
  const elevation = prepared.pages.find(p => p.id === "S-201")!;
  assert.equal(elevation.triangles.length, model.objects.length);
  assert.deepEqual(elevation.triangles[1].points, [[1, 0], [1, 3], [4, 3]]);
  model.objects[0].positions[0] = 2;
  assert.equal(prepareBlueprintBook({ model, storeys: levels() }).pages[1].triangles[0].points[0][0], 2);
  assert.equal(prepared.pages[1].triangles[0].points[0][0], 1, "preparation snapshots the source rather than keeping mutable vertex references");
});

test("rejects malformed triangles and missing source evidence before canvas rendering", () => {
  const bad = fixture(); bad.objects[0].positions = [1, 0, 2, 4, 0, 2];
  assert.throws(() => prepareBlueprintBook({ model: bad, storeys: levels() }));
  const invalidIndex = fixture(); invalidIndex.objects[0].indices[2] = 3;
  assert.throws(() => prepareBlueprintBook({ model: invalidIndex, storeys: levels() }), /triangle mesh/);
  for (const mutate of [
    (m: SourceBuilding) => { delete (m.source as Partial<SourceBuilding["source"]>).pageCount; },
    (m: SourceBuilding) => { m.objects[0].sourceRefs = []; },
    (m: SourceBuilding) => { delete (m.objects[0] as Partial<SourceBuilding["objects"][number]>).evidenceState; },
    (m: SourceBuilding) => { m.objects[0].sourceRefs[0].page = 2; },
  ]) {
    const model = fixture(); mutate(model);
    assert.throws(() => generatePlanBook({ model, storeys: levels() }));
  }
});

test("all views are NTS with honest projection names; no upper storey is fabricated", () => {
  const before = Date.now(), result = prepareBlueprintBook({ model: fixture(), storeys: levels() });
  assert.ok(Date.parse(result.generatedAt) >= before && Date.parse(result.generatedAt) <= Date.now());
  assert.ok(result.pages.every(p => p.scale === "NTS" && p.notes.some(n => n.includes("do not measure"))));
  assert.equal(result.pages[3].title, "Model elevation projection");
  assert.match(result.pages[3].subtitle, /not a section cut/);
  assert.match(result.pages[4].subtitle, /Raster capture/);
  assert.ok(!/VERIFIED BIM|1:100|A1|CAD REV|Transverse Section Cut/.test(JSON.stringify(result.pages)));
  const oneLevel = prepareBlueprintBook({ model: fixture(), storeys: [levels()[0]] });
  assert.equal(oneLevel.pages[2].triangles.length, 0);
  assert.match(oneLevel.pages[2].subtitle, /No distinct upper level/);
});

test("rejects invalid and nonascending level schedules", () => {
  for (const storeys of [[], levels().reverse(), [...levels(), { label: "Outside", elevation: 7, progress: 1 }], [{ label: "Bad", elevation: NaN, progress: 0 }]]) {
    assert.throws(() => prepareBlueprintBook({ model: fixture(), storeys }), /level schedule/);
  }
});

test("headless generation fails explicitly instead of returning mock PNG bytes", () => {
  assert.throws(() => generatePlanBook({ model: fixture(), storeys: levels() }), /browser canvas/);
});

// A drawing-command recorder tests text and layout inputs only. It is NOT canvas/pixel/browser proof.
function recordDrawing(run: (pages: string[][]) => void, contextAvailable = true) {
  const pages: string[][] = [], prior = Object.getOwnPropertyDescriptor(globalThis, "document");
  Object.defineProperty(globalThis, "document", { configurable: true, value: {
    createElement: () => {
      const strings: string[] = []; pages.push(strings);
      const noop = () => {};
      const context = { fillText: (value: string) => strings.push(value), measureText: (value: string) => ({ width: value.length * 6 }),
        fillRect: noop, strokeRect: noop, save: noop, restore: noop, beginPath: noop, closePath: noop, rect: noop, clip: noop, moveTo: noop, lineTo: noop, stroke: noop, drawImage: noop };
      return { width: 0, height: 0, getContext: () => contextAvailable ? context : null, toDataURL: () => PNG };
    },
  } });
  try { run(pages); } finally { if (prior) Object.defineProperty(globalThis, "document", prior); else Reflect.deleteProperty(globalThis, "document"); }
}

test("drawing instructions mark every sheet as illustrative and preserve all 52 level labels", () => {
  recordDrawing(pages => {
    const model = fixture(); model.bounds.max[1] = 52;
    const storeys = Array.from({ length: 52 }, (_, i) => ({ label: `Level ${i + 1}`, elevation: i, progress: i / 51 }));
    const book = generatePlanBook({ model, storeys, dimensions: { widthMm: 999, depthMm: 999, heightMm: 999, widthLabel: "FALSE_DIMENSION", depthLabel: "FALSE_DIMENSION", heightLabel: "FALSE_DIMENSION" } });
    assert.equal(book.projectNumber, "Unassigned");
    assert.ok(pages.every(strings => strings.includes(BLUEPRINT_NOTICE)));
    for (const level of storeys) assert.ok(pages[0].includes(level.label), `${level.label} missing`);
    assert.ok(pages.every(strings => strings.some(t => t.includes(`Generated ${book.generatedAt.slice(0, 10)} UTC`))));
    assert.ok(pages.every(strings => strings.some(t => t.includes("Revision: unassigned"))));
    assert.ok(pages[0].some(t => t.includes("X 10000 mm") && t.includes("Y 52000 mm")));
    assert.ok(!pages.flat().some(t => /FALSE_DIMENSION|XRAY VERIFIED BIM|CAD REV 2\.4|1:100 @ A1/.test(t)));
    assert.ok(pages[4].includes("No current model snapshot was supplied."));
    assert.throws(() => book.downloadSheet("absent"), /does not exist/);
  });
});

test("missing 2D context is an explicit generation error", () => {
  recordDrawing(() => assert.throws(() => generatePlanBook({ model: fixture(), storeys: levels() }), /2D sheet renderer/), false);
});

test("PDF is parseable A4 landscape with real embedded PNG streams and honest metadata", async () => {
  // A real one-pixel PNG isolates PDF byte integrity. It does not establish visual sheet acceptance.
  const generatedAt = new Date().toISOString();
  const bytes = await buildBlueprintPdf(Array.from({ length: 5 }, () => ({ dataUrl: PNG })), { title: "Raster export integrity fixture", generatedAt });
  assert.match(new TextDecoder().decode(bytes.slice(0, 8)), /^%PDF-/);
  const pdf = await PDFDocument.load(bytes);
  assert.equal(pdf.getPageCount(), 5); assert.equal(pdf.getSubject(), BLUEPRINT_NOTICE);
  assert.equal(pdf.getTitle(), "Raster export integrity fixture");
  assert.equal(pdf.getCreationDate()?.toISOString().slice(0, 19), generatedAt.slice(0, 19));
  for (const page of pdf.getPages()) {
    assert.equal(page.getWidth(), PageSizes.A4[1]); assert.equal(page.getHeight(), PageSizes.A4[0]);
    const resources = page.node.Resources()!, images = resources.lookup(PDFName.of("XObject"), PDFDict);
    assert.equal(images.entries().length, 1);
    const image = pdf.context.lookup(images.entries()[0][1]);
    assert.ok(image instanceof PDFRawStream);
    assert.equal(image.dict.get(PDFName.of("Subtype"))?.toString(), "/Image");
    assert.ok(image.contents.length > 0);
  }
});

test("PDF rejects empty pages, fake bytes, wrong media, and invalid dates", async () => {
  const metadata = { title: "Failure fixture", generatedAt: new Date().toISOString() };
  await assert.rejects(buildBlueprintPdf([], metadata), /rendered sheets/);
  await assert.rejects(buildBlueprintPdf([{ dataUrl: "data:image/png;base64,mockPlanBookBytes" }], metadata));
  await assert.rejects(buildBlueprintPdf([{ dataUrl: "data:image/jpeg;base64,YWJj" }], metadata), /PNG/);
  await assert.rejects(buildBlueprintPdf([{ dataUrl: PNG }], { ...metadata, generatedAt: "invalid" }), /date/);
});
