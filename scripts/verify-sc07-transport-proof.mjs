import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceOnly = process.argv.includes("--source-only");
const runningInCi = process.env.GITHUB_ACTIONS === "true";
const outputArg = process.argv.find((value) => value.startsWith("--output="));
const outputPath = resolve(root, outputArg?.slice("--output=".length) || "proof/SC-07/transport.json");

const sources = {
  typescriptTransport: "src/studio/bomTransport.test.ts",
  typescriptAdapter: "src/studio/bomTauriAdapter.test.ts",
  typescriptState: "src/studio/bomState.test.ts",
  typescriptPersistence: "src/studio/bomPersistence.test.ts",
  typescriptStore: "src/studio/bomStore.test.ts",
  typescriptPanel: "src/studio/BomPanel.test.ts",
  typescriptHost: "src/studio/engineHost.test.ts",
  browserFlow: "scripts/bom-flow-audit.mjs",
  browserBuiltFlow: "scripts/bom-flow-audit-built.mjs",
  browserFixture: "engine/fixtures/bom-contract/colorbond.request.json",
  browserResponseFixture: "engine/fixtures/bom-contract/colorbond.response.json",
  pythonBoundary: "engine/python/xray/test_job_bom_contract_boundary.py",
  rustHost: "engine/host/src/lib.rs",
  rustHostWindowsSecurity: "engine/host/src/windows_security_tests.rs",
  rustTauri: "src-tauri/src/lib.rs",
};

const loaded = Object.fromEntries(
  await Promise.all(Object.entries(sources).map(async ([key, path]) => [key, await readFile(resolve(root, path), "utf8")])),
);

const expectedSourceMarkers = {
  typescriptTransport: ["BR-001", "BR-035", "pending invocation does not block the event-loop heartbeat"],
  typescriptAdapter: ["passes the exact inspected source bytes", "sends targeted cancellation", "BR-024 keeps BOM invocation on its own command"],
  typescriptState: ["records source, recipe, ruleset and job invalidation reasons deterministically"],
  typescriptPersistence: ["reload", "rollback"],
  typescriptStore: ["rejects a late completion", "atomically commits"],
  typescriptPanel: ["SC-07H BOM panel states", "separates transport failure from domain issues"],
  typescriptHost: ["BR-025", "does not advertise the dormant legacy Electron runTakeoff bridge"],
  browserFlow: ["productionTested: false", "verifyCancellationPreservesSnapshot", "mutateJobAndVerifyStale"],
  browserBuiltFlow: ["productionTested: true", "append-only-built-chunk-observability", "nativeEngineExecuted: false"],
  pythonBoundary: ["test_br_001", "test_br_002", "test_br_003", "test_br_033"],
  rustHost: [
    "transport_br_001",
    "transport_br_009_exact_streamed_stdout_boundary_is_direct",
    "transport_br_013_unix_process_group_kills_descendants_on_timeout_and_cancel",
    "transport_br_023_source_bytes_are_rehashed_before_runner_selection",
    "transport_br_034_035",
    "transport_fixture_process",
  ],
  rustHostWindowsSecurity: [
    "transport_br_017_windows_junction_result_traversal_is_rejected",
    "transport_br_018_windows_scratch_has_current_owner_and_private_protected_dacl",
    "GetNamedSecurityInfoW",
  ],
  rustTauri: ["bom_ipc_cancellation_is_keyed", "bom_ipc_rehashes_source_bytes", "transport_br_023_import_then_changed_file", "transport_br_024_import_and_bom_are_separate_commands"],
};

const sourceProblems = [];
for (const [key, markers] of Object.entries(expectedSourceMarkers)) {
  for (const marker of markers) {
    if (!loaded[key].includes(marker)) sourceProblems.push(`${sources[key]} is missing required marker: ${marker}`);
  }
}

const spawnAudit = auditTestSpawnTargets(loaded);
if (!spawnAudit.ok) sourceProblems.push(...spawnAudit.problems);
const testInventory = buildTestInventory(loaded);

