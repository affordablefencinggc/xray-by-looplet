import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..");
const fixtureDirectory = path.join(repositoryRoot, "engine", "fixtures", "bom-contract");
const manifestPath = path.join(fixtureDirectory, "worked-cases.json");
const forbiddenKeys = new Set(["rate", "amount", "tax", "looplet", "tradify"]);
const failures = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

function equal(actual, expected, label, tolerance = 0) {
  const matches = tolerance === 0
    ? Object.is(actual, expected)
    : Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance;
  check(matches, `${label}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
}

function requireFiniteNumber(value, label) {
  const number = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (typeof number !== "number" || !Number.isFinite(number)) {
    throw new TypeError(`${label} must be a finite number; received ${JSON.stringify(value)}`);
  }
  return number;
}

function requirePositive(value, label) {
  const number = requireFiniteNumber(value, label);
  if (number <= 0) throw new RangeError(`${label} must be greater than zero; received ${number}`);
  return number;
}

function gcdBigInt(left, right) {
  left = left < 0n ? -left : left;
  right = right < 0n ? -right : right;
  while (right !== 0n) [left, right] = [right, left % right];
  return left;
}

function rational(numerator, denominator = 1n) {
  if (denominator === 0n) throw new RangeError("rational denominator cannot be zero");
  if (denominator < 0n) [numerator, denominator] = [-numerator, -denominator];
  const divisor = gcdBigInt(numerator, denominator);
  return { numerator: numerator / divisor, denominator: denominator / divisor };
}

function exactDecimal(value, label) {
  const text = String(value);
  const match = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(text);
  if (!match) throw new TypeError(`${label} must be a plain finite decimal; received ${JSON.stringify(value)}`);
  const fraction = match[3] ?? "";
  const sign = match[1] === "-" ? -1n : 1n;
  return rational(sign * BigInt(`${match[2]}${fraction}`), 10n ** BigInt(fraction.length));
}

function addRational(left, right) {
  return rational(
    left.numerator * right.denominator + right.numerator * left.denominator,
    left.denominator * right.denominator,
  );
}

function multiplyRational(left, right) {
  return rational(left.numerator * right.numerator, left.denominator * right.denominator);
}

function divideRational(left, right) {
  if (right.numerator === 0n) throw new RangeError("cannot divide by zero");
  return rational(left.numerator * right.denominator, left.denominator * right.numerator);
}

function exactDecimalString(value) {
  const negative = value.numerator < 0n;
  let numerator = negative ? -value.numerator : value.numerator;
  const whole = numerator / value.denominator;
  let remainder = numerator % value.denominator;
  if (remainder === 0n) return `${negative ? "-" : ""}${whole}`;
  let fraction = "";
  for (let index = 0; remainder !== 0n && index < 200; index += 1) {
    remainder *= 10n;
    fraction += String(remainder / value.denominator);
    remainder %= value.denominator;
  }
  if (remainder !== 0n) throw new Error("rational does not have a terminating decimal representation");
  return `${negative ? "-" : ""}${whole}.${fraction}`;
}

function roundHalfUpFixed(value, scale) {
  if (!Number.isInteger(scale) || scale < 0 || scale > 30) throw new RangeError("display scale must be an integer from 0 to 30");
  if (value.numerator < 0n) throw new RangeError("ROUND_HALF_UP helper expects a non-negative quantity");
  const factor = 10n ** BigInt(scale);
  const scaledNumerator = value.numerator * factor;
  let rounded = scaledNumerator / value.denominator;
  if ((scaledNumerator % value.denominator) * 2n >= value.denominator) rounded += 1n;
  const digits = rounded.toString().padStart(scale + 1, "0");
  return scale === 0 ? digits : `${digits.slice(0, -scale)}.${digits.slice(-scale)}`;
}

function ceilRational(value) {
  if (value.numerator < 0n) return value.numerator / value.denominator;
  return (value.numerator + value.denominator - 1n) / value.denominator;
}

function requireObject(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return value;
}

function requireArray(value, label) {
  if (!Array.isArray(value)) throw new TypeError(`${label} must be an array`);
  return value;
}

function metric(object, names, label) {
  for (const name of names) {
    if (Object.hasOwn(object, name)) return requireFiniteNumber(object[name], `${label}.${name}`);
  }
  throw new Error(`${label} is missing required field ${names.join(" or ")}`);
}

function metricArray(object, names, label) {
  for (const name of names) {
    if (!Object.hasOwn(object, name)) continue;
    return requireArray(object[name], `${label}.${name}`).map((value, index) =>
      requireFiniteNumber(value, `${label}.${name}[${index}]`));
  }
  throw new Error(`${label} is missing required field ${names.join(" or ")}`);
}

function maxBayCount(span, maximum) {
  if (span <= 0) return 0;
  return Math.ceil(span / requirePositive(maximum, "maximum spacing") - 1e-12);
}

function equallyPartition(span, count) {
  if (count === 0) return [];
  if (Number.isInteger(span)) {
    const base = Math.floor(span / count);
    const remainder = span - base * count;
    return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0));
  }
  return Array.from({ length: count }, () => span / count);
}

function complementSpans(gross, openings) {
  const sorted = openings
    .map(({ centre, width }, index) => {
      const start = centre - width / 2;
      const end = centre + width / 2;
      if (start < 0 || end > gross || end <= start) {
        throw new RangeError(`opening ${index} [${start}, ${end}] is outside 0..${gross}`);
      }
      return { start, end };
    })
    .sort((left, right) => left.start - right.start || left.end - right.end);

  const spans = [];
  let cursor = 0;
  let overlap = false;
  for (const opening of sorted) {
    if (opening.start < cursor) overlap = true;
    if (opening.start > cursor) spans.push(opening.start - cursor);
    cursor = Math.max(cursor, opening.end);
  }
  if (cursor < gross) spans.push(gross - cursor);
  return { spans, overlap, deduction: gross - spans.reduce((sum, value) => sum + value, 0) };
}

function scanForbiddenKeys(value, location) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => scanForbiddenKeys(entry, `${location}[${index}]`));
    return;
  }
  if (value === null || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    const normalized = key.toLowerCase();
    if (forbiddenKeys.has(normalized) || normalized.includes("looplet") || normalized.includes("tradify")) {
      failures.push(`${location}.${key}: forbidden pricing/external-system key`);
    }
    scanForbiddenKeys(child, `${location}.${key}`);
  }
}

function caseById(cases, id) {
  const found = cases.find((entry) => entry?.id === id);
  if (!found) throw new Error(`worked-cases.json is missing required case ${id}`);
  return requireObject(found, `case ${id}`);
}

function inputsOf(entry) {
  return requireObject(entry.input ?? entry.inputs, `${entry.id}.input`);
}

function expectedOf(entry) {
  return requireObject(entry.expected, `${entry.id}.expected`);
}

function assertMetric(expected, aliases, value, label, tolerance = 0) {
  equal(metric(expected, aliases, `${label}.expected`), value, label, tolerance);
}

function responseLines(response, label) {
  const lines = response?.bom?.lines;
  return requireArray(lines, `${label}.bom.lines`);
}

function quantityForCode(response, code, label) {
  const matches = responseLines(response, label).filter((line) => line?.itemCode === code);
  if (matches.length !== 1) {
    throw new Error(`${label} must contain exactly one ${code} line; found ${matches.length}`);
  }
  return requireFiniteNumber(matches[0]?.quantity?.value, `${label}.${code}.quantity.value`);
}

async function loadJson(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    throw new Error(`${path.relative(repositoryRoot, filePath)}: ${error.message}`, { cause: error });
  }
}

async function responseFor(entry, documents) {
  if (!entry.fixture) throw new Error(`${entry.id}.fixture must name its response fixture`);
  const name = String(entry.fixture).endsWith(".response.json")
    ? String(entry.fixture)
    : `${entry.fixture}.response.json`;
  const response = documents.get(name);
  if (!response) throw new Error(`${entry.id} references missing fixture ${name}`);
  return { name, response };
}

function verifySimpleSpacing(entry, expectedLength, expectedBays, expectedPosts) {
  const input = inputsOf(entry);
  const expected = expectedOf(entry);
  const segments = metricArray(input, ["segmentsMm", "edgeLengthsMm"], `${entry.id}.input`);
  const length = segments.reduce((sum, value) => sum + value, 0);
  const spacing = metric(input, ["maximumSpacingMm", "maxSpacingMm", "bayWidthMm"], `${entry.id}.input`);
  equal(length, expectedLength, `${entry.id} frozen length`);
  const bays = maxBayCount(length, spacing);
  equal(bays, expectedBays, `${entry.id} independent bays`);
  assertMetric(expected, ["bays", "bayCount"], bays, `${entry.id} bays`);
  assertMetric(expected, ["posts", "postCount", "physicalPosts", "postSites"], bays + 1, `${entry.id} posts`);
  equal(bays + 1, expectedPosts, `${entry.id} frozen posts`);
}

function verifyCorner(entry) {
  const input = inputsOf(entry);
  const expected = expectedOf(entry);
  const edges = metricArray(input, ["edgeLengthsMm", "segmentsMm"], `${entry.id}.input`);
  const spacing = metric(input, ["maximumSpacingMm", "maxSpacingMm", "bayWidthMm"], `${entry.id}.input`);
  equal(JSON.stringify(edges), JSON.stringify([4800, 3000]), `${entry.id} frozen edges`);
  const bays = edges.reduce((sum, edge) => sum + maxBayCount(edge, spacing), 0);
  const uniquePosts = 3 + edges.reduce((sum, edge) => sum + Math.max(0, maxBayCount(edge, spacing) - 1), 0);
  equal(bays, 4, `${entry.id} independent bays`);
  equal(uniquePosts, 5, `${entry.id} independent unique posts`);
  assertMetric(expected, ["bays", "bayCount"], bays, `${entry.id} bays`);
  assertMetric(expected, ["uniquePosts", "posts", "physicalPosts", "postSites"], uniquePosts, `${entry.id} posts`);
}

function verifyJunction(entry) {
  const input = inputsOf(entry);
  const expected = expectedOf(entry);
  const topologyEdges = requireArray(input.topologyEdges, `${entry.id}.input.topologyEdges`).map((edge, index) => {
    const tuple = requireArray(edge, `${entry.id}.input.topologyEdges[${index}]`);
    if (tuple.length !== 3) throw new Error(`${entry.id}.input.topologyEdges[${index}] must have from, to and length`);
    return { from: String(tuple[0]), to: String(tuple[1]), length: requireFiniteNumber(tuple[2], `${entry.id}.input.topologyEdges[${index}][2]`) };
  });
  const edges = topologyEdges.map((edge) => edge.length);
  const spacing = metric(input, ["maximumSpacingMm", "maxSpacingMm", "bayWidthMm"], `${entry.id}.input`);
  const bays = edges.reduce((sum, edge) => sum + maxBayCount(edge, spacing), 0);
  const explicitNodes = new Set(topologyEdges.flatMap((edge) => [edge.from, edge.to])).size;
  const posts = explicitNodes + edges.reduce((sum, edge) => sum + Math.max(0, maxBayCount(edge, spacing) - 1), 0);
  equal(JSON.stringify(edges), JSON.stringify([2400, 2400, 2400]), `${entry.id} frozen edges`);
  equal(bays, 3, `${entry.id} independent bays`);
  equal(posts, 4, `${entry.id} independent physical posts`);
  assertMetric(expected, ["bays", "bayCount"], bays, `${entry.id} bays`);
  equal(requireArray(expected.physicalPostNodes, `${entry.id}.expected.physicalPostNodes`).length, posts, `${entry.id} physical node list`);
  assertMetric(expected, ["physicalPosts", "uniquePosts", "posts", "postSites"], posts, `${entry.id} posts`);
}

function gatedGeometry(entry) {
  const input = inputsOf(entry);
  const gross = input.segmentsMm
    ? metricArray(input, ["segmentsMm"], `${entry.id}.input`).reduce((sum, value) => sum + value, 0)
    : metric(input, ["grossMm", "grossLengthMm", "lengthMm"], `${entry.id}.input`);
  const gateRows = requireArray(input.gates ?? input.openings ?? input.gateIntervalsMm, `${entry.id}.input.gates`);
  const openings = gateRows.map((gate, index) => {
    if (Array.isArray(gate)) {
      if (gate.length !== 2) throw new Error(`${entry.id}.input.gateIntervalsMm[${index}] must have start and end`);
      const start = requireFiniteNumber(gate[0], `${entry.id}.input.gateIntervalsMm[${index}][0]`);
      const end = requireFiniteNumber(gate[1], `${entry.id}.input.gateIntervalsMm[${index}][1]`);
      return { centre: (start + end) / 2, width: end - start };
    }
    const row = requireObject(gate, `${entry.id}.input.gates[${index}]`);
    return {
      centre: metric(row, ["centreOffsetMm", "centerOffsetMm", "centreMm", "centerMm"], `${entry.id}.input.gates[${index}]`),
      width: metric(row, ["widthMm"], `${entry.id}.input.gates[${index}]`),
    };
  });
  return { input, gross, ...complementSpans(gross, openings) };
}

async function verifyColorbond(entry, documents) {
  const { input, gross, spans, deduction, overlap } = gatedGeometry(entry);
  const expected = expectedOf(entry);
  equal(gross, 10000, `${entry.id} frozen gross`);
  equal(overlap, false, `${entry.id} openings do not overlap`);
  equal(JSON.stringify(spans), JSON.stringify([3000, 5000]), `${entry.id} independent spans`);
  equal(deduction, 2000, `${entry.id} independent deduction`);
  const bayWidth = metric(input, ["bayWidthMm", "maximumSpacingMm", "maxSpacingMm"], `${entry.id}.input`);
  const cover = metric(input, ["sheetCoverMm", "effectiveSheetCoverMm"], `${entry.id}.input`);
  const railRows = metric(input, ["railRows", "railsPerBay"], `${entry.id}.input`);
  const baysPerSpan = spans.map((span) => maxBayCount(span, bayWidth));
  const bayWidths = spans.flatMap((span, index) => equallyPartition(span, baysPerSpan[index]));
  const bays = baysPerSpan.reduce((sum, value) => sum + value, 0);
  const posts = bays + spans.length;
  const sheets = bayWidths.reduce((sum, width) => sum + Math.ceil(width / cover - 1e-12), 0);
  const railCuts = railRows * bays;
  const railLm = railRows * spans.reduce((sum, value) => sum + value, 0) / 1000;
  equal(bays, 5, `${entry.id} independent bays`);
  equal(posts, 7, `${entry.id} independent posts`);
  equal(sheets, 13, `${entry.id} independent sheets`);
  equal(railCuts, 10, `${entry.id} independent rail cuts`);
  equal(railLm, 16, `${entry.id} independent rail length`);
  assertMetric(expected, ["netMm", "netLengthMm"], gross - deduction, `${entry.id} net`);
  equal(JSON.stringify(metricArray(expected, ["spanLengthsMm", "spansMm", "residualSpanMm"], `${entry.id}.expected`)), JSON.stringify(spans), `${entry.id} spans`);
  equal(JSON.stringify(metricArray(expected, ["bayLengthsMm"], `${entry.id}.expected`)), JSON.stringify(bayWidths), `${entry.id} bay partition`);
  assertMetric(expected, ["bays", "bayCount"], bays, `${entry.id} bays`);
  assertMetric(expected, ["posts", "physicalPosts", "postCount", "postSites"], posts, `${entry.id} posts`);
  assertMetric(expected, ["sheets", "sheetCount", "infillSheets"], sheets, `${entry.id} sheets`);
  assertMetric(expected, ["railCuts", "railCutCount"], railCuts, `${entry.id} rail cuts`);
  assertMetric(expected, ["railLm", "railLengthM"], railLm, `${entry.id} rail lm`);
  const { name, response } = await responseFor(entry, documents);
  for (const [code, value] of [["CB-SHEET", sheets], ["CB-RAIL-CUT", railCuts], ["CB-RAIL-LM", railLm]]) {
    equal(quantityForCode(response, code, name), value, `${name} ${code}`);
  }
  const ordinary = quantityForCode(response, "CB-POST-ORD", name);
  const gate = quantityForCode(response, "CB-POST-GATE", name);
  const end = quantityForCode(response, "CB-POST-END", name);
  equal(ordinary + gate + end, posts, `${name} end + ordinary + gate posts`);
  equal(end, 2, `${name} end posts`);
  equal(gate, 2, `${name} gate posts`);
}

async function verifyTimber(entry, documents) {
  const { input, gross, spans, deduction, overlap } = gatedGeometry(entry);
  const expected = expectedOf(entry);
  equal(gross, 10000, `${entry.id} frozen gross`);
  equal(overlap, false, `${entry.id} openings do not overlap`);
  equal(JSON.stringify(spans), JSON.stringify([3000, 5000]), `${entry.id} independent spans`);
  equal(deduction, 2000, `${entry.id} independent deduction`);
  const bayWidth = metric(input, ["bayWidthMm", "maximumSpacingMm", "maxSpacingMm"], `${entry.id}.input`);
  const cover = metric(input, ["palingCoverMm", "effectivePalingCoverMm"], `${entry.id}.input`);
  const bayCounts = spans.map((span) => maxBayCount(span, bayWidth));
  const bayWidths = spans.flatMap((span, index) => equallyPartition(span, bayCounts[index]));
  const palings = bayWidths.reduce((sum, width) => sum + Math.ceil(width / cover - 1e-12), 0);
  equal(palings, 91, `${entry.id} independent palings`);
  equal(JSON.stringify(metricArray(expected, ["bayLengthsMm"], `${entry.id}.expected`)), JSON.stringify(bayWidths), `${entry.id} bay partition`);
  assertMetric(expected, ["palings", "palingCount"], palings, `${entry.id} palings`);
  const { name, response } = await responseFor(entry, documents);
  equal(quantityForCode(response, "TP-PALING", name), palings, `${name} TP-PALING`);
}

async function verifyChainWire(entry, documents) {
  const { input, gross, spans, deduction, overlap } = gatedGeometry(entry);
  const expected = expectedOf(entry);
  equal(gross, 10000, `${entry.id} frozen gross`);
  equal(overlap, false, `${entry.id} openings do not overlap`);
  equal(JSON.stringify(spans), JSON.stringify([3000, 5000]), `${entry.id} independent spans`);
  equal(deduction, 2000, `${entry.id} independent deduction`);
  const spacing = metric(input, ["linePostSpacingMm", "postSpacingMm", "maximumSpacingMm", "maxSpacingMm", "bayWidthMm"], `${entry.id}.input`);
  const height = metric(input, ["heightMm", "meshHeightMm"], `${entry.id}.input`);
  const bays = spans.reduce((sum, span) => sum + maxBayCount(span, spacing), 0);
  const posts = bays + spans.length;
  const strainerPosts = spans.length * 2;
  const linePosts = posts - strainerPosts;
  const incidentEnds = spans.length * 2;
  const meshLm = spans.reduce((sum, span) => sum + span, 0) / 1000;
  const meshM2 = meshLm * height / 1000;
  equal(bays, 3, `${entry.id} independent bays`);
  equal(posts, 5, `${entry.id} independent posts`);
  equal(strainerPosts, 4, `${entry.id} independent strainers`);
  equal(linePosts, 1, `${entry.id} independent line posts`);
  equal(incidentEnds, 4, `${entry.id} independent incident ends`);
  equal(meshLm, 8, `${entry.id} independent mesh lm`);
  equal(meshM2, 14.4, `${entry.id} independent mesh area`, 1e-9);
  const bayLengths = spans.flatMap((span) => equallyPartition(span, maxBayCount(span, spacing)));
  equal(JSON.stringify(metricArray(expected, ["bayLengthsMm"], `${entry.id}.expected`)), JSON.stringify(bayLengths), `${entry.id} bay partition`);
  assertMetric(expected, ["bays", "bayCount"], bays, `${entry.id} bays`);
  assertMetric(expected, ["posts", "physicalPosts", "postCount", "postSites"], posts, `${entry.id} posts`);
  assertMetric(expected, ["strainerPosts", "strainers"], strainerPosts, `${entry.id} strainers`);
  assertMetric(expected, ["linePosts"], linePosts, `${entry.id} line posts`);
  assertMetric(expected, ["incidentStrainerEnds", "strainerEnds", "braceAssemblies"], incidentEnds, `${entry.id} incident ends`);
  assertMetric(expected, ["meshLm", "meshLengthM"], meshLm, `${entry.id} mesh lm`);
  assertMetric(expected, ["meshM2", "meshAreaM2"], meshM2, `${entry.id} mesh area`, 1e-9);
  assertMetric(expected, ["topRailLm", "topRailLengthM"], meshLm, `${entry.id} top rail`);
  const { name, response } = await responseFor(entry, documents);
  for (const [code, value] of [
    ["CW-POST-STRAINER", strainerPosts], ["CW-POST-LINE", linePosts], ["CW-BRACE", incidentEnds],
    ["CW-MESH-LM", meshLm], ["CW-MESH-M2", meshM2], ["CW-TOP-RAIL", meshLm],
  ]) equal(quantityForCode(response, code, name), value, `${name} ${code}`, 1e-9);
}

async function verifyOverlap(entry, documents) {
  const { gross, spans, deduction, overlap } = gatedGeometry(entry);
  equal(gross, 10000, `${entry.id} frozen gross`);
  equal(overlap, true, `${entry.id} independently detects overlap`);
  check(deduction > 0 && spans.reduce((sum, value) => sum + value, 0) === gross - deduction,
    `${entry.id} defensive union must conserve gross length`);
  const expected = expectedOf(entry);
  equal(expected.issueCode, "gate-overlap", `${entry.id} issue code`);
  check(expected.bomProduced === false, `${entry.id}.expected.bomProduced must be false`);
  const { name, response } = await responseFor(entry, documents);
  check(response?.ok === false, `${name}.ok must be false`);
  const issues = requireArray(response?.issues, `${name}.issues`);
  check(issues.some((issue) => issue?.code === "gate-overlap"), `${name} must contain a gate-overlap issue`);
  check(response?.bom === undefined, `${name} must not contain a BOM for overlapping gates`);
}

async function verifyDoubleGate(entry, documents) {
  const input = inputsOf(entry);
  const expected = expectedOf(entry);
  const type = String(input.gateType ?? input.type ?? "");
  equal(type, "double", `${entry.id} frozen gate type`);
  const openings = 1;
  const leaves = type === "double" ? 2 : 1;
  const posts = 2;
  const hingeSets = leaves;
  const latches = openings;
  const dropBolts = type === "double" ? 1 : 0;
  for (const [aliases, value, label] of [
    [["openings", "gateOpenings"], openings, "openings"], [["leaves", "gateLeaves"], leaves, "leaves"],
    [["gatePosts", "posts", "boundaryPosts"], posts, "gate posts"], [["hingeSets", "hinges"], hingeSets, "hinges"],
    [["latches", "latchCount"], latches, "latches"], [["dropBolts", "dropBoltCount"], dropBolts, "drop bolts"],
  ]) assertMetric(expected, aliases, value, `${entry.id} ${label}`);
  const { name, response } = await responseFor(entry, documents);
  for (const [code, value] of [
    ["GATE-OPENING", openings], ["GATE-LEAF", leaves], ["CB-POST-GATE", posts],
    ["GATE-HINGE-SET", hingeSets], ["GATE-LATCH", latches], ["GATE-DROP-BOLT", dropBolts],
  ]) equal(quantityForCode(response, code, name), value, `${name} ${code}`);
}

async function verifyConcrete(entry, documents) {
  const input = inputsOf(entry);
  const expected = expectedOf(entry);
  const roles = input.roles
    ? requireArray(input.roles, `${entry.id}.input.roles`)
    : [requireObject(input.ordinary, `${entry.id}.input.ordinary`), requireObject(input.gate, `${entry.id}.input.gate`)];
  const pi = exactDecimal(input.pi, `${entry.id}.input.pi`);
  const raw = roles.reduce((sum, role, index) => {
    const row = requireObject(role, `${entry.id}.input.roles[${index}]`);
    const count = exactDecimal(row.count, `${entry.id}.input.roles[${index}].count`);
    const diameter = exactDecimal(
      row.diameterMm ?? row.diameterM,
      `${entry.id}.input.roles[${index}].diameter`,
    );
    const depth = exactDecimal(
      row.depthMm ?? row.depthM,
      `${entry.id}.input.roles[${index}].depth`,
    );
    const diameterM = Object.hasOwn(row, "diameterMm")
      ? divideRational(diameter, exactDecimal("1000", "millimetres per metre"))
      : diameter;
    const depthM = Object.hasOwn(row, "depthMm")
      ? divideRational(depth, exactDecimal("1000", "millimetres per metre"))
      : depth;
    const radiusM = divideRational(diameterM, exactDecimal("2", "diameter divisor"));
    const volume = multiplyRational(
      multiplyRational(multiplyRational(count, pi), multiplyRational(radiusM, radiusM)),
      depthM,
    );
    return addRational(sum, volume);
  }, rational(0n));
  const allowance = Object.hasOwn(input, "allowancePercent")
    ? addRational(
        rational(1n),
        divideRational(
          exactDecimal(input.allowancePercent, `${entry.id}.input.allowancePercent`),
          exactDecimal("100", "percentage divisor"),
        ),
      )
    : exactDecimal(input.allowanceFactor, `${entry.id}.input.allowanceFactor`);
  const increment = exactDecimal(
    input.roundingIncrementM3 ?? input.orderIncrementM3 ?? input.orderIncrement,
    `${entry.id}.input.roundingIncrementM3`,
  );
  const allowed = multiplyRational(raw, allowance);
  const orderUnits = ceilRational(divideRational(allowed, increment));
  const ordered = multiplyRational(rational(orderUnits), increment);
  const rawExact = exactDecimalString(raw);
  const allowedExact = exactDecimalString(allowed);
  const orderedExact = exactDecimalString(ordered);
  equal(rawExact, "0.201454628911445476125", `${entry.id} frozen exact raw concrete`);
  equal(allowedExact, "0.2216000918025900237375", `${entry.id} frozen exact allowed concrete`);
  equal(orderedExact, "0.23", `${entry.id} frozen exact ordered concrete`);
  equal(String(expected.rawFullPrecisionM3), rawExact, `${entry.id} raw full precision`);
  equal(String(expected.allowedFullPrecisionM3), allowedExact, `${entry.id} allowed full precision`);
  equal(String(expected.orderM3 ?? expected.orderedM3), orderedExact, `${entry.id} ordered`);
  const scale = metric(input, ["displayScale"], `${entry.id}.input`);
  equal(String(expected.rawDisplayM3), roundHalfUpFixed(raw, scale), `${entry.id} raw ROUND_HALF_UP display`);
  equal(String(expected.allowedDisplayM3), roundHalfUpFixed(allowed, scale), `${entry.id} allowed ROUND_HALF_UP display`);
  const { name, response } = await responseFor(entry, documents);
  const concreteLines = responseLines(response, name).filter((line) => line?.itemCode === "CONCRETE");
  if (concreteLines.length !== 1) throw new Error(`${name} must contain exactly one CONCRETE line; found ${concreteLines.length}`);
  const concreteLine = concreteLines[0];
  const concreteQuantity = concreteLine?.quantity?.value;
  equal(
    exactDecimalString(exactDecimal(concreteQuantity, `${name}.CONCRETE.quantity.value`)),
    orderedExact,
    `${name} CONCRETE`,
  );
  const operands = requireArray(concreteLine?.calculation?.operands, `${name}.CONCRETE.calculation.operands`);
  const operand = (operandName) => {
    const matches = operands.filter((candidate) => candidate?.name === operandName);
    if (matches.length !== 1) throw new Error(`${name} must contain exactly one ${operandName} operand; found ${matches.length}`);
    return exactDecimal(matches[0].value, `${name}.${operandName}.value`);
  };
  equal(exactDecimalString(operand("raw-full-precision")), rawExact, `${name} raw full-precision operand`);
  equal(exactDecimalString(operand("allowed-full-precision")), allowedExact, `${name} allowed full-precision operand`);
  equal(
    exactDecimalString(operand("raw-display-round-half-up-6")),
    exactDecimalString(exactDecimal(expected.rawDisplayM3, `${entry.id}.expected.rawDisplayM3`)),
    `${name} raw display operand`,
  );
  equal(
    exactDecimalString(operand("allowed-display-round-half-up-6")),
    exactDecimalString(exactDecimal(expected.allowedDisplayM3, `${entry.id}.expected.allowedDisplayM3`)),
    `${name} allowed display operand`,
  );
}

async function main() {
  let fileNames;
  try {
    fileNames = (await readdir(fixtureDirectory)).filter((name) => name.endsWith(".json")).sort();
  } catch (error) {
    throw new Error(`fixture directory is unavailable: ${fixtureDirectory}`, { cause: error });
  }
  check(fileNames.length > 0, "engine/fixtures/bom-contract contains no JSON fixtures");
  const documents = new Map();
  for (const fileName of fileNames) {
    const document = await loadJson(path.join(fixtureDirectory, fileName));
    documents.set(fileName, document);
    scanForbiddenKeys(document, fileName);
  }
  if (!documents.has("worked-cases.json")) {
    throw new Error(`missing required manifest ${path.relative(repositoryRoot, manifestPath)}`);
  }
  const manifest = documents.get("worked-cases.json");
  equal(manifest?.schema, "xray.bom-worked-cases/v1", "worked-cases schema");
  const cases = requireArray(manifest?.cases, "worked-cases.json.cases");
  const ids = cases.map((entry) => entry?.id);
  equal(new Set(ids).size, ids.length, "worked-cases IDs are unique");

  verifySimpleSpacing(caseById(cases, "A-short-span"), 2500, 2, 3);
  verifySimpleSpacing(caseById(cases, "A-exact-multiple"), 4800, 2, 3);
  verifyCorner(caseById(cases, "B-l-corner"));
  verifyJunction(caseById(cases, "C-t-junction"));
  await verifyColorbond(caseById(cases, "D-colorbond-gated"), documents);
  await verifyTimber(caseById(cases, "E-timber-gated"), documents);
  await verifyChainWire(caseById(cases, "E-chain-wire-gated"), documents);
  await verifyOverlap(caseById(cases, "F-overlapping-gates"), documents);
  await verifyDoubleGate(caseById(cases, "G-double-gate"), documents);
  await verifyConcrete(caseById(cases, "H-role-footings"), documents);

  const orderBoundary = caseById(cases, "I-order-boundary");
  const orderExpected = expectedOf(orderBoundary);
  check(orderExpected.orderQuantity === null, "I-order-boundary expected.orderQuantity must be null");
  check(typeof orderExpected.orderKernel === "string" && /separate/i.test(orderExpected.orderKernel),
    "I-order-boundary must explicitly state that the order kernel remains separate");
  for (const [fileName, document] of documents) {
    if (!fileName.endsWith(".response.json")) continue;
    const serialized = JSON.stringify(document);
    check(!/\boptimi[sz](?:e|er|ation|ed|ing)\b/i.test(serialized),
      `${fileName} must not claim BOM order optimisation`);
  }

  if (failures.length > 0) {
    throw new Error(`BOM golden verification failed (${failures.length}):\n- ${failures.join("\n- ")}`);
  }
  console.log(JSON.stringify({
    ok: true,
    fixtureDirectory: path.relative(repositoryRoot, fixtureDirectory).replaceAll("\\", "/"),
    jsonFiles: fileNames.length,
    workedCases: cases.length,
    verifiedCases: [
      "A-short-span", "A-exact-multiple", "B-l-corner", "C-t-junction",
      "D-colorbond-gated", "E-timber-gated", "E-chain-wire-gated",
      "F-overlapping-gates", "G-double-gate", "H-role-footings", "I-order-boundary",
    ],
    forbiddenKeys: [...forbiddenKeys],
  }, null, 2));
}

main().catch((error) => {
  console.error(`[verify-bom-goldens] ${error.message}`);
  process.exitCode = 1;
});
