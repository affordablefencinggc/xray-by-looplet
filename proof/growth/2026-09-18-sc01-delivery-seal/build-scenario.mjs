/**
 * The scenario that takes SC-01's screenshots.
 *
 * It seeds the app's own storage with the project `sc01-seed-project.mjs` built — the project is put into
 * `xray:architect:v1:<the job id the app itself created>`, so what the screenshots show is the app loading a
 * real frozen issue set through its own path, not a component rendered by a test harness.
 *
 * The readings are asserted in the page, not just photographed: each issue's seal badge text, the hash it
 * shows, and whether that hash is the record's own `sourceSha256` read back out of storage. A screenshot
 * alone would show a badge; these say the badge is about the bytes.
 *
 * Run from the repo root: node .temp/live-rig/build-sc01-scenario.mjs
 */
import fs from "node:fs";

const PROJECT = fs.readFileSync(".temp/live-rig/sc01-seeded-project.json", "utf8");
const OUT = ".temp/live-rig/sc01-proof.json";
const SHOTS = "screenshots/growth/sc01";

const seed = `(()=>{
  /* The workspace loads the project stored at the key built from the job it is holding, and refuses a
     project whose own id is a different one ("Wrong project identity", which it turns into an empty
     blocked session). So the fixture's job id is adopted by the job as well, rather than the other way
     round: the frozen issue's bytes carry the project id inside them under a SHA-256 seal, and rewriting
     that to match a freshly generated id would break the very seal these screenshots are about. */
  const raw = localStorage.getItem('xray:fencing-job:v2');
  if (!raw) throw Error('the app has not created a job yet');
  const job = JSON.parse(raw);
  if (!job || typeof job !== 'object') throw Error('the stored job is not an object');
  const wanted = 'job-sc01-proof';
  localStorage.setItem('xray:fencing-job:v2', JSON.stringify({ ...job, id: wanted, name: 'SC-01 proof fixture' }));
  const key = 'xray:architect:v1:' + encodeURIComponent(wanted);
  localStorage.setItem(key, ${JSON.stringify(PROJECT)});
  return JSON.stringify({ jobId: wanted, replacedJobId: job.id, seeded: localStorage.getItem(key).length });
})()`;

const navigate = `(()=>{
  const byText = (t) => [...document.querySelectorAll('button')].find(b => b.innerText.trim() === t);
  const design = byText('Design'); if (!design) throw Error('no Design tab'); design.click();
  return 'design';
})()`;

const openWorkspace = `(()=>{
  const byText = (t) => [...document.querySelectorAll('button')].find(b => b.innerText.trim() === t);
  const ws = byText('Architectural workspace'); if (!ws) throw Error('no Architectural workspace tab'); ws.click();
  return 'workspace';
})()`;

const read = `(()=>{
  const rows = [...document.querySelectorAll('.alteration-issue-row')];
  const issues = rows.map(r => {
    const badge = r.querySelector('.alteration-seal-badge');
    const hash = r.querySelector('.alteration-seal-hash');
    return {
      status: (r.querySelector('.alteration-status-badge')?.textContent ?? '').trim(),
      seal: (badge?.textContent ?? '').trim(),
      sealClass: badge?.className ?? null,
      hashShown: (hash?.textContent ?? '').trim(),
      supersededBy: (r.querySelector('.alteration-superseded-pointer')?.textContent ?? '').trim(),
    };
  });
  const raw = localStorage.getItem('xray:fencing-job:v2');
  let jobId; try { const p = JSON.parse(raw); jobId = typeof p === 'string' ? p : (p.id ?? p.jobId); } catch { jobId = raw; }
  const project = JSON.parse(localStorage.getItem('xray:architect:v1:' + encodeURIComponent(jobId)));
  const stored = (project.alterationIssues ?? []).map(i => ({
    id: i.id, status: i.status, sourceSha256: i.sourceSha256,
    deliveryHash: i.delivery?.contentSha256 ?? null, deliveryState: i.delivery?.state ?? null,
    deliveryStatus: i.delivery?.status ?? null,
    supersededAt: i.supersededAt ?? null, deliverySupersededAt: i.delivery?.supersededAt ?? null,
  }));
  return JSON.stringify({
    rows: issues.length,
    issues,
    stored,
    everySealMatches: stored.every(s => s.deliveryHash === s.sourceSha256),
    everySealShownIsStored: issues.every(r => stored.some(s => r.hashShown.startsWith(s.sourceSha256.slice(0, 16)))),
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    bodyBg: getComputedStyle(document.body).backgroundColor,
  });
})()`;

const scenario = [
  ["set", "viewport", "1600", "1000"],
  ["open", "http://127.0.0.1:8085/"],
  ["wait", "--fn", "document.readyState==='complete'", "--timeout", "60000"],
  ["wait", "--fn", "!!localStorage.getItem('xray:fencing-job:v2')", "--timeout", "60000"],
  ["eval", seed],
  ["open", "http://127.0.0.1:8085/"],
  ["wait", "--fn", "document.readyState==='complete'", "--timeout", "60000"],
  ["wait", "--fn", "[...document.querySelectorAll('button')].some(b=>b.innerText.trim()==='Design')", "--timeout", "60000"],
  ["eval", navigate],
  ["wait", "--fn", "[...document.querySelectorAll('button')].some(b=>b.innerText.trim()==='Architectural workspace')", "--timeout", "30000"],
  ["eval", openWorkspace],
  ["wait", "--fn", "!!document.querySelector('.alteration-stage-preview')", "--timeout", "60000"],
  /* The preview is collapsed until its own header is opened, and a collapsed section still holds its rows in
     the DOM — so the list renders off-screen and a screenshot taken without this shows an empty fold. */
  ["eval", "(()=>{const t=[...document.querySelectorAll('button, summary, [role=button]')].find(b=>/Before\\s*\\/\\s*proposed preview/i.test(b.innerText||''));if(!t)throw Error('no preview toggle');t.click();return 'expanded the preview'})()"],
  ["wait", "--fn", "document.querySelectorAll('.alteration-issue-row').length >= 1", "--timeout", "60000"],
  ["eval", "(()=>{const el=document.querySelector('.alteration-issue-row')??document.querySelector('.alteration-issues-list');if(el)el.scrollIntoView({block:'center'});return 'scrolled to the first issue row'})()"],
  ["eval", read],
  ["screenshot", `C:/Users/danie/repo/xray-by-looplet/${SHOTS}/sc01-sealed-issues-desktop-1600x1000.png`],
  ["eval", "(()=>{const el=document.querySelector('.alteration-issue-row');const r=el.getBoundingClientRect();return JSON.stringify({rowTop:Math.round(r.top),rowBottom:Math.round(r.bottom),viewport:window.innerHeight})})()"],
  ["screenshot", `C:/Users/danie/repo/xray-by-looplet/${SHOTS}/sc01-issue-row-desktop.png`],
  ["set", "viewport", "1024", "768"],
  ["eval", "(()=>{const el=document.querySelector('.alteration-issue-row');if(el)el.scrollIntoView({block:'center'});return 'scrolled'})()"],
  ["eval", read],
  ["screenshot", `C:/Users/danie/repo/xray-by-looplet/${SHOTS}/sc01-sealed-issues-tablet-1024x768.png`],
  ["errors"],
];

fs.writeFileSync(OUT, JSON.stringify(scenario, null, 2));
console.log(`written  ${OUT}  (${scenario.length} ops, project ${PROJECT.length} chars embedded)`);
console.log(`screenshots land in ${SHOTS}/`);
