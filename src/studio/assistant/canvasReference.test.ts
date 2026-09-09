import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  describeArchitectEntity,
  describeSourcePart,
  formatReference,
  mergeDraft,
  useCanvasPick,
  REFERENCE_MAX_CHARS,
  type ArchitectLike,
} from "./canvasReference.ts";
import { useLiveAssistant } from "../liveAssistantState.ts";

const layer = { id: "l1", name: "Brick", thickness: 110, kind: "solid" as const, hatch: "brick" as const, densityKgM3: null, rateM2: null, supplierReference: "", rateRevision: "", wastePercent: 0 };
const design: ArchitectLike = {
  levels: [{ id: "lv-ground", name: "Ground", elevation: 0, height: 3000 }],
  walls: [{ id: "w1", revision: 1, levelId: "lv-ground", name: "North wall", a: [0, 0], b: [10000, 0], height: 2700, layers: [layer] }],
  openings: [{ id: "d1", revision: 1, wallId: "w1", tag: "D01", kind: "door", offset: 1200, width: 920, height: 2040, sill: 0, hinge: "left", swing: "in" }],
  lines: [{ id: "ln1", revision: 1, levelId: "lv-ground", a: [1, 2], b: [3, 4] }],
  circles: [],
  arcs: [],
  roomTags: [{ id: "r1", revision: 1, levelId: "lv-ground", point: [5000, 3000], name: "Kitchen" }],
  slabs: [{ id: "s1", revision: 1, levelId: "lv-ground", name: "Ground slab", points: [[0, 0], [10000, 0], [10000, 8000], [0, 8000]], thickness: 150, offset: 0, material: "Concrete" }],
  roofs: [{ id: "rf1", revision: 1, levelId: "lv-ground", name: "Main roof", points: [[0, 0], [10000, 0], [10000, 8000], [0, 8000]], offset: 0, eaves: 450, fasciaHeight: 140, fasciaThickness: 20, gutterEnabled: true, gutterWidth: 125, gutterDepth: 90, gutterThickness: 1.2, edges: [{ pitch: 22.5, gable: false }, { pitch: 22.5, gable: true }, { pitch: 22.5, gable: false }, { pitch: 22.5, gable: true }] }],
  grids: [{ id: "g1", revision: 1, label: "A", axis: "x", position: 0 }],
  dimensions: [{ id: "dm1", revision: 1, wallId: "w1", offset: 600 }],
};

describe("describeArchitectEntity", () => {
  it("describes a wall with its level, endpoints in mm and length", () => {
    const ref = describeArchitectEntity(design, "w1");
    assert.equal(ref?.kind, "architect-entity");
    if (ref?.kind !== "architect-entity") return;
    assert.equal(ref.entity, "wall");
    assert.equal(ref.levelName, "Ground");
    assert.match(ref.summary, /from \(0, 0\) to \(10000, 0\) mm, length 10000 mm, height 2700 mm, 1 layer/);
  });
  it("resolves an opening's level through its host wall and keeps the wall id in the summary", () => {
    const ref = describeArchitectEntity(design, "d1");
    assert.equal(ref?.kind === "architect-entity" && ref.entity, "door");
    assert.equal(ref?.kind === "architect-entity" && ref.levelId, "lv-ground");
    assert.match(ref?.summary ?? "", /in wall w1, offset 1200 mm/);
  });
  it("covers every entity family and returns null for unknown ids", () => {
    for (const [id, entity] of [["lv-ground", "level"], ["ln1", "line"], ["r1", "room"], ["s1", "slab"], ["rf1", "roof"], ["g1", "grid"], ["dm1", "dimension"]] as const) {
      const ref = describeArchitectEntity(design, id);
      assert.equal(ref?.kind === "architect-entity" && ref.entity, entity, id);
    }
    assert.match(describeArchitectEntity(design, "rf1")?.summary ?? "", /10000 × 8000 mm from \(0, 0\), eaves 450 mm, pitches 22.5°\/gable\/22.5°\/gable/);
    assert.equal(describeArchitectEntity(design, "missing"), null);
  });
  it("clips very long summaries so the reference fits the composer", () => {
    const long = { ...design, roomTags: [{ id: "r2", revision: 1, levelId: "lv-ground", point: [0, 0] as [number, number], name: "x".repeat(400) }] };
    const ref = describeArchitectEntity(long, "r2");
    assert.ok((ref?.summary.length ?? 0) <= REFERENCE_MAX_CHARS);
  });
});

