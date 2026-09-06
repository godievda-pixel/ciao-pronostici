import test from 'node:test';
import assert from 'node:assert/strict';
import { CURRENT_API, resolveTelegramInitData, normalizeApiError } from '../src/modular/data/api-contract.mjs';

test('API contract names the current production services and supported competitions', () => {
  assert.equal(typeof CURRENT_API.core, 'string');
  assert.match(CURRENT_API.core, /ciao-core-api-fast-v6$/);
  assert.equal(CURRENT_API.capabilities.serieA, true);
  assert.equal(CURRENT_API.capabilities.predictions, true);
  assert.equal(CURRENT_API.capabilities.rankings, true);
  assert.equal(CURRENT_API.capabilities.matchCenter, true);
  assert.equal(CURRENT_API.provider.name, 'BSD Football API v2');
  assert.deepEqual(CURRENT_API.competitions, ['serie_a','coppa_italia','ucl','uel','uecl']);
  assert.equal(CURRENT_API.provider.browserTokenAllowed, false);
});

test('API contract resolves Telegram init data without inventing auth', () => {
  assert.equal(resolveTelegramInitData({ Telegram:{ WebApp:{ initData:'signed-init-data' } } }), 'signed-init-data');
  assert.equal(resolveTelegramInitData({}), '');
});

test('API errors normalize without leaking response bodies', () => {
  const error = Object.assign(new Error('provider unavailable'), { status:503, code:'provider_unavailable' });
  assert.deepEqual(normalizeApiError(error), {
    code:'provider_unavailable',
    status:503,
    message:'provider unavailable',
  });
});
