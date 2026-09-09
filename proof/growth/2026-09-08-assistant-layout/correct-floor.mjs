import fs from 'node:fs';
const file='src/studio/floorConstruction.ts';let s=fs.readFileSync(file,'utf8');fs.writeFileSync('proof/growth/2026-09-08-assistant-layout/floorConstruction.before.ts',s);
const start=s.indexOf('export const FLOOR_STAGES = ['),end=s.indexOf('] as const;',start)+'] as const;'.length;
s=s.slice(0,start)+`export const FLOOR_STAGES = [
 {id:'plumbing',title:'Under-slab plumbing',detail:'Water and waste mains below the slab, with risers to fixture positions.'},
 {id:'electrical',title:'Electrical rough-in',detail:'Under-slab supply conduits and service risers, with outlet and lighting connections.'},
 {id:'reinforcement',title:'Slab reinforcement',detail:'Two visible reinforcement mats within the future slab. Illustrative layout, not an engineered bar schedule.'},
 {id:'structure',title:'Concrete structure',detail:'Concrete poured around the prepared service penetrations and reinforcement; columns and beams follow.'},
 {id:'framing',title:'Wall framing',detail:'Timber studs, plates and doorway lintels. Open front for inspection.'},
 {id:'insulation',title:'Wall insulation',detail:'Insulation batts fitted between the studs and noggins before the plasterboard.'},
 {id:'gyprock',title:'Gyprock',detail:'Plasterboard panels over the insulated wall framing.'},
 {id:'painting',title:'Painting',detail:'Warm ivory finish with a sage kitchen feature wall.'},
 {id:'flooring',title:'Flooring',detail:'Individual oak boards and ceramic bathroom tiles.'},
 {id:'fixtures',title:'Fixtures & fittings',detail:'Cabinetry, worktop, sink, tap, shower, vanity and sanitaryware.'},
 {id:'appliances',title:'Appliances & fit-off',detail:'Oven, cooktop, refrigerator, lights and finished outlets.'},
] as const;`+s.slice(end);
s=s.replaceAll('[-4.7, 0.22, z], [4.8, 0.22, z]','[-4.7, -0.52, z], [4.8, -0.52, z]').replaceAll('[x, 0.22, z]','[x, -0.52, z]').replaceAll(', 0.11, -3.2]',', -0.62, -3.2]').replaceAll('[4.5, 0.11, -0.8]','[4.5, -0.59, -0.8]').replaceAll('[3.2, 0.11, -2.4]','[3.2, -0.59, -2.4]').replaceAll('`Cable tray feed ${x}`','`Under-slab electrical feed ${x}`').replaceAll('[-5.2, 2.78, -3.75]','[-5.2, -0.43, -3.75]').replaceAll('[x, 2.78, -3.75],\n      0.019','[x, -0.43, -3.75],\n      0.019').replaceAll('`Outlet conduit ${x}`, "electrical", [x, 2.78, -3.75]','`Outlet conduit ${x}`, "electrical", [x, -0.43, -3.75]');
const insertion=`
  // Under-slab branches terminate at fixture risers, rather than floating above the pour.
  pipe('WC waste riser','plumbing',[4.5,-.59,-.8],[4.5,.25,-.8],.055,waste);
  pipe('Shower waste riser','plumbing',[3.2,-.59,-2.4],[3.2,.13,-2.4],.045,waste);
  for(const layer of [-.10,-.23]) {
    for(let z=-4.2;z<=4.2;z+=.3) pipe('Slab steel X '+layer+':'+z,'reinforcement',[-5.7,layer,z],[5.7,layer,z],.0075,'#6a7072',.55);
    for(let x=-5.7;x<=5.7;x+=.3) pipe('Slab steel Z '+layer+':'+x,'reinforcement',[x,layer-.018,-4.2],[x,layer-.018,4.2],.0075,'#6a7072',.55);
  }
  for(const [x,z,w] of [[0,-4,11.3],[3.9,1,3.5]])for(let a=-w/2;a+.56<=w/2;a+=.56){
    if(z===1&&a<-.65)continue;
    for(const [y,h] of [[.72,1.19],[2.13,1.48]])box('Wall batt '+z+':'+a+':'+y,'insulation',x+a+.28,y,z,.505,h,.078,'#d5c28c');
  }
  for(const x of [-5.5,5.5])for(let z=-3.8;z+.56<=.7;z+=.56)box('Side batt '+x+':'+z,'insulation',x,1.5,z+.28,.078,2.79,.505,'#d5c28c');
`;
s=s.replace('  group.updateMatrixWorld(true);',insertion+'\n  group.updateMatrixWorld(true);');fs.writeFileSync(file,s);
const studio='src/studio/FloorConstructionStudio.tsx';let v=fs.readFileSync(studio,'utf8');fs.writeFileSync('proof/growth/2026-09-08-assistant-layout/FloorConstructionStudio.before.tsx',v);
v=v.replace('ground.position.y = -0.33','ground.position.y = -0.90').replace('grid.position.y = -0.325','grid.position.y = -0.895').replace('["gyprock", "painting", "flooring"].includes(p.stage)','["gyprock", "painting", "flooring", "insulation"].includes(p.stage)');
v=v.replace('if (expose && [','if(expose&&p.id===\'Concrete floor slab\')p.mesh.visible=false;\n      if (expose && [');fs.writeFileSync(studio,v);
