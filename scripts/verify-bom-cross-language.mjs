#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { delimiter, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { buildBom } from "../src/studio/bomRules.ts";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const fixtures = resolve(root, "engine/fixtures/bom-contract");
const output = resolve(root, process.env.XRAY_BOM_PARITY_OUTPUT || "proof/SC-07/convergence.json");
const python = process.env.XRAY_PYTHON || (process.platform === "win32" ? "python.exe" : "python3");
const stems = ["colorbond", "timber-paling", "chain-wire", "concrete-allowance"];
const pythonProgram = [
  "import json,sys",
  "from xray.job_bom import build_bom",
  "request=json.load(sys.stdin)",
  "json.dump(build_bom(request),sys.stdout,ensure_ascii=False,separators=(',',':'))",
].join(";");

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function sourceHash(path) {
  return sha256(readFileSync(resolve(root, path)));
}

function runPython(requestText) {
  const result = spawnSync(python, ["-c", pythonProgram], {
    cwd: root,
    encoding: "utf8",
    input: requestText,
    env: {
      ...process.env,
      PYTHONIOENCODING: "utf-8",
      PYTHONPATH: [resolve(root, "engine/python"), resolve(root, "engine"), process.env.PYTHONPATH]
        .filter(Boolean)
        .join(delimiter),
    },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Python BOM kernel failed (${result.status}): ${result.stderr.trim()}`);
  return result.stdout;
}

const records = [];
for (const stem of stems) {
  const requestText = readFileSync(resolve(fixtures, `${stem}.request.json`), "utf8");
  const expected = JSON.parse(readFileSync(resolve(fixtures, `${stem}.response.json`), "utf8"));
  const request = JSON.parse(requestText);
  const expectedText = JSON.stringify(expected);
  const tsText = JSON.stringify(await buildBom(request));
  const pythonText = runPython(requestText);
  records.push({
    fixture: stem,
    requestSha256: sha256(JSON.stringify(request)),
    expectedSha256: sha256(expectedText),
    typescriptResponseSha256: sha256(tsText),
    pythonResponseSha256: sha256(pythonText),
    typescriptMatchesExpected: tsText === expectedText,
    pythonMatchesExpected: pythonText === expectedText,
    crossLanguageByteEquivalent: tsText === pythonText,
  });
}

const pythonVersion = execFileSync(python, ["--version"], { encoding: "utf8" }).trim();
// Build-worker snapshots have content manifests, but deliberately have no Git checkout.
// Keep that absence explicit rather than inventing a commit or dropping kernel/fixture hashes.
const hasGitCheckout = existsSync(resolve(root, '.git'));
const sourceState = hasGitCheckout ? {
  kind: 'git-checkout',
  gitHead: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
  dirty: execFileSync("git", ["status", "--porcelain", "--untracked-files=normal"], { cwd: root, encoding: "utf8" }).trim().length > 0,
} : { kind: 'source-snapshot', gitHead: null, dirty: null };
const pytestXml = resolve(root, "proof/SC-07/pytest-kernels.xml");
const ok = records.every((record) =>
  record.typescriptMatchesExpected && record.pythonMatchesExpected && record.crossLanguageByteEquivalent);
const manifest = {
  schema: "xray.proof.bom-convergence/v1",
  ok,
  sourceState,
  runtimes: { node: process.version, python: pythonVersion },
  sourceSha256: {
    packageLock: sourceHash("package-lock.json"),
    typescriptContract: sourceHash("src/studio/bomContract.ts"),
    jsonSchema: sourceHash("contracts/xray-job-bom-v1.schema.json"),
    typescriptKernel: sourceHash("src/studio/bomRules.ts"),
    pythonKernel: sourceHash("engine/python/xray/job_bom.py"),
    orderKernel: sourceHash("engine/python/xray/orders.py"),
    pythonBomTests: sourceHash("engine/python/xray/test_job_bom.py"),
    pythonOrderTests: sourceHash("engine/python/xray/test_orders.py"),
    parityVerifier: sourceHash("scripts/verify-bom-cross-language.mjs"),
  },
  artifacts: {
    pytestKernelsXmlSha256: existsSync(pytestXml) ? sha256(readFileSync(pytestXml)) : null,
  },
  fixtures: records,
};

mkdirSync(resolve(output, '..'), { recursive: true });
writeFileSync(output, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(JSON.stringify(manifest, null, 2));
if (!ok) process.exitCode = 1;