describe("describeSourcePart", () => {
  const scene = { objects: [{ id: "p-1", category: "wall" as const, label: "North wall", storey: "upper", positions: [0, 0, 0, 4, 0, 0, 4, 2.7, 1], indices: [0, 1, 2], material: "brick", evidenceState: "traced" as const, sourceRefs: [{ page: 3, region: [0, 0, 1, 1] as [number, number, number, number], evidenceState: "traced" as const, note: "" }] }] };
  it("reports bounds in metres, evidence and source pages", () => {
    const ref = describeSourcePart(scene, "redburn", "p-1");
    assert.equal(ref?.kind, "source-part");
    if (ref?.kind !== "source-part") return;
    assert.equal(ref.storey, "upper");
    assert.match(ref.summary, /4\.00 × 1\.00 m footprint, 2\.70 m tall/);
    assert.match(ref.summary, /evidence traced, source pages 3/);
    assert.equal(describeSourcePart(scene, "redburn", "nope"), null);
  });
});

describe("formatReference and mergeDraft", () => {
  it("formats one bracketed line carrying the exact id and level", () => {
    const text = formatReference(describeArchitectEntity(design, "w1")!);
    assert.equal(text.includes("\n"), false);
    assert.match(text, /^\[Reference · wall id w1 on level "Ground" \(lv-ground\) · North wall/);
    assert.match(formatReference({ kind: "view", target: "architect-plan", summary: "Ground, 12 walls" }), /^\[Reference · architect-plan view · Ground, 12 walls\]$/);
  });
  it("appends to an existing draft without duplicating the reference or the intent", () => {
    const ref = "[Reference · wall id w1]";
    assert.equal(mergeDraft("", ref), ref);
    assert.equal(mergeDraft("Please look at this ", ref, "Explain it."), `Please look at this\n${ref}\nExplain it.`);
    assert.equal(mergeDraft(`Hello\n${ref}\nExplain it.`, ref, "Explain it."), `Hello\n${ref}\nExplain it.`);
  });
});

describe("useCanvasPick", () => {
  it("accepts only the requested kinds and inserts the reference into the draft", () => {
    useLiveAssistant.setState({ draft: "", open: false });
    useCanvasPick.getState().start({ prompt: "Click a wall", accept: ["architect-entity"], intent: "Move this wall 500 mm north." });
    assert.equal(useCanvasPick.getState().resolve({ kind: "view", target: "architect-plan", summary: "x" }), false);
    assert.equal(useCanvasPick.getState().resolve(describeSourcePart({ objects: [] }, "redburn", "p") ?? { kind: "source-part", building: "redburn", partId: "p", category: "wall", label: "w", storey: null, evidenceState: "traced", summary: "s" }), false);
    assert.ok(useCanvasPick.getState().request, "still picking after a rejected kind");
    assert.equal(useCanvasPick.getState().resolve(describeArchitectEntity(design, "w1")!), true);
    assert.equal(useCanvasPick.getState().request, null);
    assert.equal(useLiveAssistant.getState().open, true);
    assert.match(useLiveAssistant.getState().draft, /\[Reference · wall id w1 .*\]\nMove this wall 500 mm north\.$/);
    useCanvasPick.getState().start({ prompt: "x", accept: ["source-part"] });
    useCanvasPick.getState().cancel();
    assert.equal(useCanvasPick.getState().request, null);
  });
});
