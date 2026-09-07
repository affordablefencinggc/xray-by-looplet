import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

// Prepares a descriptor only. Root must explicitly sign off production/native visuals,
// then run scripts/growth-report.mjs and the generated render scenario separately.
const root=path.resolve(import.meta.dirname,'../../..'), dir=import.meta.dirname;
const [run,signoffFile]=process.argv.slice(2);
if(!/^[a-f0-9]{12}$/.test(run??'')||!signoffFile) throw Error('Usage: node prepare-stage-report.mjs <verified-run> <root-signoff.json>');
const locate=file=>{const absolute=path.resolve(root,file); if(!absolute.startsWith(root+path.sep))throw Error('Proof must remain inside the repository'); return absolute;};
const read=file=>JSON.parse(fs.readFileSync(locate(file),'utf8').replace(/^\uFEFF/,''));
const hash=file=>createHash('sha256').update(fs.readFileSync(locate(file))).digest('hex');
const signoff=read(signoffFile);
if(signoff.run!==run||signoff.approved!==true||signoff.productionInspected!==true||signoff.nativeInspected!==true) throw Error('Explicit root production/native visual signoff required');
const release=`proof/growth/2026-09-08-walk-boundaries/release-${run}`;
const native=read(`${release}/native-completion.json`), artifacts=read(`${release}/artifacts-verified.json`), drift=read(`${release}/source-drift.json`);
if(!native.sourceSha256?.startsWith(run)||!native.nativeSourceSha256||!Array.isArray(native.results)||native.results.some(r=>r.exitCode!==0))throw Error('Native completion/source identity mismatch');
for(const step of ['typecheck','focused-tests','web-build','native-build']) if(!native.results.some(r=>r.step===step&&r.exitCode===0))throw Error('Missing release gate '+step);
if(artifacts.status!=='pass'||artifacts.sourceSha256!==native.sourceSha256||artifacts.nativeSourceSha256!==native.nativeSourceSha256||drift.status!=='pass'||drift.runId!==run||drift.drift?.length)throw Error('Artifacts or source drift gate failed');
const checked=[];
for(const [platform,files] of [['production',signoff.productionRecords],['native',signoff.nativeRecords]]) {
  if(!Array.isArray(files)||!files.length) throw Error(`Missing ${platform} runner evidence`);
  for(const file of files) {
    const record=read(file);
    if(record.exitCode!==0||record.error||!Number.isFinite(record.commands)||record.commands<1||!record.savedScenario||!record.log)throw Error('Runner did not pass: '+file);
    if(hash(record.savedScenario)!==record.scenarioSha256)throw Error('Executed scenario changed: '+file);
    const scenario=read(record.savedScenario);
    if(!Array.isArray(scenario)||scenario.length!==record.commands||!fs.statSync(locate(record.log)).size)throw Error('Incomplete runner evidence: '+file);
    checked.push({platform,file,...record});
  }
}
if(!Array.isArray(signoff.images)||!signoff.images.length)throw Error('Inspected final release images required');
for(const image of signoff.images) {
  if(!image.caption||path.extname(image.file).toLowerCase()!=='.png'||fs.readFileSync(locate(image.file)).subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw Error('Invalid inspected image');
}
const descriptor=path.join(dir,'stage-report.json'), stage=JSON.parse(fs.readFileSync(descriptor,'utf8'));
if(stage.ready||fs.existsSync(path.join(root,'proof/growth',stage.id,'index.html')))throw Error('Preserve finalized report; use a new stage for changes');
const exe=native.artifacts?.find(a=>a.path.endsWith('xray-by-looplet.exe')), installer=native.artifacts?.find(a=>a.path.includes('nsis'));
if(!exe?.sha256||!installer?.sha256)throw Error('Missing native executable/installer identity');
stage.ready=true;
stage.platform=`Production browser and Windows candidate ${run}; development source and architectural journeys`;
stage.requirements[0].status='Pass: boundaries/doors milestone; full ID partial';
stage.requirements[0].remaining=stage.requirements[0].remaining.replace('Production/native checks pending. ','');
stage.requirements[1].status='Pass: retained controls; full ID partial';
stage.requirements[2].status='Pass: bounded navigation feedback; full IDs partial';
stage.images=[...signoff.images,...stage.images];
stage.commands=stage.commands.map(c=>c.replace(' Production/native checks are pending.',''));
stage.commands.push('Dans1 typecheck, focused tests, web build and sequential native build all exit 0. Artifacts and source drift gates pass.');
stage.commands.push(...checked.map(r=>`${r.platform}: ${r.commands} commands, ${r.seconds.toFixed(3)} seconds, exit 0; ${r.file}`));
stage.logs.push(...checked.flatMap(r=>[r.file,r.log]),`${release}/native-completion.json`,`${release}/artifacts-verified.json`,`${release}/source-drift.json`,signoffFile);
stage.sourceIdentity=stage.sourceIdentity.replace(' Final release identity pending.','')+` Final web SHA-256 ${native.sourceSha256}; native source ${native.nativeSourceSha256}; executable ${exe.sha256}; NSIS installer ${installer.sha256}. Root visual signoff applies to the listed candidate and recorded scenarios. No installation, CRM edit or normal profile mutation is claimed.`;
fs.writeFileSync(descriptor,JSON.stringify(stage,null,2)+'\n');
const renderFile=path.join(dir,'render-report.json'), render=JSON.parse(fs.readFileSync(renderFile,'utf8'));
render[5][2]=`document.images.length===${stage.images.length}&&[...document.images].every(i=>i.complete&&i.naturalWidth>0)`;
fs.writeFileSync(renderFile,JSON.stringify(render,null,2)+'\n');
console.log(JSON.stringify({ready:true,descriptor:path.relative(root,descriptor),images:stage.images.length,next:`node scripts/growth-report.mjs ${path.relative(root,descriptor)}`,htmlGenerated:false},null,2));
