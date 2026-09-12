import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArchitectSheets } from '/src/studio/architect/ArchitectSheets';
import { demonstration } from '/src/studio/architect/model';
import { recordDrawingIssue } from '/src/studio/architect/issueHistory';
import { reviewIssueSet } from '/src/studio/architect/issueSet';
import { authoredSheets } from '/src/studio/architect/authoredSheetSet';
import '/src/studio/architect/architect.css';
let base = demonstration('review-fixture');
base.designRevision = 'A'; base.notes = 'Original review note';
base = recordDrawingIssue(base, reviewIssueSet(base, authoredSheets(base).sheets.map(s => s.id), 'Review baseline'), new Date('2026-09-12T00:00:00Z'), () => 'issue-a');
const changed = structuredClone(base);
changed.designRevision = 'B';
changed.notes = 'Revised fire door note';
changed.dimensions[0].offset += 150;
const legacy = structuredClone(changed);
delete legacy.issues![0].snapshot.notes;
function Fixture() {
 const [project, setProject] = useState(changed);
 return <div style={{fontFamily:'Arial', padding:16}}><button id="legacy" onClick={() => setProject(legacy)}>Test legacy issue</button><button id="current" onClick={() => setProject(changed)}>Test current issue</button><ArchitectSheets project={project} onChange={p => {setProject(p); return true;}} onError={e => {throw Error(e);}} /></div>;
}
createRoot(document.getElementById('annotation-fixture-root')!).render(<Fixture />);
