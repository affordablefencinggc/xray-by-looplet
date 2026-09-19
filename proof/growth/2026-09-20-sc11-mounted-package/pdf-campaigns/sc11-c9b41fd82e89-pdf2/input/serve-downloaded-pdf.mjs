import { createServer } from 'node:http';
import { hostname } from 'node:os';
import { readFile, stat } from 'node:fs/promises';
import { resolve, sep, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
if(hostname().split('.')[0].toLowerCase()!=='dans1')throw Error('DANS1 only');
const source=resolve(process.argv[2]),browserOutput=resolve(process.argv[3]),renderInput=resolve(process.argv[4]),port=Number(process.argv[5]||8090);
if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Invalid loopback port');
const own=dirname(fileURLToPath(import.meta.url)),vendor=resolve(source,'node_modules/pdfjs-dist');
const expected=JSON.parse(await readFile(resolve(renderInput,'expected.json'),'utf8'));
const pdf=resolve(browserOutput,expected.pdfFile);if(!pdf.startsWith(browserOutput+sep))throw Error('PDF path escapes browser output');
const types={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.pdf':'application/pdf','.json':'application/json','.wasm':'application/wasm'};
createServer(async(req,res)=>{try{
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405).end();return}
 const route=decodeURIComponent(new URL(req.url,'http://127.0.0.1:'+port).pathname);
 if(route==='/favicon.ico'){res.writeHead(204).end();return}
 let file;
 if(route.startsWith('/vendor/')){file=resolve(vendor,route.slice(8));if(!file.startsWith(vendor+sep)){res.writeHead(403).end();return}}
 else if(route==='/downloaded.pdf')file=pdf;
 else if(route==='/expected.json')file=resolve(renderInput,'expected.json');
 else if(route==='/'||route==='/viewer.html')file=resolve(own,'pdf-viewer.html');
 else{res.writeHead(404).end();return}
 if(!(await stat(file)).isFile()){res.writeHead(404).end();return}
 const bytes=await readFile(file);res.writeHead(200,{'Content-Type':types[extname(file)]??'application/octet-stream','Content-Length':bytes.length,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:bytes);
 }catch{res.writeHead(404).end('Outside the isolated disk-readback surface')}}).listen(port,'127.0.0.1',()=>console.log(JSON.stringify({host:hostname(),source,browserOutput,renderInput,pdf,pid:process.pid,port,purpose:'SC11 actual disk-downloaded PDF readback only; no exporter'})));
