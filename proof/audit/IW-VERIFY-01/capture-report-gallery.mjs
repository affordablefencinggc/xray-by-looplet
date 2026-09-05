import {createServer} from 'node:http';
import {once} from 'node:events';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,relative} from 'node:path';
import {chromium} from 'playwright';
import {readLedger,inputDigest} from '../../../scripts/industry-ledger.mjs';
const run=readFileSync('proof/audit/IW-VERIFY-01/latest-run.txt','utf8').trim(),html=readFileSync(resolve(run,'execution-report.html'));
const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const server=createServer((req,res)=>{res.writeHead(req.url==='/'?200:404,{'Content-Type':'text/html'});res.end(req.url==='/'?html:'Not found');});server.listen(0,'127.0.0.1');await once(server,'listening');
const url=`http://127.0.0.1:${server.address().port}/`,captures=[];
const browser=await chromium.launch({headless:true,channel:'msedge'});
try{for(const viewport of [{name:'desktop',width:1280,height:1000},{name:'mobile',width:390,height:844}]){const page=await browser.newPage({viewport});await page.goto(url,{waitUntil:'networkidle'});const path=`screenshots/industry-verification/${viewport.name}-execution-report-gallery.png`;await page.screenshot({path,fullPage:true});captures.push({path,url,capturedAt:new Date().toISOString(),viewport,sha256:hash(path)});await page.close();}}finally{await browser.close();await new Promise(r=>server.close(r));}
const reportPath='proof/audit/IW-VERIFY-01/execution-capture-gallery.json';writeFileSync(reportPath,JSON.stringify({kind:'Actual captured local execution report; not app behavior',resultsPath:relative(process.cwd(),resolve(run,'results.json')).replaceAll('\\','/'),resultsSha256:hash(resolve(run,'results.json')),captures},null,2));
const d=readLedger(),task=d.tasks.find(t=>t.id==='IW-004');
for(const c of captures)task.evidence.push({kind:c.viewport.name==='desktop'?'execution-capture':'execution-capture-mobile',path:c.path,sha256:c.sha256,revision:task.revision,inputDigest:inputDigest(task),screenshot:{url:c.url,time:c.capturedAt,timeLabel:'captured at',viewport:{width:c.viewport.width,height:c.viewport.height},scenario:`Executed core checks · ${c.viewport.name}`,classification:'backend execution report · not app UI',result:'24 core + 9 adversarial + 15 prior tracker tests passed. Captured report visualizes execution; runtime integration remains open.',sourceIdentity:`Exact inputs in ${relative(process.cwd(),resolve(run,'results.json')).replaceAll('\\','/')}; source hashes stable during execution; tracker gallery changed subsequently.`,reportPath,reportSha256:hash(reportPath),featured:c.viewport.name==='desktop'}});
d.updatedAt=new Date().toISOString();writeFileSync('planning/control/ledger.json',JSON.stringify(d,null,2)+'\n');console.log(JSON.stringify({reportPath,captures},null,2));
