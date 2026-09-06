import { test } from "node:test";
import assert from "node:assert/strict";
import { reviewMatchesSource, type AssistantReviewRequest } from "./liveAssistantState.ts";

const request: AssistantReviewRequest = { id: "request-1", documentId: "plan-a", sha256: "a".repeat(64), page: 3, focus: "Check visible materials" };
const source = { documentId: request.documentId, sha256: request.sha256 };
test("assistant preserves the selected sheet only for the matching original document", () => {
  assert.equal(reviewMatchesSource(request, source, 3), true);
  assert.equal(reviewMatchesSource(request, { ...source, documentId: "plan-b" }, 3), false);
  assert.equal(reviewMatchesSource(request, { ...source, sha256: "b".repeat(64) }, 3), false);
});
test("assistant rejects missing sources and pages outside the actual document", () => {
  assert.equal(reviewMatchesSource(request, null, 3), false);
  assert.equal(reviewMatchesSource(request, source, 2), false);
  for (const page of [0, -1, 1.5, NaN, Infinity]) assert.equal(reviewMatchesSource({ ...request, page }, source, 3), false);
});
