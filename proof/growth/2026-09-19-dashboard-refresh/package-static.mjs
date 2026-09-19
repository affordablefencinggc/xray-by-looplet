/** Explicit source staging only; no product execution on the authoring host. */
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const directory = dirname(fileURLToPath(import.meta.url));
const root = resolve(directory, "../../..");
const own = "proof/growth/2026-09-19-dashboard-refresh";
const images = JSON.parse(readFileSync(resolve(root, "dashboard-curated-images.json"), "utf8"));
// Root reviewed the original 53 captures plus three SC09 built-output captures.
if (images.length !== 56) throw Error("Curated input changed; explicitly review its scope before packaging");
const files = [
  "XRAY-PRODUCTION-CLOSEOUT-LEDGER.md", "PROFESSIONAL-A-Z-CHECKLIST.md", "dashboard-curated-images.json",
  "scripts/build-full-dashboard.mjs", "scripts/validate-dashboard.mjs", "scripts/fast-cdp.mjs", "scripts/run-fast-cdp.ps1",
  `${own}/build-scenario.mjs`, `${own}/preview-built-dashboard.mjs`, `${own}/run-static.ps1`,
  ...images.map(image => image.relPath),
];
const entries = [...new Set(files)].sort().map(path => {
  if (path.startsWith("/") || path.includes("..") || path.includes(":")) throw Error("Unsafe staging input: " + path);
  const bytes = readFileSync(resolve(root, path));
  return { path, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") };
});
const digest = createHash("sha256").update(JSON.stringify(entries)).digest("hex");
const runId = `dash-${digest.slice(0, 12)}`;
const staging = resolve(root, ".temp", "dashboard-refresh", runId);
if (existsSync(staging)) throw Error("Historical stage already exists; use a new reviewed source snapshot");
mkdirSync(staging, { recursive: true });
const source = resolve(staging, "source");
mkdirSync(source);
for (const entry of entries) {
  const target = resolve(source, entry.path);
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(resolve(root, entry.path), target);
  if (createHash("sha256").update(readFileSync(target)).digest("hex") !== entry.sha256) throw Error("Source changed during packaging: " + entry.path);
}
writeFileSync(resolve(staging, "source-manifest.json"), JSON.stringify({ schemaVersion: 1, runId, sourceDigest: digest, curatedImages: images.length, entries }, null, 2) + "\n");
console.log(JSON.stringify({ runId, staging, files: entries.length, bytes: entries.reduce((total, entry) => total + entry.bytes, 0), sourceDigest: digest }, null, 2));
