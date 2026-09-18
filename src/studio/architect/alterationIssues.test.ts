import test from "node:test";
import assert from "node:assert/strict";
import { emptyProject, newWall, validateProject } from "./model.ts";
import { createAlterationBasis } from "./alterationStage.ts";
import {
  createAlterationIssueRecord,
  appendAlterationIssue,
  retrieveAlterationIssue,
  compareAlterationIssues,
  validateAlterationIssues,
  isCorruptedIssueDelivery,
} from "./alterationIssues.ts";
import { exportAlterationIssueSetPdf } from "./alterationIssueExport.ts";

function fixtureProject() {
  const p = emptyProject("alteration-issue-test-p");
  const lid = p.levels[0].id;

  // External envelope 8000 x 6000
  const wSouth = newWall(p, lid, [0, 0], [8000, 0], [
    { id: "s1", name: "Brick", thickness: 230, kind: "solid", hatch: "brick", densityKgM3: 1900, rateM2: 120, supplierReference: "SUP-01", rateRevision: "R1", wastePercent: 5 },
  ]);
  wSouth.id = "w-south";
  wSouth.lifecycle = { status: "existing", reference: "Survey S01" };
  p.walls.push(wSouth);

  const wEast = newWall(p, lid, [8000, 0], [8000, 6000], [
    { id: "s2", name: "Brick", thickness: 230, kind: "solid", hatch: "brick", densityKgM3: 1900, rateM2: 120, supplierReference: "SUP-01", rateRevision: "R1", wastePercent: 5 },
  ]);
  wEast.id = "w-east";
  wEast.lifecycle = { status: "existing", reference: "Survey S01" };
  p.walls.push(wEast);

  const wNorth = newWall(p, lid, [8000, 6000], [0, 6000], [
    { id: "s3", name: "Brick", thickness: 230, kind: "solid", hatch: "brick", densityKgM3: 1900, rateM2: 120, supplierReference: "SUP-01", rateRevision: "R1", wastePercent: 5 },
  ]);
  wNorth.id = "w-north";
  wNorth.lifecycle = { status: "existing", reference: "Survey S01" };
  p.walls.push(wNorth);

  const wWest = newWall(p, lid, [0, 6000], [0, 0], [
    { id: "s4", name: "Brick", thickness: 230, kind: "solid", hatch: "brick", densityKgM3: 1900, rateM2: 120, supplierReference: "SUP-01", rateRevision: "R1", wastePercent: 5 },
  ]);
  wWest.id = "w-west";
  wWest.lifecycle = { status: "existing", reference: "Survey S01" };
  p.walls.push(wWest);

  // Demolished internal dividing partition
  const wPart = newWall(p, lid, [4000, 0], [4000, 6000], [
    { id: "s5", name: "Stud", thickness: 90, kind: "solid", hatch: "timber", densityKgM3: 500, rateM2: 70, supplierReference: "SUP-02", rateRevision: "R1", wastePercent: 5 },
  ]);
  wPart.id = "w-demo-part";
  wPart.lifecycle = { status: "demolished", reference: "Demolition D01" };
  p.walls.push(wPart);

  // Demolished door with infill
  p.openings.push({
    id: "d01",
    revision: 1,
    wallId: "w-south",
    tag: "D01",
    kind: "door",
    offset: 2000,
    width: 900,
    height: 2100,
    sill: 0,
    hinge: "left",
    swing: "in",
    lifecycle: { status: "demolished", reference: "Demolition D01" },
    demolitionDisposition: { kind: "infill", reference: "Infill D01" },
  });

  // Demolished window with partial infill
  p.openings.push({
    id: "w01",
    revision: 1,
    wallId: "w-south",
    tag: "W01",
    kind: "window",
    offset: 6000,
    width: 1500,
    height: 1200,
    sill: 900,
    hinge: "left",
    swing: "in",
    lifecycle: { status: "demolished", reference: "Demolition D02" },
    demolitionDisposition: {
      kind: "partial-infill",
      reference: "Reduce W01",
      remainingVoid: { offset: 6000, width: 900, height: 1200, sill: 900 },
    },
  });

  p.roomTags.push({ id: "t-lounge", name: "Lounge", point: [2000, 3000], levelId: lid, revision: 1 });
  p.roomTags.push({ id: "t-dining", name: "Dining", point: [6000, 3000], levelId: lid, revision: 1 });

  return validateProject(p);
}

