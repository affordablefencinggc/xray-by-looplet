import http from 'node:http';
import { readFileSync, statSync } from 'node:fs';
import { resolve, extname, sep, relative } from 'node:path';
const root = resolve('proof/audit/IW-PY-WIREFRAME');
const types = {'.html':'text/html; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.json':'application/json'};
http.createServer((req,res)=>{
  if(req.method!=='GET'||req.headers.host!=='127.0.0.1:8098'){res.writeHead(403).end();return}
  if(req.url==='/favicon.ico'){res.writeHead(204).end();return}
  let path;try{path=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://127.0.0.1:8098').pathname))}catch{res.writeHead(400).end();return}
  const rel=relative(root,path).split(sep).join('/');
  const intended=/^(report\.html|feature-audit\.json|(?:residential|shed)-source\.(?:html|png)|(?:residential|shed|cad)-(?:before|after|plan)-attempt-02\.png)$/.test(rel)||/^(?:residential-final|shed-final|transform-final)\/(?:index\.html|scene\.json|complete\.json|page-\d+\.svg)$/.test(rel)||rel==='cli-attempt-02/synthetic-nested-plan/synthetic-nested-plan.wireframe.html';
  if(!path.startsWith(root+sep)||!intended||!types[extname(path)]){res.writeHead(404).end();return}
  try{if(!statSync(path).isFile())throw Error();const data=readFileSync(path);res.writeHead(200,{'Content-Type':types[extname(path)],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}).end(data)}catch{res.writeHead(404).end()}
}).listen(8098,'127.0.0.1',()=>console.log('Owned wireframe proof server http://127.0.0.1:8098'));
