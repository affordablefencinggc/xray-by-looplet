// Launches the locally built candidate (not installed) in a fresh isolated profile with loopback CDP.
import fs from 'node:fs'; import path from 'node:path'; import net from 'node:net'; import {createHash} from 'node:crypto'; import {spawn} from 'node:child_process'; import {once} from 'node:events';
const exe=path.resolve('src-tauri/target/release/xray-by-looplet.exe'), expected=process.argv[2];
const sha256=createHash('sha256').update(fs.readFileSync(exe)).digest('hex'); if(sha256!==expected) throw Error('EXE hash mismatch '+sha256);
const profile=path.resolve('.temp/desktop-refresh-candidate'), out=path.resolve('proof/growth/2026-09-23-desktop-refresh/qa-launch.json');
if(fs.existsSync(profile)) throw Error('profile exists'); if(fs.existsSync(out)) throw Error('launch record exists');
const cdpPort=9291, probe=net.createServer(); probe.listen(cdpPort,'127.0.0.1'); await once(probe,'listening'); await new Promise(r=>probe.close(r));
fs.mkdirSync(profile,{recursive:true});
const app=spawn(exe,[],{detached:true,stdio:'ignore',env:{...process.env,WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:`--remote-debugging-port=${cdpPort} --remote-debugging-address=127.0.0.1`,WEBVIEW2_USER_DATA_FOLDER:profile}});
await once(app,'spawn'); app.unref();
const rec={pid:app.pid,exe,sha256,profile,cdpPort,launchedAt:new Date().toISOString(),installed:false};
fs.writeFileSync(out,JSON.stringify(rec,null,2)+'\n',{flag:'wx'}); console.log(JSON.stringify(rec));
