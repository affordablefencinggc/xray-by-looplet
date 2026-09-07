import fs from 'node:fs';
import {assessWalkStart} from '../../../src/studio/walkStartPlacement.ts';
import {planBounds,floorKey} from '../../../src/studio/componentLocation.ts';
import type {SourceBuilding} from '../../../src/studio/sourceBuilding.ts';
const m=JSON.parse(fs.readFileSync('public/models/redburn/source-building.json','utf8')) as SourceBuilding;
const starts=[['slide',0,2.1,'ground'],['swing',-1.9,2.75,'ground'],['stairs',-6.2,2.6,'ground'],['upper',-.1,-2.1,'upper']] as const;
for(const [name,x,z,floor] of starts){
 const b=planBounds(m.objects.filter(p=>floorKey(p)===floor));
 const scale=Math.min(552/Math.max(.1,b[2]-b[0]),312/Math.max(.1,b[3]-b[1]));
 const ox=(600-(b[2]-b[0])*scale)/2-b[0]*scale,oz=(360-(b[3]-b[1])*scale)/2-b[1]*scale;
 console.log(JSON.stringify({name,x,z,floor,pixel:[ox+x*scale,oz+z*scale],assessment:assessWalkStart(m,floor,{x,z})}));
}
