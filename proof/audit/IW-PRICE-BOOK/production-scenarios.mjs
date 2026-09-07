import { readFileSync, writeFileSync } from 'node:fs';
for (const name of ['fresh', 'reload']) {
  const commands = JSON.parse(readFileSync(`proof/audit/IW-PRICE-BOOK/${name}.json`, 'utf8'));
  for (const command of commands) for (let i = 0; i < command.length; i++) {
    command[i] = command[i].replaceAll('http://127.0.0.1:8080/', 'http://127.0.0.1:8084/').replaceAll('screenshots/price-book/', 'screenshots/price-book/production-');
  }
  if (name === 'fresh') commands.push(['eval', "(()=>{const key=Object.keys(localStorage).find(k=>k.startsWith('xray:price-books:v1:'));const value=JSON.parse(localStorage.getItem(key));sessionStorage.setItem('qa-pricing-before-reload-job',value.jobId);return value.jobId;})()"]);
  else commands.push(['eval', "(()=>{const key=Object.keys(localStorage).find(k=>k.startsWith('xray:price-books:v1:'));const value=JSON.parse(localStorage.getItem(key));if(value.jobId!==sessionStorage.getItem('qa-pricing-before-reload-job'))throw Error('Project identity changed after reload');return 'Production project identity unchanged';})()"]);
  writeFileSync(`proof/audit/IW-PRICE-BOOK/production-${name}.json`, JSON.stringify(commands, null, 2));
}
