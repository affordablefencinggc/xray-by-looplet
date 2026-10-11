import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildBom } from "../src/studio/bomRules.ts";
import { computeBomInputDigest } from "../src/studio/bomContract.ts";

// Build-time qualification data, not a product runtime or Python fallback.
const root = fileURLToPath(new URL("../", import.meta.url));
const output = resolve(process.argv[2]);
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const read = (relative) => readFileSync(join(root, relative));
const json = (relative) => JSON.parse(read(relative).toString("utf8"));
const stems = ["colorbond", "timber-paling", "chain-wire", "concrete-allowance"];
const paths = ["src/studio/bomRules.ts", "src/studio/bomContract.ts", "package.json", "package-lock.json",
  "scripts/frozen-engine-cases.mjs", "contracts/xray-job-bom-v1.schema.json"];
for (const stem of stems) for (const kind of ["request", "response"]) paths.push(`engine/fixtures/bom-contract/${stem}.${kind}.json`);
function dependencyFiles(dir) {
  for (const name of readdirSync(join(root, dir)).sort()) {
    const relative = `${dir}/${name}`;
    const stat = lstatSync(join(root, relative));
    assert.ok(!stat.isSymbolicLink(), `Dependency symlink rejected: ${relative}`);
    if (stat.isDirectory()) dependencyFiles(relative);
    else { assert.ok(stat.isFile()); paths.push(relative); }
  }
}
dependencyFiles("node_modules/zod");
const before = paths.map((path) => ({ path, sha256: hash(read(path)) }));
const lock = json("package-lock.json");
assert.equal(json("node_modules/zod/package.json").version, lock.packages["node_modules/zod"].version);
const cases = [];
for (const name of [...stems, "equal", "full-bays-terminal-cut"]) {
  const fixture = stems.includes(name);
  const request = json(`engine/fixtures/bom-contract/${fixture ? name : "colorbond"}.request.json`);
  if (!fixture) {
    request.recipeSet.recipes[0].bayLayout = name;
    request.inputDigest = await computeBomInputDigest(request);
  }
  const expected = await buildBom(request);
  assert.equal(expected.ok, true);
  if (fixture) assert.deepEqual(expected, json(`engine/fixtures/bom-contract/${name}.response.json`));
  else {
    const lines = Object.fromEntries(expected.bom.lines.map((line) => [line.id, line]));
    assert.equal(lines["bom-cb-sheet"].quantity.value, name === "equal" ? "13" : "14");
    assert.equal(lines["bom-cb-rail-cut"].quantity.value, "10");
  }
  cases.push({ name, request, expected, requestSha256: hash(JSON.stringify(request)), expectedSha256: hash(JSON.stringify(expected)) });
}
for (const entry of before) assert.equal(hash(read(entry.path)), entry.sha256, `Source changed: ${entry.path}`);
const record = {
  schema: "xray.frozen-engine-cases/v1", sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
  createdAt: new Date().toISOString(), nodeVersion: process.version, nodeSha256: hash(readFileSync(process.execPath)),
  zodVersion: lock.packages["node_modules/zod"].version, zodLockIntegrity: lock.packages["node_modules/zod"].integrity,
  dependencyLimit: "Installed Zod files are inventoried; registry tarball integrity is recorded, not independently revalidated.",
  sources: before, cases,
};
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, `${JSON.stringify(record, null, 2)}\n`, { flag: "wx" });
console.log(JSON.stringify({ output, cases: cases.length, sourceFiles: before.length, sha256: hash(readFileSync(output)) }));