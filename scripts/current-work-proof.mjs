import {readFileSync, statSync, realpathSync} from 'node:fs';
import {resolve, sep} from 'node:path';
import {createHash} from 'node:crypto';
import {validatePng} from './proof-png.mjs';

export const CURRENT_INPUTS = Object.freeze([
 'src/studio/SourceBuildingViewer.tsx', 'src/studio/sourceBuilding.ts',
 'src/studio/buildingAppearance.ts', 'src/studio/buildingAppearance.test.ts',
 'src/studio/BuildingVisualSettings.tsx',
 'src/studio/ModelScope.ts', 'src/studio/ModelScope.test.ts',
 'src/studio/sourceBuilding.css', 'src/studio/Studio.tsx', 'src/studio/documents.ts',
 'package.json', 'package-lock.json', 'vite.config.ts',
 'public/models/caroline/source-building.json',
 'engine/python/xray/source_building.py', 'engine/python/xray/caroline_building.py',
 'engine/fixtures/caroline-source-trace.json',
 'engine/fixtures/caroline-blueprints-renderings-2025-08-08.pdf',
 'src/studio/sourceBuilding.test.ts',
 'src/studio/documentsComplex.test.ts',
 'engine/python/xray/test_source_building.py',
 'engine/python/xray/test_caroline_building.py',
 'engine/python/xray/building_svg.py',
 'engine/python/xray/test_building_svg.py',
 'public/models/caroline/source.pdf',
 'public/models/caroline/source-page-4.png',
 'public/models/caroline/source-page-5.png',
 'public/models/caroline/source-page-6.png',
 'public/models/caroline/source-page-7.png',
 'public/models/caroline/source-page-8.png',
 'public/models/caroline/source-page-9.png',
 'public/models/caroline/source-page-12.png',
 'public/models/caroline/source-page-13.png',
 'public/models/caroline/source-page-14.png',
 'public/models/caroline/source-page-15.png',
 'public/models/caroline/source-page-16.png',
 'public/models/caroline/source-page-17.png',
 'public/models/caroline/source-page-18.png',
 'public/models/caroline/wireframe-axonometric.svg',
 'public/models/caroline/wireframe-ground.svg',
 'public/models/caroline/wireframe-upper.svg',
 'public/models/caroline/wireframe-manifest.json',
]);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const requireValue = (condition, message) => {if (!condition) throw Error(message);};
const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object'
 ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
export function currentPacketDigest(packet) {
 const {review, status, ...binding} = packet;
 return sha(Buffer.from(JSON.stringify(stable(binding))));
}
function safeFile(root, path) {
 requireValue(typeof path === 'string' && !path.includes('\\') && !path.startsWith('/') && !path.split('/').some(p => !p || p === '.' || p === '..') && !path.includes(':'), 'Unsafe current proof path');
 const base = realpathSync(root), full = realpathSync(resolve(base, path));
 requireValue(full.startsWith(base + sep), 'Current proof path escapes repository');
 const info = statSync(full);
 requireValue(info.isFile() && info.size > 0 && info.size <= 64 * 1024 * 1024, 'Invalid current proof file');
 return readFileSync(full);
}
function boundFile(root, entry) {
 requireValue(entry && /^[a-f0-9]{64}$/.test(entry.sha256) && Number.isSafeInteger(entry.bytes) && entry.bytes > 0, 'Invalid current proof file binding');
 const bytes = safeFile(root, entry.path);
 requireValue(bytes.length === entry.bytes && sha(bytes) === entry.sha256, `Stale current proof file: ${entry.path}`);
 return bytes;
}
function artifact(path) {
 return typeof path === 'string' && /^(proof\/audit\/IW-(CURRENT-WORK|REAL-3D-VIEWER|CAROLINE-3D|WIREFRAME)\/|screenshots\/industry-(real-3d-viewer|wireframe)\/)/.test(path);
}
function sameInputs(entries, inputs) {
 requireValue(Array.isArray(entries) && entries.length === inputs.length, 'Execution input set differs from packet');
 const actual = new Map(entries.map(e => [e.path, e.sha256]));
 requireValue(actual.size === inputs.length && inputs.every(e => actual.get(e.path) === e.sha256), 'Execution input hashes differ from packet');
}
const timestamp = text => typeof text === 'string' && Number.isFinite(Date.parse(text));

