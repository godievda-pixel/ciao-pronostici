import test from 'node:test';
import assert from 'node:assert/strict';

const URL = 'https://ciao-web-app-test.ciao-web.workers.dev/api/ciao-core-api-fast-v4';

test('diagnostic: deployment-probe can or cannot read legacy prediction state', async () => {
  const response = await fetch(URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-cache, no-store, max-age=0',
      'x-telegram-init-data': 'deployment-probe',
    },
    body: JSON.stringify({ action: 'state' }),
  });

  let payload = null;
  try { payload = await response.json(); } catch {}
  const observation = {
    status: response.status,
    ok: Boolean(response.ok && payload?.ok),
    error: payload?.error || null,
    topLevelKeys: payload && typeof payload === 'object' ? Object.keys(payload).sort() : [],
    hasUser: Boolean(payload?.user),
    hasRound: Boolean(payload?.round),
    hasStandings: Array.isArray(payload?.standings),
  };
  console.log('PREDICTION_AUTH_DIAGNOSTIC', JSON.stringify(observation));
  assert.ok(response.status > 0);
});
