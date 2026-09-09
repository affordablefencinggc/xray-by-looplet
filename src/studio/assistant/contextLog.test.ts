import test from "node:test";
import assert from "node:assert/strict";
import {
  DIGEST_DEFAULT_LIMIT, INFERRED_LABEL, SUMMARY_MAX_CHARS, TOPIC_MAX_CHARS,
  renderDigest, searchLog, strongestEvidence, summariseTurn,
  type ContextLogEntry,
} from "./contextLog.ts";

const entry = (over: Partial<ContextLogEntry> & { id: string; at: string }): ContextLogEntry => ({
  topic: "Boundary run", summary: "Traced the northern boundary.", evidence: "stated", tools: [], ...over,
});

test("a turn with tool receipts is measured evidence and reads from the receipt", () => {
  const result = summariseTurn(
    "Trace the north boundary please",
    ["trace_takeoff_run", "read_takeoff_evidence"],
    [{ tool: "trace_takeoff_run", summary: "Traced run R1 at 12.480 m. Calibration locked." }],
  );
  assert.equal(result.evidence, "tool-receipt");
  assert.equal(result.topic, "Trace the north boundary");
  assert.match(result.summary, /12\.480 m/);
  assert.deepEqual(result.tools, ["trace_takeoff_run", "read_takeoff_evidence"]);
});

test("further receipts are counted and failures are stated in the summary", () => {
  const result = summariseTurn("Export everything", ["export_design_file"], [
    { tool: "export_design_file", summary: "site.dxf (42 KB)", ok: true },
    { tool: "export_design_file", summary: "site.ifc failed", ok: false },
    { tool: "export_design_file", summary: "site.pdf (9 KB)", ok: true },
  ]);
  assert.equal(result.evidence, "tool-receipt");
  assert.match(result.summary, /2 further tool results/);
  assert.match(result.summary, /1 tool failed\./);
});

test("a turn without receipts is stated evidence built from the user's own words", () => {
  const result = summariseTurn("The eastern fence is 1800 high", []);
  assert.equal(result.evidence, "stated");
  assert.equal(result.topic, "The eastern fence is 1800 high");
  assert.equal(result.summary, "The eastern fence is 1800 high.");
  assert.deepEqual(result.tools, []);
});

test("stated turns name the tools that ran in readable words", () => {
  const result = summariseTurn("Open the takeoff pane", ["navigate_workspace"]);
  assert.equal(result.evidence, "stated");
  assert.equal(result.summary, "Open the takeoff pane. Ran navigate workspace.");
  const three = summariseTurn("Check it", ["read_project_context", "read_architect_design", "save_project"]);
  assert.equal(three.summary, "Check it. Ran read project context, read architect design and save project.");
});

test("a turn with neither words nor receipts is inferred", () => {
  const withTools = summariseTurn("", ["read_project_context"]);
  assert.equal(withTools.evidence, "inferred");
  assert.equal(withTools.topic, "Read project context");
  assert.equal(withTools.summary, "Ran read project context.");
  const empty = summariseTurn("   ", []);
  assert.equal(empty.evidence, "inferred");
  assert.equal(empty.topic, "Untitled turn");
  assert.match(empty.summary, /No user text and no tool results/);
});

test("summarisation is deterministic and never depends on a model", () => {
  const args = ["Raise the parapet to 900", ["edit_architect_elements"], [{ tool: "edit_architect_elements", summary: "changed 3 elements, design revision 7" }]] as const;
  const a = summariseTurn(...args), b = summariseTurn(...args);
  assert.deepEqual(a, b);
});

