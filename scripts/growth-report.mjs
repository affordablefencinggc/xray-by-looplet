import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const root = path.resolve(import.meta.dirname, '..');
const input = process.argv[2];
if (!input) throw Error('Usage: node scripts/growth-report.mjs <stage.json>');
const stage = JSON.parse(fs.readFileSync(input, 'utf8').replace(/^\uFEFF/, ''));
if (!/^[a-z0-9-]+$/.test(stage.id)) throw Error('Invalid stage ID');
const out = path.join(root, 'proof/growth', stage.id);
if (fs.existsSync(path.join(out, 'index.html'))) throw Error('Preserve prior stage reports; use a new stage ID for an update.');
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const evidence = (stage.images ?? []).map(item => {
  const file = path.resolve(root, item.file);
  if (!file.startsWith(root + path.sep) || path.extname(file).toLowerCase() !== '.png') throw Error('Evidence must be a repository PNG');
  const bytes = fs.readFileSync(file);
  if (bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw Error('Invalid PNG evidence');
  return {...item, sha256:createHash('sha256').update(bytes).digest('hex'), data:`data:image/png;base64,${bytes.toString('base64')}`};
});
const archiveDir=path.join(root,'screenshots/growth',stage.id);fs.mkdirSync(archiveDir,{recursive:true});
for(const [index,item] of evidence.entries()) {
  item.archivedFile=`screenshots/growth/${stage.id}/${String(index+1).padStart(2,'0')}.png`;
  fs.writeFileSync(path.join(root,item.archivedFile),Buffer.from(item.data.split(',')[1],'base64'),{flag:'wx'});
}
const rows = stage.requirements.map(row => `<tr><td>${escape(row.id)}</td><td><strong>${escape(row.status)}</strong></td><td>${escape(row.change)}</td><td>${escape(row.remaining || 'None within stated scope')}</td></tr>`).join('');
const summary = `<header><p class="eyebrow">X-RAY / PROOF OF GROWTH</p><h1>${escape(stage.title)}</h1><p>${escape(stage.date)} · ${escape(stage.platform)}</p></header><section><h2>What changed</h2><p>${escape(stage.summary)}</p><table><thead><tr><th>ID</th><th>Result</th><th>Change and evidence</th><th>Remaining scope</th></tr></thead><tbody>${rows}</tbody></table></section>`;
const cards = evidence.map(item => `<figure><img src="${item.data}" alt="${escape(item.caption)}"><figcaption>${escape(item.caption)}<small>${escape(item.file)} · SHA-256 ${item.sha256}</small></figcaption></figure>`).join('');
const style = `:root{--ink:#14232c;--muted:#52636c;--line:#ced8dd;--paper:#fff;--ground:#edf1f3;--accent:#28556b}*{box-sizing:border-box}body{margin:0;background:var(--ground);color:var(--ink);font:16px/1.55 Segoe UI,Arial,sans-serif}main{max-width:1180px;margin:36px auto;padding:40px;background:var(--paper)}header{border-bottom:2px solid var(--accent);padding-bottom:24px}h1{font-size:34px;line-height:1.2;margin:10px 0}h2{font-size:22px;margin-top:32px}.eyebrow{letter-spacing:.16em;font-size:12px;font-weight:700;color:var(--accent)}p,figcaption{color:var(--muted)}table{width:100%;border-collapse:collapse;font-size:14px}th,td{text-align:left;vertical-align:top;padding:12px;border-bottom:1px solid var(--line)}th{background:var(--ground)}figure{margin:28px 0;border:1px solid var(--line);break-inside:avoid}img{display:block;width:100%;height:auto}figcaption{padding:14px}small{display:block;overflow-wrap:anywhere;font-size:11px;margin-top:6px}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:var(--ground);padding:18px;font:13px/1.5 Consolas,monospace}.summary-image{margin-top:24px}.summary-image img{max-height:620px;object-fit:contain;background:var(--ground)}@media(max-width:700px){main{margin:0;padding:18px}h1{font-size:27px}table{font-size:12px}th,td{padding:7px}}@media print{body{background:white}main{margin:0;max-width:none;padding:0}h2{break-after:avoid}pre{font-size:10px}}`;
const html = content => `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(stage.title)} — X-Ray growth</title><style>${style}</style><main>${content}</main></html>`;
fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(path.join(out,'index.html'),html(summary+cards+`<section><h2>Executed checks</h2><pre>${escape((stage.commands??[]).join('\n'))}</pre><h2>Source and proof identity</h2><pre>${escape(stage.sourceIdentity)}\n${escape((stage.logs??[]).join('\n'))}\n${escape(stage.codeDiff)}</pre></section>`));
fs.writeFileSync(path.join(out,'summary.html'),html(summary+(evidence[0]?`<figure class="summary-image"><img src="${evidence[0].data}" alt="${escape(evidence[0].caption)}"><figcaption>${escape(evidence[0].caption)}</figcaption></figure>`:'')));
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({...stage,images:evidence.map(({data,...rest})=>rest)},null,2));
const growthRoot=path.join(root,'proof/growth');
const stages=fs.readdirSync(growthRoot,{withFileTypes:true}).filter(d=>d.isDirectory()&&/^[a-z0-9-]+$/.test(d.name)&&fs.existsSync(path.join(growthRoot,d.name,'manifest.json'))).map(d=>JSON.parse(fs.readFileSync(path.join(growthRoot,d.name,'manifest.json'),'utf8'))).sort((a,b)=>a.id.localeCompare(b.id));
const stageLinks=stages.map(item=>`<article style="border-bottom:1px solid var(--line);padding:20px 0"><h2><a href="${escape(item.id)}/index.html">${escape(item.title)}</a></h2><p>${escape(item.date)} · ${escape(item.platform)}</p><p>${escape(item.summary)}</p><p>${item.requirements.map(r=>`${escape(r.id)}: ${escape(r.status)}`).join(' · ')}</p><a href="${escape(item.id)}/index.html">Open illustrated report</a>${item.summaryImage?` · <a href="../../${escape(item.summaryImage)}">Open PNG summary</a>`:''}</article>`).join('');
fs.writeFileSync(path.join(growthRoot,'index.html'),html(`<header><p class="eyebrow">X-RAY / PROOF OF GROWTH</p><h1>Development you can inspect</h1><p>Dated reports with embedded screenshots, executed checks and exact scope. Partial work remains labelled partial.</p></header>${stageLinks}`));
console.log(JSON.stringify({report:path.join(out,'index.html'),summary:path.join(out,'summary.html'),images:evidence.length}));
