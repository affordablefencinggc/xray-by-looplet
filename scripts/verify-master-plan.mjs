#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const root = process.cwd();
const paths = {
  master: resolve(root, "XRAY-MASTER-LEDGER.md"),
  topdown: resolve(root, "XRAY-TOPDOWN-MINDMAP-TODO.md"),
  workbench: resolve(root, "XRAY-WORKBENCH-CONTRACT.md"),
  sc07: resolve(root, "SC07-BRIDGE-ACCEPTANCE.md"),
  sc08: resolve(root, "SC08-REVIEW-PROOF-ACCEPTANCE.md"),
  sc09: resolve(root, "SC09-PRICING-ACCEPTANCE.md"),
  integration: resolve(root, "SC10-SC13-SC16-INTEGRATION-RELEASE-ACCEPTANCE.md"),
  desktopContinuity: resolve(root, "SC11-SC12-DESKTOP-CONTINUITY-ACCEPTANCE.md"),
  featureCrosswalk: resolve(root, "XRAY-FEATURE-ACCEPTANCE-CROSSWALK.md"),
  crosswalkProduct: resolve(root, "planning/crosswalk-product.md"),
  crosswalkEngine: resolve(root, "planning/crosswalk-engine.md"),
  crosswalkRelease: resolve(root, "planning/crosswalk-release.md"),
  residualProduct: resolve(root, "planning/residual-acceptance-product.md"),
  residualEngine: resolve(root, "planning/residual-acceptance-engine.md"),
  residualRelease: resolve(root, "planning/residual-acceptance-release.md"),
  caterpillar: resolve(root, "XRAY-CATERPILLAR-EXECUTION-MAP.md"),
  scheduleSc0709: resolve(root, "planning/caterpillar-sc07-sc09.md"),
  scheduleSc1012: resolve(root, "planning/caterpillar-sc10-sc12.md"),
  scheduleSc1316: resolve(root, "planning/caterpillar-sc13-sc16.md"),
};
const documents = Object.fromEntries(
  Object.entries(paths).map(([key, path]) => [key, readFileSync(path, "utf8")]),
);
const problems = [];
const unique = (values) => new Set(values).size === values.length;
const sha256 = (text) => createHash("sha256").update(text).digest("hex");

