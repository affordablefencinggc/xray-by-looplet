import fs from 'node:fs';
const file='src/studio/MagicPencilDraftsman.ts';
let s=fs.readFileSync(file,'utf8').replaceAll('\r\n','\n');
s=s.replace('import * as THREE from "three";', 'import * as THREE from "three";\nimport { createCinematicPencils, PENCIL_COUNT, SCRIBBLE_SECONDS } from "./cinematicPencils.ts";');
const a=s.indexOf('  // 2. Draftsman Pencil Cursor / Reticle 3D Group');
const b=s.indexOf('  // 3. Section Cut Clipping Planes & Indicator',a);
if(a<0||b<0)throw Error('Integration markers changed');
s=s.slice(0,a)+`  // Five upright drafting pencils share one seekable motion score.
  const pencilEnsemble = createCinematicPencils({ bounds, lines: records.map(r => r.line),
    duration: durationSeconds * 0.5, color: pencilColor, scale: pencilScale });
  const pencilGroup = pencilEnsemble.group;
  scene.add(pencilGroup);

`+s.slice(b);
s=s.replace('      let activeX = center.x;\n      let activeZ = center.z;\n','');
s=s.replace('            activeX = rec.centerX;\n            activeZ = rec.centerZ;\n','');
s=s.replace('      // Animate pencil reticle\n      pencilGroup.position.set(activeX, activeElevation, activeZ);\n      reticleRing.rotation.z += 0.08;', '      pencilEnsemble.update(t * durationSeconds * 0.5);');
s=s.replace('    pencilGroup.scale.set(pencilScale, pencilScale, pencilScale);', '    pencilEnsemble.setScale(pencilScale);');
s=s.replace('    barrelMat.color.set(pencilColor);\n    ringMat.color.set(pencilColor);', '    pencilEnsemble.setColor(pencilColor);');
s=s.replace('    tipGeo.dispose();\n    tipMat.dispose();\n    barrelGeo.dispose();\n    barrelMat.dispose();\n    ringGeo.dispose();\n    ringMat.dispose();\n    crossGeo.dispose();\n    crossMat.dispose();', '    pencilEnsemble.dispose();');
s=s.replace('    domElement.dataset.drawPencilScale = pencilScale.toFixed(2);', '    domElement.dataset.drawPencilScale = pencilScale.toFixed(2);\n    domElement.dataset.drawPencilCount = String(PENCIL_COUNT);\n    domElement.dataset.drawScribbleSeconds = String(SCRIBBLE_SECONDS);');
fs.writeFileSync(file,s);
