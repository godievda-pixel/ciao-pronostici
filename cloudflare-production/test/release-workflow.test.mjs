import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflow=readFileSync(
  new URL('../../.github/workflows/ciao-production-check.yml',import.meta.url),
  'utf8',
);

test('production workflow runs release gate only for pushes to main after build',()=>{
  const buildAt=workflow.indexOf('name: Build');
  const releaseAt=workflow.indexOf('name: Synchronize Telegram release');
  assert.ok(buildAt>=0);
  assert.ok(releaseAt>buildAt);
  assert.match(workflow,/if:\s*github\.event_name == 'push' && github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow,/node scripts\/release-gate\.mjs/);
});

test('tracked Telegram router changes are covered by production CI',()=>{
  assert.match(workflow,/supabase\/functions\/ciao-pronostici-router\/\*\*/);
});
