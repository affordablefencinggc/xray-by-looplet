import React from 'react';
import { createRoot } from 'react-dom/client';
import { ArchitectWalkStart } from '/src/studio/architect/ArchitectWalkStart';
import { demonstration } from '/src/studio/architect/model';
const project=demonstration('walk-review');
project.levels.push({...project.levels[0],id:'review-upper',name:'Review upper',elevation:3300});
createRoot(document.getElementById('review-fixture-root')!).render(<ArchitectWalkStart project={project} initialLevel={project.levels[0].id} onClose={()=>{}} onStart={point=>{(window as any).reviewStart=point;}} />);