const sliceMatches = [...documents.master.matchAll(/^### SC-(\d{2}) .+?\s+\[([^\]]+)\]$/gm)];
const slices = sliceMatches.map((match) => ({ id: `SC-${match[1]}`, status: match[2] }));
const expectedSlices = Array.from({ length: 17 }, (_, index) => `SC-${String(index).padStart(2, "0")}`);
if (JSON.stringify(slices.map(({ id }) => id)) !== JSON.stringify(expectedSlices)) {
  problems.push("The master ledger must contain exactly SC-00 through SC-16 in order.");
}
const activeSlices = slices.filter(({ status }) => status.startsWith("in-progress"));
if (activeSlices.length !== 1) problems.push("Exactly one caterpillar segment must be active.");
const firstActiveIndex = slices.findIndex(({ status }) => status.startsWith("in-progress"));
if (slices.slice(0, firstActiveIndex).some(({ status }) => status !== "done")) {
  problems.push("Every segment before the active caterpillar segment must be done.");
}
if (slices.slice(firstActiveIndex + 1).some(({ status }) => status === "done")) {
  problems.push("A later slice is marked done beyond the active caterpillar segment.");
}

const queueMatches = [...documents.master.matchAll(/^(\d+)\. \[([ x>!])\] (SC-\d{2}[^\n]*)$/gm)];
const queue = queueMatches.map((match) => ({ number: Number(match[1]), marker: match[2], label: match[3] }));
if (queue.length !== 44 || queue.some(({ number }, index) => number !== index + 1)) {
  problems.push("The immediate execution queue must be contiguous from 1 through 44.");
}
const activeQueue = queue.filter(({ marker }) => marker === ">");
if (activeQueue.length !== 1) {
  problems.push("Exactly one immediate execution item must be active.");
} else if (activeSlices.length === 1 && !activeQueue[0].label.startsWith(activeSlices[0].id)) {
  problems.push("The active queue item must belong to the active caterpillar segment.");
}

const featureRows = [...documents.master.matchAll(/^\| ([A-Z]+-\d{3}) \| ([^|]+) \| ([^|]+) \| ([^|]+) \| ([^|]+) \|$/gm)].map(
  (match) => ({
    id: match[1],
    feature: match[2].trim(),
    state: match[3].trim(),
    authoritativeSource: match[4].trim(),
    requiredProofOrGap: match[5].trim(),
  }),
);
const deadCodeRows = [...documents.master.matchAll(/^\| (LEG-\d{3}) \| ([^|]+) \| ([^|]+) \| ([^|]+) \|$/gm)].map(
  (match) => ({ id: match[1], feature: match[2].trim(), state: match[3].trim(), requiredProofOrGap: match[4].trim() }),
);
const mappedRows = [...featureRows, ...deadCodeRows];
if (featureRows.length < 120) problems.push(`Expected at least 120 mapped product/engine/release feature rows; found ${featureRows.length}.`);
if (deadCodeRows.length < 9) problems.push(`Expected at least 9 mapped dead-code/false-claim rows; found ${deadCodeRows.length}.`);
if (!unique(mappedRows.map(({ id }) => id))) problems.push("Feature and dead-code inventory IDs must be unique.");
const expectedInventoryGroups = {
  UI: 7,
  SITE: 5,
  TRACE: 16,
  TAKE: 5,
  QUOTE: 5,
  DATA: 5,
  ENG: 36,
  MCP: 8,
  DESK: 11,
  WEB: 4,
  CI: 9,
  CRM: 3,
  SYNC: 2,
  SEC: 2,
  OFF: 3,
  AUTH: 1,
  COLLAB: 1,
  INT: 3,
  REL: 4,
  LEG: 9,
};
const inventoryGroups = {};
for (const [prefix, count] of Object.entries(expectedInventoryGroups)) {
  const ids = mappedRows.filter(({ id }) => id.startsWith(`${prefix}-`)).map(({ id }) => id);
  const expected = Array.from({ length: count }, (_, index) => `${prefix}-${String(index + 1).padStart(3, "0")}`);
  inventoryGroups[prefix] = ids.length;
  if (JSON.stringify(ids) !== JSON.stringify(expected)) {
    problems.push(`${prefix} inventory must be contiguous and ordered from ${expected[0]} through ${expected.at(-1)}.`);
  }
}
if (Object.values(expectedInventoryGroups).reduce((total, count) => total + count, 0) !== mappedRows.length) {
  problems.push("The feature inventory contains an unexpected prefix or count outside the frozen group map.");
}
for (const row of featureRows) {
  if (!row.feature || !row.state || !row.authoritativeSource || row.requiredProofOrGap.length < 3) {
    problems.push(`${row.id} is missing a feature name, state, authoritative source or meaningful proof/gap.`);
  }
}
for (const row of deadCodeRows) {
  if (!row.feature || !row.state || row.requiredProofOrGap.length < 3) {
    problems.push(`${row.id} is missing a surface, state or meaningful disposition.`);
  }
}

const acceptanceContracts = [
  { document: "sc08", file: "SC08-REVIEW-PROOF-ACCEPTANCE.md", prefix: "RP", count: 36, columns: 5 },
  { document: "sc09", file: "SC09-PRICING-ACCEPTANCE.md", prefix: "PR", count: 45, columns: 6 },
  {
    document: "integration",
    file: "SC10-SC13-SC16-INTEGRATION-RELEASE-ACCEPTANCE.md",
    prefix: "IR",
    count: 112,
    columns: 7,
  },
  {
    document: "desktopContinuity",
    file: "SC11-SC12-DESKTOP-CONTINUITY-ACCEPTANCE.md",
    prefix: "DC",
    count: 86,
    columns: 6,
  },
];
const acceptanceRows = {};
const acceptanceContent = {};
for (const contract of acceptanceContracts) {
  const parsedRows = documents[contract.document]
    .split(/\r?\n/)
    .filter((line) => new RegExp(`^\\| ${contract.prefix}-\\d{3} \\|`).test(line))
    .map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim()));
  const ids = parsedRows.map(([id]) => id);
  const expected = Array.from(
    { length: contract.count },
    (_, index) => `${contract.prefix}-${String(index + 1).padStart(3, "0")}`,
  );
  acceptanceRows[contract.prefix] = ids;
  if (JSON.stringify(ids) !== JSON.stringify(expected)) {
    problems.push(
      `${contract.file} acceptance rows must be contiguous from ${expected[0]} through ${expected.at(-1)}.`,
    );
  }
  for (const cells of parsedRows) {
    const [id] = cells;
    const [requirement, buildTarget, machineProof, humanProof] =
      contract.prefix === "DC" ? [cells[1], cells[1], cells[2], cells[3]] : cells.slice(1, 5);
    if (cells.length !== contract.columns) {
      problems.push(`${id} must have exactly ${contract.columns} populated acceptance columns; found ${cells.length}.`);
      continue;
    }
    if (
      cells.some((cell) => !cell) ||
      requirement.length < 12 ||
      buildTarget.length < 3 ||
      machineProof.length < 12 ||
      humanProof.length < 8
    ) {
      problems.push(`${id} lacks a meaningful requirement, build target, machine proof or human proof.`);
    }
  }
  acceptanceContent[contract.prefix] = {
    rows: parsedRows.length,
    expectedColumns: contract.columns,
    meaningfulCoreFields: parsedRows.filter((cells) => {
      const [requirement = "", buildTarget = "", machineProof = "", humanProof = ""] =
        contract.prefix === "DC" ? [cells[1], cells[1], cells[2], cells[3]] : cells.slice(1, 5);
      return (
        cells.length === contract.columns &&
        cells.every(Boolean) &&
        requirement.length >= 12 &&
        buildTarget.length >= 3 &&
        machineProof.length >= 12 &&
        humanProof.length >= 8
      );
    }).length,
  };
  if (!documents.master.includes(contract.file)) {
    problems.push(`The master ledger does not link ${contract.file}.`);
  }
  if (!documents.topdown.includes(`${expected[0]}…${expected.at(-1)}`)) {
    problems.push(`The live top-down queue does not name ${expected[0]}…${expected.at(-1)}.`);
  }
}

