/**
 * The page's four inlined screenshots, against every PNG on disk.
 *
 * README.md:266-268 claims the figures printed on the page are unaffected as printed — they were inlined
 * into `index.html` before the committed-revision re-runs ran, and none of the four payloads now matches
 * the bytes of any PNG under `proof/`. That is what licenses reading the page's figures as the accepted
 * runs' frames rather than as the re-run ones, and until this script existed it was the one claim in the
 * bundle that nothing executed established: the note asserted the comparison rather than citing a check
 * that performs it. The reading happened to be true; the point of the bundle's own rule — every claim
 * names the artifact that carries it — is that it should not have to be taken on trust.
 *
 * Run from the repo root: node proof/growth/2026-09-17-defect-fixes/check-payloads.mjs
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const PAGE = "proof/growth/2026-09-17-defect-fixes/index.html";
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const html = fs.readFileSync(PAGE, "utf8");
const payloads = [...html.matchAll(/src="data:image\/png;base64,([^"]+)"/g)].map((m) => Buffer.from(m[1], "base64"));

/* Every PNG under proof/, by digest: the claim is about all of them, not about this bundle's own captures,
   and the walk is sorted so the recorded output is reproducible from the same tree. */
const files = [];
const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (entry.name.endsWith(".png")) files.push(p);
  }
};
walk("proof");

const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const onDisk = new Map();
for (const file of files.sort()) onDisk.set(sha(fs.readFileSync(file)), file);

const checks = [];
const check = (label, ok, detail) => checks.push({ label, ok, detail });

check("four inlined payloads on the page", payloads.length === 4, `${payloads.length}`);
check("every payload starts with the PNG signature", payloads.every((b) => b.subarray(0, 8).equals(PNG_SIGNATURE)),
  payloads.filter((b) => !b.subarray(0, 8).equals(PNG_SIGNATURE)).length ? "not every one" : "all four");
check("the four payloads are four distinct images", new Set(payloads.map(sha)).size === payloads.length,
  `${new Set(payloads.map(sha)).size} distinct`);
check("none of the four matches the bytes of any PNG under proof/",
  payloads.every((b) => !onDisk.has(sha(b))),
  `${payloads.filter((b) => onDisk.has(sha(b))).length} of ${payloads.length} match`);

payloads.forEach((bytes, i) => {
  const digest = sha(bytes);
  console.log(`payload ${i + 1}: ${String(bytes.length).padStart(8)} bytes  sha256 ${digest.slice(0, 16)}…  matches: ${onDisk.get(digest) ?? "none"}`);
});
console.log(`\n${files.length} PNG(s) under proof/, ${onDisk.size} distinct digest(s) — the tree the payloads are held against.`);
console.log(`brief: the note cites these four as the pre-re-run frames; a payload matching a file on disk would retire that reading.`);

for (const c of checks) console.log(`${c.ok ? "ok  " : "FAIL"} ${c.label} — ${c.detail}`);
const bad = checks.filter((c) => !c.ok);
console.log(bad.length ? `\nFAIL — ${bad.length} of ${checks.length} checks failed.` : `\nPASS — ${checks.length} of ${checks.length} checks pass.`);
if (bad.length) process.exitCode = 1;
