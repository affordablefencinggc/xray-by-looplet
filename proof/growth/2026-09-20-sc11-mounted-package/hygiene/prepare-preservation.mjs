import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, lstatSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Metadata only. This script never changes the index, refs, original files or
// active ignore configuration. Output belongs exclusively to this proof lane.
const output = dirname(fileURLToPath(import.meta.url));
const root = resolve(output, "../../../..");
const prefix = "proof/growth/2026-09-20-sc11-mounted-package/";
const git = (args, options = {}) => execFileSync("git", args, { cwd: root, ...options });
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const stamp = new Date().toISOString().replaceAll(":", "-");
const startedAt = new Date().toISOString();
const json = (name, value) => writeFileSync(resolve(output, name), `${JSON.stringify(value, null, 2)}\n`);
const nulPaths = bytes => bytes.toString("utf8").split("\0").filter(Boolean);
const repo = git(["rev-parse", "--show-toplevel"]).toString("utf8").trim();
if (resolve(repo).toLowerCase() !== root.toLowerCase()) throw Error("Unexpected repository root");
const branch = git(["branch", "--show-current"]).toString("utf8").trim();
const head = git(["rev-parse", "HEAD"]).toString("utf8").trim();
const upstream = git(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"]).toString("utf8").trim();
const divergence = git(["rev-list", "--left-right", "--count", "HEAD...@{upstream}"]).toString("utf8").trim().split(/\s+/).map(Number);
const staged = nulPaths(git(["diff", "--cached", "--name-only", "-z"]));
const trackedDirty = nulPaths(git(["diff", "--name-only", "-z"]));
const paths = nulPaths(git(["ls-files", "--others", "--exclude-standard", "-z"])).filter(path => !path.startsWith(prefix)).sort();
if (paths.length !== 856) throw Error(`Expected the agreed 856 legacy paths, found ${paths.length}; review before changing scope`);

const category = path => path.startsWith("proof/growth/") ? path.split("/").slice(0, 3).join("/")
  : path.startsWith(".agents/skills/typesafe-ai/") ? ".agents/skills/typesafe-ai" : "repository-root";
const exclusionReason = path => path.startsWith("proof/growth/runner/") ? "User explicitly forbids staging runner leftovers"
  : ["20", "probe-variants.mjs", "HANDOFF-TYPESAFE-JEV-PLAN.md"].includes(path) ? "User explicitly forbids staging this path"
  : /84cadc|b853/.test(path) ? "User explicitly excludes old 84cadc/b853 infrastructure receipts"
  : path.startsWith("proof/growth/2026-09-19-dashboard-refresh/campaigns/dash-329") ? "User explicitly excludes dash-329"
  : "Preserved legacy local file; no staging or hiding approval inferred";
const meta = new Set(["\\", "*", "?", "[", "]", "!", "#", " "]);
const literalRule = path => "/" + [...path].map(char => meta.has(char) ? "\\" + char : char).join("");
const files = paths.map(path => {
  const absolute = resolve(root, path), stat = lstatSync(absolute);
  if (!stat.isFile() || stat.isSymbolicLink()) throw Error(`Non-regular legacy path requires review: ${path}`);
  if (!absolute.toLowerCase().startsWith(root.toLowerCase() + "\\")) throw Error(`Path outside repository: ${path}`);
  const bytes = readFileSync(absolute);
  return { path, bytes: bytes.length, sha256: digest(bytes), category: category(path),
    preservation: exclusionReason(path), proposedLocalExclude: literalRule(path) };
});

const excludePath = resolve(root, ".git/info/exclude"), excludeBytes = readFileSync(excludePath);
const excludeBackup = `git-info-exclude-before-${stamp}.bin`;
copyFileSync(excludePath, resolve(output, excludeBackup));
if (digest(readFileSync(resolve(output, excludeBackup))) !== digest(excludeBytes)) throw Error("Exclude backup identity mismatch");

const hoverPath = resolve(root, "CODEX-HOVER-LOG.md");
let hoverBytes, hoverDiff, hoverStable = false;
for (let attempt = 0; attempt < 3 && !hoverStable; attempt++) {
  hoverBytes = readFileSync(hoverPath);
  hoverDiff = git(["diff", "--binary", "--no-ext-diff", "--", "CODEX-HOVER-LOG.md"]);
  hoverStable = digest(hoverBytes) === digest(readFileSync(hoverPath));
}
if (!hoverStable) throw Error("Shared hover writer remained active; no coherent hover snapshot obtained");
const hoverSnapshot = `CODEX-HOVER-LOG-${stamp}.md`, hoverPatch = `CODEX-HOVER-LOG-${stamp}.diff`;
writeFileSync(resolve(output, hoverSnapshot), hoverBytes);
writeFileSync(resolve(output, hoverPatch), hoverDiff);

const rulesName = "proposed-local-exclude.txt";
writeFileSync(resolve(output, rulesName), [
  "# PROPOSAL ONLY: not installed in .git/info/exclude or any other ignore file.",
  "# Exact 856 preserved legacy files; requires approval before application.",
  "# No directory wildcards. New SC11 proof and future files remain visible.",
  ...files.map(file => file.proposedLocalExclude), "",
].join("\n"));
// check-ignore receives the proposal as a command-local configuration value.
// This validates matching without installing the rules or changing Git config.
const matched = nulPaths(git(["-c", `core.excludesFile=${resolve(output, rulesName)}`, "check-ignore", "--no-index", "--stdin", "-z"],
  { input: Buffer.from(paths.join("\0") + "\0") })).sort();
const unmatched = paths.filter(path => !matched.includes(path));
if (matched.some(path => !paths.includes(path))) throw Error("Proposed literal rules matched an unexpected input path");
if (unmatched.some(path => !path.startsWith("proof/growth/") || !path.endsWith(".log")))
  throw Error("An unexpected non-log path did not match the proposed local rules");
const changed = files.filter(file => digest(readFileSync(resolve(root, file.path))) !== file.sha256).map(file => file.path);
if (changed.length) throw Error(`Legacy files changed during hashing: ${changed.join(", ")}`);
if (digest(readFileSync(excludePath)) !== digest(excludeBytes)) throw Error("Active local exclude changed during this read-only preparation");
if (git(["rev-parse", "HEAD"]).toString("utf8").trim() !== head) throw Error("HEAD changed during preparation; review source identity");
const currentPaths = nulPaths(git(["ls-files", "--others", "--exclude-standard", "-z"])).filter(path => !path.startsWith(prefix)).sort();
if (JSON.stringify(currentPaths) !== JSON.stringify(paths)) throw Error("Legacy visible-untracked scope changed during preparation");

const groups = [...new Set(files.map(file => file.category))].map(name => {
  const group = files.filter(file => file.category === name);
  return { category: name, files: group.length, bytes: group.reduce((sum, file) => sum + file.bytes, 0) };
}).sort((a, b) => b.bytes - a.bytes);
const manifest = { schema: "xray.legacy-preservation/v1", startedAt, completedAt: new Date().toISOString(), root,
  branch, head, upstream, localTrackingDivergence: { ahead: divergence[0], behind: divergence[1] }, staged, trackedDirty,
  legacyFileCount: files.length, legacyBytes: files.reduce((sum, file) => sum + file.bytes, 0), groups,
  excludeBackup: { path: excludeBackup, bytes: excludeBytes.length, sha256: digest(excludeBytes), activeFileUnchanged: true },
  sharedHoverSnapshot: { path: hoverSnapshot, bytes: hoverBytes.length, sha256: digest(hoverBytes),
    diffPath: hoverPatch, diffBytes: hoverDiff.length, diffSha256: digest(hoverDiff), againstHead: head },
  proposedRules: { path: rulesName, rules: files.length, matchedExistingIntendedFiles: matched.length,
    blockedByHigherPriorityLogNegation: unmatched, sha256: digest(readFileSync(resolve(output, rulesName))), installed: false },
  limitations: ["No files deleted, moved, staged or hidden; no branch or Git configuration changed.",
    "Upstream comparison uses the current local tracking ref; this script performs no fetch or push.",
    "Hashes were stable during this check, not a claim that every file is redundant or remotely backed up.",
    "All 856 originals remain on disk. The manifest records identity, not a second copy of their contents.",
    "Shared hover log and new SC11 proof may continue changing after this dated snapshot.",
    "No application test ran on DANIEL; these are filesystem and Git metadata checks only.",
    "Root .gitignore !/proof/growth/**/*.log outranks local exclusions, so the listed log paths cannot be hidden by local-only exact rules."], files };
json("legacy-preservation-manifest.json", manifest);
const manifestHash = digest(readFileSync(resolve(output, "legacy-preservation-manifest.json")));
const receipt = { completedAt: manifest.completedAt, head, branch, legacyFileCount: files.length, legacyBytes: manifest.legacyBytes,
  manifestSha256: manifestHash, originalExcludeSha256: manifest.excludeBackup.sha256,
  hoverSnapshot, hoverSha256: manifest.sharedHoverSnapshot.sha256, stagedCount: staged.length,
  localTrackingDivergence: manifest.localTrackingDivergence, proposedRulesValidated: matched.length,
  higherPriorityLogNegationCount: unmatched.length, exclusionsApplied: false };
json("precheck-results.json", receipt);
process.stdout.write(JSON.stringify({ ...receipt, output: relative(root, output).replaceAll("\\", "/") }, null, 2) + "\n");