const expectedSectionRanges = {
  sc09: {
    "SC-09A": ["PR-001", "PR-010"],
    "SC-09B": ["PR-011", "PR-019"],
    "SC-09C": ["PR-020", "PR-030"],
    "SC-09D": ["PR-031", "PR-036"],
    "SC-09E": ["PR-037", "PR-045"],
  },
  integration: {
    "SC-10": ["IR-001", "IR-018"],
    "SC-13": ["IR-019", "IR-034"],
    "SC-14": ["IR-035", "IR-060"],
    "SC-15": ["IR-061", "IR-088"],
    "SC-16": ["IR-089", "IR-112"],
  },
  desktopContinuity: {
    "SC-11A": ["DC-001", "DC-006"],
    "SC-11B": ["DC-007", "DC-015"],
    "SC-11C": ["DC-016", "DC-025"],
    "SC-11D": ["DC-026", "DC-033"],
    "SC-11E": ["DC-034", "DC-041"],
    "SC-11F": ["DC-042", "DC-046"],
    "SC-12A": ["DC-047", "DC-050"],
    "SC-12B": ["DC-051", "DC-058"],
    "SC-12C": ["DC-059", "DC-064"],
    "SC-12D": ["DC-065", "DC-071"],
    "SC-12E": ["DC-072", "DC-076"],
    "SC-12F": ["DC-077", "DC-081"],
    "SC-12G": ["DC-082", "DC-086"],
  },
};
const sectionRanges = {};
for (const [document, expectedRanges] of Object.entries(expectedSectionRanges)) {
  let section = null;
  const actualRanges = {};
  for (const line of documents[document].split(/\r?\n/)) {
    const heading = line.match(/^### (SC-\d{2}[A-Z]?)(?:\s|$)/);
    if (heading) section = heading[1];
    const row = line.match(/^\| ((?:PR|IR|DC)-\d{3}) \|/);
    if (!section || !row) continue;
    actualRanges[section] ??= [row[1], row[1]];
    actualRanges[section][1] = row[1];
  }
  sectionRanges[document] = actualRanges;
  if (JSON.stringify(actualRanges) !== JSON.stringify(expectedRanges)) {
    problems.push(`${document} acceptance rows are assigned to the wrong ordered slice/subslice.`);
  }
}

if (!documents.master.includes("SC-11 owns DC-001…DC-046") || !documents.master.includes("SC-12 owns DC-047…DC-086")) {
  problems.push("The master ledger must preserve the exact SC-11/SC-12 acceptance ownership boundary.");
}

const residualDocumentKeys = ["residualProduct", "residualEngine", "residualRelease"];
const residualRows = residualDocumentKeys.flatMap((key) =>
  documents[key]
    .split(/\r?\n/)
    .filter((line) => /^\| FC-\d{3} \|/.test(line))
    .map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim())),
);
const residualIds = residualRows.map(([id]) => id);
const expectedResidualIds = Array.from({ length: 45 }, (_, index) => `FC-${String(index + 1).padStart(3, "0")}`);
if (JSON.stringify(residualIds) !== JSON.stringify(expectedResidualIds)) {
  problems.push("Residual feature acceptance rows must be contiguous from FC-001 through FC-045.");
}
const residualFeatureMap = new Map();
const residualAcceptanceMap = new Map();
for (const cells of residualRows) {
  const [id, featureIds, requirement, owner, buildTarget, machineProof, humanProof, dependencies] = cells;
  if (
    cells.length !== 8 ||
    cells.some((cell) => !cell) ||
    requirement.length < 12 ||
    buildTarget.length < 3 ||
    machineProof.length < 12 ||
    humanProof.length < 8 ||
    dependencies.length < 2
  ) {
    problems.push(`${id} lacks its exact eight-column build/test/human-proof contract.`);
  }
  const featureTokens = featureIds.match(/\b[A-Z]+-\d{3}\b/g) ?? [];
  if (featureTokens.length !== 1 || !mappedRows.some((row) => row.id === featureTokens[0])) {
    problems.push(`${id} must own exactly one valid master-ledger feature ID.`);
  } else if (residualFeatureMap.has(featureTokens[0])) {
    problems.push(`${featureTokens[0]} has more than one residual feature acceptance row.`);
  } else {
    residualFeatureMap.set(featureTokens[0], id);
  }
  residualAcceptanceMap.set(id, { owner, dependencies });
  const ownerSlices = [...owner.matchAll(/\bSC-(\d{2})/g)].map((match) => Number(match[1]));
  if (ownerSlices.length === 0 || ownerSlices.some((slice) => slice < 7 || slice > 16)) {
    problems.push(`${id} must be owned by the active or a future caterpillar slice (SC-07…SC-16).`);
  }
}

