import test from 'node:test';
import assert from 'node:assert/strict';
import { browserSingleton } from './browserSingleton.ts';

test('module copies share the exact store and install subscriptions only once per tab', () => {
  const tab = {};
  let creates = 0;
  const make = () => ({ pane: 'sheets', instance: ++creates });
  const first = browserSingleton('xray-test', make, tab);
  first.value.pane = 'model';
  const second = browserSingleton('xray-test', make, tab);
  assert.equal(first.value, second.value);
  assert.equal(second.value.pane, 'model');
  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.equal(creates, 1);
});

test('different tabs and server evaluations do not share project state', () => {
  const make = () => ({ project: 'example' });
  assert.notEqual(browserSingleton('xray-test', make, {}).value, browserSingleton('xray-test', make, {}).value);
  assert.notEqual(browserSingleton('xray-test', make).value, browserSingleton('xray-test', make).value);
});
