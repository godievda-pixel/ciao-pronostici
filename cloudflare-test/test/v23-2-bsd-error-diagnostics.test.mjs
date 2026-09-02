import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.js';

test('v23.2 BSD failures expose only safe upstream stage/status/code diagnostics', async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async url => {
    const value = String(url);
    if (value.includes('/api/v2/leagues/')) {
      return Response.json({
        error: 'invalid token',
        code: 'authentication_failed',
        detail: 'token rejected',
      }, { status: 401 });
    }
    throw new Error(`unexpected URL ${value}`);
  };

  try {
    const secret = 'super-secret-bsd-key';
    const response = await worker.fetch(
      new Request('https://ciao-web-app-test.example/api/v23.2/matches?competition=ucl&from=2026-07-01&to=2027-06-30', {
        headers: { 'x-telegram-init-data': 'probe' },
      }),
      {
        BSD_API_KEY: secret,
        CIAO_WEB_API: { fetch: async () => new Response('unused') },
        ASSETS: { fetch: async () => new Response('asset') },
      },
    );
    const body = await response.json();

    assert.equal(response.status, 502);
    assert.equal(body.error, 'competition_upstream_failed');
    assert.equal(body.upstream_stage, 'leagues');
    assert.equal(body.upstream_status, 401);
    assert.equal(body.upstream_code, 'authentication_failed');
    assert.equal(JSON.stringify(body).includes(secret), false);
  } finally {
    globalThis.fetch = previousFetch;
  }
});
