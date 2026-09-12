import test from 'node:test';
import assert from 'node:assert/strict';
import { demonstration } from './model.ts';
import { compareAnnotations } from './annotationDelta.ts';
import { compareDrawingRevisions } from './revisionDelta.ts';
import { recordDrawingIssue } from './issueHistory.ts';
import { reviewIssueSet } from './issueSet.ts';
import { authoredSheets } from './authoredSheetSet.ts';

function issued() {
 const p = demonstration('annotation-test');
 p.notes = 'Original notes';
 return recordDrawingIssue(p, reviewIssueSet(p, authoredSheets(p).sheets.map(s => s.id), 'Review'), new Date('2026-09-13T00:00:00Z'));
}
test('annotation-only edits are reported without fabricated quantity changes', () => {
 const p = issued(), target = structuredClone(p);
 target.dimensions[0].offset += 150;
 target.notes = 'New review notes';
 const report = compareDrawingRevisions(p.issues![0], target);
 assert.equal(report.summary.hasChanges, true);
 assert.equal(report.geometry.counts.totalChanged, 0);
 assert.equal(report.quantityVariance.totals.varianceCost, 0);
 assert.equal(report.annotations.counts.changed, 2);
 assert.ok(report.annotations.items.some(i => i.category === 'Dimension' && i.changes.some(c => c.includes('offset'))));
 assert.ok(report.annotations.items.some(i => i.category === 'Project notes' && i.changes[0].includes('Original notes')));
 assert.equal(p.issues![0].snapshot!.notes, 'Original notes');
});
test('entity adds/removals and field edits compare by identity, not array or property order', () => {
 const p = demonstration('annotation-order'), target = structuredClone(p);
 target.dimensions.reverse(); target.dimensions.forEach(d => d.revision++);
 assert.deepEqual(compareAnnotations(p, target).items, []);
 target.dimensions.pop();
 target.lines.push({id:'new-line',revision:1,a:[0,0],b:[100,200],levelId:target.levels[0].id});
 target.roomTags[0].name = 'Renamed room';
 const delta = compareAnnotations(p, target);
 assert.equal(delta.counts.added, 1); assert.equal(delta.counts.removed, 1); assert.equal(delta.counts.changed, 1);
 assert.ok(delta.items.some(i=>i.category==='Room tag' && i.changes.some(c=>c.includes('Renamed room'))));
});
test('legacy notes remain explicitly unavailable and never appear as added or deleted', () => {
 const p = issued(), old = structuredClone(p.issues![0]);
 delete old.snapshot!.notes;
 const delta = compareAnnotations(old, p);
 assert.equal(delta.items.length, 0);
 assert.ok(delta.unavailable.some(s=>s.includes('Project notes')));
});
test('two saved issues retain their annotation comparison after live edits', () => {
 const a = issued(); const b = structuredClone(a); b.designRevision = 'B'; b.notes = 'Issued B';
 const saved = recordDrawingIssue(b, reviewIssueSet(b, authoredSheets(b).sheets.map(s=>s.id), 'Review B'), new Date('2026-09-13T01:00:00Z'));
 const report = compareAnnotations(saved.issues![0], saved.issues![1]);
 saved.notes = 'Live changes'; saved.dimensions[0].offset += 900;
 assert.deepEqual(compareAnnotations(saved.issues![0], saved.issues![1]), report);
 assert.equal(report.counts.changed, 1);
});
