import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {pathToFileURL} from 'node:url';
if(os.hostname().toLowerCase()!=='dans1')throw Error('DANS1 required');
const {generateMcpConfigs}=await import(pathToFileURL(path.resolve('scripts/mcp-setup.mjs')));
const config=generateMcpConfigs('python');
for(const [file,value] of [['.agents/mcp_config.json',config.antigravity],['.cursor/mcp.json',config.cursorAndClaude]]){
  if(fs.existsSync(file))throw Error('Preserve existing configuration: '+file);
  fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(value));
}
console.log('Created workspace-only test configurations; no user/global config changed.');
