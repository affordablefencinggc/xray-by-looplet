// Read-only source-list review. Does not capture source hashes or create a snapshot.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
const base='proof/growth/2026-09-08-daily-recovery';
const spec=JSON.parse(fs.readFileSync(`${base}/source-snapshot.json`,'utf8'));
const git=args=>execFileSync('git',args,{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']}).trim();
const names=text=>text?text.split(/\r?\n/).filter(Boolean):[];
const modified=names(git(['diff','--name-only','HEAD','--','src','scripts','package.json']));
const added=names(git(['ls-files','--others','--exclude-standard','--','src','scripts']));
const actual=[...new Set([...modified,...added])].sort();
const explicit=[...spec.files].sort();
assert.equal(new Set(explicit).size,explicit.length);
assert.equal(spec.id,'2026-09-08-daily-recovery-release');
for(const file of explicit){assert(/^(src\/|scripts\/|package\.json$)/.test(file)&&!file.includes('..'));assert(fs.existsSync(file));}
assert.deepEqual(actual,explicit,'Changed application scope differs from the reviewed explicit list; inspect before updating it');
assert(!fs.existsSync(`proof/growth/${spec.id}/source-manifest.json`),'Do not rerun preparation over an existing snapshot');
assert(!fs.existsSync(`${base}/release-freeze-guard.json`),'This source-list review precedes the explicit release freeze');
const result={status:'spec prepared; QA and explicit SOURCE FREEZE still required',snapshotId:spec.id,files:explicit.length,modifiedTracked:modified.length,addedUntracked:added.length,baseline:git(['rev-parse','HEAD']),paths:explicit,excluded:'All other paths: ledgers, historic proof, screenshots, local launch shortcuts, profiles and unrelated artifacts. No app-source changes outside the explicit list were observed.',sourceSnapshotCreated:false,sourceHashesCaptured:false,packaged:false,built:false};
fs.writeFileSync(`${base}/source-snapshot-spec-review.json`,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(result));