const resultFiles = {
  typescript: "proof/SC-07/typescript-transport.tap",
  rustHost: "proof/SC-07/rust-host-transport.log",
  rustHostWindowsSecurity: "proof/SC-07/rust-host-windows-security.log",
  rustTauri: "proof/SC-07/rust-tauri-transport.log",
  browserDev: "proof/SC-07/bom-flow-audit-dev.json",
  browserBuilt: "proof/SC-07/bom-flow-audit-built.json",
  python: "proof/SC-07/python-transport.log",
};
const unixProcessTreePath = "proof/SC-07/rust-host-process-tree-unix.log";
const results = sourceOnly
  ? Object.fromEntries(Object.entries(resultFiles).map(([key, path]) => [key, { status: "not-run", path }]))
  : {
      typescript: await parseNodeResult(resultFiles.typescript),
      rustHost: await parseCargoResult(resultFiles.rustHost),
      rustHostWindowsSecurity: process.platform === "win32"
        ? await parseCargoResult(resultFiles.rustHostWindowsSecurity)
        : { status: "not-applicable", path: resultFiles.rustHostWindowsSecurity, reason: "Direct DACL and junction proof executes only on Windows." },
      rustTauri: await parseCargoResult(resultFiles.rustTauri),
      browserDev: await parseBrowserFlowResult(resultFiles.browserDev),
      browserBuilt: await parseBuiltBrowserFlowResult(resultFiles.browserBuilt),
      python: await parsePythonResult(resultFiles.python),
    };
const unixProcessTree = sourceOnly
  ? { status: "not-run", path: unixProcessTreePath }
  : await parseUnixProcessTreeResult(unixProcessTreePath);
if (runningInCi && unixProcessTree.status !== "passed") {
  sourceProblems.push(`CI did not produce passing Unix process-group proof: ${unixProcessTree.reason ?? unixProcessTree.status}`);
}

const brCoverage = coverageMatrix(unixProcessTree.status === "passed");
const passedLayers = new Set(
  Object.entries(results).filter(([, result]) => result.status === "passed").map(([key]) => key),
);
const requirements = brCoverage.map((entry) => {
  const provenLayers = entry.sourceLayers.filter((layer) => passedLayers.has(layer));
  const runtimeEvidenceComplete = entry.requiredPassingLayers.every((layer) => passedLayers.has(layer));
  const complete = entry.knownGaps.length === 0 && runtimeEvidenceComplete && (entry.id !== "BR-035" || spawnAudit.ok);
  return {
    id: entry.id,
    complete,
    status: complete ? "verified" : entry.sourceLayers.length > 0 ? "partial" : "open",
    sourceLayers: entry.sourceLayers,
    provenLayers,
    missingPassingLayers: entry.requiredPassingLayers.filter((layer) => !passedLayers.has(layer)),
    knownGaps: entry.knownGaps,
    sourceEvidence: Object.fromEntries(
      Object.entries(testInventory)
        .map(([layer, tests]) => [layer, tests.filter((test) => test.brIds.includes(entry.id)).map((test) => test.name)])
        .filter(([, names]) => names.length > 0),
    ),
  };
});
const summary = {
  verified: requirements.filter((entry) => entry.status === "verified").length,
  partial: requirements.filter((entry) => entry.status === "partial").length,
  open: requirements.filter((entry) => entry.status === "open").length,
  total: requirements.length,
};
const proofResultsPass = Object.values(results).every((result) => sourceOnly || result.status === "passed" || result.status === "not-applicable");
const completionClaim = !sourceOnly && sourceProblems.length === 0 && proofResultsPass && requirements.every((entry) => entry.complete);

