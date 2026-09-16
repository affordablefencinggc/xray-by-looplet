import assert from "node:assert/strict";
import { test } from "node:test";
import { industrySourceBindingSchema } from "./sourceBinding.ts";
import {
  DELIVERY_RECORD_SCHEMA,
  advanceDelivery,
  assertDeliveryContentIntact,
  deliveryRecordSchema,
  describeDeliveryState,
  frozenDeliveryState,
  supersedeDelivery,
  type DeliveryRecord,
} from "./deliveryRecord.ts";

const SHA = "a".repeat(64);
const CONTENT = "frozen-content";
const CONTENT_HASH = SHA;
const sha = (content: string) => (content === CONTENT ? CONTENT_HASH : "b".repeat(64));

const base = (overrides: Record<string, unknown> = {}) => ({
  format: DELIVERY_RECORD_SCHEMA,
  id: "del-roof-1",
  kind: "roofing",
  projectId: "project-riverside",
  state: "saved-draft",
  revision: 1,
  createdAt: "2026-09-16T02:00:00.000Z",
  sourceBinding: null,
  contentSha256: SHA,
  status: "active",
  ...overrides,
});

const binding = (projectId: string) =>
  industrySourceBindingSchema.parse({
    schema: "xray.industry-source-binding/1",
    projectId,
    sourceRevisionId: "rev-1",
    sha256: SHA,
    sourceName: "Roof plan.pdf",
    locator: { kind: "page", pageIndex: 0 },
    calibrationId: null,
    units: "m",
    evidenceClass: "declared",
    reference: "typed reference",
    boundAt: "2026-09-16T02:00:00.000Z",
  });

const issued = (overrides: Record<string, unknown> = {}): DeliveryRecord =>
  deliveryRecordSchema.parse(
    base({
      state: "issued-deliverable",
      reviewedAt: "2026-09-16T03:00:00.000Z",
      issuedAt: "2026-09-16T04:00:00.000Z",
      ...overrides,
    }),
  );

test("a saved draft needs no review or issue timestamp", () => {
  const record = deliveryRecordSchema.parse(base());
  assert.equal(record.state, "saved-draft");
  assert.equal(record.reviewedAt, undefined);
  assert.equal(record.issuedAt, undefined);
  assert.equal(record.status, "active");
});

test("unknown keys, a short hash, whitespace ids and a missing format are refused", () => {
  assert.throws(() => deliveryRecordSchema.parse(base({ extra: true })));
  assert.throws(() => deliveryRecordSchema.parse(base({ contentSha256: "short" })));
  assert.throws(() => deliveryRecordSchema.parse(base({ id: "  del-roof-1  " })));
  assert.throws(() => deliveryRecordSchema.parse(base({ format: "xray.other/v1" })));
});

test("a draft cannot carry review or issue timestamps, nor be superseded", () => {
  assert.throws(() => deliveryRecordSchema.parse(base({ reviewedAt: "2026-09-16T03:00:00.000Z" })));
  assert.throws(() => deliveryRecordSchema.parse(base({ issuedAt: "2026-09-16T04:00:00.000Z" })));
  assert.throws(() =>
    deliveryRecordSchema.parse(
      base({ status: "superseded", supersededAt: "2026-09-16T05:00:00.000Z", supersededById: "del-roof-2" }),
    ),
  );
});

test("a reviewed estimate records when it was reviewed, and nothing later", () => {
  const record = deliveryRecordSchema.parse(base({ state: "reviewed-estimate", reviewedAt: "2026-09-16T03:00:00.000Z" }));
  assert.equal(record.state, "reviewed-estimate");
  assert.equal(record.reviewedAt, "2026-09-16T03:00:00.000Z");
  assert.throws(() => deliveryRecordSchema.parse(base({ state: "reviewed-estimate" })));
  assert.throws(() =>
    deliveryRecordSchema.parse(base({ state: "reviewed-estimate", reviewedAt: "2026-09-16T03:00:00.000Z", issuedAt: "2026-09-16T04:00:00.000Z" })),
  );
});

test("an issued deliverable records both review and issue", () => {
  const record = issued();
  assert.equal(record.reviewedAt, "2026-09-16T03:00:00.000Z");
  assert.equal(record.issuedAt, "2026-09-16T04:00:00.000Z");
  assert.throws(() =>
    deliveryRecordSchema.parse(base({ state: "issued-deliverable", reviewedAt: "2026-09-16T03:00:00.000Z" })),
  );
});

test("a superseded deliverable needs its pointer fields and may only be issued", () => {
  const record = issued({
    status: "superseded",
    supersededAt: "2026-09-16T05:00:00.000Z",
    supersededById: "del-roof-2",
    supersededByRevision: "2",
  });
  assert.equal(record.status, "superseded");
  assert.throws(() => issued({ status: "superseded" }));
  assert.throws(() => issued({ status: "superseded", supersededAt: "2026-09-16T05:00:00.000Z" }));
});

test("a deliverable's source binding must belong to the same project", () => {
  assert.doesNotThrow(() => deliveryRecordSchema.parse(base({ sourceBinding: binding("project-riverside") })));
  assert.throws(() => deliveryRecordSchema.parse(base({ sourceBinding: binding("project-elsewhere") })));
});

