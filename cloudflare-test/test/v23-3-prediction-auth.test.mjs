import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveAuthenticatedUser } from '../src/v23.3/prediction-auth.mjs';

function request(initData = '') {
  return new Request('https://ciao-web-app-test.example/api/v23.3/predictions', {
    headers: initData ? { 'x-telegram-init-data': initData } : {},
  });
}

function json(payload, status = 200) {
  return Response.json(payload, { status });
}

test('identity resolver rejects missing Telegram init data before upstream auth', async () => {
  let calls = 0;
  await assert.rejects(
    resolveAuthenticatedUser({
      request: request(),
      env: { CIAO_WEB_API: { fetch: async () => { calls += 1; return json({ ok: true }); } } },
    }),
    error => error.code === 'telegram_auth_required' && error.status === 401,
  );
  assert.equal(calls, 0);
});

test('identity resolver forwards init data to stable state auth and normalizes user', async () => {
  let upstreamRequest;
  const user = await resolveAuthenticatedUser({
    request: request('signed-init-data'),
    env: { CIAO_WEB_API: { fetch: async req => {
      upstreamRequest = req;
      return json({ ok: true, user: { id: 42, first_name: 'Daniil', username: 'ciao42' } });
    } } },
  });
  assert.equal(new URL(upstreamRequest.url).pathname, '/api/ciao-core-api-fast-v4');
  assert.equal(upstreamRequest.headers.get('x-telegram-init-data'), 'signed-init-data');
  assert.deepEqual(JSON.parse(await upstreamRequest.text()), { action: 'state' });
  assert.deepEqual(user, {
    userId: 'telegram:42',
    displayName: 'Daniil',
    username: 'ciao42',
  });
});

test('identity resolver refuses an authenticated payload without stable id', async () => {
  await assert.rejects(
    resolveAuthenticatedUser({
      request: request('signed'),
      env: { CIAO_WEB_API: { fetch: async () => json({ ok: true, user: { first_name: 'No id' } }) } },
    }),
    error => error.code === 'identity_resolution_failed' && error.status === 502,
  );
});

test('identity resolver preserves upstream 401 and 403 auth status', async () => {
  for (const status of [401, 403]) {
    await assert.rejects(
      resolveAuthenticatedUser({
        request: request('signed'),
        env: { CIAO_WEB_API: { fetch: async () => json({ ok: false, error: 'auth_rejected' }, status) } },
      }),
      error => error.status === status,
    );
  }
});

test('identity resolver supports observed nesting and safe display fallback', async () => {
  const user = await resolveAuthenticatedUser({
    request: request('signed'),
    env: { CIAO_WEB_API: { fetch: async () => json({ ok: true, state: { user: { id: '77' } } }) } },
  });
  assert.deepEqual(user, { userId:'telegram:77', displayName:'Участник', username:null });
});
