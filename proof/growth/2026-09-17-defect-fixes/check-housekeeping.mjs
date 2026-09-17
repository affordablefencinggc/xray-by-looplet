/**
 * Checks the process-table figures the two READMEs now state, against the record itself.
 *
 * The claim being tested is README.md's, not this script's: that the record reads 51 sessions across
 * 25 passes, that 50 of 50 temporary browser profile directories were gone after close, that the one
 * persistent directory is still present, and that the record's last twenty-eight entries are exactly the
 * sessions this work started, each recorded with exitCode 0.
 *
 * Run from the repo root: node proof/growth/2026-09-17-defect-fixes/check-housekeeping.mjs
 */
import fs from "node:fs";

const record = JSON.parse(fs.readFileSync("proof/growth/2026-09-17-assistant-sweep-review/process-table.json", "utf8"));

/** The twenty-eight sessions the fix work started, as named in its README. */
const MINE = [
  "qa-defect20-d3", "qa-defect21-d8", "qa-defect22-d8", "qa-defect22b-d8",
  "qa-defect22c-d8", "qa-defect22d-d4", "qa-defect23-diag", "qa-defect23b-diag",
  "qa-report-page", "qa-report-page2", "qa-report-page3", "qa-report-page3-verify", "qa-report-page4",
  "qa-recheck-d3", "qa-recheck-d8-readonly", "qa-recheck-d8-ask", "qa-recheck-d4", "qa-render-final",
  "qa-render-final2", "qa-render-final3", "qa-render-final4", "qa-render-final5", "qa-render-final6",
  "qa-render-final7", "qa-render-final8", "qa-render-final9", "qa-render-final10", "qa-render-final11",
];

const checks = [];
const check = (label, ok, detail) => checks.push({ label, ok, detail });

check("25 passes in the record", record.passes.length === 25, `${record.passes.length}`);
check("51 sessions recorded", record.sessionsClosed.length === 51, `${record.sessionsClosed.length}`);
check("50 temporary profile dirs, all 50 gone after close",
  record.summary.temporaryProfileDirs === 50 && record.summary.temporaryDirsGoneAfterClose === 50,
  `${record.summary.temporaryDirsGoneAfterClose} of ${record.summary.temporaryProfileDirs}`);
check("1 persistent profile dir, still present",
  record.summary.persistentProfileDirs === 1 && record.summary.persistentDirsGoneAfterClose === 0,
  `${record.summary.persistentProfileDirs} dirs, ${record.summary.persistentDirsGoneAfterClose} gone`);

const tail = record.sessionsClosed.slice(-MINE.length).map((s) => s.session);
check("the last twenty-eight entries are this work's sessions",
  JSON.stringify(tail.slice().sort()) === JSON.stringify(MINE.slice().sort()), tail.join(", "));

const by = new Map(record.sessionsClosed.map((s) => [s.session, s]));
check("all twenty-eight are present in the record", MINE.every((n) => by.has(n)),
  MINE.filter((n) => !by.has(n)).join(", ") || "none missing");
check("all twenty-eight carry exitCode 0", MINE.every((n) => by.get(n)?.exitCode === 0),
  MINE.filter((n) => by.get(n)?.exitCode !== 0).join(", ") || "all zero");
check("all twenty-eight record the daemon gone and every profile dir gone",
  MINE.every((n) => by.get(n)?.daemonProcessGone === true && by.get(n).browsers.every((b) => b.dirStillExists === false)),
  MINE.filter((n) => !(by.get(n)?.daemonProcessGone === true && by.get(n).browsers.every((b) => b.dirStillExists === false))).join(", ") || "all clean");

// The owned dev server is stopped once its task is finished (AGENTS.project.md), and the record says so
// with the stop's own log rather than a retention claim. The user-facing preview is the one thing kept.
const ds = record.devServer ?? {};
check("the owned dev server was stopped, not retained",
  ds.daemonPid === 50804 && /Port 8085 released/.test(ds.cleanupLog ?? "") && !(record.untouched ?? []).some((u) => /8085/.test(u.what ?? "")),
  `PID ${ds.daemonPid ?? "?"} — ${ds.cleanupLog ?? "no stop recorded"}`);
/* Exactly two entries are kept, exactly one of them names a port at all, and that one is the preview —
   so a record keeping a second server on any port, or keeping one in the preview's place, fails this
   rather than passing on the preview's presence alone. The predicate is then run against perturbed
   copies of the record, because a reading that cannot fail carries nothing. */
const previewOnly = (r) => {
  const kept = r.untouched ?? [];
  const ported = kept.filter((u) => /:\d+/.test(u.what ?? ""));
  return kept.length === 2 && ported.length === 1 && /:8080\b/.test(ported[0].what ?? "");
};
check("the only server retained is the user-facing preview", previewOnly(record),
  (record.untouched ?? []).map((u) => u.what).join(" | "));

/* The record this reading must reject: the preview and a second server beside it (which the previous
   form of this check passed — reproduced against this exact record before the reading was strengthened),
   a second server in the preview's place, and no preview kept at all. */
const PERTURBED = [
  ["a second server kept beside the preview", [...record.untouched, { what: "an owned server left running on :9999", why: "perturbed" }]],
  ["a second server kept in the preview's place", [record.untouched[0], { what: "an owned server left running on :9999", why: "perturbed" }]],
  ["no preview kept at all", [{ what: "an owned server left running on :9999", why: "perturbed" }, record.untouched[1]]],
];
for (const [label, untouched] of PERTURBED) {
  check(`that reading rejects a record with ${label}`, previewOnly({ ...record, untouched }) === false,
    untouched.map((u) => u.what).join(" | "));
}

for (const c of checks) console.log(`${c.ok ? "ok  " : "FAIL"} ${c.label} — ${c.detail}`);
const bad = checks.filter((c) => !c.ok);
console.log(bad.length ? `\nFAIL — ${bad.length} of ${checks.length} checks failed.` : `\nPASS — ${checks.length} of ${checks.length} checks pass.`);
if (bad.length) process.exitCode = 1;