const knownAcceptanceIds = new Set([
  ...[...documents.sc07.matchAll(/^\| (BR-\d{3}) \|/gm)].map((match) => match[1]),
  ...Object.values(acceptanceRows).flat(),
  ...residualIds,
]);
const allowedDispositions = new Set(["retain", "replace", "remove", "intentional-off", "decision-gated"]);
const crosswalkDocumentKeys = ["crosswalkProduct", "crosswalkEngine", "crosswalkRelease"];
const crosswalkRows = crosswalkDocumentKeys.flatMap((key) =>
  documents[key]
    .split(/\r?\n/)
    .filter((line) => /^\| [A-Z]+-\d{3} \|/.test(line))
    .map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim())),
);
const expectedCrosswalkIds = Object.entries(expectedInventoryGroups).flatMap(([prefix, count]) =>
  Array.from({ length: count }, (_, index) => `${prefix}-${String(index + 1).padStart(3, "0")}`),
);
const actualCrosswalkIds = crosswalkRows.map(([id]) => id);
if (JSON.stringify(actualCrosswalkIds) !== JSON.stringify(expectedCrosswalkIds)) {
  problems.push("The feature crosswalk must contain all 139 master-ledger IDs exactly once and in ledger order.");
}
const masterStates = new Map(mappedRows.map(({ id, state }) => [id, state]));
let fcReferences = 0;
for (const cells of crosswalkRows) {
  const [id, currentState, disposition, owner, acceptanceIds, buildTarget, machineProof, humanProof, gap] = cells;
  if (
    cells.length !== 9 ||
    cells.some((cell) => !cell) ||
    buildTarget.length < 3 ||
    machineProof.length < 12 ||
    humanProof.length < 8 ||
    gap.length < 3
  ) {
    problems.push(`${id} lacks its exact nine-column feature/build/test/proof mapping.`);
  }
  if (currentState !== masterStates.get(id)) problems.push(`${id} crosswalk state does not match the master ledger.`);
  if (!allowedDispositions.has(disposition)) problems.push(`${id} has an unsupported final disposition.`);
  const ownerSlices = [...owner.matchAll(/\bSC-(\d{2})/g)].map((match) => Number(match[1]));
  if (ownerSlices.length === 0 || ownerSlices.some((slice) => slice < 0 || slice > 16)) {
    problems.push(`${id} has no valid ordered SC-00…SC-16 owner.`);
  }
  if (acceptanceIds.includes("NEW-REQUIRED")) problems.push(`${id} still has an unresolved acceptance placeholder.`);
  const references = acceptanceIds.match(/\b(?:BR|RP|PR|IR|DC|FC)-\d{3}\b/g) ?? [];
  if (references.length === 0) problems.push(`${id} has no exact acceptance reference.`);
  for (const reference of references) {
    if (!knownAcceptanceIds.has(reference)) problems.push(`${id} references unknown acceptance row ${reference}.`);
  }
  const featureFcReferences = references.filter((reference) => reference.startsWith("FC-"));
  fcReferences += featureFcReferences.length;
  for (const reference of featureFcReferences) {
    if (residualFeatureMap.get(id) !== reference) {
      problems.push(`${id} references ${reference}, but that residual row is not bound to the feature.`);
    }
    if (ownerSlices.some((slice) => slice < 7)) {
      problems.push(`${id}'s unresolved FC gate cannot be owned by a completed SC-00…SC-06 slice.`);
    }
  }
}
if (fcReferences !== residualRows.length || residualFeatureMap.size !== residualRows.length) {
  problems.push("Every residual FC row must be referenced exactly once by its owning feature crosswalk row.");
}
for (const file of [
  "XRAY-FEATURE-ACCEPTANCE-CROSSWALK.md",
  "planning/crosswalk-product.md",
  "planning/crosswalk-engine.md",
  "planning/crosswalk-release.md",
]) {
  if (!documents.master.includes(file)) problems.push(`The master ledger does not link ${file}.`);
}
if (!documents.topdown.includes("FC-001…FC-045")) {
  problems.push("The live top-down queue does not name the residual FC-001…FC-045 acceptance range.");
}

