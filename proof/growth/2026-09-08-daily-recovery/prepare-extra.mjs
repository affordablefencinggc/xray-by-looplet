import fs from 'node:fs';
const dir='proof/growth/2026-09-08-daily-recovery';
const a=JSON.parse(fs.readFileSync(`${dir}/quota-retry.json`,'utf8')).map(c=>c.map(s=>s.replaceAll('Recovery quota unsaved name','Recovery readback unsaved name').replaceAll('daily-recovery-dev-','daily-recovery-dev-readback-').replace("throw new DOMException('Injected quota failure','QuotaExceededError')",'return')));
fs.writeFileSync(`${dir}/readback-retry.json`,JSON.stringify(a,null,2));
fs.writeFileSync(`${dir}/download-path-retry.json`,JSON.stringify([
 ['eval',"sessionStorage.setItem('daily-download-latest',localStorage.getItem('xray:fencing-job:v2'));localStorage.setItem('xray:fencing-job:v2',sessionStorage.getItem('daily-recovery-corrupt'))"],['reload'],['wait','--fn',"!!document.querySelector('[data-project-recovery=blocked]')"],
 ['download','[data-project-recovery=blocked] button:nth-of-type(2)','C:/Users/danie/repo/xray-by-looplet/proof/growth/2026-09-08-daily-recovery/downloaded-corrupt-record-final.txt']
],null,2));