test("creates and freezes an immutable alteration issue record", () => {
  const p = fixtureProject();
  const basis = createAlterationBasis(p, "Survey Basis S01");

  const record = createAlterationIssueRecord(p, basis, {
    purpose: "For Planning Approval",
    metadata: { id: "issue-rev-a", issuedAt: "2026-09-15T10:00:00.000Z" },
  });

  assert.equal(record.format, "xray.alteration-issue/v1");
  assert.equal(record.id, "issue-rev-a");
  assert.equal(record.purpose, "For Planning Approval");
  assert.equal(record.status, "current");
  assert.equal(record.issued, true);
  assert.equal(record.projectId, p.id);

  // Before vs Proposed summaries
  assert.ok(record.beforeSummary.wallSolidVolumeM3 > 0);
  assert.ok(record.proposedSummary.wallSolidVolumeM3 > 0);
  assert.equal(record.beforeSummary.roomsCount, 2);
  assert.equal(record.proposedSummary.roomsCount, 1); // Merged lounge
  assert.equal(record.beforeSummary.openingsCount, 2);

  // Schedules summary
  assert.equal(record.schedulesSummary.demolitionRowsCount, 3); // 1 wall + 2 openings
  assert.ok(record.schedulesSummary.demolitionVolumeM3 > 0);
  assert.ok(record.schedulesSummary.salvageDisposalVolumeM3 > 0);

  // Sheets
  assert.ok(record.sheets.length >= 5);
  assert.ok(record.sheets.some((s) => s.stage === "before" && s.view === "plan"));
  assert.ok(record.sheets.some((s) => s.stage === "proposed" && s.view === "plan"));
});

test("supersession: issuing revision B marks revision A superseded without mutating historical bytes", () => {
  let p = fixtureProject();
  const basisA = createAlterationBasis(p, "Survey Basis S01");

  const issueA = createAlterationIssueRecord(p, basisA, {
    purpose: "For Client Review",
    metadata: { id: "issue-rev-a", issuedAt: "2026-09-15T10:00:00.000Z" },
  });

  p = appendAlterationIssue(p, issueA);
  assert.equal(p.alterationIssues?.length, 1);
  assert.equal(p.alterationIssues[0].status, "current");

  // Modify project for Revision B: add a new window on North wall
  p.designRevision = "B";
  p.revision = 2;
  p.openings.push({
    id: "w02",
    revision: 1,
    wallId: "w-north",
    tag: "W02",
    kind: "window",
    offset: 4000,
    width: 1800,
    height: 1200,
    sill: 900,
    hinge: "left",
    swing: "in",
    lifecycle: { status: "new", reference: "New Window Brief N01" },
  });
  p = validateProject(p);

  const basisB = createAlterationBasis(p, "Revised Survey Basis S02");
  const issueB = createAlterationIssueRecord(p, basisB, {
    purpose: "For Tender",
    metadata: { id: "issue-rev-b", issuedAt: "2026-09-15T14:00:00.000Z" },
  });

  p = appendAlterationIssue(p, issueB);
  assert.equal(p.alterationIssues?.length, 2);

  // Issue A is now marked superseded
  const retrievedA = p.alterationIssues[0];
  assert.equal(retrievedA.status, "superseded");
  assert.equal(retrievedA.supersededById, "issue-rev-b");
  assert.equal(retrievedA.supersededByRevision, "B");
  assert.equal(retrievedA.supersededAt, "2026-09-15T14:00:00.000Z");

  // Issue B is current
  const retrievedB = p.alterationIssues[1];
  assert.equal(retrievedB.status, "current");

  // Historical source retrieval produces exact original project snapshot
  const { source: sourceA } = retrieveAlterationIssue(p, "issue-rev-a");
  assert.equal(sourceA.designRevision, "A");
  assert.equal(sourceA.openings.length, 2); // W02 not in Revision A

  const { source: sourceB } = retrieveAlterationIssue(p, "issue-rev-b");
  assert.equal(sourceB.designRevision, "B");
  assert.equal(sourceB.openings.length, 3); // W02 in Revision B
});

