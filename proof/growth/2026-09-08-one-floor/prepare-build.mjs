import fs from 'node:fs';
const file='src/studio/FloorConstructionStudio.tsx';
let s=fs.readFileSync(file,'utf8');
s=s.split('\n').map(line=>{
 if(line.includes('/ MATERIAL STUDIES'))return '          X-RAY <span>/ MATERIAL STUDIES</span>';
 if(line.includes('className="floor-edition"'))return '        <span className="floor-edition">01 / THE APARTMENT</span>';
 if(line.includes('<i>{status.stage > i'))return '                <i>{status.stage > i ? "✓" : status.stage === i ? "●" : "·"}</i>';
 if(line.includes('ILLUSTRATIVE STUDY'))return '            ILLUSTRATIVE STUDY · 12 × 9 M<br />';
 if(line.includes('PENCILS')&&line.includes('status.pencils'))return '                ? `${status.pencils} PENCILS · 0.1 S BURSTS`';
 if(line.includes('components placed'))return '            <span>{status.parts} components placed · Drag to orbit · Scroll to zoom</span>';
 if(line.includes('<option value=".5">'))return '              <option value=".5">½×</option>';
 for(const n of [1,2,4])if(line.includes(`<option value="${n}">`))return `              <option value="${n}">${n}×</option>`;
 return line;
}).join('\n');fs.writeFileSync(file,s);
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));if(!pkg.scripts.test.includes('src/studio/floorDrawing.test.ts'))pkg.scripts.test=pkg.scripts.test.replace('src/studio/cinematicPencils.test.ts','src/studio/cinematicPencils.test.ts src/studio/floorDrawing.test.ts');fs.writeFileSync('package.json',JSON.stringify(pkg,null,2)+'\n');
const prior='proof/growth/2026-09-08-pencil-independent',base='proof/growth/2026-09-08-one-floor';
for(const file of ['package-web.mjs','package-native.mjs','remote-orchestrator.mjs','worker.ps1','start-preview.ps1','remote-collect-artifacts.ps1','release-verify-artifacts.mjs','release-build-identity.mjs']) {
 let text=fs.readFileSync(`${prior}/${file}`,'utf8').replaceAll('2026-09-08-pencil-independent','2026-09-08-one-floor');
 if(file==='worker.ps1')text=text.replace("'src/studio/cinematicPencils.test.ts'","'src/studio/cinematicPencils.test.ts','src/studio/floorDrawing.test.ts'");
 fs.writeFileSync(`${base}/${file}`,text);
}
