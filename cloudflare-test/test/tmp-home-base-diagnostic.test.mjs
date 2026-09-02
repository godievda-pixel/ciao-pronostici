import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_BASE_URL } from '../scripts/build.mjs';

test('diagnostic: report Home labels in the fetched v23.1 base', async () => {
  const response = await fetch(DEFAULT_BASE_URL, {
    headers: { 'cache-control': 'no-cache, no-store, max-age=0' },
  });
  const html = await response.text();
  const observation = {
    status: response.status,
    bytes: Buffer.byteLength(html),
    hasSeasonLabel: html.includes('SERIE A 2026/27'),
    hasResetNotice: html.includes('Начало нового сезона!'),
    hasFullResetNotice: html.includes('Начало нового сезона! Счёт обнулен, все начинают с нуля. Удачи!'),
  };
  console.log('HOME_BASE_DIAGNOSTIC', JSON.stringify(observation));
  assert.equal(response.ok, true);
});
