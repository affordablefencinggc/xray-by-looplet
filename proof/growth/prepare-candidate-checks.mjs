import fs from 'node:fs';
const pricing=JSON.parse(fs.readFileSync('proof/growth/2026-09-07-pricing/portable-candidate.json','utf8'));
for(const target of ['production','native']){
 const prefix=target==='production'?[['open','http://127.0.0.1:8086/'],['set','viewport','1440','1000']]:[['tab','t1']];
 const commands=pricing.map(c=>c.map(v=>v.replaceAll('screenshots/growth/2026-09-07-pricing/candidate-','screenshots/growth/2026-09-07-pricing/'+target+'-')));
 fs.writeFileSync(`proof/growth/${target}-pricing.json`,JSON.stringify([...prefix,...commands],null,2));
}