test("advance moves one state forward at a time and stamps the right timestamps", () => {
  const draft = deliveryRecordSchema.parse(base({ state: "draft-export" }));
  const saved = advanceDelivery(draft, "saved-draft");
  assert.equal(saved.state, "saved-draft");
  const reviewed = advanceDelivery(saved, "reviewed-estimate", { reviewedAt: "2026-09-16T03:00:00.000Z" });
  assert.equal(reviewed.state, "reviewed-estimate");
  assert.equal(reviewed.reviewedAt, "2026-09-16T03:00:00.000Z");
  const issuedRecord = advanceDelivery(reviewed, "issued-deliverable", { issuedAt: "2026-09-16T04:00:00.000Z" });
  assert.equal(issuedRecord.state, "issued-deliverable");
  assert.equal(issuedRecord.issuedAt, "2026-09-16T04:00:00.000Z");
});

test("advance refuses skipping, regressing, missing timestamps and superseded records", () => {
  const draft = deliveryRecordSchema.parse(base({ state: "draft-export" }));
  assert.throws(() => advanceDelivery(draft, "reviewed-estimate", { reviewedAt: "2026-09-16T03:00:00.000Z" }));
  assert.throws(() => advanceDelivery(issued(), "saved-draft"));
  const reviewed = advanceDelivery(
    deliveryRecordSchema.parse(base({ state: "draft-export" })),
    "saved-draft",
  );
  assert.throws(() => advanceDelivery(reviewed, "reviewed-estimate"));
  const superseded = deliveryRecordSchema.parse(
    issued({ status: "superseded", supersededAt: "2026-09-16T05:00:00.000Z", supersededById: "del-roof-2" }),
  );
  assert.throws(() => advanceDelivery(superseded, "issued-deliverable", { issuedAt: "2026-09-16T06:00:00.000Z" }));
});

test("advancing never changes the frozen content hash", () => {
  const draft = deliveryRecordSchema.parse(base({ state: "draft-export" }));
  const saved = advanceDelivery(draft, "saved-draft");
  const reviewed = advanceDelivery(saved, "reviewed-estimate", { reviewedAt: "2026-09-16T03:00:00.000Z" });
  const issuedRecord = advanceDelivery(reviewed, "issued-deliverable", { issuedAt: "2026-09-16T04:00:00.000Z" });
  assert.equal(draft.contentSha256, SHA);
  assert.equal(saved.contentSha256, SHA);
  assert.equal(reviewed.contentSha256, SHA);
  assert.equal(issuedRecord.contentSha256, SHA);
});

test("superseding marks the prior deliverable and leaves its content untouched", () => {
  const first = issued({ id: "del-roof-1", revision: 1 });
  const second = issued({ id: "del-roof-2", revision: 2, issuedAt: "2026-09-16T05:00:00.000Z" });
  const superseded = supersedeDelivery(first, second);
  assert.equal(superseded.status, "superseded");
  assert.equal(superseded.supersededAt, "2026-09-16T05:00:00.000Z");
  assert.equal(superseded.supersededById, "del-roof-2");
  assert.equal(superseded.supersededByRevision, "2");
  assert.equal(superseded.contentSha256, first.contentSha256);
  assert.equal(superseded.sourceBinding, first.sourceBinding);
  assert.equal(superseded.revision, first.revision);
});

test("superseding refuses a non-issued, already-superseded, or cross-project target", () => {
  const second = issued({ id: "del-roof-2", revision: 2, issuedAt: "2026-09-16T05:00:00.000Z" });
  const draft = deliveryRecordSchema.parse(base({ state: "saved-draft" }));
  assert.throws(() => supersedeDelivery(draft, second));
  const superseded = supersedeDelivery(issued({ id: "del-roof-1" }), second);
  assert.throws(() => supersedeDelivery(superseded, second));
  assert.throws(() =>
    supersedeDelivery(issued({ id: "del-roof-1" }), issued({ id: "del-roof-3", projectId: "project-elsewhere" })),
  );
});

test("the content hash must still match the frozen bytes", () => {
  assert.doesNotThrow(() => assertDeliveryContentIntact(issued(), CONTENT, sha));
  assert.throws(() => assertDeliveryContentIntact(issued(), "tampered-content", sha));
});

test("only reviewed and issued states are frozen", () => {
  assert.equal(frozenDeliveryState("draft-export"), false);
  assert.equal(frozenDeliveryState("saved-draft"), false);
  assert.equal(frozenDeliveryState("reviewed-estimate"), true);
  assert.equal(frozenDeliveryState("issued-deliverable"), true);
});

test("delivery states have stable labels", () => {
  assert.equal(describeDeliveryState("draft-export"), "Draft export");
  assert.equal(describeDeliveryState("saved-draft"), "Saved draft");
  assert.equal(describeDeliveryState("reviewed-estimate"), "Reviewed estimate");
  assert.equal(describeDeliveryState("issued-deliverable"), "Issued deliverable");
});
