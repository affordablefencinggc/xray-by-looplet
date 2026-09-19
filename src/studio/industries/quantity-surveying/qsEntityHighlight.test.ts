import test from "node:test";
import assert from "node:assert/strict";
import {
  QS_ENTITY_HIGHLIGHT_SCHEMA,
  qsHighlightRequestSchema,
  qsHighlightResolutionSchema,
  resolveEntityHighlight,
  type QsHighlightSubject,
} from "./qsEntityHighlight.ts";

const AT = "2026-09-19T10:00:00.000Z";

const subject = (patch: Partial<QsHighlightSubject> = {}): QsHighlightSubject => ({
  entityId: "measured:item-01",
  verified: true,
  present: true,
  ...patch,
});

const resolve = (patch: Partial<QsHighlightSubject> = {}, surfacesAvailable = true) =>
  resolveEntityHighlight({ subject: subject(patch), surfacesAvailable });

// --- A: the request contract -------------------------------------------------

test("A1: a highlight request names an entity; there is no request to highlight nothing", () => {
  assert.equal(
    qsHighlightRequestSchema.parse({
      format: QS_ENTITY_HIGHLIGHT_SCHEMA,
      itemId: "item-01",
      entityId: "measured:item-01",
      requestedAt: AT,
    }).entityId,
    "measured:item-01",
  );
  assert.throws(
    () => qsHighlightRequestSchema.parse({ format: QS_ENTITY_HIGHLIGHT_SCHEMA, itemId: "item-01", entityId: "", requestedAt: AT }),
    /Invalid|too_small/,
  );
});

test("A2: a request stores no verdict — only the id the user clicked", () => {
  const parsed = qsHighlightRequestSchema.parse({
    format: QS_ENTITY_HIGHLIGHT_SCHEMA, itemId: "item-01", entityId: "measured:item-01", requestedAt: AT,
  }) as Record<string, unknown>;
  // A stored verdict here would be a second source of truth for what
  // evaluateItemBinding already derives, and the copy is the one that goes stale.
  for (const forbidden of ["status", "verified", "stale", "claim", "emphasis", "resolution"])
    assert.equal(parsed[forbidden], undefined, `${forbidden} must not be stored on a highlight request`);
});

test("A3: unknown keys are rejected", () => {
  assert.throws(
    () => qsHighlightRequestSchema.parse({
      format: QS_ENTITY_HIGHLIGHT_SCHEMA, itemId: "i", entityId: "e", requestedAt: AT, colour: "#fff",
    }),
    /Unrecognized key/,
  );
});

// --- B: resolution invariants ------------------------------------------------

test("B1: an unresolvable entity is never emphasised", () => {
  assert.throws(
    () => qsHighlightResolutionSchema.parse({
      entityId: "e", resolvable: false, emphasis: "highlight", claim: "measured-and-current", note: "x",
    }),
    /is not emphasised/,
  );
});

test("B2: an unmeasured entity is never emphasised as measured", () => {
  // This is the invariant that stops the highlight becoming a second way to
  // present an unmeasured object as verified, after the ledger was fixed not to.
  assert.throws(
    () => qsHighlightResolutionSchema.parse({
      entityId: "e", resolvable: true, emphasis: "highlight", claim: "not-measured", note: "x",
    }),
    /never emphasised as measured/,
  );
});

test("B3: a drawn highlight states what it means", () => {
  assert.throws(
    () => qsHighlightResolutionSchema.parse({
      entityId: "e", resolvable: true, emphasis: "warning", claim: "measured-then-changed", note: "   ",
    }),
    /states what it means/,
  );
});

test("B4: not drawing anything may say nothing", () => {
  const parsed = qsHighlightResolutionSchema.parse({
    entityId: "e", resolvable: false, emphasis: "none", claim: "not-measured", note: "",
  });
  assert.equal(parsed.emphasis, "none");
});

// --- C: resolution behaviour -------------------------------------------------

test("C1: a current, present entity highlights and claims it is current", () => {
  const r = resolve();
  assert.equal(r.emphasis, "highlight");
  assert.equal(r.claim, "measured-and-current");
  assert.equal(r.resolvable, true);
  assert.match(r.note, /measured from/);
});

test("C2: a stale entity is still shown, and says it changed", () => {
  // The discriminating case for the whole design. Refusing to highlight a stale
  // item would hide the one fact that makes the problem fixable — which wall moved.
  const r = resolve({ verified: false });
  assert.equal(r.emphasis, "warning");
  assert.equal(r.claim, "measured-then-changed");
  assert.equal(r.resolvable, true);
  assert.match(r.note, /geometry changed/);
});

test("C3: a deleted entity is not drawn, and is not claimed as current", () => {
  const r = resolve({ present: false });
  assert.equal(r.emphasis, "none");
  assert.equal(r.resolvable, false);
  assert.equal(r.claim, "measured-then-changed");
  assert.match(r.note, /not in the workspace/);
});

test("C4: an unbound row highlights nothing and invents no entity", () => {
  const r = resolve({ entityId: null });
  assert.equal(r.emphasis, "none");
  assert.equal(r.resolvable, false);
  assert.equal(r.claim, "not-measured");
  // The entity id must not be fabricated from the item id: highlighting the cost
  // line and calling it the wall is worse than drawing nothing.
  assert.notEqual(r.entityId, "item-01");
});

test("C5: with no canvas mounted, nothing is claimed to have been highlighted", () => {
  const r = resolve({}, false);
  assert.equal(r.emphasis, "none");
  assert.equal(r.resolvable, false);
  assert.match(r.note, /not open/);
  // The claim about the *measurement* survives — only the drawing is absent.
  assert.equal(r.claim, "measured-and-current");

  const stale = resolve({ verified: false }, false);
  assert.equal(stale.emphasis, "none");
  assert.equal(stale.claim, "measured-then-changed");
});

test("C6: an unbound row with no canvas reports not-measured, not merely absent", () => {
  // Order matters: "unbound" outranks "no canvas". Reporting the missing canvas
  // for a row that has no entity at all would send the user looking for a window
  // to open when the real problem is that nothing was ever measured.
  const r = resolve({ entityId: null }, false);
  assert.equal(r.claim, "not-measured");
  assert.match(r.note, /not bound to a measured entity/);
});

test("C7: resolution is pure", () => {
  const input = { subject: subject({ verified: false }), surfacesAvailable: true } as const;
  const once = resolveEntityHighlight(input);
  assert.deepEqual(once, resolveEntityHighlight(input));
  assert.deepEqual(input.subject, { entityId: "measured:item-01", verified: false, present: true });
});

test("C8: every resolvable state produces a parseable resolution", () => {
  // Guards the superRefine from rejecting a combination the resolver can build.
  for (const s of [
    subject(), subject({ verified: false }), subject({ present: false }),
    subject({ entityId: null }), subject({ entityId: null, verified: false, present: false }),
  ])
    for (const surfaces of [true, false])
      assert.doesNotThrow(() => resolveEntityHighlight({ subject: s, surfacesAvailable: surfaces }));
});
