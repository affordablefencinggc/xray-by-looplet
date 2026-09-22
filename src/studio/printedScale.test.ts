import { test } from 'node:test';
import assert from 'node:assert/strict';
import { printedScaleMetresPerPoint, reviewedPrintedScale, REDBURN_SCALE_SOURCE } from './printedScale.ts';
test('reviewed scale is bound to exact source and page', () => {
  assert.equal(reviewedPrintedScale(REDBURN_SCALE_SOURCE, 11)?.denominator, 250);
  assert.equal(reviewedPrintedScale(REDBURN_SCALE_SOURCE, 10), null);
  assert.equal(reviewedPrintedScale('different', 11), null);
});
test('printed A3 1:250 maps a 40mm paper line to 10m, independently of screen zoom', () => {
  const points = 40 / 25.4 * 72;
  assert.ok(Math.abs(points * printedScaleMetresPerPoint(250) - 10) < 1e-10);
  for (const ratio of [0, -1, NaN, Infinity, 100001]) assert.throws(() => printedScaleMetresPerPoint(ratio));
});