const expandAcceptanceCell = (cell, wave) => {
  const ids = [];
  const pattern = /\b(BR|RP|PR|IR|DC|FC)-(\d{3})(?:\s*(?:…|–|—|\.\.|to)\s*(?:(BR|RP|PR|IR|DC|FC)-)?(\d{3}))?/g;
  for (const match of cell.matchAll(pattern)) {
    const startPrefix = match[1];
    const start = Number(match[2]);
    const endPrefix = match[3] ?? startPrefix;
    const end = match[4] ? Number(match[4]) : start;
    if (startPrefix !== endPrefix || end < start || end - start > 500) {
      problems.push(`${wave} has an invalid acceptance range: ${match[0]}.`);
      continue;
    }
    for (let value = start; value <= end; value += 1) {
      ids.push(`${startPrefix}-${String(value).padStart(3, "0")}`);
    }
  }
  return ids;
};
const scheduleDocumentKeys = ["scheduleSc0709", "scheduleSc1012", "scheduleSc1316"];
const scheduleRows = scheduleDocumentKeys.flatMap((key) =>
  documents[key]
    .split(/\r?\n/)
    .filter((line) => /^\| W\d{2}[A-G]?[.-]\d{1,2} \|/.test(line))
    .map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim())),
);
const scheduleAcceptanceIds = [];
const acceptanceWaveIndex = new Map();
const waveGroups = new Map();
let previousSliceNumber = 0;
for (const [waveIndex, cells] of scheduleRows.entries()) {
  const [wave, slice, acceptanceCell, laneA, laneB, laneC, entryGate, mergeBarrier, externalGate, prohibitedOverlap] = cells;
  if (
    cells.length !== 10 ||
    cells.some((cell) => !cell) ||
    laneA.length < 12 ||
    laneB.length < 12 ||
    laneC.length < 12 ||
    entryGate.length < 8 ||
    mergeBarrier.length < 20 ||
    externalGate.length < 3 ||
    prohibitedOverlap.length < 12
  ) {
    problems.push(`${wave} lacks its exact ten-column parallel-lane and merge-barrier contract.`);
  }
  const waveMatch = wave.match(/^W(\d{2})([A-G]?)[.-](\d{1,2})$/);
  const sliceMatch = slice.match(/^SC-(\d{2})/);
  if (!waveMatch || !sliceMatch || waveMatch[1] !== sliceMatch[1]) {
    problems.push(`${wave} does not match its ordered slice ${slice}.`);
  } else {
    const sliceNumber = Number(sliceMatch[1]);
    if (sliceNumber < previousSliceNumber) problems.push(`${wave} moves backward in the caterpillar.`);
    previousSliceNumber = sliceNumber;
    const group = `${waveMatch[1]}${waveMatch[2]}`;
    const sequence = Number(waveMatch[3]);
    if (!waveGroups.has(group)) waveGroups.set(group, []);
    waveGroups.get(group).push(sequence);
  }
  const expanded = expandAcceptanceCell(acceptanceCell, wave);
  if (expanded.length === 0) problems.push(`${wave} schedules no exact acceptance IDs.`);
  for (const id of expanded) {
    if (!acceptanceWaveIndex.has(id)) acceptanceWaveIndex.set(id, { wave, waveIndex });
  }
  scheduleAcceptanceIds.push(...expanded);
}
for (const [group, sequence] of waveGroups) {
  if (sequence.some((value, index) => value !== index + 1)) {
    problems.push(`Wave group W${group} must be contiguous from 1 in document order.`);
  }
}
const expectedActiveForwardIds = [...knownAcceptanceIds];
const scheduledSet = new Set(scheduleAcceptanceIds);
if (
  scheduleAcceptanceIds.length !== expectedActiveForwardIds.length ||
  scheduledSet.size !== expectedActiveForwardIds.length ||
  expectedActiveForwardIds.some((id) => !scheduledSet.has(id)) ||
  scheduleAcceptanceIds.some((id) => !knownAcceptanceIds.has(id))
) {
  problems.push("The caterpillar schedules must cover every BR/RP/PR/IR/DC/FC row exactly once.");
}
if (scheduleRows.length !== 76) {
  problems.push(`The dependency-ordered caterpillar must contain exactly 76 waves; found ${scheduleRows.length}.`);
}

