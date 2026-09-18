/**
 * The project the SC-01 screenshots are taken against.
 *
 * Built by running the real domain code, not by hand-writing JSON: a small building with four existing
 * envelope walls and a demolished partition, issued as two alteration sets so that the history shows a
 * superseded revision and a current one, both sealed. The bytes written here are what the app loads from
 * `xray:architect:v1:<jobId>`, and the script prints the readings the scenario then asserts in the page —
 * each issue's `sourceSha256` and its delivery `contentSha256`, which must be the same string, and the
 * supersession pointers, which must agree between the record's own fields and its delivery record.
 *
 * Run from the repo root: node .temp/live-rig/sc01-seed-project.mjs [outfile]
 */
import fs from "node:fs";
import { emptyProject, newWall, validateProject } from "../../src/studio/architect/model.ts";
import { createAlterationBasis } from "../../src/studio/architect/alterationStage.ts";
import {
  createAlterationIssueRecord,
  appendAlterationIssue,
} from "../../src/studio/architect/alterationIssues.ts";

function building(jobId) {
  const p = emptyProject(jobId);
  const lid = p.levels[0].id;
  const envelope = [
    ["w-south", [0, 0], [8000, 0]],
    ["w-east", [8000, 0], [8000, 6000]],
    ["w-north", [8000, 6000], [0, 6000]],
    ["w-west", [0, 6000], [0, 0]],
  ];
  let n = 0;
  for (const [id, from, to] of envelope) {
    const w = newWall(p, lid, from, to, [
      { id: `s${++n}`, name: "Brick", thickness: 230, kind: "solid", hatch: "brick", densityKgM3: 1900, rateM2: 120, supplierReference: "SUP-01", rateRevision: "R1", wastePercent: 5 },
    ]);
    w.id = id;
    w.lifecycle = { status: "existing", reference: "Survey S01" };
    p.walls.push(w);
  }
  const part = newWall(p, lid, [4000, 0], [4000, 6000], [
    { id: "s9", name: "Stud", thickness: 90, kind: "solid", hatch: "timber", densityKgM3: 500, rateM2: 70, supplierReference: "SUP-02", rateRevision: "R1", wastePercent: 5 },
  ]);
  part.id = "w-partition";
  part.lifecycle = { status: "demolished", reference: "Demolition D01" };
  p.walls.push(part);
  return validateProject(p);
}

const OUT = process.argv[2] ?? ".temp/live-rig/sc01-seeded-project.json";
const JOB = "job-sc01-proof";

let p = building(JOB);
const basisA = createAlterationBasis(p, "Survey Basis S01");
const issueA = createAlterationIssueRecord(p, basisA, {
  purpose: "For Client Review",
  metadata: { id: "issue-sc01-rev-a", issuedAt: "2026-09-17T22:00:00.000Z" },
});
p = appendAlterationIssue(p, issueA);

p.revision = 2;
p.designRevision = "B";
p = validateProject(p);
const basisB = createAlterationBasis(p, "Survey Basis S02");
const issueB = createAlterationIssueRecord(p, basisB, {
  purpose: "For Tender Reissue",
  metadata: { id: "issue-sc01-rev-b", issuedAt: "2026-09-17T23:30:00.000Z" },
});
p = appendAlterationIssue(p, issueB);

const json = JSON.stringify(p);
console.log(`project ${p.id}: ${p.walls.length} walls, ${(p.alterationIssues ?? []).length} issues, ${json.length} characters`);
for (const issue of p.alterationIssues ?? []) {
  const agrees = issue.delivery?.contentSha256 === issue.sourceSha256;
  const pointersAgree =
    issue.delivery?.supersededAt === issue.supersededAt &&
    issue.delivery?.supersededById === issue.supersededById &&
    issue.delivery?.supersededByRevision === issue.supersededByRevision;
  console.log(
    `  ${issue.id.padEnd(20)} ${issue.status.padEnd(11)} seal ${issue.sourceSha256.slice(0, 16)}… ` +
      `delivery ${issue.delivery?.state} hash-agrees ${agrees} pointers-agree ${pointersAgree}`,
  );
}
fs.writeFileSync(OUT, json);
console.log(`\nwritten  ${OUT}`);
