import test from 'node:test';
import assert from 'node:assert/strict';

async function clientModule() {
  try {
    return await import('../src/v23.3/data-client.mjs');
  } catch {
    return {};
  }
}

test('v23.3 standings client sends canonical competition and Telegram auth', async () => {
  const { loadCompetitionStandings } = await clientModule();
  assert.equal(typeof loadCompetitionStandings, 'function');

  let request = null;
  const data = await loadCompetitionStandings('ucl', {
    initData: 'tg-init-data',
    fetchImpl: async (url, options) => {
      request = { url: String(url), options };
      return Response.json({
        ok: true,
        data: {
          competition: 'ucl',
          provider: 'bsd-v2',
          rows: [{ position: 1, team: { name: 'Реал Мадрид' }, points: 19 }],
        },
      });
    },
  });

  assert.equal(request.url, '/api/v23.3/standings?competition=ucl');
  assert.equal(request.options.method, 'GET');
  assert.equal(new Headers(request.options.headers).get('x-telegram-init-data'), 'tg-init-data');
  assert.equal(data.competition, 'ucl');
  assert.equal(data.rows[0].team.name, 'Реал Мадрид');
});

test('v23.3 match center client encodes canonical match id and preserves safe API errors', async () => {
  const { loadMatchCenterSnapshot } = await clientModule();
  assert.equal(typeof loadMatchCenterSnapshot, 'function');

  let requestedUrl = '';
  await assert.rejects(
    loadMatchCenterSnapshot('ucl', 'ucl:601024', {
      initData: 'tg-init-data',
      fetchImpl: async url => {
        requestedUrl = String(url);
        return Response.json(
          { ok: false, error: 'match_center_upstream_failed', upstream_stage: 'event' },
          { status: 502 },
        );
      },
    }),
    error => {
      assert.equal(error.code, 'match_center_upstream_failed');
      assert.equal(error.status, 502);
      assert.equal(error.payload.upstream_stage, 'event');
      return true;
    },
  );

  assert.equal(
    requestedUrl,
    '/api/v23.3/match-center?competition=ucl&match_id=ucl%3A601024',
  );
});

test('v23.3 data client fails locally when Telegram auth is missing', async () => {
  const { loadCompetitionStandings, loadMatchCenterSnapshot } = await clientModule();
  assert.equal(typeof loadCompetitionStandings, 'function');
  assert.equal(typeof loadMatchCenterSnapshot, 'function');

  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return Response.json({ ok: true, data: {} });
  };

  await assert.rejects(
    loadCompetitionStandings('ucl', { initData: '', fetchImpl }),
    error => error?.code === 'telegram_auth_required',
  );
  await assert.rejects(
    loadMatchCenterSnapshot('ucl', 'ucl:601024', { initData: '', fetchImpl }),
    error => error?.code === 'telegram_auth_required',
  );
  assert.equal(calls, 0);
});