const sliceRank = (owner) => {
  const ranks = [...owner.matchAll(/\bSC-(\d{2})([A-Z]?)(\d*)/g)].map((match) => {
    const letter = match[2] ? match[2].charCodeAt(0) - 64 : 0;
    const suffix = match[3] ? Number(match[3]) : 0;
    return Number(match[1]) * 10000 + letter * 100 + suffix;
  });
  return ranks.length > 0 ? Math.max(...ranks) : -1;
};
let dependencyEdges = 0;
let orderedDependencyEdges = 0;
let conditionalDependencyEdges = 0;
for (const [id, { owner, dependencies }] of residualAcceptanceMap) {
  const dependencyIds = expandAcceptanceCell(dependencies, `${id} dependency`).filter((value) => value.startsWith("FC-"));
  const conditional = /\bonly if\b/i.test(dependencies);
  for (const dependencyId of dependencyIds) {
    dependencyEdges += 1;
    if (conditional) {
      conditionalDependencyEdges += 1;
      continue;
    }
    const dependency = residualAcceptanceMap.get(dependencyId);
    if (!dependency) {
      problems.push(`${id} depends on unknown residual acceptance row ${dependencyId}.`);
      continue;
    }
    if (sliceRank(dependency.owner) > sliceRank(owner)) {
      problems.push(`${id} is owned by ${owner} before dependency ${dependencyId} owned by ${dependency.owner}.`);
      continue;
    }
    const rowWave = acceptanceWaveIndex.get(id);
    const dependencyWave = acceptanceWaveIndex.get(dependencyId);
    if (!rowWave || !dependencyWave) continue;
    if (dependencyWave.waveIndex > rowWave.waveIndex) {
      problems.push(`${id} is scheduled in ${rowWave.wave} before dependency ${dependencyId} in ${dependencyWave.wave}.`);
      continue;
    }
    orderedDependencyEdges += 1;
  }
}
for (const file of [
  "XRAY-CATERPILLAR-EXECUTION-MAP.md",
  "planning/caterpillar-sc07-sc09.md",
  "planning/caterpillar-sc10-sc12.md",
  "planning/caterpillar-sc13-sc16.md",
]) {
  if (!documents.master.includes(file)) problems.push(`The master ledger does not link ${file}.`);
}
if (!documents.topdown.includes("359 active-forward acceptance rows")) {
  problems.push("The live top-down queue does not record the 359-row caterpillar schedule.");
}