const manifest = {
  schema: "xray.proof.sc07-transport/v1",
  ok: sourceProblems.length === 0 && proofResultsPass,
  mode: sourceOnly ? "source-audit" : runningInCi ? "ci-executed" : "local-executed",
  executionContext: {
    platform: process.platform,
    arch: process.arch,
    node: process.version,
    githubActions: runningInCi,
  },
  completionClaim,
  completionReason: completionClaim
    ? "Every BR-001…BR-035 row has current passing evidence in every required layer."
    : `${summary.partial} partial and ${summary.open} open BR rows remain; source presence is never treated as completed transport acceptance.`,
  sourceSha256: Object.fromEntries(Object.entries(loaded).map(([key, value]) => [key, sha256(value)])),
  testResults: results,
  platformProofs: { unixProcessTree },
  testInventory,
  hermeticSpawnAudit: spawnAudit,
  sourceProblems,
  requirements,
  summary,
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ output: relative(root, outputPath), ok: manifest.ok, mode: manifest.mode, executionContext: manifest.executionContext, summary: manifest.summary, sourceProblems }, null, 2));
if (!manifest.ok) process.exitCode = 1;

function auditTestSpawnTargets(allSources) {
  const hostTests = `${testModule(allSources.rustHost, sources.rustHost)}\n${allSources.rustHostWindowsSecurity}`;
  const tauriTests = testModule(allSources.rustTauri, sources.rustTauri);
  const tsTests = Object.entries(allSources)
    .filter(([key]) => key.startsWith("typescript"))
    .map(([, value]) => value)
    .join("\n");
  const rustTests = `${hostTests}\n${tauriTests}`;
  const commandTargets = [...rustTests.matchAll(/Command::new\(([^\n;]+)\)/gu)].map((match) => match[1].trim());
  const problems = [];
  const approvedTargets = new Set(["std::env::current_exe().unwrap()", '"cmd.exe"']);
  if (commandTargets.length < 1 || commandTargets.some((target) => !approvedTargets.has(target))) {
    problems.push(`Rust transport tests may spawn only their current compiled test executable or Windows cmd.exe for the fixed mklink /J fixture; found: ${JSON.stringify(commandTargets)}`);
  }
  if (commandTargets.includes('"cmd.exe"') && !/\.args\(\["\/D", "\/C", "mklink", "\/J"\]\)/u.test(allSources.rustHostWindowsSecurity)) {
    problems.push("The Windows cmd.exe security fixture is not pinned to /D /C mklink /J.");
  }
  if (commandTargets.filter((target) => target === '"cmd.exe"').length !== 1) {
    problems.push("Exactly one Windows cmd.exe invocation is permitted for the junction fixture.");
  }
  if (/node:child_process|child_process|\b(?:exec|execFile|spawn|fork)Sync?\s*\(/u.test(tsTests)) {
    problems.push("TypeScript transport/state/panel tests must use in-memory adapters and cannot start child processes.");
  }
  const forbiddenTarget = /engine[\\/]bin|(?:installer|setup)\.(?:exe|msi)|\bpython(?:3(?:\.\d+)?)?\.exe\b|Command::new\(\s*["'](?:python|python3|xray-engine)|externalBin/u;
  if (forbiddenTarget.test(rustTests) || forbiddenTarget.test(tsTests)) {
    problems.push("Transport tests reference a forbidden repository binary, installer, PATH Python, or production sidecar spawn target.");
  }
  return {
    ok: problems.length === 0,
    policy: "Rust tests may spawn only std::env::current_exe() or Windows cmd.exe pinned to /D /C mklink /J for a harmless temporary junction. TypeScript tests remain in-process. Repository binaries, installers, PATH Python and production sidecars are forbidden.",
    rustCommandTargets: commandTargets,
    typescriptChildProcessImports: [...tsTests.matchAll(/(?:node:)?child_process/gu)].length,
    forbiddenTargetMatches: 0,
    problems,
  };
}

function testModule(source, path) {
  const marker = source.indexOf("#[cfg(test)]");
  if (marker < 0) throw new Error(`${path} has no #[cfg(test)] module.`);
  return source.slice(marker);
}

function buildTestInventory(allSources) {
  const typescript = Object.entries(allSources)
    .filter(([key]) => key.startsWith("typescript"))
    .flatMap(([key, source]) => [...source.matchAll(/\b(?:test|it)\(\s*["`]([^"`]+)["`]/gu)].map((match) => ({
      file: sources[key],
      name: match[1],
      brIds: extractBrIds(match[1]),
    })));
  const rustTestsFromSource = (key, source) => [...source.matchAll(/#\[test\]\s*(?:#\[ignore\]\s*)?fn\s+([A-Za-z0-9_]+)/gu)].map((match) => ({
    file: sources[key],
    name: match[1],
    brIds: extractBrIds(match[1].replaceAll("_", "-")),
  }));
  const python = [...allSources.pythonBoundary.matchAll(/\bdef\s+(test_[a-z0-9_]+)\s*\(/gu)].map((match) => ({
    file: sources.pythonBoundary,
    name: match[1],
    brIds: extractBrIds(match[1].replaceAll("_", "-")),
  }));
  return {
    typescript,
    rustHost: rustTestsFromSource("rustHost", testModule(allSources.rustHost, sources.rustHost)),
    rustHostWindowsSecurity: rustTestsFromSource("rustHostWindowsSecurity", allSources.rustHostWindowsSecurity),
    rustTauri: rustTestsFromSource("rustTauri", testModule(allSources.rustTauri, sources.rustTauri)),
    python,
  };
}

function extractBrIds(value) {
  const normalised = value.toUpperCase().replaceAll("_", "-");
  if (!normalised.includes("BR-")) return [];
  return [...new Set([...normalised.matchAll(/(?:^|[-\s])(\d{3})(?=$|[-\s])/gu)].map((match) => `BR-${match[1]}`))].sort();
}

async function parseNodeResult(path) {
  const rawText = await requiredResult(path);
  const text = rawText.replaceAll("ℹ ", "# ").replaceAll("â„¹ ", "# ");
  const tests = numberFrom(text, /(?:^|\n)(?:# |ℹ )?tests\s+(\d+)/u, path, "test count");
  const pass = numberFrom(text, /(?:^|\n)(?:# |ℹ )?pass\s+(\d+)/u, path, "pass count");
  const fail = numberFrom(text, /(?:^|\n)(?:# |ℹ )?fail\s+(\d+)/u, path, "failure count");
  if (tests < 1 || pass !== tests || fail !== 0) throw new Error(`${path} is not a passing complete Node test result.`);
  return { status: "passed", path, sha256: sha256(rawText), tests, passed: pass, failed: fail };
}

async function parseCargoResult(path) {
  const text = await requiredResult(path);
  const matches = [...text.matchAll(/test result: (ok|FAILED)\.\s+(\d+) passed;\s+(\d+) failed;\s+(\d+) ignored/gu)];
  if (matches.length === 0 || matches.some((match) => match[1] !== "ok" || Number(match[3]) !== 0)) {
    throw new Error(`${path} is not a passing Cargo test result.`);
  }
  const executed = matches.reduce((sum, match) => sum + Number(match[2]), 0);
  if (executed < 1) throw new Error(`${path} did not execute any tests.`);
  return { status: "passed", path, sha256: sha256(text), resultGroups: matches.length, executed, failed: 0 };
}

async function parseUnixProcessTreeResult(path) {
  try {
    const result = await parseCargoResult(path);
    const text = await requiredResult(path);
    const executionMarker = "SC07G_BR013_UNIX_PROCESS_GROUP_EXECUTED platform=unix cases=timeout,cancel";
    const testMarker = "transport_br_013_unix_process_group_kills_descendants_on_timeout_and_cancel";
    if (!text.includes(executionMarker) || !text.includes(testMarker)) {
      throw new Error(`${path} lacks the exact Unix execution and test markers.`);
    }
    return { ...result, executionMarker };
  } catch (error) {
    return {
      status: "missing-or-invalid",
      path,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

async function parsePythonResult(path) {
  const text = await requiredResult(path);
  const passed = numberFrom(text, /(?:^|\s)(\d+) passed(?:,|\s|$)/u, path, "passed test count");
  if (passed < 1 || /(?:^|\s)\d+ failed(?:,|\s|$)/u.test(text) || /(?:^|\s)ERROR(?:\s|$)/u.test(text)) {
    throw new Error(`${path} is not a passing complete Python boundary result.`);
  }
  return { status: "passed", path, sha256: sha256(text), tests: passed, passed, failed: 0 };
}

async function parseBrowserFlowResult(path) {
  const text = await requiredResult(path);
  let proof;
  try {
    proof = JSON.parse(text);
  } catch {
    throw new Error(`${path} is not valid JSON.`);
  }
  if (
    proof?.schema !== "xray.sc-07-bom-flow-audit/v1"
    || proof?.scope !== "development UI only"
    || proof?.ok !== true
    || proof?.productionTested !== false
    || proof?.nativeEngineExecuted !== false
    || proof?.auditScriptSha256 !== sha256(loaded.browserFlow)
    || proof?.fixture?.sha256 !== sha256(loaded.browserFixture)
    || !Array.isArray(proof?.viewports)
    || proof.viewports.length !== 2
  ) {
    throw new Error(`${path} is not a passing, explicitly development-only SC-07 browser result.`);
  }
  const expectedViewports = new Map([["desktop", [1280, 800]], ["mobile", [390, 844]]]);
  for (const result of proof.viewports) {
    const expected = expectedViewports.get(result?.viewport?.name);
    const staleReasons = [...(result?.stale?.reasons ?? [])].sort().join(",");
    if (
      !expected
      || result.viewport.width !== expected[0]
      || result.viewport.height !== expected[1]
      || result.ok !== true
      || result.status !== 200
      || result.noRecipe?.visible !== true
      || result.noRecipe?.generateUnavailable !== true
      || result.actorGate?.blockedWithoutActor !== true
      || result.assumptions?.accepted !== 4
      || result.generation?.transport !== "fake-tauri"
      || result.generation?.bridge?.runCalls !== 1
      || result.generation?.hasSnapshot !== true
      || result.generation?.lineCount !== 11
      || result.generation?.visibleRows !== 11
      || result.generation?.expressionExpanded !== true
      || result.generation?.evidenceVisible !== true
      || result.generation?.assumptionsVisible !== true
      || result.generation?.confidenceVisible !== true
      || result.generation?.evidenceNavigation?.pane !== "Measure"
      || result.reload?.restored !== true
      || result.reload?.stayedCurrent !== true
      || result.failurePreservation?.failureKind !== "transport"
      || result.failurePreservation?.snapshotPreserved !== true
      || result.stale?.hasSnapshot !== true
      || staleReasons !== "job-changed,recipe-changed"
      || result.horizontalOverflow?.document !== false
      || result.horizontalOverflow?.body !== false
      || result.consoleErrors?.length !== 0
      || result.pageErrors?.length !== 0
    ) {
      throw new Error(`${path} has incomplete ${result?.viewport?.name ?? "unknown"} browser-flow evidence.`);
    }
    expectedViewports.delete(result.viewport.name);
  }
  if (expectedViewports.size !== 0) throw new Error(`${path} is missing a required browser viewport.`);
  validateBrowserEdgeEvidence(proof, path);
  return {
    status: "passed",
    path,
    sha256: sha256(text),
    scope: proof.scope,
    viewports: proof.viewports.map((result) => result.viewport.name),
    productionTested: false,
    nativeEngineExecuted: false,
    executedInCurrentInvocation: false,
    capturedAt: proof.generatedAt,
  };
}

async function parseBuiltBrowserFlowResult(path) {
  const text = await requiredResult(path);
  let proof;
  try {
    proof = JSON.parse(text);
  } catch {
    throw new Error(`${path} is not valid JSON.`);
  }
  if (
    proof?.schema !== "xray.sc-07-bom-flow-audit/v1"
    || proof?.scope !== "production bundle UI with append-only store observability and deterministic fake Tauri invoke"
    || proof?.ok !== true
    || proof?.productionTested !== true
    || proof?.nativeEngineExecuted !== false
    || proof?.production?.attempted !== true
    || proof?.production?.supportedByAuditSeam !== true
    || proof?.production?.exactBuiltBytesServed !== false
    || proof?.production?.productionLogicReplaced !== false
    || proof?.production?.observabilitySideEffect !== true
    || proof?.auditScriptSha256 !== sha256(loaded.browserBuiltFlow)
    || proof?.fixture?.requestSha256 !== sha256(loaded.browserFixture)
    || proof?.fixture?.responseSha256 !== sha256(loaded.browserResponseFixture)
    || !Array.isArray(proof?.viewports)
    || proof.viewports.length !== 2
  ) {
    throw new Error(`${path} is not a passing, explicitly instrumented production-bundle SC-07 result.`);
  }
  const expectedViewports = new Map([["desktop", [1280, 800]], ["mobile", [390, 844]]]);
  let routeSha256 = null;
  for (const result of proof.viewports) {
    const expected = expectedViewports.get(result?.viewport?.name);
    const staleReasons = [...(result?.stale?.reasons ?? [])].sort().join(",");
    const observedRouteSha = result?.instrumentation?.originalSha256;
    if (
      !expected
      || result.viewport.width !== expected[0]
      || result.viewport.height !== expected[1]
      || result.ok !== true
      || result.status !== 200
      || result.instrumentation?.strategy !== "append-only-built-chunk-observability"
      || typeof observedRouteSha !== "string"
      || !/^[a-f0-9]{64}$/u.test(observedRouteSha)
      || result.instrumentation?.appendBytes !== 111
      || result.instrumentation?.replacements !== 0
      || result.instrumentation?.sourceBehaviorChanged !== false
      || result.noRecipe?.visible !== true
      || result.noRecipe?.generateUnavailable !== true
      || result.actorGate?.blockedWithoutActor !== true
      || result.assumptions?.accepted !== 4
      || result.generation?.transport !== "fake-tauri"
      || result.generation?.bridge?.runCalls !== 1
      || result.generation?.hasSnapshot !== true
      || result.generation?.lineCount !== 11
      || result.generation?.visibleRows !== 11
      || result.generation?.evidenceNavigation?.pane !== "Measure"
      || result.reload?.restored !== true
      || result.reload?.stayedCurrent !== true
      || result.failurePreservation?.failureKind !== "transport"
      || result.failurePreservation?.snapshotPreserved !== true
      || result.stale?.hasSnapshot !== true
      || staleReasons !== "job-changed,recipe-changed"
      || result.horizontalOverflow?.document !== false
      || result.horizontalOverflow?.body !== false
      || result.consoleErrors?.length !== 0
      || result.pageErrors?.length !== 0
    ) {
      throw new Error(`${path} has incomplete ${result?.viewport?.name ?? "unknown"} production-flow evidence.`);
    }
    if (routeSha256 !== null && routeSha256 !== observedRouteSha) throw new Error(`${path} used different built route bytes across viewports.`);
    routeSha256 = observedRouteSha;
    expectedViewports.delete(result.viewport.name);
  }
  if (expectedViewports.size !== 0) throw new Error(`${path} is missing a required production viewport.`);
  validateBrowserEdgeEvidence(proof, path);
  return {
    status: "passed",
    path,
    sha256: sha256(text),
    scope: proof.scope,
    viewports: proof.viewports.map((result) => result.viewport.name),
    routeSha256,
    productionTested: true,
    exactBuiltBytesServed: false,
    productionLogicReplaced: false,
    nativeEngineExecuted: false,
    executedInCurrentInvocation: false,
    capturedAt: proof.generatedAt,
  };
}

function validateBrowserEdgeEvidence(proof, path) {
  const expectedUnavailable = new Map([["desktop", [1280, 800]], ["mobile", [390, 844]]]);
  if (!Array.isArray(proof.browserUnavailableViewports) || proof.browserUnavailableViewports.length !== 2) {
    throw new Error(`${path} is missing genuine web-host unavailable evidence.`);
  }
  for (const result of proof.browserUnavailableViewports) {
    const expected = expectedUnavailable.get(result?.viewport?.name);
    if (
      !expected
      || result.viewport.width !== expected[0]
      || result.viewport.height !== expected[1]
      || result.host !== "web"
      || result.status !== 200
      || result.assumptionsAccepted !== 4
      || result.titleVisible !== true
      || result.generateUnavailable !== true
      || result.consoleErrors?.length !== 0
      || result.pageErrors?.length !== 0
      || result.ok !== true
    ) throw new Error(`${path} has incomplete ${result?.viewport?.name ?? "unknown"} web-unavailable evidence.`);
    expectedUnavailable.delete(result.viewport.name);
  }
  if (expectedUnavailable.size !== 0) throw new Error(`${path} is missing a web-unavailable viewport.`);

  for (const result of proof.viewports) {
    const edge = result.responsiveLateResult;
    const bindingReasons = [...(edge?.bindingChanges?.reasons ?? [])].sort().join(",");
    const failures = result.failureKinds;
    if (
      edge?.pendingInvokeHeld !== true
      || !Number.isFinite(edge?.heartbeat?.elapsedMs)
      || edge.heartbeat.elapsedMs <= 0
      || edge.heartbeat.elapsedMs > 2_000
      || edge.heartbeat.ticks < 1
      || edge.retainedDetailResponsive !== true
      || edge.bindingChanges?.jobRevisionAfter !== edge.bindingChanges?.jobRevisionBefore + 1
      || edge.bindingChanges?.pendingCleared !== true
      || bindingReasons !== "job-changed,recipe-changed,ruleset-changed"
      || typeof edge.heldRequestId !== "string"
      || typeof edge.newestRequestId !== "string"
      || edge.heldRequestId === edge.newestRequestId
      || edge.lateResultIgnored !== true
      || edge.newestStart !== "visible Regenerate BOM control"
      || edge.staleRegenerationControlAvailable !== true
      || edge.uiBlocker !== null
      || failures?.domain?.distinctPresentation !== true
      || failures.domain.issueCodeVisible !== "gate-overlap"
      || failures.domain.transportHeadingAbsent !== true
      || failures?.transport?.distinctPresentation !== true
      || failures.transport.forbiddenDetailsRendered !== false
      || failures.transport.expectedNormalizedCode !== "response-contract"
      || !Array.isArray(failures.transport.attemptedForbiddenDetails)
      || failures.transport.attemptedForbiddenDetails.length < 4
    ) throw new Error(`${path} has incomplete ${result?.viewport?.name ?? "unknown"} responsive, late-result, or failure-kind evidence.`);
  }
}

async function requiredResult(path) {
  try {
    return await readFile(resolve(root, path), "utf8");
  } catch {
    throw new Error(`Required executed proof is missing: ${path}`);
  }
}

function numberFrom(text, expression, path, label) {
  const match = text.match(expression);
  if (!match) throw new Error(`${path} has no ${label}.`);
  return Number(match[1]);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function coverageMatrix(hasExecutedUnixProcessTreeProof) {
  const partial = (number, sourceLayers, requiredPassingLayers, ...knownGaps) => ({
    id: `BR-${String(number).padStart(3, "0")}`,
    sourceLayers,
    requiredPassingLayers,
    knownGaps,
  });
  return [
    partial(1, ["typescript", "rustHost", "python"], ["typescript", "rustHost", "python"]),
    partial(2, ["typescript", "rustHost", "python"], ["typescript", "rustHost", "python"]),
    partial(3, ["typescript", "rustHost", "python"], ["typescript", "rustHost", "python"]),
    partial(4, ["typescript", "rustHost"], ["typescript", "rustHost"]),
    partial(5, ["typescript", "rustHost", "rustTauri"], ["typescript", "rustHost", "rustTauri"]),
    partial(6, ["typescript", "rustHost"], ["typescript", "rustHost"]),
    partial(7, ["typescript", "rustHost", "rustTauri"], ["typescript", "rustHost", "rustTauri"]),
    partial(8, ["typescript", "rustHost"], ["typescript", "rustHost"]),
    partial(9, ["typescript", "rustHost"], ["typescript", "rustHost"]),
    partial(10, ["rustHost"], ["rustHost"]),
    partial(11, ["typescript", "rustHost", "rustTauri"], ["typescript", "rustHost", "rustTauri"]),
    partial(12, ["typescript", "rustHost", "rustTauri", "browserDev", "browserBuilt"], ["typescript", "rustHost", "rustTauri", "browserDev", "browserBuilt"]),
    partial(
      13,
      ["rustHost"],
      ["rustHost"],
      ...(hasExecutedUnixProcessTreeProof
        ? []
        : ["The Windows Job Object descendant test passes locally; a current executed Unix process-group artifact is still missing."]),
    ),
    partial(14, ["typescript", "rustTauri", "browserDev", "browserBuilt"], ["typescript", "rustTauri", "browserDev", "browserBuilt"]),
    partial(15, ["typescript", "rustHost", "rustTauri"], ["typescript", "rustHost", "rustTauri"]),
    partial(16, ["typescript", "rustHost"], ["typescript", "rustHost"]),
    partial(17, ["rustHost", "rustHostWindowsSecurity"], ["rustHost", "rustHostWindowsSecurity"]),
    partial(18, ["rustHost", "rustHostWindowsSecurity"], ["rustHost", "rustHostWindowsSecurity"]),
    partial(19, ["rustHost", "rustTauri"], ["rustHost", "rustTauri"]),
    partial(20, ["typescript", "rustHost", "rustTauri", "browserDev", "browserBuilt"], ["typescript", "rustHost", "rustTauri", "browserDev", "browserBuilt"]),
    partial(21, ["typescript", "rustHost", "rustTauri"], ["typescript", "rustHost", "rustTauri"]),
    partial(22, ["rustTauri"], ["rustTauri"]),
    partial(23, ["typescript", "rustHost", "rustTauri"], ["typescript", "rustHost", "rustTauri"]),
    partial(24, ["typescript", "rustTauri"], ["typescript", "rustTauri"]),
    partial(25, ["typescript"], ["typescript"]),
    partial(26, ["typescript", "browserDev", "browserBuilt"], ["typescript", "browserDev", "browserBuilt"]),
    partial(27, ["typescript", "browserDev", "browserBuilt"], ["typescript", "browserDev", "browserBuilt"]),
    partial(28, ["typescript", "browserDev", "browserBuilt"], ["typescript", "browserDev", "browserBuilt"]),
    partial(29, ["typescript", "browserDev", "browserBuilt"], ["typescript", "browserDev", "browserBuilt"]),
    partial(30, ["typescript", "rustHost"], ["typescript", "rustHost"]),
    partial(31, ["typescript", "rustHost", "rustTauri", "browserDev", "browserBuilt"], ["typescript", "rustHost", "rustTauri", "browserDev", "browserBuilt"]),
    partial(32, ["typescript", "rustHost", "rustTauri", "browserDev", "browserBuilt"], ["typescript", "rustHost", "rustTauri", "browserDev", "browserBuilt"]),
    partial(33, ["typescript", "rustHost", "python"], ["typescript", "rustHost", "python"]),
    partial(34, ["typescript", "rustHost"], ["typescript", "rustHost"]),
    partial(35, ["typescript", "rustHost"], ["typescript", "rustHost"]),
  ];
}
