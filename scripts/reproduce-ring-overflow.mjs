import { emptyProject, newWall } from '../src/studio/architect/model.ts';
import { wallSolids, rooms } from '../src/studio/architect/geometry.ts';
const p=emptyProject('ring-reproduction');
const points=[[-20.168,236.349],[9047.201,236.349],[-26.676,236.349],[-26.676,6286.036],[8940.314,6286.036],[9063.77,236.349],[9047.201,236.349]];
const ids=['27883449','4cb51d97','075cbeb5','bfff72ba','9d64b742','24baa342'];
p.walls=ids.map((id,i)=>({...newWall(p,p.levels[0].id,points[i],points[i+1]),id}));
for(const [name,fn] of [['solids',()=>wallSolids(p)],['rooms',()=>rooms(p,p.levels[0].id)]]) {
try {console.log(name,fn().length)} catch(e){console.error(name,e.stack);process.exitCode=1}
}
