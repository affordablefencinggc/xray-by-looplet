import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const hash=b=>createHash('sha256').update(b).digest('hex');
const built=fs.readFileSync('src-tauri/target/release/xray-by-looplet.exe');
const base=path.join(process.env.LOCALAPPDATA,'X-Ray by Looplet');
const installed=fs.readFileSync(path.join(base,'xray-by-looplet.exe'));
const normalized=Buffer.from(installed),differences=[];
if(built.length!==installed.length)throw Error('Executable lengths differ');
for(let i=0;i<built.length;i++)if(built[i]!==installed[i])differences.push(i);
if(differences.length){
 const offset=differences[0],prefix='__TAURI_BUNDLE_TYPE_VAR_';
 if(differences.length!==3||differences.some((v,i)=>v!==offset+i)||built.subarray(offset-prefix.length,offset+3).toString()!==prefix+'UNK'||installed.subarray(offset-prefix.length,offset+3).toString()!==prefix+'NSS')throw Error('Unexpected executable changes');
 normalized.write('UNK',offset,'ascii');
}
if(hash(normalized)!==hash(built))throw Error('Installed executable mismatch');
const resources=fs.readdirSync('engine/cad/bin').map(name=>{
 const expected=fs.readFileSync(path.join('engine/cad/bin',name)),actual=fs.readFileSync(path.join(base,'engine/cad',name));
 if(!expected.equals(actual))throw Error(`Installed CAD resource differs: ${name}`);
 return {name,sha256:hash(actual)};
});
const result={pass:true,builtSha256:hash(built),installedSha256:hash(installed),normalizedSha256:hash(normalized),changedBytes:differences.length,resources};
fs.writeFileSync('proof/audit/IW-DWG/installed-identity.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result));
