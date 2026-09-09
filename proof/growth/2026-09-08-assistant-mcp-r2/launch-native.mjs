// Explicit invocation only after root artifact signoff. Never installs the app.
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
const runId=process.argv[2];
assert(/^[a-f0-9]{12}$/.test(runId??''),'Verified run ID required');
const base=path.resolve(`proof/growth/2026-09-08-assistant-mcp-r2/release-${runId}`);
const read=p=>JSON.parse(fs.readFileSync(path.join(base,p),'utf8').replace(/^\uFEFF/,''));
const native=read('native-completion.json'),verified=read('artifacts-verified.json'),identity=read('build-identity-verified.json'),transfer=read('transfer-record.json');
assert.equal(verified.status,'pass');assert.equal(identity.status,'pass');assert.equal(identity.runId,runId);assert.equal(verified.runId,runId);
for(const record of [native,verified,identity]){assert.equal(record.sourceSha256,transfer.sourceSha256);assert.equal(record.nativeSourceSha256,transfer.nativeSourceSha256);}
assert.equal(transfer.sourceSha256.slice(0,12),runId);
assert.deepEqual(native.results.map(g=>g.step),['dependencies','typecheck','focused-tests','web-build','native-build','native-assistant-tests','native-material-tests']);
for(const gate of native.results)assert.equal(gate.exitCode,0,gate.step+' did not pass');
const exe=path.join(base,'artifacts/src-tauri/target/release/xray-by-looplet.exe');
const sha256=createHash('sha256').update(fs.readFileSync(exe)).digest('hex');
assert(native.artifacts.some(a=>a.sha256===sha256&&a.path.endsWith('xray-by-looplet.exe')),'EXE identity mismatch');
const profile=path.resolve(`.temp/assistant-native-${runId}`),output=path.join(base,'qa-launch.json');
assert(!fs.existsSync(profile),'Fresh isolated profile required; existing profile preserved');
assert(!fs.existsSync(output),'Prior launch evidence preserved');
// Refuse an occupied diagnostic port rather than attaching to another app.
const cdpPort=9273,probe=net.createServer();probe.listen(cdpPort,'127.0.0.1');await once(probe,'listening');await new Promise((resolve,reject)=>probe.close(error=>error?reject(error):resolve()));
fs.mkdirSync(profile,{recursive:true});
const app=spawn(exe,[],{windowsHide:true,detached:true,stdio:'ignore',env:{...process.env,WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:`--remote-debugging-port=${cdpPort} --remote-debugging-address=127.0.0.1`,WEBVIEW2_USER_DATA_FOLDER:profile}});
await once(app,'spawn');app.unref();
const result={runId,pid:app.pid,exe,profile,sha256,cdpPort,launchedAt:new Date().toISOString(),installed:false,profileMode:'new isolated QA profile; normal installation, prior QA profiles and user data untouched'};
fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(result));