test("topic stays within 60 characters and summary within 160, cut on a word boundary", () => {
  const long = "Reconcile the northern boundary setback against the survey plan and the council overlay before the estimator issues the revised quotation";
  const result = summariseTurn(long, []);
  assert.ok(result.topic.length <= TOPIC_MAX_CHARS, `topic was ${result.topic.length}`);
  assert.ok(result.summary.length <= SUMMARY_MAX_CHARS, `summary was ${result.summary.length}`);
  assert.match(result.topic, /…$/);
  assert.doesNotMatch(result.topic, /\s…$/);
  assert.equal(TOPIC_MAX_CHARS, 60);
  assert.equal(SUMMARY_MAX_CHARS, 160);
});

test("politeness at either end of a request is dropped from the topic but kept in a stated summary", () => {
  assert.equal(summariseTurn("Please open the takeoff pane, thanks", []).topic, "Open the takeoff pane");
  assert.equal(summariseTurn("Can you save the project for me", []).topic, "Save the project");
  assert.equal(summariseTurn("Now trace it", []).topic, "Trace it");
  assert.equal(summariseTurn("Please open the takeoff pane", []).summary, "Please open the takeoff pane.");
});

test("only the first sentence of a long message is kept, and whitespace is collapsed", () => {
  const result = summariseTurn("Fix   the\n gate.   Then quote it. Then invoice it.", []);
  assert.equal(result.summary, "Fix the gate.");
  assert.equal(result.topic, "Fix the gate");
});

test("tool names are deduplicated and keep first-appearance order", () => {
  const result = summariseTurn("Do it", ["save_project", "read_project_context", "save_project", "  ", "read_project_context"]);
  assert.deepEqual(result.tools, ["save_project", "read_project_context"]);
});

