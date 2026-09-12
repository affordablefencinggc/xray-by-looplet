import test from "node:test";
import assert from "node:assert/strict";
import { indexNccPage, searchNcc, nccReferencePrompt, type NccDocument } from "./nccReferences.ts";

test("search preserves source edition, page and printed clause identifiers", () => {
  const passages = indexNccPage("fixture", 12, "A1G1 Test heading\nSample topic alpha\nA1G2 Another heading\nSample topic beta");
  const documents: NccDocument[] = [{ id: "fixture", name: "Synthetic test.pdf", edition: "Test edition, not NCC content", sha256: "abc", pageCount: 12, passages }];
  const matches = searchNcc(documents, "beta A1G2");
  assert.equal(matches[0].section, "A1G2");
  assert.equal(matches[0].page, 12);
  assert.equal(matches[0].edition, documents[0].edition);
  assert.ok(nccReferencePrompt(matches.slice(0, 1)).includes('"pdfPage": 12'));
  assert.equal(searchNcc(documents, "unmatchedword").length, 0);
});

test("empty libraries produce no invented references and unnumbered text stays unnumbered", () => {
  assert.deepEqual(searchNcc([], "fire"), []);
  assert.equal(indexNccPage("fixture", 1, "Unnumbered test material")[0].section, null);
  assert.throws(() => nccReferencePrompt([]), /Select/);
});

test("long pages remain bounded without losing source text", () => {
  const text = "a".repeat(12000);
  const passages = indexNccPage("fixture", 1, text);
  assert.ok(passages.every(p => p.text.length <= 3500));
  assert.equal(passages.map(p => p.text).join(""), text);
});
