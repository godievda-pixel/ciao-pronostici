import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const indexPath = new URL('../../supabase/functions/ciao-v23-api/index.ts', import.meta.url);

test('ciao-v23-api composes the standalone v23 services without legacy/modular runtime routing', async () => {
  const source = await readFile(indexPath, 'utf8');

  for (const required of [
    'createV23Router',
    'createMatchService',
    'createPredictionRepository',
    'createPredictionService',
    'createRankingService',
    'createUserRepository',
    'createProfileService',
  ]) assert.match(source, new RegExp(required));

  assert.doesNotMatch(source, /createModularActionRouter/);
  assert.doesNotMatch(source, /createModularRuntime/);
  assert.doesNotMatch(source, /isModularAction/);
  assert.doesNotMatch(source, /\bmodular_matches\b/);
  assert.doesNotMatch(source, /ciao-core-api-fast-v[456]/);
  assert.doesNotMatch(source, /functions\/v1\/ciao-core-api-fast/);
});

test('runtime environment and CORS are configured through environment variables, not a hardcoded TEST origin', async () => {
  const source = await readFile(indexPath, 'utf8');
  assert.match(source, /Deno\.env\.get\(['"]CIAO_ENVIRONMENT['"]\)/);
  assert.match(source, /Deno\.env\.get\(['"]CIAO_ALLOWED_ORIGINS['"]\)/);
  assert.doesNotMatch(source, /ciao-web-v23-test\.ciao-web\.workers\.dev/);
});

test('TEST allowlist is checked before channel membership and user profile sync', async () => {
  const source = await readFile(indexPath, 'utf8');
  const authorize = source.slice(source.indexOf('async function authorize'));
  const allowlist = authorize.indexOf('requireTestAccess(telegramId)');
  const membership = authorize.indexOf('requireMembership(telegramId)');
  const sync = authorize.indexOf('syncTelegramProfile(tgUser)');
  assert.ok(allowlist >= 0 && membership > allowlist && sync > membership);
});