test("digest lists newest first, labels inferred lines and states each row's evidence", () => {
  const entries = [
    entry({ id: "a", at: "2026-09-01T00:00:00.000Z", topic: "Older", summary: "Measured 12.480 m.", evidence: "tool-receipt", tools: ["trace_takeoff_run"] }),
    entry({ id: "b", at: "2026-09-03T00:00:00.000Z", topic: "Newer", summary: "The fence is about 12 m.", evidence: "inferred" }),
    entry({ id: "c", at: "2026-09-02T00:00:00.000Z", topic: "Middle", summary: "Asked for a quote.", evidence: "stated" }),
  ];
  const digest = renderDigest(entries);
  const rows = digest.split("\n").filter(line => line.startsWith("| 2026-"));
  assert.equal(rows.length, 3);
  assert.match(rows[0]!, /Newer/);
  assert.match(rows[1]!, /Middle/);
  assert.match(rows[2]!, /Older/);
  assert.match(rows[0]!, new RegExp(`\\(${INFERRED_LABEL}\\) The fence is about 12 m\\.`));
  assert.match(rows[0]!, /\| inferred \|/);
  assert.match(rows[1]!, /\| stated \|/);
  assert.match(rows[2]!, /\| tool receipt \|/);
  assert.match(rows[2]!, /trace_takeoff_run/);
  assert.match(rows[1]!, /\| none \|/);
  assert.match(digest, /^## Earlier in this project$/m);
  assert.match(digest, /A line marked inferred is recalled, not measured/);
});

test("only inferred lines are labelled, so a measured number is never marked recalled", () => {
  const digest = renderDigest([entry({ id: "a", at: "2026-09-01T00:00:00.000Z", summary: "Measured 12.480 m.", evidence: "tool-receipt" })]);
  assert.doesNotMatch(digest, new RegExp(`\\(${INFERRED_LABEL}\\)`));
});

test("digest honours its limit and reports how many turns are held back", () => {
  const many = Array.from({ length: 35 }, (_, index) =>
    entry({ id: `e${String(index).padStart(2, "0")}`, at: `2026-09-01T00:${String(index).padStart(2, "0")}:00.000Z` }));
  const rows = (block: string) => block.split("\n").filter(line => line.startsWith("| 2026-")).length;
  assert.equal(rows(renderDigest(many)), DIGEST_DEFAULT_LIMIT);
  assert.match(renderDigest(many), /5 older turns are held in the log/);
  assert.equal(rows(renderDigest(many, 5)), 5);
  assert.match(renderDigest(many, 34), /1 older turn is held in the log/);
  assert.equal(rows(renderDigest(many, 0)), DIGEST_DEFAULT_LIMIT);
  assert.doesNotMatch(renderDigest(many, 100), /held in the log/);
});

test("an empty digest says so rather than rendering an empty table", () => {
  const digest = renderDigest([]);
  assert.match(digest, /No earlier turns are recorded\./);
  assert.doesNotMatch(digest, /\| --- \|/);
});

test("a pipe in an entry cannot break the digest table", () => {
  const digest = renderDigest([entry({ id: "a", at: "2026-09-01T00:00:00.000Z", topic: "Grid A | B", summary: "Span A | B measured." })]);
  const row = digest.split("\n").find(line => line.startsWith("| 2026-"))!;
  assert.equal(row.split(/(?<!\\)\|/).length - 1, 6);
  assert.match(row, /Grid A \\\| B/);
});

test("search matches topic, summary and tool names without embeddings", () => {
  const entries = [
    entry({ id: "a", at: "2026-09-01T00:00:00.000Z", topic: "Northern boundary", summary: "Traced 12.480 m.", tools: ["trace_takeoff_run"] }),
    entry({ id: "b", at: "2026-09-02T00:00:00.000Z", topic: "Price book", summary: "Imported rates.", tools: ["import_price_book"] }),
  ];
  assert.deepEqual(searchLog(entries, "boundary").map(match => match.id), ["a"]);
  assert.deepEqual(searchLog(entries, "12.480").map(match => match.id), ["a"]);
  assert.deepEqual(searchLog(entries, "takeoff").map(match => match.id), ["a"]);
  assert.deepEqual(searchLog(entries, "import price").map(match => match.id), ["b"]);
  assert.deepEqual(searchLog(entries, "NORTHERN").map(match => match.id), ["a"]);
  assert.deepEqual(searchLog(entries, "gate"), []);
});

test("search requires every term and returns matches newest first", () => {
  const entries = [
    entry({ id: "a", at: "2026-09-01T00:00:00.000Z", topic: "Fence quote", summary: "Northern boundary quoted." }),
    entry({ id: "b", at: "2026-09-05T00:00:00.000Z", topic: "Fence quote", summary: "Southern boundary quoted." }),
    entry({ id: "c", at: "2026-09-03T00:00:00.000Z", topic: "Fence quote", summary: "Northern boundary revised." }),
  ];
  assert.deepEqual(searchLog(entries, "fence").map(match => match.id), ["b", "c", "a"]);
  assert.deepEqual(searchLog(entries, "northern quoted").map(match => match.id), ["a"]);
  assert.deepEqual(searchLog(entries, "northern southern"), []);
});

test("a blank or single-character query returns nothing rather than everything", () => {
  const entries = [entry({ id: "a", at: "2026-09-01T00:00:00.000Z" })];
  assert.deepEqual(searchLog(entries, ""), []);
  assert.deepEqual(searchLog(entries, "   "), []);
  assert.deepEqual(searchLog(entries, "?!"), []);
  assert.deepEqual(searchLog(entries, "a"), []);
});

test("search and digest leave the caller's array untouched", () => {
  const entries = [
    entry({ id: "a", at: "2026-09-05T00:00:00.000Z" }),
    entry({ id: "b", at: "2026-09-01T00:00:00.000Z" }),
  ];
  const order = entries.map(item => item.id);
  searchLog(entries, "boundary"); renderDigest(entries);
  assert.deepEqual(entries.map(item => item.id), order);
});

test("tool receipt outranks stated, and stated outranks inferred", () => {
  assert.equal(strongestEvidence("stated", "tool-receipt"), "tool-receipt");
  assert.equal(strongestEvidence("inferred", "stated"), "stated");
  assert.equal(strongestEvidence("inferred", "inferred"), "inferred");
});
