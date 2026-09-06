import test from 'node:test';
import assert from 'node:assert/strict';
import { RELEASE_SOURCE_URL } from '../scripts/build.mjs';

test('diagnostic: report current production-source bottom navigation contract', async () => {
  const response = await fetch(RELEASE_SOURCE_URL, { headers:{ 'cache-control':'no-cache' } });
  assert.equal(response.ok, true, `release source HTTP ${response.status}`);
  const html = await response.text();
  const buttons = Array.from(html.matchAll(/<button\b[^>]*data-tab=["']([^"']+)["'][^>]*>([\s\S]*?)<\/button>/gi), match => ({
    tab:match[1],
    label:match[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
  }));
  assert.fail(`production nav buttons: ${JSON.stringify(buttons)}`);
});
