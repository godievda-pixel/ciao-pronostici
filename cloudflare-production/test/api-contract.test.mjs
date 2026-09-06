import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CURRENT_API,
  resolveTelegramInitData,
  normalizeApiError,
} from '../src/modular/data/api-contract.mjs';

test('API contract names the observed production capabilities', () => {
  assert.equal(CURRENT_API.core, 'https://dkefzepiiudehhzbbrjn.supabase.co/functions/v1/ciao-core-api-fast-v6');
  assert.equal(CURRENT_API.capabilities.serieA, true);
  assert.equal(CURRENT_API.capabilities.predictions, true);
  assert.equal(CURRENT_API.capabilities.rankings, true);
  assert.equal(CURRENT_API.capabilities.matchCenter, true);
  assert.deepEqual(CURRENT_API.competitions, ['serie_a','coppa_italia','ucl','uel','uecl']);
  assert.equal(CURRENT_API.provider.name, 'BSD Football v2');
  assert.equal(CURRENT_API.provider.browserToken, false);
});

test('API contract resolves Telegram auth without inventing identity', () => {
  assert.equal(resolveTelegramInitData({ Telegram:{ WebApp:{ initData:'signed-init-data' } } }), 'signed-init-data');
  assert.equal(resolveTelegramInitData({}), '');
});

test('API contract normalizes network errors', () => {
  const error = Object.assign(new Error('network_down'), { status:503, code:'upstream_down' });
  assert.deepEqual(normalizeApiError(error), {
    code:'upstream_down',
    status:503,
    message:'network_down',
  });
});
