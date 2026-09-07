import fs from 'node:fs';import {assessWalkStart} from '../../../src/studio/walkStartPlacement.ts';import {planBounds,floorKey} from '../../../src/studio/componentLocation.ts';
const m=JSON.parse(fs.readFileSync('public/models/redburn/source-building.json','utf8'));const b=planBounds(m.objects.filter(p=>floorKey(p)==='ground'));const scale=Math.min(552/(b[2]-b[0]),312/(b[3]-b[1])),ox=(600-(b[2]-b[0])*scale)/2-b[0]*scale,oz=(360-(b[3]-b[1])*scale)/2-b[1]*scale;
const actual={x:(198.9826750198519-ox)/scale,z:(261.05188471798874-oz)/scale};
const candidates=[actual,{x:-6.2,z:2.6},{x:-6.2,z:2.7},{x:-6.2,z:2.8},{x:-6.15,z:2.7}];
const result={bounds:b,scale,actual,candidates:candidates.map(p=>({point:p,pixel:[ox+p.x*scale,oz+p.z*scale],assessment:assessWalkStart(m,'ground',p)}))};fs.writeFileSync('proof/growth/2026-09-08-walkthrough-polish/native-start-assessment.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
