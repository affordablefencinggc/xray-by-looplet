import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BUILDING_CATALOG } from "./sourceBuilding.ts";
import { SOURCE_SHEET_TITLES, sheetDisplayName } from "./sourceSheetTitles.ts";

const REDBURN = "b57956f76b5dc893ac2b28a021f3f92e345807e326d6b1f8313e373f9145ad38";

test("curated titles match every catalogue model's sourceSheets", () => {
  for (const entry of BUILDING_CATALOG) {
    const model = JSON.parse(readFileSync(`public${entry.sceneUrl}`, "utf8")) as { source: { sha256: string }; sourceSheets: { page: number; title: string }[] };
    assert.equal(model.source.sha256, entry.sha256, entry.id);
    assert.deepEqual(SOURCE_SHEET_TITLES[entry.sha256], Object.fromEntries(model.sourceSheets.map(sheet => [sheet.page, sheet.title])), entry.id);
  }
});

test("default names take the curated title; renamed pages and unknown sources keep their own name", () => {
  assert.equal(sheetDisplayName("Sheet 1", 0, REDBURN), "Cover perspective");
  assert.equal(sheetDisplayName("Sheet 12", 11, REDBURN), SOURCE_SHEET_TITLES[REDBURN][12]);
  assert.equal(sheetDisplayName("Fence line survey", 11, REDBURN), "Fence line survey");
  assert.equal(sheetDisplayName("Sheet 3", 2, "0".repeat(64)), "Sheet 3");
  assert.equal(sheetDisplayName("Sheet 3", 2, null), "Sheet 3");
});
