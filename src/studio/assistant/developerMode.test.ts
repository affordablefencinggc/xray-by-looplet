import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readDeveloperMode,hasDeveloperReview,developerReviewInstruction} from './developerMode.ts';
test('developer mode defaults on and preserves explicit off',()=>{
  assert.equal(readDeveloperMode({getItem:()=>null}),true);
  assert.equal(readDeveloperMode({getItem:()=> 'false'}),false);
  assert.equal(readDeveloperMode({getItem:()=> 'true'}),true);
  assert.equal(readDeveloperMode({getItem:()=>{throw Error('storage blocked');}}),true);
});
test('self-review detection requires a labelled section with content',()=>{
  assert.equal(hasDeveloperReview('### Developer review\n- Delivered the answer.'),true);
  assert.equal(hasDeveloperReview('**Developer review**\nOutcome: incomplete.'),true);
  assert.equal(hasDeveloperReview('I could add a Developer review.'),false);
  assert.equal(hasDeveloperReview('### Developer review\n'),false);
});
test('recording review excludes current-state verification without forbidding checks on real edits',()=>{
  const recording=developerReviewInstruction(true), action=developerReviewInstruction(false);
  assert.ok(recording.includes('current project state; that state is outside this request'));
  assert.ok(!action.includes('that state is outside this request'));
  assert.ok(action.includes('Recommend verification only when the requested action or a specific unsupported claim actually needs it'));
});
