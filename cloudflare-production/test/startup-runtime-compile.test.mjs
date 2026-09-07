import test from 'node:test';
import assert from 'node:assert/strict';
import { homeCalcioPolishRuntimeSource } from '../scripts/home-calcio-polish.mjs';
import { homeCalcioSafetyRuntimeSource } from '../scripts/home-calcio-safety.mjs';

test('new home/calcio runtime patches compile as browser JavaScript', () => {
  assert.doesNotThrow(() => new Function(homeCalcioPolishRuntimeSource()));
  assert.doesNotThrow(() => new Function(homeCalcioSafetyRuntimeSource()));
});
