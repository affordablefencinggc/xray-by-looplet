/**
 * Tabulates every runner report whose session name matches the defect batch or its committed-revision
 * re-run set, so the proof note's index is read out of the artifacts rather than retyped.
 *
 * Two things are computed rather than declared:
 *   - the total, from the directory itself;
 *   - the close-operations count, from each report's own scenario (`scenarioOps === 1`).
 *
 * The remaining reports are turns, and their class is a judgement no artifact carries — the runner
 * cannot know that a scenario was re-run to supersede an earlier one. So the judgement is declared
 * here as an explicit run-id list and reconciled against the reports: a report that is neither a
 * close operation nor declared fails the run, as does a declared id with no report. That way the
 * note's figures cannot drift from the artifacts without this script going red.
 *
 * Run: node proof/growth/2026-09-17-defect-fixes/tabulate-runs.mjs > runner-index.out.txt
 */
import fs from "node:fs";

const dir = new URL("../runner/", import.meta.url);

/** The class of every report that is not a close operation. Judgement, declared, reconciled below. */
const DECLARED = {
  accepted: [
    "2026-09-17T03-07-12-626Z-qa-defect20-d3",
    "2026-09-17T03-07-26-824Z-qa-defect21-d8",
    "2026-09-17T03-27-24-335Z-qa-defect22c-d8",
    "2026-09-17T05-16-24-468Z-qa-defect22d-d4",
  ],
  excluded: [
    "2026-09-17T03-06-17-845Z-qa-defect20-d3",
    "2026-09-17T03-07-48-835Z-qa-defect22-d8",
    "2026-09-17T03-18-43-804Z-qa-defect22b-d8",
    "2026-09-17T03-25-38-810Z-qa-defect23-diag",
    "2026-09-17T05-14-13-165Z-qa-defect22d-d4",
  ],
  diagnostic: [
    "2026-09-17T03-26-10-068Z-qa-defect23b-diag",
  ],
  // The same four behaviours, driven a second time — once — against the committed source, after the
  // files they live in changed. Not extra attempts at an answer: the accepted runs measured a revision
  // the commits do not contain.
  recheck: [
    "2026-09-17T05-49-17-844Z-qa-recheck-d3",
    "2026-09-17T05-49-36-237Z-qa-recheck-d8-readonly",
    "2026-09-17T05-50-05-933Z-qa-recheck-d8-ask",
    "2026-09-17T05-50-35-117Z-qa-recheck-d4",
  ],
};

const classOf = new Map();
for (const [cls, ids] of Object.entries(DECLARED)) for (const id of ids) classOf.set(id, cls);

const files = fs.readdirSync(dir)
  .filter((name) => /qa-(defect|recheck).*\.json$/.test(name) && !name.endsWith(".scenario.json"))
  .sort();

const rows = files.map((name) => {
  const report = JSON.parse(fs.readFileSync(new URL(name, dir), "utf8"));
  const ops = (() => {
    try { return JSON.parse(fs.readFileSync(report.savedScenario, "utf8")).length; }
    catch { return null; }
  })();
  const id = name.replace(/\.json$/, "");
  return {
    id,
    session: report.session,
    exitCode: report.exitCode,
    seconds: typeof report.seconds === "number" ? Number(report.seconds.toFixed(1)) : null,
    commands: report.commands ?? null,
    scenarioOps: ops,
    error: report.error ?? null,
    // A one-opcode [["close"]] scenario is a cleanup invocation, not a turn: read off the artifact.
    klass: ops === 1 ? "close" : classOf.get(id) ?? null,
  };
});

const problems = [];
for (const row of rows) {
  if (row.klass === null) problems.push(`${row.id}: neither a close operation nor a declared class`);
}
const seen = new Set(rows.map((r) => r.id));
for (const [id, cls] of classOf) if (!seen.has(id)) problems.push(`${id}: declared as ${cls} but no report exists`);

console.log(`${rows.length} reports.\n`);
for (const row of rows) {
  const klass = row.klass === "close" ? "close operation" : row.klass ?? "UNCLASSIFIED";
  console.log([row.id, `exit ${row.exitCode}`, `${row.seconds}s`, `${row.commands} cmds`, `${row.scenarioOps} ops`, klass, row.error ? `ERROR ${row.error.slice(0, 60)}` : "no error"].join(" | "));
}

const tally = (cls) => rows.filter((r) => r.klass === cls).length;
console.log(`\nclose-op only (one [["close"]] opcode): ${rows.filter((r) => r.scenarioOps === 1).length}`);
console.log(`accepted: ${tally("accepted")}`);
console.log(`re-run at the committed revision: ${tally("recheck")}`);
console.log(`substantive-but-excluded: ${tally("excluded")}`);
console.log(`diagnostic: ${tally("diagnostic")}`);
if (problems.length) {
  console.error(`\nFAIL — declared classes do not reconcile with the reports:\n- ${problems.join("\n- ")}`);
  process.exitCode = 1;
}
