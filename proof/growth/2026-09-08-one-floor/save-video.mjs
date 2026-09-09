import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
const binary='.temp/npm/_npx/8e62322f9a68a26a/node_modules/agent-browser/bin/agent-browser-win32-x64.exe';
const result=spawnSync(binary,['--session','floor-local','--json','eval','window.__floorVideo'],{encoding:'utf8',windowsHide:true,maxBuffer:25000000,timeout:30000});
if(result.status!==0)throw Error('Video retrieval failed');
const payload=JSON.parse(result.stdout),value=payload.data?.result??payload.data;
if(typeof value!=='string'||!value.startsWith('data:video/webm'))throw Error('Unexpected result');
const bytes=Buffer.from(value.slice(value.indexOf(',')+1),'base64'),file='proof/growth/2026-09-08-one-floor/one-floor.webm';fs.writeFileSync(file,bytes);console.log(JSON.stringify({file,bytes:bytes.length,source:'Actual WebGL canvas at 1x, structure then flooring shading'}));
