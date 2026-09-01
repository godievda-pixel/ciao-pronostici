import test from 'node:test';
import assert from 'node:assert/strict';

const {
  resolveTelegramInitData,
  loadCompetitionMatches,
} = await import('../src/v23.2/data-client.mjs');

test('resolves Telegram initData from WebApp without reading user-specific globals', () => {
  assert.equal(resolveTelegramInitData({
    Telegram: { WebApp: { initData: 'signed-init-data' } },
    initData: 'legacy-global-should-not-win',
  }), 'signed-init-data');

  assert.equal(resolveTelegramInitData({ Telegram: { WebApp: { initData: '' } } }), '');
});

test('loads one competition through the TEST-only v23.2 route with Telegram auth', async () => {
  const requests = [];
  const fetchImpl = async (url, options) => {
    requests.push({ url: String(url), options });
    return Response.json({
      ok: true,
      data: {
        competition: 'serie_a',
        currentRound: 3,
        rounds: [],
        matches: [{ matchId: 'serie_a:777' }],
      },
    });
  };

  const data = await loadCompetitionMatches('serie_a', {
    initData: 'tg-init-data',
    fetchImpl,
  });

  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, '/api/v23.2/matches?competition=serie_a');
  assert.equal(requests[0].options.method, 'GET');
  assert.equal(requests[0].options.headers['x-telegram-init-data'], 'tg-init-data');
  assert.equal(data.matches[0].matchId, 'serie_a:777');
});

test('passes a bounded date range to external competition routes', async () => {
  const requests = [];
  const fetchImpl = async (url, options) => {
    requests.push({ url: String(url), options });
    return Response.json({
      ok: true,
      data: {
        competition: 'ucl',
        matches: [],
      },
    });
  };

  await loadCompetitionMatches('ucl', {
    from: '2026-09-01',
    to: '2026-12-31',
    initData: 'tg-init-data',
    fetchImpl,
  });

  assert.equal(
    requests[0].url,
    '/api/v23.2/matches?competition=ucl&from=2026-09-01&to=2026-12-31',
  );
});

test('client fails locally when Telegram auth is unavailable', async () => {
  let calls = 0;
  await assert.rejects(
    loadCompetitionMatches('serie_a', {
      initData: '',
      fetchImpl: async () => {
        calls += 1;
        return Response.json({ ok: true });
      },
    }),
    error => error?.code === 'telegram_auth_required',
  );
  assert.equal(calls, 0);
});

test('client preserves API status and payload for competition-not-wired errors', async () => {
  await assert.rejects(
    loadCompetitionMatches('ucl', {
      initData: 'tg-init-data',
      fetchImpl: async () => Response.json(
        { ok: false, error: 'competition_not_wired', competition: 'ucl' },
        { status: 501 },
      ),
    }),
    error => (
      error?.status === 501
      && error?.code === 'competition_not_wired'
      && error?.payload?.competition === 'ucl'
    ),
  );
});
