import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import * as productionBuild from '../scripts/build.mjs';

async function exists(url) {
  try { await stat(url); return true; }
  catch { return false; }
}

test('production build ships native predictions as static module and css', async () => {
  await productionBuild.build();
  const html = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
  assert.match(html, /href=["']\/predictions\/predictions-screen\.css["']/);
  assert.match(html, /<script[^>]+type=["']module["'][^>]+src=["']\/predictions\/predictions-screen\.mjs["']/);
  assert.equal(await exists(new URL('../dist/predictions/predictions-screen.mjs', import.meta.url)), true);
  assert.equal(await exists(new URL('../dist/predictions/predictions-screen.css', import.meta.url)), true);
  assert.equal(await exists(new URL('../dist/predictions/controller.mjs', import.meta.url)), true);
  assert.equal(await exists(new URL('../dist/predictions/model.mjs', import.meta.url)), true);
  assert.equal(await exists(new URL('../dist/predictions/data-client.mjs', import.meta.url)), true);
  assert.equal(await exists(new URL('../dist/predictions/view.mjs', import.meta.url)), true);
});

test('native predictions module installs by default after cutover', async () => {
  const source = await readFile(new URL('../src/predictions/predictions-screen.mjs', import.meta.url), 'utf8');
  assert.match(source, /if \(typeof document !== 'undefined'\) \{\s*globalThis\.CiaoPredictionsScreen = installPredictionsScreen\(document\);\s*\}/);
  assert.doesNotMatch(source, /native_predictions/);
  assert.doesNotMatch(source, /nativePredictionsEnabled/);
});