test("revision comparison calculates deltas across model, schedules, and sheets", () => {
  let p = fixtureProject();
  const basisA = createAlterationBasis(p, "Survey Basis S01");
  const issueA = createAlterationIssueRecord(p, basisA, {
    purpose: "For Client Review",
    metadata: { id: "issue-rev-a", issuedAt: "2026-09-15T10:00:00.000Z" },
  });

  p.designRevision = "B";
  p.revision = 2;
  p.openings.push({
    id: "w02",
    revision: 1,
    wallId: "w-north",
    tag: "W02",
    kind: "window",
    offset: 4000,
    width: 1800,
    height: 1200,
    sill: 900,
    hinge: "left",
    swing: "in",
    lifecycle: { status: "new", reference: "New Window Brief N01" },
  });
  p = validateProject(p);
  const basisB = createAlterationBasis(p, "Survey Basis S02");
  const issueB = createAlterationIssueRecord(p, basisB, {
    purpose: "For Tender",
    metadata: { id: "issue-rev-b", issuedAt: "2026-09-15T14:00:00.000Z" },
  });

  const diff = compareAlterationIssues(issueA, issueB);
  assert.equal(diff.baselineRevision, "A");
  assert.equal(diff.targetRevision, "B");
  assert.equal(diff.openingsCountDelta, 1); // 1 new opening added
  assert.equal(diff.hasVariance, true);

  // Comparing an issue to itself has zero deltas and hasVariance = false
  const selfDiff = compareAlterationIssues(issueA, issueA);
  assert.equal(selfDiff.hasVariance, false);
  assert.equal(selfDiff.openingsCountDelta, 0);
  assert.equal(selfDiff.wallVolumeDeltaM3, 0);
  assert.equal(selfDiff.demolitionVolumeDeltaM3, 0);
});

test("validation fail-closed: rejects tampered source or foreign project", () => {
  const p = fixtureProject();
  const basis = createAlterationBasis(p, "Survey Basis S01");
  const issue = createAlterationIssueRecord(p, basis, {
    purpose: "For Planning",
    metadata: { id: "issue-safe", issuedAt: "2026-09-15T10:00:00.000Z" },
  });

  // Tampered sourceJson
  const tamperedJson = { ...issue, sourceJson: issue.sourceJson + " " };
  assert.throws(() => validateAlterationIssues({ ...p, alterationIssues: [tamperedJson] }), /hash does not match/);

  // Foreign project ID
  const foreign = { ...issue, projectId: "foreign-project-id" };
  assert.throws(() => validateAlterationIssues({ ...p, alterationIssues: [foreign] }), /belongs to another project/);

  // Exceeding 10 issues
  const manyIssues = Array.from({ length: 11 }, (_, i) => ({
    ...issue,
    id: `issue-${i}`,
  }));
  assert.throws(() => validateAlterationIssues({ ...p, alterationIssues: manyIssues }), /at most 10/);
});

test("exportAlterationIssueSetPdf exports multi-page PDF with cover, sheets and schedules", async () => {
  let p = fixtureProject();
  const basis = createAlterationBasis(p, "Survey Basis S01");
  const issue = createAlterationIssueRecord(p, basis, {
    purpose: "For Construction",
    metadata: { id: "issue-pdf-test", issuedAt: "2026-09-15T10:00:00.000Z" },
  });
  p = appendAlterationIssue(p, issue);

  const pdfBytes = await exportAlterationIssueSetPdf(p, "issue-pdf-test");
  assert.ok(pdfBytes.length > 5000, "PDF bytes should be non-trivial");
  const header = new TextDecoder().decode(pdfBytes.slice(0, 5));
  assert.equal(header, "%PDF-", "Should have valid PDF header");

  // Verify superseded watermark export
  p.designRevision = "B";
  p.revision = 2;
  p = validateProject(p);
  const basisB = createAlterationBasis(p, "Survey Basis S02");
  const issueB = createAlterationIssueRecord(p, basisB, {
    purpose: "For Tender Reissue",
    metadata: { id: "issue-pdf-rev-b", issuedAt: "2026-09-15T16:00:00.000Z" },
  });
  p = appendAlterationIssue(p, issueB);

  const supersededBytes = await exportAlterationIssueSetPdf(p, "issue-pdf-test");
  assert.ok(supersededBytes.length > 5000);
});

