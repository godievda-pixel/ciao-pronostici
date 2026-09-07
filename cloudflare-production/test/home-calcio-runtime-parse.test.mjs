import test from 'node:test';
import assert from 'node:assert/strict';
import { homeCalcioPolishRuntimeSource } from '../scripts/home-calcio-polish.mjs';
import { homeCalcioSafetyRuntimeSource } from '../scripts/home-calcio-safety.mjs';

test('home/calcio runtime fragments compile as browser JavaScript before injection', () => {
  assert.doesNotThrow(() => new Function(homeCalcioPolishRuntimeSource()));
  assert.doesNotThrow(() => new Function(homeCalcioSafetyRuntimeSource()));
});
