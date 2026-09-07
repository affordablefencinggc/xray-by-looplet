import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const built=fs.readFileSync('.temp/dans1-native/xray-by-looplet.exe');
const installed=fs.readFileSync(path.join(process.env.LOCALAPPDATA,'X-Ray by Looplet','xray-by-looplet.exe'));
const sha=b=>createHash('sha256').update(b).digest('hex');
const normalized=Buffer.from(installed),differences=[];
if(built.length!==installed.length)throw Error('Binary lengths differ');
for(let i=0;i<built.length;i++)if(built[i]!==installed[i])differences.push(i);
if(differences.length){
 const offset=differences[0],prefix='__TAURI_BUNDLE_TYPE_VAR_';
 if(differences.length!==3||differences.some((n,i)=>n!==offset+i)||built.subarray(offset-prefix.length,offset+3).toString()!==prefix+'UNK'||installed.subarray(offset-prefix.length,offset+3).toString()!==prefix+'NSS')throw Error('Unexpected executable differences');
 normalized.write('UNK',offset,'ascii');
}
if(sha(normalized)!==sha(built))throw Error('Installed identity mismatch');
const result={ok:true,changedBytes:differences.length,builtSha256:sha(built),installedSha256:sha(installed),normalizedSha256:sha(normalized)};
fs.writeFileSync('proof/audit/IW-REDBURN-ENCLOSURE/installed-identity.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
