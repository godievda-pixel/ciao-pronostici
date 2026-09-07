import test from 'node:test';
import assert from 'node:assert/strict';
import { homeCalcioPolishRuntimeSourceSafe } from '../scripts/home-calcio-polish-safe.mjs';
import { homeCalcioSafetyRuntimeSource } from '../scripts/home-calcio-safety.mjs';

test('home/calcio runtime shipped to the browser is syntactically valid', () => {
  assert.doesNotThrow(() => new Function(homeCalcioPolishRuntimeSourceSafe()));
  assert.doesNotThrow(() => new Function(homeCalcioSafetyRuntimeSource()));
});
