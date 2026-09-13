import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyProject, newWall, validateProject, type ArchitectProject, type Point } from "./model.ts";
import { primitives, type View } from "./drawing.ts";
import { rooms } from "./geometry.ts";
import { issuableSheets, reviewIssueSet } from "./issueSet.ts";
import { recordDrawingIssue } from "./issueHistory.ts";
import { createAlterationBasis, resolveAlterationStage } from "./alterationStage.ts";

function alteration() {
  const p = emptyProject("stage-integration");
  const corners: Point[] = [[0, 0], [6000, 0], [6000, 4000], [0, 4000]];
  p.walls = corners.map((a, i) => ({
    ...newWall(p, p.levels[0].id, a, corners[(i + 1) % corners.length]),
    lifecycle: { status: "existing" as const, reference: "Survey S01" },
  }));
  p.walls.push({
    ...newWall(p, p.levels[0].id, [3000, 0], [3000, 4000]),
    id: "demolished-divider", lifecycle: { status: "demolished", reference: "Brief D01" },
  });
  p.dimensions.push({ id: "divider-dimension", revision: 1, wallId: "demolished-divider", offset: 500 });
  p.section = { a: [-1000, 2000], b: [7000, 2000] };
  return validateProject(p);
}

function resolved(p: ArchitectProject, stage: "before" | "proposed") {
  const result = resolveAlterationStage(p, createAlterationBasis(p, "Survey S01 and alteration brief A02"), stage);
  assert.equal(result.ready, true, JSON.stringify(result));
  if (!result.ready) throw Error("Stage fixture did not resolve");
  return result.model;
}

test("stage room boundaries merge after divider demolition without mutating the all-work model", () => {
  const p = alteration(), saved = JSON.stringify(p);
  const before = resolved(p, "before"), proposed = resolved(p, "proposed");
  assert.equal(rooms(before, p.levels[0].id).length, 2);
  assert.equal(rooms(proposed, p.levels[0].id).length, 1);
  assert.ok(rooms(proposed, p.levels[0].id)[0].areaM2 > rooms(before, p.levels[0].id).reduce((sum, room) => sum + room.areaM2, 0));
  assert.equal(JSON.stringify(p), saved);
});

test("all drawing views consume stage geometry; excluded wall and hosted dimension never reappear", () => {
  const p = alteration(), before = resolved(p, "before"), proposed = resolved(p, "proposed");
  const beforePlan = primitives(before, p.levels[0].id, "plan");
  assert.ok(beforePlan.some(item => item.id === "demolished-divider"));
  assert.ok(beforePlan.some(item => item.id === "divider-dimension"));
  for (const view of ["plan", "north", "south", "east", "west", "section"] as View[]) {
    const drawing = primitives(proposed, p.levels[0].id, view);
    assert.ok(drawing.length, `${view} must render stage content`);
    assert.equal(drawing.some(item => item.id === "demolished-divider" || item.id === "divider-dimension"), false, view);
  }
});

test("new window is absent from before plan and present in proposed plan", () => {
  const p = alteration();
  p.openings.push({ id: "new-window", revision: 1, wallId: p.walls[0].id, tag: "NW01", kind: "window", offset: 1500,
    width: 900, height: 1200, sill: 900, hinge: "left", swing: "in", lifecycle: { status: "new", reference: "Brief W01" } });
  const before = primitives(resolved(p, "before"), p.levels[0].id, "plan");
  const proposed = primitives(resolved(p, "proposed"), p.levels[0].id, "plan");
  assert.equal(before.some(item => item.id === "new-window"), false);
  assert.ok(proposed.some(item => item.id === "new-window" && item.text === "NW01"));
});

test("stage resolution and drawing do not alter frozen issued geometry or canonical saved bytes", () => {
  const p = alteration();
  const review = reviewIssueSet(p, issuableSheets(p).map(sheet => sheet.id), "Alteration review");
  const issued = recordDrawingIssue(p, review, new Date("2026-09-14T02:00:00Z"), () => "stage-issue");
  const saved = JSON.stringify(issued), history = JSON.stringify(issued.issues);
  for (const stage of ["before", "proposed"] as const) {
    const model = resolved(issued, stage);
    primitives(model, p.levels[0].id, "section");
    model.walls[0].height += 100;
  }
  assert.equal(JSON.stringify(issued), saved);
  assert.equal(JSON.stringify(issued.issues), history);
});

for (const change of ["wall", "level", "classification"] as const) {
  test(`reviewed stage basis refuses later ${change} changes without returning a drawable model`, () => {
    const p = alteration(), basis = createAlterationBasis(p, "Reviewed survey S01"), next = structuredClone(p);
    if (change === "wall") next.walls[0].height += 100;
    else if (change === "level") next.levels[0].elevation += 100;
    else next.walls[0].lifecycle = { status: "repaired", reference: "Revised brief R01" };
    const result = resolveAlterationStage(next, basis, "before");
    assert.equal(result.ready, false);
    assert.equal("model" in result, false);
  });
}
