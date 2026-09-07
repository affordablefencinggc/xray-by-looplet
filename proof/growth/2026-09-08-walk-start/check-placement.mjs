import fs from 'node:fs';
import {recommendWalkStarts,listWalkFloors,assessWalkStart} from '../../../src/studio/walkStartPlacement.ts';
const model=JSON.parse(fs.readFileSync('public/models/redburn/source-building.json','utf8'));
for(const floor of listWalkFloors(model)){const start=performance.now();console.log(JSON.stringify({floor,center:assessWalkStart(model,floor.id,{x:0,z:0}),starts:recommendWalkStarts(model,floor.id),ms:performance.now()-start}));}
