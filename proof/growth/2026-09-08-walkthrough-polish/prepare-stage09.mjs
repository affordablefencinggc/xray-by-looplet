import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const root = process.cwd();
const dir = 'proof/growth/2026-09-08-walkthrough-polish';
const release = `${dir}/release-38a64f0b8c2b`;
const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const sha = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const sourceRun = '2026-09-07T16-20-03-389Z-growth-polish-built';
const nativeRun = '2026-09-07T16-24-27-082Z-growth-polish-native';
const runs = [sourceRun, nativeRun].map(id => read(`proof/growth/runner/${id}.json`));
for (const [index, run] of runs.entries()) {
  if (run.exitCode !== 0 || run.error || run.commands !== [158, 183][index]) throw Error('Incomplete production journey');
  if (sha(run.savedScenario) !== run.scenarioSha256 || read(run.savedScenario).length !== run.commands) throw Error('Scenario identity mismatch');
}
const coverage = read('proof/growth/2026-09-08-walk-boundaries/production-38a64-acceptance.json');
if (coverage.runs.length !== 6 || coverage.totalCommands !== 330 || coverage.runs.some(run => run.exitCode !== 0)) throw Error('Incomplete production layout/Architect gates');
for (const item of coverage.images) if (!item.visuallyInspected || sha(item.path) !== item.sha256) throw Error('Unverified layout evidence');
const identity = read(`${release}/build-identity-verified.json`);
const drift = read(`${release}/source-drift.json`);
if (identity.status !== 'pass' || identity.gates.length !== 5 || identity.gates.some(g => g.exitCode !== 0) || drift.status !== 'pass' || drift.drift.length || drift.webFiles + drift.nativeFiles !== 631) throw Error('Incomplete release identity gates');

const journey = ['slide-before','closed-door-block','reach','slide-open','open-wireframe','terrace-stepdown','closed-from-terrace','threshold-return','stairs-before','stairs-upper','stairs-return','controls','fly-before','fly-moved','fly-escaped','final-controls'];
const nativeImages = ['retained-sheets','retained-view','retained-backup', ...journey];
const inspected = [...journey.map(name => `screenshots/growth/walkthrough-polish-production-source-01-${name}.png`), ...nativeImages.map(name => `screenshots/growth/walkthrough-polish-production-native-01-${name}.png`)];
const inspection = inspected.map(file => ({file, sha256:sha(file), visuallyInspected:true}));
fs.writeFileSync(`${dir}/source-production-visual-acceptance.json`, JSON.stringify({scope:'Independent read-only inspection of all 16 source and all 19 native production PNGs; no browser interaction by reviewer', source:runs[0], native:runs[1], images:inspection, findings:['Attached arm visibly enters the lower-right canvas boundary and disappears after opening. Compact prompt/hint overlays can partly cover the hand; full visibility at every frame is not claimed.','Closed-door stop, step-back refusal, open portal, Wireframe pose retention, terrace step-down/return and real stair ascent/descent are visible.','Original top options and separate five-button bottom navigation dock remain legible and present. Actual WASD/Escape and camera changes are asserted by the scenarios.','Native retained Civil/Structural sheet names/order, original-page 2 saved view at 156%, and unchanged backup impact review are visible.','No new desktop visual blocker in these images. Stair upper connection remains an unsupported model gap; screenshots do not establish a connected building route.'], limits:['Windows Chromium and the isolated Windows executable only; no real tablet hardware, macOS or Linux acceptance.','Fresh journey runtime monitoring passes; this is not a claim about every historical console record.','View-only inferred model and door styles remain unsuitable as engineering or verified access-route evidence.']}, null, 2)+'\n');

