import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

async function source(path) {
  return readFile(resolve(repoRoot, path), 'utf8');
}

test('Telegram router opens the no-cache launcher instead of Cloudflare directly', async () => {
  const s = await source('supabase/functions/ciao-pronostici-router/index.ts');
  assert.match(s, /const APP_URL=.*ciao-web-app/);
  assert.match(s, /const TELEGRAM_APP_URL=APP_URL/);
  assert.doesNotMatch(s, /const TELEGRAM_APP_URL=.*workers\.dev/);
});

test('launcher gives every Mini App launch a unique Cloudflare document URL', async () => {
  const s = await source('supabase/functions/ciao-web-app/index.ts');
  assert.match(s, /new URL\(resolved\.url\)/);
  assert.match(s, /searchParams\.set\(["']v["'],\s*String\(Date\.now\(\)\)\)/);
  assert.match(s, /location:target\.toString\(\)/);
  assert.match(s, /no-store, no-cache, must-revalidate, max-age=0/);
});

test('launcher health exposes safe registry diagnostics without secret values', async () => {
  const s = await source('supabase/functions/ciao-web-app/index.ts');
  assert.match(s, /resolution_error/);
  assert.match(s, /supabase_url_present/);
  assert.match(s, /service_key_present/);
  assert.doesNotMatch(s, /service_key_value/);
});

test('launcher queries the actual frontend build registry schema', async () => {
  const s = await source('supabase/functions/ciao-web-app/index.ts');
  assert.match(s, /select=build_id,url,is_stable/);
  assert.match(s, /b\?\.is_stable/);
  assert.doesNotMatch(s, /select=build_id,url,enabled/);
  assert.doesNotMatch(s, /b\?\.enabled/);
});