test("exportAlterationIssueSetPdf handles schema limit strings without overflowing", async () => {
  let p = fixtureProject();
  p.name = "X".repeat(200);
  p.address = "Y".repeat(500);
  p = validateProject(p);
  const basis = createAlterationBasis(p, "Z".repeat(300));
  const issue = createAlterationIssueRecord(p, basis, {
    purpose: "For Construction",
    metadata: { id: "issue-limits-test", issuedAt: "2026-09-15T10:00:00.000Z" },
  });
  p = appendAlterationIssue(p, issue);

  const pdfBytes = await exportAlterationIssueSetPdf(p, "issue-limits-test");
  assert.ok(pdfBytes.length > 5000);
  const header = new TextDecoder().decode(pdfBytes.slice(0, 5));
  assert.equal(header, "%PDF-");
});

test("compareAlterationIssues detects sheet changes when sheets are renumbered", () => {
  const p = fixtureProject();
  const basis = createAlterationBasis(p, "Survey Basis S01");
  const issueA = createAlterationIssueRecord(p, basis, {
    purpose: "For Review",
    metadata: { id: "issue-sheet-a", issuedAt: "2026-09-15T10:00:00.000Z" },
    sheets: [
      { sheetId: "s1", number: "ALT-01", name: "Ground Floor", stage: "before", view: "plan", levelId: p.levels[0].id, scale: "1:100" },
      { sheetId: "s2", number: "ALT-02", name: "Roof Plan", stage: "proposed", view: "plan", levelId: p.levels[0].id, scale: "1:100" },
    ],
  });

  // Target has the same ALT-01/ALT-02 numbers, but different views/names
  const issueB = createAlterationIssueRecord(p, basis, {
    purpose: "For Review",
    metadata: { id: "issue-sheet-b", issuedAt: "2026-09-15T11:00:00.000Z" },
    sheets: [
      { sheetId: "s1", number: "ALT-01", name: "Ground Floor", stage: "before", view: "plan", levelId: p.levels[0].id, scale: "1:100" },
      { sheetId: "s3", number: "ALT-02", name: "North Elevation", stage: "proposed", view: "north", levelId: p.levels[0].id, scale: "1:100" },
    ],
  });

  const diff = compareAlterationIssues(issueA, issueB);
  assert.equal(diff.sheetsAddedCount, 1);
  assert.equal(diff.sheetsRemovedCount, 1);
  assert.equal(diff.hasVariance, true);
});


/* --- SC-01: the SH-03 delivery contract, wired into the issue rather than left beside it ---------------- */

test("an issued alteration set enters the delivery contract, sealed with the hash of its own frozen bytes", () => {
  const p = fixtureProject();
  const basis = createAlterationBasis(p, "Survey Basis S01");
  const issue = createAlterationIssueRecord(p, basis, {
    purpose: "For Planning Approval",
    metadata: { id: "issue-delivery-a", issuedAt: "2026-09-15T10:00:00.000Z" },
  });

  assert.equal(issue.delivery.format, "xray.delivery-record/v1");
  assert.equal(issue.delivery.id, issue.id);
  assert.equal(issue.delivery.kind, "alteration");
  assert.equal(issue.delivery.projectId, issue.projectId);
  assert.equal(issue.delivery.state, "issued-deliverable");
  assert.equal(issue.delivery.status, "active");
  assert.equal(issue.delivery.revision, issue.projectRevision);
  assert.equal(issue.delivery.issuedAt, issue.issuedAt);
  assert.equal(issue.delivery.reviewedAt, issue.issuedAt);
  assert.equal(issue.delivery.contentSha256, issue.sourceSha256);
  assert.equal(issue.delivery.contentSha256.length, 64);
});

test("reopening refuses a record whose delivery seal no longer matches the bytes it sealed", () => {
  const p = fixtureProject();
  const basis = createAlterationBasis(p, "Survey Basis S01");
  const issue = createAlterationIssueRecord(p, basis, {
    purpose: "For Planning Approval",
    metadata: { id: "issue-delivery-b", issuedAt: "2026-09-15T10:00:00.000Z" },
  });

  // The seal is rewritten to a hash of nothing in particular, the source bytes left alone.
  const resealed = { ...issue, delivery: { ...issue.delivery, contentSha256: "a".repeat(64) } };
  assert.throws(
    () => validateAlterationIssues({ ...p, alterationIssues: [resealed] }),
    (error: unknown) => isCorruptedIssueDelivery(error) && /content hash does not match/.test(String(error)),
  );

  // And the reverse: the bytes move while the seal stays, which the record's own field catches first.
  const moved = { ...issue, sourceJson: issue.sourceJson + " " };
  assert.throws(() => validateAlterationIssues({ ...p, alterationIssues: [moved] }), /hash does not match/);
});

