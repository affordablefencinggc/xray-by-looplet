import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const output = dirname(fileURLToPath(import.meta.url)), root = resolve(output, "../../../..");
const manifest = JSON.parse(readFileSync(resolve(output, "legacy-preservation-manifest.json"), "utf8"));
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const git = (args, input) => execFileSync("git", args, { cwd: root, input });
const split = bytes => bytes.toString("utf8").split("\0").filter(Boolean);
const save = (name, value) => writeFileSync(resolve(output, name), JSON.stringify(value, null, 2) + "\n");
const ignore = resolve(root, ".gitignore"), backup = resolve(output, "root-gitignore-before-295-log-rules.bin");
if (process.argv.includes("--before")) {
  if (existsSync(backup)) throw Error("Original backup already exists; do not overwrite historical evidence");
  const bytes = readFileSync(ignore); copyFileSync(ignore, backup);
  save("root-gitignore-before-295-log-rules.json", { capturedAt: new Date().toISOString(), bytes: bytes.length,
    sha256: digest(bytes), head: git(["rev-parse", "HEAD"]).toString("utf8").trim(),
    approval: "Approve both paths", approvedPaths: [".gitignore", "dashboard-curated-images.json"],
    scope: "This helper changes neither approved path. It snapshots root .gitignore before the separately applied 295 exact log rules." });
  process.stdout.write(`Backed up ${bytes.length} original root-ignore bytes, SHA256 ${digest(bytes)}\n`);
} else {
  const before = readFileSync(backup); let after = readFileSync(ignore), restoredOriginalNewlines = false;
  if (!after.subarray(0, before.length).equals(before)) {
    const original = before.toString("utf8").replaceAll("\r\n", "\n"), patched = after.toString("utf8").replaceAll("\r\n", "\n");
    if (!patched.startsWith(original)) throw Error("Original root-ignore content changed beyond newline formatting");
    after = Buffer.concat([before, Buffer.from(patched.slice(original.length))]);
    writeFileSync(ignore, after); restoredOriginalNewlines = true;
  }
  const paths = manifest.files.map(file => file.path);
  const verbose = split(git(["check-ignore", "--no-index", "--verbose", "--stdin", "-z"], Buffer.from(paths.join("\0") + "\0")));
  if (verbose.length !== paths.length * 4) throw Error("Missing per-file ignore evidence");
  const matches = [];
  for (let at = 0; at < verbose.length; at += 4) {
    const [source, line, pattern, path] = verbose.slice(at, at + 4), file = manifest.files.find(file => file.path === path);
    if (!file || pattern.startsWith("!") || pattern !== file.proposedLocalExclude) throw Error(`Non-exact or negative exclusion: ${path}`);
    if (![".git/info/exclude", ".gitignore"].includes(source.replaceAll("\\", "/"))) throw Error(`Unexpected ignore source: ${path}`);
    if ((source === ".gitignore") !== path.endsWith(".log")) throw Error(`Unexpected root/local allocation: ${path}`);
    matches.push({ path, source, line: Number(line), pattern, ignored: true });
  }
  const preserved = manifest.files.map(file => {
    const bytes = readFileSync(resolve(root, file.path));
    return { path: file.path, bytes: bytes.length, sha256: digest(bytes), unchanged: bytes.length === file.bytes && digest(bytes) === file.sha256 };
  });
  if (preserved.some(file => !file.unchanged)) throw Error("Legacy bytes changed");
  const visible = split(git(["ls-files", "--others", "--exclude-standard", "-z"]));
  if (visible.some(path => paths.includes(path))) throw Error("A legacy path remains visible");
  const proofRoot = resolve(output, ".."), proofPaths = [];
  const visit = directory => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolute = resolve(directory, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile()) proofPaths.push(relative(root, absolute).replaceAll("\\", "/"));
    }
  };
  visit(proofRoot);
  const futurePaths = [
    "proof/growth/runner/future-adjacent-proof.log",
    "proof/growth/2026-09-19-sc11-pdf-qualification/future-adjacent-proof.log",
    "proof/growth/2026-09-19-dashboard-refresh/campaigns/dash-329a6d2103c2/output/future-adjacent-proof.png",
    "proof/growth/runner/future-adjacent-proof.json",
    "proof/growth/2026-09-20-sc11-mounted-package/future-proof.log",
    "proof/growth/2026-09-20-sc11-mounted-package/future-proof.png",
    "proof/growth/2026-09-20-sc11-mounted-package/future-proof.json",
  ];
  let incorrectlyIgnored = [];
  try { incorrectlyIgnored = split(git(["check-ignore", "--no-index", "--stdin", "-z"], Buffer.from([...proofPaths, ...futurePaths].join("\0") + "\0"))); }
  catch (failure) { if (failure.status !== 1 || failure.stdout?.length) throw failure; }
  if (incorrectlyIgnored.length) throw Error("Current SC11 or future adjacent proof was hidden: " + incorrectlyIgnored.join(", "));
  let diff;
  try { diff = git(["-c", "core.autocrlf=false", "diff", "--no-index", "--binary", "--no-ext-diff", "--", backup, ignore]); }
  catch (failure) { if (failure.status !== 1) throw failure; diff = failure.stdout; }
  writeFileSync(resolve(output, "root-log-exclusions-applied.diff"), diff);
  save("final-856-ignore-matches.json", matches);
  save("final-856-preservation.json", preserved);
  const result = { schema: "xray.approved-root-log-exclusion/v1", completedAt: new Date().toISOString(), approval: "Approve both paths",
    head: git(["rev-parse", "HEAD"]).toString("utf8").trim(), branch: git(["branch", "--show-current"]).toString("utf8").trim(),
    totalLegacyFiles: paths.length, totalLegacyBytes: manifest.legacyBytes, unchangedLegacyFiles: preserved.length,
    effectiveLocalRules: matches.filter(match => match.source === ".git/info/exclude").length,
    effectiveRootLogRules: matches.filter(match => match.source === ".gitignore").length,
    visibleLegacyBeforeFirstHygiene: 856, visibleLegacyBeforeRootChange: 295, visibleLegacyNow: 0,
    totalVisibleUntrackedAtObservation: visible.length, originalRootIgnoreBytes: before.length, originalRootIgnoreSha256: digest(before),
    afterRootIgnoreBytes: after.length, afterRootIgnoreSha256: digest(after), originalPrefixByteIdentical: after.subarray(0, before.length).equals(before),
    restoredOriginalNewlines, currentSc11PathsChecked: proofPaths.length, futurePathsChecked: futurePaths, incorrectlyIgnored,
    stagedAtObservation: split(git(["diff", "--cached", "--name-only", "-z"])),
    limitations: ["Original files remain on disk; ignore rules are not backups and do not delete data.",
      "Only 295 exact root log rules were applied. Prior local rules and both historical verification receipts were preserved.",
      "The shared hover log was not edited. No stage, commit, push, branch operation or product test was performed by this helper."] };
  save("final-root-log-results.json", result);
  process.stdout.write(JSON.stringify({ ...result, stagedAtObservation: result.stagedAtObservation.length }, null, 2) + "\n");
}
