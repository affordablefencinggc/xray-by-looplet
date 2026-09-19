import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const output = dirname(fileURLToPath(import.meta.url)), root = resolve(output, "../../../..");
const manifest = JSON.parse(readFileSync(resolve(output, "legacy-preservation-manifest.json"), "utf8"));
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const git = (args, input) => execFileSync("git", args, { cwd: root, input });
const split = bytes => bytes.toString("utf8").split("\0").filter(Boolean);
const saveJson = (name, value) => writeFileSync(resolve(output, name), `${JSON.stringify(value, null, 2)}\n`);
const before = readFileSync(resolve(output, manifest.excludeBackup.path));
const exclude = resolve(root, ".git/info/exclude");
let after = readFileSync(exclude), restoredOriginalNewlines = false;
if (!after.subarray(0, before.length).equals(before)) {
  // apply_patch was the rule edit. This strictly mechanical formatting repair
  // restores its normalized existing prefix to the backed-up CRLF/LF bytes.
  const normalized = before.toString("utf8").replaceAll("\r\n", "\n");
  const patchedNormalized = after.toString("utf8").replaceAll("\r\n", "\n");
  if (!patchedNormalized.startsWith(normalized)) throw Error("Existing exclude content changed, not just line endings; stop");
  const appended = patchedNormalized.slice(normalized.length);
  after = Buffer.concat([before, Buffer.from(appended, "utf8")]);
  writeFileSync(exclude, after);
  restoredOriginalNewlines = true;
}
if (!readFileSync(exclude).subarray(0, before.length).equals(before)) throw Error("Original exclude prefix is not byte-identical");
const paths = manifest.files.map(file => file.path), input = Buffer.from(paths.join("\0") + "\0");
const verbose = split(git(["check-ignore", "--no-index", "--verbose", "--stdin", "-z"], input));
if (verbose.length !== paths.length * 4) throw Error("Every legacy path must have an identified matching rule");
const matches = [];
for (let index = 0; index < verbose.length; index += 4) {
  const [source, line, pattern, path] = verbose.slice(index, index + 4);
  const file = manifest.files.find(file => file.path === path);
  if (!file) throw Error("Unexpected matched path");
  const ignored = !pattern.startsWith("!");
  if (ignored && (source.replaceAll("\\", "/") !== ".git/info/exclude" || pattern !== file.proposedLocalExclude))
    throw Error(`Unexpected effective rule for ${path}`);
  if (!ignored && (source !== ".gitignore" || pattern !== "!/proof/growth/**/*.log"))
    throw Error(`Unexpected overriding rule for ${path}`);
  matches.push({ path, ignored, source, line: Number(line), pattern });
}
const effective = matches.filter(match => match.ignored), overridden = matches.filter(match => !match.ignored);
if (effective.length !== 561 || overridden.length !== 295) throw Error("Unexpected exclusion totals");
const preservation = manifest.files.map(file => {
  const bytes = readFileSync(resolve(root, file.path));
  return { path: file.path, bytes: bytes.length, sha256: hash(bytes), unchanged: bytes.length === file.bytes && hash(bytes) === file.sha256 };
});
if (preservation.some(file => !file.unchanged)) throw Error("A preserved legacy file changed");
const visible = split(git(["ls-files", "--others", "--exclude-standard", "-z"]));
const remainingLegacy = visible.filter(path => paths.includes(path)).sort();
if (JSON.stringify(remainingLegacy) !== JSON.stringify(overridden.map(match => match.path).sort())) throw Error("Visible legacy paths do not match the 295 overridden logs");
const futurePaths = [
  "proof/growth/2026-09-19-dashboard-refresh/campaigns/dash-329a6d2103c2/output/future-adjacent-proof.png",
  "proof/growth/runner/future-adjacent-proof.json",
  "proof/growth/2026-09-19-sc11-pdf-qualification/future-adjacent-proof.md",
  ".agents/skills/typesafe-ai/future-reference.md",
  "proof/growth/2026-09-20-sc11-mounted-package/future-proof.png",
];
let futureIgnored = [];
try { futureIgnored = split(git(["check-ignore", "--no-index", "--stdin", "-z"], Buffer.from(futurePaths.join("\0") + "\0"))); }
catch (failure) { if (failure.status !== 1 || failure.stdout?.length) throw failure; }
if (futureIgnored.length) throw Error("An adjacent future proof path was hidden");
const proposalLines = overridden.map(match => manifest.files.find(file => file.path === match.path).proposedLocalExclude);
writeFileSync(resolve(output, "proposed-root-gitignore-log-exclude.txt"), [
  "# PROPOSAL ONLY: NOT APPLIED. Exact 295 logs overridden by root .gitignore.",
  "# Requires separate approval; originals remain on disk.", ...proposalLines, "",
].join("\n"));
const rootIgnore = readFileSync(resolve(root, ".gitignore"), "utf8"), tail = rootIgnore.trimEnd().split(/\r?\n/).at(-1);
writeFileSync(resolve(output, "root-gitignore-log-proposal.diff"), [
  "*** Begin Patch", "*** Update File: .gitignore", "@@", " " + tail,
  "+", "+# PROPOSED exact preserved legacy log exclusions; requires explicit approval.",
  ...proposalLines.map(line => "+" + line), "*** End Patch", "",
].join("\n"));
let exactDiff;
try { exactDiff = git(["diff", "--no-index", "--binary", "--no-ext-diff", "--", resolve(output, manifest.excludeBackup.path), exclude]); }
catch (failure) { if (failure.status !== 1) throw failure; exactDiff = failure.stdout; }
writeFileSync(resolve(output, "local-exclude-applied.diff"), exactDiff);
saveJson("local-exclude-matches.json", matches);
saveJson("legacy-after-preservation.json", preservation);
const staged = split(git(["diff", "--cached", "--name-only", "-z"]));
const result = { schema: "xray.local-exclusion-verification/v1", completedAt: new Date().toISOString(),
  head: git(["rev-parse", "HEAD"]).toString("utf8").trim(), branch: git(["branch", "--show-current"]).toString("utf8").trim(),
  originalLegacyFiles: paths.length, originalLegacyBytes: manifest.legacyBytes, preservedUnchanged: preservation.length,
  rulesApplied: paths.length, effectiveLocalExclusions: effective.length, overriddenByRootLogNegation: overridden.length,
  visibleLegacyAfter: remainingLegacy.length, totalVisibleUntrackedAtObservation: visible.length,
  originalExcludeBytes: before.length, originalExcludeSha256: hash(before), afterExcludeBytes: after.length,
  afterExcludeSha256: hash(after), originalPrefixByteIdentical: true, restoredOriginalNewlines,
  adjacentFuturePathsChecked: futurePaths, adjacentFutureIgnored: futureIgnored, newSc11RootExcluded: false,
  rootGitignoreModified: false, proposedRootLogRules: proposalLines.length, staged,
  limitations: ["No files deleted or moved; all 856 originals still exist and match the precheck hashes.",
    "561 existing files are hidden from Git status; 295 logs remain visible because root .gitignore negates their exclusion.",
    "The root-log proposal is not applied; no broad directory patterns were added.",
    "No stage, commit, push, branch change, or product execution was performed by this helper."] };
saveJson("local-exclude-results.json", result);
process.stdout.write(JSON.stringify(result, null, 2) + "\n");