test("reopening refuses a record whose delivery and own fields disagree about what was issued", () => {
  const p = fixtureProject();
  const basis = createAlterationBasis(p, "Survey Basis S01");
  const issue = createAlterationIssueRecord(p, basis, {
    purpose: "For Planning Approval",
    metadata: { id: "issue-delivery-c", issuedAt: "2026-09-15T10:00:00.000Z" },
  });

  const disagreeing = [
    { ...issue, delivery: { ...issue.delivery, projectId: "another-project" } },
    { ...issue, delivery: { ...issue.delivery, revision: issue.delivery.revision + 1 } },
    { ...issue, delivery: { ...issue.delivery, issuedAt: "2026-09-15T11:00:00.000Z" } },
    { ...issue, delivery: { ...issue.delivery, id: "issue-delivery-renamed" } },
  ];
  for (const record of disagreeing) {
    assert.throws(
      () => validateAlterationIssues({ ...p, alterationIssues: [record] }),
      (error: unknown) => isCorruptedIssueDelivery(error),
      "a delivery that disagrees with the record beside it is refused",
    );
  }
});

test("an issue saved before the contract opened is adopted from its own bytes, not refused", () => {
  const p = fixtureProject();
  const basis = createAlterationBasis(p, "Survey Basis S01");
  const issued = createAlterationIssueRecord(p, basis, {
    purpose: "For Planning Approval",
    metadata: { id: "issue-delivery-legacy", issuedAt: "2026-09-15T10:00:00.000Z" },
  });
  const { delivery: _dropped, ...legacy } = issued;

  // The project still validates: the record predates the field, it is not corrupt.
  validateAlterationIssues({ ...p, alterationIssues: [legacy] });

  const reopened = retrieveAlterationIssue({ ...p, alterationIssues: [legacy] } as never, legacy.id);
  assert.equal(reopened.record.delivery.contentSha256, legacy.sourceSha256);
  assert.equal(reopened.record.delivery.state, "issued-deliverable");
  assert.equal(reopened.record.delivery.status, "active");
  assert.equal(reopened.record.delivery.id, legacy.id);

  // And a legacy record whose bytes were edited after the fact is still refused.
  const edited = { ...legacy, sourceJson: legacy.sourceJson + " " };
  assert.throws(() => validateAlterationIssues({ ...p, alterationIssues: [edited] }), /hash does not match/);
});

test("superseding writes the delivery pointers through the contract and carries the frozen hash untouched", () => {
  let p = fixtureProject();
  const basisA = createAlterationBasis(p, "Survey Basis S01");
  const issueA = createAlterationIssueRecord(p, basisA, {
    purpose: "For Client Review",
    metadata: { id: "issue-delivery-a1", issuedAt: "2026-09-15T10:00:00.000Z" },
  });
  p = appendAlterationIssue(p, issueA);

  p.revision = 2;
  p = validateProject(p);
  const basisB = createAlterationBasis(p, "Survey Basis S02");
  const issueB = createAlterationIssueRecord(p, basisB, {
    purpose: "For Tender Reissue",
    metadata: { id: "issue-delivery-b1", issuedAt: "2026-09-15T16:00:00.000Z" },
  });
  p = appendAlterationIssue(p, issueB);

  const [superseded] = p.alterationIssues ?? [];
  assert.ok(superseded.delivery, "a record issued by this build stores its delivery identity");
  assert.equal(superseded.status, "superseded");
  assert.equal(superseded.delivery.status, "superseded");
  assert.equal(superseded.delivery.state, "issued-deliverable");
  assert.equal(superseded.delivery.supersededAt, superseded.supersededAt);
  assert.equal(superseded.delivery.supersededById, superseded.supersededById);
  assert.equal(superseded.delivery.supersededByRevision, superseded.supersededByRevision);
  assert.equal(superseded.delivery.supersededById, issueB.id);

  // The frozen bytes and the seal over them are the ones revision A was issued with, unchanged.
  assert.equal(superseded.delivery.contentSha256, superseded.sourceSha256);
  assert.equal(superseded.delivery.contentSha256, issueA.delivery.contentSha256);
  assert.equal(superseded.sourceJson, issueA.sourceJson);

  // The record with its supersession written through revalidates as a whole.
  validateAlterationIssues(p);
});
