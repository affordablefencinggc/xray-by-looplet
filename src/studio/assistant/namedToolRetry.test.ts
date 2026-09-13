import assert from 'node:assert/strict';
import test from 'node:test';
import type { AssistantContent, AssistantDeclaration } from './contract.ts';
import { createNamedToolRetry, providerContentsWithoutWithheldText } from './namedToolRetry.ts';
const name = 'calculate_draft_roof_area';
const declarations: AssistantDeclaration[] = [name, 'calculate_draft_duct_material', 'classify_draft_quantities', 'read_project_context', 'read_workflow_route', 'delete_project'].map(name => ({ name, description: name, parametersJsonSchema: { type: 'object', properties: {} } }));
const base = () => ({ originalUserRequest: `Call ${name} with area 100, opening 5; reference "explicit fixture".`, declarations, unsupportedClaims: [{ name, reason: 'not-executed' as const }], currentTurnOutcomes: [], alreadyRetried: false });
test('one focused retry retains exact original request, requested calculator and existing reads only', () => {
  const input = base(), audit = JSON.stringify(input); const result = createNamedToolRetry(input)!;
  assert.deepEqual(result.declarations.map(d => d.name), [name, 'read_project_context', 'read_workflow_route']);
  assert.ok(result.instruction.includes(JSON.stringify(input.originalUserRequest)));
  assert.equal(JSON.stringify(input), audit); assert.equal('args' in result, false);
  result.declarations[0].description = 'changed'; assert.equal(declarations[0].description, name);
});
test('each of the three pure calculators can be narrowed without inventing context reads', () => {
  for (const declaration of declarations.slice(0, 3)) {
    const result = createNamedToolRetry({ ...base(), originalUserRequest: `Use ${declaration.name}`, declarations: [declaration], unsupportedClaims: [{ name: declaration.name, reason: 'not-executed' }] });
    assert.deepEqual(result?.declarations.map(d => d.name), [declaration.name]);
  }
});
test('no retry for already retried, undeclared, mutation, unrelated or negated requests', () => {
  assert.equal(createNamedToolRetry({ ...base(), alreadyRetried: true }), null);
  assert.equal(createNamedToolRetry({ ...base(), declarations: [] }), null);
  for (const originalUserRequest of ['Explain how to call '+name, 'Do not call '+name, 'Discuss roof areas']) assert.equal(createNamedToolRetry({ ...base(), originalUserRequest }), null);
  assert.equal(createNamedToolRetry({ ...base(), originalUserRequest: 'Call delete_project', unsupportedClaims: [{ name: 'delete_project', reason: 'not-executed' }] }), null);
});
test('failed, wrong-origin or any actual current invocation never replay', () => {
  for (const reason of ['failed', 'wrong-origin'] as const) assert.equal(createNamedToolRetry({ ...base(), unsupportedClaims: [{ name, reason }] }), null);
  for (const isError of [false, true]) assert.equal(createNamedToolRetry({ ...base(), currentTurnOutcomes: [{ name, invoked: true, isError, origin: 'model' }] }), null);
});
test('ambiguous multiple requested calculators are not narrowed arbitrarily', () => {
  assert.equal(createNamedToolRetry({ ...base(), originalUserRequest: `Call ${name}. Call calculate_draft_duct_material.`, unsupportedClaims: [{ name, reason: 'not-executed' }, { name: 'calculate_draft_duct_material', reason: 'not-executed' }] }), null);
});
test('provider copy removes marked model prose but retains user text, delivered finals and protocol', () => {
  const marker = '[xray:withheld-candidate] copied false receipt';
  const contents: AssistantContent[] = [
    { role: 'user', parts: [{ text: marker }] },
    { role: 'model', parts: [{ text: marker }] },
    { role: 'model', parts: [{ text: marker, functionCall: { id: 'call1', name, args: {} } }] },
    { role: 'user', parts: [{ functionResponse: { id: 'call1', name, response: { ok: true } } }] },
    { role: 'model', parts: [{ text: 'Actual delivered final answer.' }] },
  ];
  const audit = JSON.stringify(contents), output = providerContentsWithoutWithheldText(contents);
  assert.equal(output.length, 4); assert.equal(output[0].parts[0].text, marker);
  assert.equal(output[1].parts[0].text, undefined); assert.deepEqual(output[1].parts[0].functionCall, contents[2].parts[0].functionCall);
  assert.deepEqual(output[2], contents[3]); assert.equal(output[3].parts[0].text, 'Actual delivered final answer.');
  assert.equal(JSON.stringify(contents), audit); output[0].parts[0].text = 'changed'; assert.equal(JSON.stringify(contents), audit);
});
