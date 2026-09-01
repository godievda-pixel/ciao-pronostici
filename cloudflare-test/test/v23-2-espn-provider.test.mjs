import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildEspnScoreboardUrl,
  fetchItalianEspnTeamIds,
  fetchEspnMatches,
} from '../src/v23.2/espn-provider.mjs';

const jsonResponse = value => Response.json(value);

function teamPayload(ids) {
  return {
    sports: [{ leagues: [{ teams: ids.map(id => ({ team: { id: String(id) } })) }] }],
  };
}

function event(id, homeId, awayId) {
  return {
    id: String(id),
    date: '2026-09-16T19:00:00Z',
    season: { year: 2026, slug: 'league-phase' },
    status: { type: { state: 'pre', completed: false, name: 'STATUS_SCHEDULED' } },
    competitions: [{
      id: String(id),
      date: '2026-09-16T19:00:00Z',
      altGameNote: 'UEFA Champions League, League Phase',
      status: { type: { state: 'pre', completed: false, name: 'STATUS_SCHEDULED' } },
      competitors: [
        { id: String(homeId), homeAway: 'home', team: { id: String(homeId), displayName: 'Home' } },
        { id: String(awayId), homeAway: 'away', team: { id: String(awayId), displayName: 'Away' } },
      ],
    }],
  };
}

test('builds bounded ESPN scoreboard URL from canonical competition and ISO dates', () => {
  assert.equal(
    buildEspnScoreboardUrl('ucl', '2026-09-01', '2026-10-31'),
    'https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.champions/scoreboard?dates=20260901-20261031',
  );
  assert.throws(
    () => buildEspnScoreboardUrl('ucl', '2026-01-01', '2027-12-31'),
    /range/i,
  );
});

test('Italian team set is the dynamic union of Serie A and Serie B ESPN ids', async () => {
  const urls = [];
  const fetchImpl = async url => {
    urls.push(String(url));
    if (String(url).includes('/ita.1/teams')) return jsonResponse(teamPayload([10, 20]));
    if (String(url).includes('/ita.2/teams')) return jsonResponse(teamPayload([20, 30]));
    throw new Error('unexpected URL');
  };

  const ids = await fetchItalianEspnTeamIds({ fetchImpl });
  assert.deepEqual([...ids].sort(), ['10', '20', '30']);
  assert.equal(urls.length, 2);
});

test('UEFA provider loads scoreboard plus Italian team ids and filters non-Italian matches', async () => {
  const urls = [];
  const fetchImpl = async url => {
    const value = String(url);
    urls.push(value);
    if (value.includes('/ita.1/teams')) return jsonResponse(teamPayload([110]));
    if (value.includes('/ita.2/teams')) return jsonResponse(teamPayload([103]));
    if (value.includes('/uefa.champions/scoreboard')) {
      return jsonResponse({
        leagues: [{ name: 'UEFA Champions League' }],
        events: [event(1, 110, 359), event(2, 86, 132)],
      });
    }
    throw new Error('unexpected URL');
  };

  const matches = await fetchEspnMatches({
    competition: 'ucl',
    from: '2026-09-01',
    to: '2026-10-31',
    fetchImpl,
  });

  assert.deepEqual(matches.map(match => match.matchId), ['ucl:1']);
  assert.equal(urls.some(url => url.includes('/ita.1/teams')), true);
  assert.equal(urls.some(url => url.includes('/ita.2/teams')), true);
  assert.equal(urls.some(url => url.includes('/uefa.champions/scoreboard?dates=20260901-20261031')), true);
});

test('Coppa Italia provider fetches only its scoreboard and keeps all matches', async () => {
  const urls = [];
  const fetchImpl = async url => {
    const value = String(url);
    urls.push(value);
    return jsonResponse({
      leagues: [{ name: 'Coppa Italia' }],
      events: [event(9, 110, 103)],
    });
  };

  const matches = await fetchEspnMatches({
    competition: 'coppa_italia',
    from: '2026-12-01',
    to: '2026-12-31',
    fetchImpl,
  });

  assert.deepEqual(matches.map(match => match.matchId), ['coppa_italia:9']);
  assert.equal(urls.length, 1);
  assert.match(urls[0], /ita\.coppa_italia\/scoreboard/);
});

test('provider surfaces upstream HTTP failures instead of returning empty success', async () => {
  await assert.rejects(
    fetchEspnMatches({
      competition: 'coppa_italia',
      from: '2026-12-01',
      to: '2026-12-31',
      fetchImpl: async () => new Response('bad gateway', { status: 503 }),
    }),
    /503/,
  );
});
