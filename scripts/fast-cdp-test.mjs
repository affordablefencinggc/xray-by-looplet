import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const [session, scenario, ...extra] = process.argv.slice(2);
if (!session || !scenario || !/^[a-zA-Z0-9_-]+$/.test(session)) throw Error('Usage: node scripts/fast-cdp-test.mjs <session> <scenario.json> [--cdp <port>]');
const commands=JSON.parse(fs.readFileSync(scenario,'utf8'));
if(!Array.isArray(commands)||commands.some(c=>!Array.isArray(c)||c.some(v=>typeof v!=='string')))throw Error('Expected JSON opcode arrays');
const candidates=[process.env.AGENT_BROWSER_BINARY,'node_modules/agent-browser/bin/agent-browser-win32-x64.exe','.temp/npm/_npx/8e62322f9a68a26a/node_modules/agent-browser/bin/agent-browser-win32-x64.exe'].filter(Boolean);
const binary=candidates.find(p=>fs.existsSync(p));
if(!binary)throw Error('Set AGENT_BROWSER_BINARY to the installed native agent-browser executable.');
const directory=path.resolve('proof/growth/runner');fs.mkdirSync(directory,{recursive:true});
const id=`${new Date().toISOString().replace(/[:.]/g,'-')}-${session}`;
const log=path.join(directory,id+'.log'), handle=fs.openSync(log,'wx');
const input=JSON.stringify(commands);
const savedScenario=path.join(directory,id+'.scenario.json');
fs.writeFileSync(savedScenario,input,{flag:'wx'});
const started=performance.now();
// Real file handles avoid waiting for EOF from inherited daemon output pipes.
// Use the installed agent-browser binary directly; no shell or alternative browser driver.
const result=spawnSync(binary,['--session',session,...extra,'batch','--bail'],{input,encoding:'utf8',stdio:['pipe',handle,handle],windowsHide:true,timeout:Number(process.env.FAST_CDP_TIMEOUT_MS)||180000,maxBuffer:8e6});
fs.closeSync(handle);
const report={session,scenario,savedScenario,scenarioSha256:createHash('sha256').update(input).digest('hex'),commands:commands.length,seconds:(performance.now()-started)/1000,exitCode:result.status,error:result.error?.message??null,log};
fs.writeFileSync(path.join(directory,id+'.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report));
process.exit(result.status??1);
