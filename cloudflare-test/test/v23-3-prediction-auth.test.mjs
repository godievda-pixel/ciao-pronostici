import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function authProbe() {
  try {
    return await import('../scripts/probe-prediction-auth.mjs');
  } catch (error) {
    assert.fail(`prediction auth probe is missing: ${error?.code || error?.message || error}`);
  }
}

test('prediction auth probe performs no network request when test identity is missing', async () => {
  const { probePredictionAuthentication } = await authProbe();
  let calls = 0;
  const result = await probePredictionAuthentication({
    initData: '',
    fetchImpl: async () => {
      calls += 1;
      throw new Error('network must not be called');
    },
  });

  assert.equal(calls, 0);
  assert.equal(result.status, 'BLOCKED_NO_TEST_IDENTITY');
  assert.equal(result.performed, false);
  assert.equal(result.authenticated, false);
  assert.equal(result.readOnly, true);
  assert.equal(result.mutatedUserData, false);
});

test('prediction auth probe uses only read-only state with a supplied signed test identity', async () => {
  const { probePredictionAuthentication } = await authProbe();
  const requests = [];
  const result = await probePredictionAuthentication({
    initData: 'query_id=test&user=%7B%22id%22%3A1%7D&auth_date=1&hash=signed-test',
    fetchImpl: async (url, init) => {
      requests.push({ url: String(url), init });
      return new Response(JSON.stringify({ ok: true, user: { id: 1 }, round: {}, standings: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
  });

  assert.equal(requests.length, 1);
  assert.equal(requests[0].init.method, 'POST');
  assert.deepEqual(JSON.parse(requests[0].init.body), { action: 'state' });
  assert.equal(requests[0].init.headers['x-telegram-init-data'].includes('signed-test'), true);
  assert.equal(result.status, 'AUTHENTICATED_READ_ONLY');
  assert.equal(result.authenticated, true);
  assert.equal(result.readOnly, true);
  assert.equal(result.mutatedUserData, false);
  assert.deepEqual(result.responseShape, {
    topLevelKeys: ['ok', 'round', 'standings', 'user'],
    hasUser: true,
    hasRound: true,
    hasStandings: true,
  });
});

test('prediction auth probe source contains no prediction write action and never logs initData', async () => {
  const source = await readFile(new URL('../scripts/probe-prediction-auth.mjs', import.meta.url), 'utf8');

  assert.doesNotMatch(source, /save_predictions/);
  assert.doesNotMatch(source, /console\.log\([^\n]*initData/);
  assert.doesNotMatch(source, /JSON\.stringify\([^\n]*initData/);
  assert.match(source, /action:\s*'state'/);
});