const stage = read(`${dir}/stage09-report.json`);
stage.ready = true;
stage.releaseGates = {run:'38a64f0b8c2b', production:true, windowsNative:true, tabletProduction:true, artifactsVerified:true, rootVisualSignoff:true};
stage.platform = 'Bounded acceptance: production browser and isolated Windows app; desktop and tablet viewports';
stage.summary = 'Both pickers now say “Pick your walkthrough starting point” and show clean plans aligned to actual model coordinates. A textured 3D arm reaches from the camera body when operating a door. Production walking, door, stair, Fly and bottom-control journeys pass in the browser and the Windows app; tablet prompts and controls clear the overlap that failed Stage 08. This accepts the stated walkthrough slice only. The broader A–Z requirements remain partial, and Stage 08 stays preserved as an intermediate, unaccepted candidate.';
stage.requirements = [
 {id:'R-02',status:'PARTIAL — walkthrough slice accepted',change:'Source production: 158 commands in 27.912 s. Windows app: full 183 commands in 31.363 s. Actual doors, thresholds both ways, stairs, Fly, Escape and five bottom camera actions pass; all 35 journey/data screenshots inspected.',remaining:'Redburn has an approximately 0.92 m unsupported connection at the stair top; walking correctly stops. Door styles, including the bifold-to-slide approximation, remain inferred presentation geometry.'},
 {id:'R-01 / U-02',status:'PARTIAL — clean picker slice accepted',change:'Exact requested title, clean floor and wall plans, real opening gaps, room labels, stair treads and selected heading. Both production pickers pass valid/unsupported selection and 44 px Start/Close checks at three sizes.',remaining:'No aligned aerial asset was available; actual model geometry supplies the clean plan. Full model and industry coverage remain open; this is not engineering or verified access-route evidence.'},
 {id:'U-05 / U-06',status:'PARTIAL — tested layouts accepted',change:'1440 × 1000 desktop plus 1024 × 768 and 768 × 1024 tablet layouts. Source door-card/hint separation is 8 px; top, door and five lower controls meet 44 px and hit testing.',remaining:'Compact hint/prompt overlays can partly cover the hand. Physical tablet hardware and native macOS/Linux are unverified. Phone testing is excluded.'},
 {id:'U-09',status:'PARTIAL — tested recovery accepted',change:'Native retained sheets, saved page/zoom/centre and backup integrity review pass. Reduced motion opens/closes instantly; optional arm-load failure leaves doors functional and recovery reloads the arm.',remaining:'These checks do not close general backup restore, full accessibility or cross-platform reliability. Original failed candidates and test corrections remain archived.'}
];
stage.images = [
 {file:'screenshots/growth/walkthrough-polish-production-source-01-reach.png',caption:'AFTER — production browser: a textured arm enters continuously from the lower-right body position. Pre-capture progress 0.355 and post-capture 0.672 show expected screenshot latency; the actual image was inspected.'},
 {file:'screenshots/growth/walk-boundaries-built-release-reach.png',caption:'BEFORE — superseded Stage 08 floating hand. The intermediate candidate remains unaccepted and archived.'},
 {file:'screenshots/growth/production-38a64-source-picker-portrait-plan-final.png',caption:'AFTER — production source picker at 768 × 1024. Actual floor areas, wall openings, room names, stair treads and heading are clear; the exact requested title and reachable Start action are visible.'},
 {file:'screenshots/growth/walkthrough-polish-native-diagnostic-before.png',caption:'BEFORE — superseded Stage 08 triangle-heavy map and old title. The unsupported edge point was correctly refused; the revised test uses a supported landing point.'},
 {file:'screenshots/growth/production-38a64-architect-picker-desktop-plan-final-44.png',caption:'AFTER — production architectural picker with true wall opening gaps and room labels. Start stays disabled until a valid point is chosen; Start and Close meet 44 px minimums.'},
 {file:'screenshots/growth/production-197ab-tablet-landscape-prompt-attempt1.png',caption:'BEFORE — real Stage 08 tablet failure: door card and walking hint overlapped by 22.17 px at 1024 × 768.'},
 {file:'screenshots/growth/production-38a64-tablet-landscape-prompt.png',caption:'AFTER — production tablet landscape: door card clears the hint by 8 px. The original top controls and distinct lower navigation dock remain visible and hittable.'},
 {file:'screenshots/growth/production-38a64-tablet-portrait-reach.png',caption:'AFTER — production tablet portrait: attached arm and working door action. The prompt partly covers the hand; this known compact-view limit remains disclosed.'},
 {file:'screenshots/growth/production-38a64-architect-door-reach.png',caption:'AFTER — architectural production door interaction. The forearm enters the 3D pane from the body, while the hint partly obscures the hand in the compact canvas.'},
 {file:'screenshots/growth/walkthrough-polish-production-native-01-reach.png',caption:'WINDOWS APP — actual newly built executable, complete 183-command journey passed. The textured arm is visibly attached to the lower-right camera/body edge.'},
 {file:'screenshots/growth/walkthrough-polish-production-native-01-stairs-upper.png',caption:'WINDOWS APP — climbed actual Redburn treads to the upper stair surface, then descended in the same run. The model’s unsupported upper connection remains blocked; this is not a verified continuous access route.'},
 {file:'screenshots/growth/walkthrough-polish-production-native-01-retained-view.png',caption:'WINDOWS APP — prior sheet name, original page 2 and saved 156% view survived the new executable. Recorded zoom and centre restoration checks passed.'},
 {file:'screenshots/growth/walkthrough-polish-production-native-01-retained-backup.png',caption:'WINDOWS APP — prior backup integrity review matches the retained isolated workspace and original source bytes. Review remains read-only.'}
];
stage.pendingEvidence = [];
stage.commands = [
 'Source production: 158 commands, 27.9116031 s, exit 0 — 2026-09-07T16-20-03-389Z-growth-polish-built; all 16 screenshots inspected.',
 'Windows executable: complete 183 commands, 31.3628102 s, exit 0 — 2026-09-07T16-24-27-082Z-growth-polish-native; all 19 screenshots inspected, including retained data.',
 'Architect production journey: 126 commands, 23.0747836 s, exit 0. Five further layout/picker/reduced-motion/arm-failure runs pass; six runs total 330 commands in 47.0741418 s. Coverage report records 15 inspected, hashed images.',
 'Combined production/native UI acceptance: 671 commands across 8 runs; 106.3485551 s of runner execution. This is a command count, not 671 independent test cases.',
 'DANS1: all five sequential gates pass — dependency restore, typecheck, 145 focused tests (none failed/skipped/cancelled), production web build, native executable and installer build. No local full build.',
 'Release identity: 631 frozen source files with zero drift; 11 web assets, two native artifacts and both runtime arm assets matched to build/freeze records.',
 'Fresh journey runtime monitors pass. Source and native arm screenshots are visually inspected; post-screenshot progress is telemetry, not an assertion that animation is paused.',
 'Earlier Stage 08 tablet failures, native edge fixture failure, 40 px Architect picker targets and dev screenshot-timing assertion remain preserved. Final passing evidence supersedes those bounded failures without rewriting them.'
];
stage.logs = [
 `${dir}/source-production-visual-acceptance.json`,
 ...[sourceRun,nativeRun].flatMap(id=>[`proof/growth/runner/${id}.json`,`proof/growth/runner/${id}.log`]),
 'proof/growth/2026-09-08-walk-boundaries/production-38a64-acceptance.json',
 `${dir}/remote-build-acceptance.md`,`${release}/build-identity-verified.json`,`${release}/source-drift.json`,`${release}/artifacts-verified.json`,`${release}/qa-launch.json`,`${release}/native-qa-close.json`,
 `${dir}/asset-provenance.md`,`${dir}/release-freeze-guard.json`,`${dir}/source-development-acceptance.md`
];
for(const file of [...stage.logs, stage.codeDiff, ...stage.images.map(x=>x.file)]) if(!fs.existsSync(path.resolve(root,file))) throw Error(`Missing proof ${file}`);
stage.sourceIdentity = 'Source checkpoint 844e091 (root-reported scoped source/assets commit). Frozen web/source SHA-256 38a64f0b8c2b4a3293386f63845be806805ea58a3e68ff50839f06c735c57ed1 (530 files); native source 9e85e6501cbe8e92b7f504ba1b9b41b3be8268059955e065a852a1f032b2f6d7 (101 files). Twenty-one-file scope SHA-256 420a03c0d9916921e895bed85e855c5df14dda46443dab8a09fb80e09aa78bcd; exact manifest/code diff in proof/growth/2026-09-08-09-walkthrough-polish-source. Executed application EXE SHA-256 14db2b026c8a8aaaf75c54f47be9405db0f5e81a1cb9ee455582d9646bfe72ca. Isolated QA PID 78792; verified close recorded separately. Original source model/PDF bytes and normal user profile remain untouched; no CRM change or application installation is part of this stage.';
fs.writeFileSync(`${dir}/stage09-report.json`, JSON.stringify(stage,null,2)+'\n');
console.log(JSON.stringify({ready:true,journeyImagesInspected:inspection.length,embeddedImages:stage.images.length,release:identity.sourceSha256}));
