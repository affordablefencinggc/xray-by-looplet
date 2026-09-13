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

test('developer review judges the delivered current answer and distinguishes actual calls from context',()=>{
  const instruction=developerReviewInstruction();
  for (const boundary of [
    'CURRENT USER-VISIBLE RESPONSE',
    'not a hidden candidate answer, prior response or prior work packet',
    'Distinguish context supplied automatically from tools you executed in this turn',
    'prior packet receipts do not prove a new call',
  ]) assert.ok(instruction.includes(boundary), boundary);
});

test('developer review cannot treat static reference or reviewer names as verification',()=>{
  const instruction=developerReviewInstruction();
  assert.ok(instruction.includes('read_workbench_structure is a static capability reference, not a fresh project-state readback'));
  assert.ok(instruction.includes('cannot confer verified human authority or unblock review_takeoff_item'));
  assert.ok(instruction.includes("respect the current work packet's authority gate"));
  assert.ok(instruction.includes('Keep it under 70 words'));
  assert.ok(instruction.includes('Do not call tools or repeat project actions solely to write this review'));
});
