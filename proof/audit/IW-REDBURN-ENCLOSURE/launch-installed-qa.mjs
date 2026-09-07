import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';import {spawn} from 'node:child_process';
const dir='proof/audit/IW-REDBURN-ENCLOSURE',identity=JSON.parse(fs.readFileSync(dir+'/installed-identity.json','utf8'));
const exe=path.join(process.env.LOCALAPPDATA,'X-Ray by Looplet','xray-by-looplet.exe');
const sha256=createHash('sha256').update(fs.readFileSync(exe)).digest('hex');
if(!identity.ok||sha256!==identity.installedSha256)throw Error('Installed identity changed');
const profile=path.resolve('.temp',`redburn-installed-${Date.now()}`);fs.mkdirSync(profile,{recursive:true});
const child=spawn(exe,[],{windowsHide:true,detached:true,stdio:'ignore',env:{...process.env,WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:'--remote-debugging-port=9252',WEBVIEW2_USER_DATA_FOLDER:profile}});child.unref();
fs.writeFileSync(dir+'/installed-qa-launch.json',JSON.stringify({pid:child.pid,exe,profile,sha256},null,2));console.log(JSON.stringify({pid:child.pid,profile,sha256}));