// Incomplete packets can display checked author evidence. Only a complete dev+built
// packet with an independent review bound to its digest may verify current work.
export function validateCurrentPacket(packet, root) {
 requireValue(packet?.schema === 'xray.current-proof/v1' && typeof packet.id === 'string' && packet.id && typeof packet.author === 'string' && packet.author, 'Invalid current proof packet');
 requireValue(Array.isArray(packet.workIds) && packet.workIds.length > 0 && new Set(packet.workIds).size === packet.workIds.length && packet.workIds.every(id => typeof id === 'string' && /^IW-[A-Z0-9-]+$/.test(id)), 'Invalid current proof work scope');
 requireValue(['in progress', 'awaiting independent review', 'verified'].includes(packet.status), 'Invalid current proof status');
 requireValue(Array.isArray(packet.inputs) && packet.inputs.length >= CURRENT_INPUTS.length, 'Missing required current inputs');
 const inputPaths = new Set(packet.inputs.map(e => e.path));
 requireValue(inputPaths.size === packet.inputs.length && CURRENT_INPUTS.every(p => inputPaths.has(p)), 'Missing or duplicate current inputs');
 for (const input of packet.inputs) boundFile(root, input);
 requireValue(artifact(packet.diff?.path) && packet.diff.path.endsWith('.patch'), 'Missing current code diff');
 boundFile(root, packet.diff);
 requireValue(Array.isArray(packet.executions) && packet.executions.length <= 2, 'Invalid current executions');
 const environments = new Set(), screenshots = [], artifacts = [packet.diff], blockers = [];
 let lastExecution = 0;
 for (const execution of packet.executions) {
  requireValue(['dev', 'built'].includes(execution.environment) && !environments.has(execution.environment), 'Duplicate or invalid execution environment');
  environments.add(execution.environment);
  requireValue(execution.additionalReports === undefined || (Array.isArray(execution.additionalReports) && execution.additionalReports.length <= 3), 'Invalid additional execution reports');
  const reports = [execution.report, ...(execution.additionalReports ?? [])], captures = new Map(), reportPaths = new Set();
  for (const entry of reports) {
   requireValue(artifact(entry?.path) && entry.path.endsWith('.json') && !reportPaths.has(entry.path), 'Invalid or duplicate execution report path');
   reportPaths.add(entry.path);
   const report = JSON.parse(boundFile(root, entry)); artifacts.push(entry);
   sameInputs(report.inputs, packet.inputs);
   requireValue(report.environment === execution.environment && report.target === 'caroline' && timestamp(report.completedAt), 'Execution environment or identity mismatch');
   requireValue(Array.isArray(report.results) && report.results.length > 0 && report.results.every(r => r.status === 'pass'), 'Current execution contains failed or missing results');
   requireValue(Array.isArray(report.errors) && report.errors.length === 0, 'Current execution has browser errors');
   const origin = new URL(report.origin);
   requireValue(origin.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(origin.hostname), 'Execution origin must identify local app');
   requireValue(Array.isArray(report.captures), 'Missing execution captures');
   for (const capture of report.captures) {
    requireValue(!captures.has(capture.path), 'Duplicate execution capture ownership');
    captures.set(capture.path, {capture, report, origin, reportPath: entry.path});
   }
   lastExecution = Math.max(lastExecution, Date.parse(report.completedAt));
  }
  requireValue(Array.isArray(execution.screenshots) && execution.screenshots.length >= 2, 'Missing current before/after screenshots');
  const phases = new Set(), used = new Set();
  for (const image of execution.screenshots) {
   requireValue(artifact(image.path) && image.path.endsWith('.png') && !used.has(image.path), 'Invalid or duplicate current screenshot');
   used.add(image.path);
   const owner = captures.get(image.path), {capture, report, origin} = owner ?? {}, bytes = boundFile(root, image);
   requireValue(capture && capture.sha256 === image.sha256 && ['before', 'after'].includes(capture.phase) && capture.kind === 'application-ui' && typeof capture.scenario === 'string' && capture.scenario.trim(), 'Screenshot is not bound to execution capture');
   requireValue(timestamp(capture.capturedAt) && Date.parse(capture.capturedAt) <= Date.parse(report.completedAt), 'Invalid screenshot capture time');
   requireValue(new URL(capture.url).origin === origin.origin, 'Screenshot URL differs from executed app');
   sameInputs(capture.sourceFiles, packet.inputs);
   const dimensions = validatePng(bytes);
   requireValue(capture.viewport?.width === dimensions.width && capture.viewport?.height === dimensions.height, 'Screenshot dimensions differ from captured viewport');
   phases.add(capture.phase); artifacts.push(image);
   screenshots.push({...capture, environment: execution.environment, reportPath: owner.reportPath});
  }
  requireValue(phases.has('before') && phases.has('after'), 'Missing current before/after pair');
 }
 for (const environment of ['dev', 'built']) if (!environments.has(environment)) blockers.push(`Missing ${environment} execution`);
 if (!packet.review) blockers.push('Independent review pending');
 else {
  requireValue(artifact(packet.review.path) && packet.review.path.endsWith('.json'), 'Invalid current review path');
  const review = JSON.parse(boundFile(root, packet.review)); artifacts.push(packet.review);
  requireValue(review.schema === 'xray.current-proof-review/v1' && review.reviewer === 'root' && review.reviewer !== packet.author && review.decision === 'approved', 'Current review is not an independent approval');
  requireValue(review.packetDigest === currentPacketDigest(packet) && timestamp(review.reviewedAt) && Date.parse(review.reviewedAt) >= lastExecution, 'Current review is stale or binds another packet');
  requireValue(Array.isArray(review.scenarios) && review.scenarios.length > 0 && review.scenarios.every(s => typeof s === 'string' && s.trim()), 'Current review lacks executed scenario assessment');
 }
 requireValue(packet.status !== 'verified' || blockers.length === 0, 'Current verification requires dev, built and independent review');
 return {ok: true, verified: packet.status === 'verified' && blockers.length === 0, digest: currentPacketDigest(packet), blockers, screenshots, artifacts};
}

export function readCurrentProof(root, reference) {
 requireValue(artifact(reference?.path) && reference.path.endsWith('.json'), 'Invalid current packet path');
 const packet = JSON.parse(boundFile(root, reference));
 return {packet, ...validateCurrentPacket(packet, root)};
}