const output = {
  schema: "xray.master-plan-proof/v1",
  ok: problems.length === 0,
  activeSlice: activeSlices[0]?.id ?? null,
  activeQueueItem: activeQueue[0]?.label ?? null,
  slices,
  queueItems: queue.length,
  mappedFeatureRows: featureRows.length,
  mappedDeadCodeRows: deadCodeRows.length,
  mappedTotalRows: mappedRows.length,
  inventoryGroups,
  featureStateCounts: Object.fromEntries(
    [...new Set(mappedRows.map(({ state }) => state))]
      .sort()
      .map((state) => [state, mappedRows.filter((row) => row.state === state).length]),
  ),
  futureAcceptanceRows: Object.fromEntries(
    acceptanceContracts.map(({ prefix }) => [prefix, acceptanceRows[prefix].length]),
  ),
  futureAcceptanceTotal: Object.values(acceptanceRows).reduce((total, rows) => total + rows.length, 0),
  acceptanceContent,
  acceptanceSectionRanges: sectionRanges,
  featureCrosswalk: {
    rows: crosswalkRows.length,
    exactStateMatches: crosswalkRows.filter(([id, state]) => masterStates.get(id) === state).length,
    residualAcceptanceRows: residualRows.length,
    residualFeatureBindings: residualFeatureMap.size,
    residualReferences: fcReferences,
  },
  totalPlannedAcceptanceRows:
    Object.values(acceptanceRows).reduce((total, rows) => total + rows.length, 0) + residualRows.length,
  caterpillarSchedule: {
    waves: scheduleRows.length,
    acceptanceRows: scheduleAcceptanceIds.length,
    uniqueAcceptanceRows: scheduledSet.size,
    dependencyEdges,
    orderedDependencyEdges,
    conditionalDependencyEdges,
    waveGroups: Object.fromEntries([...waveGroups].map(([group, sequence]) => [group, sequence.length])),
  },
  documentSha256: Object.fromEntries(
    Object.entries(documents).map(([key, text]) => [key, sha256(text)]),
  ),
  problems,
};

const outputPath = resolve(root, "proof", "master-plan.json");
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ output: "proof/master-plan.json", ...output }, null, 2));
if (!output.ok) process.exitCode = 1;
