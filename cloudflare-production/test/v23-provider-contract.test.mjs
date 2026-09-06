import test from 'node:test';
import assert from 'node:assert/strict';
import { createBsdModularProvider } from '../../supabase/functions/ciao-v23-api/bsd-modular-provider.mjs';

function json(value, status = 200) {
  return new Response(JSON.stringify(value), {status, headers:{'content-type':'application/json'}});
}

function makeFetch(requests) {
  return async (url, options = {}) => {
    const href = String(url);
    const parsed = new URL(href);
    requests.push({
      href,
      path: parsed.pathname,
      params: Object.fromEntries(parsed.searchParams),
      authorization: new Headers(options.headers).get('authorization'),
    });

    if (parsed.pathname.endsWith('/leagues/')) {
      return json({results:[{id:7,name:'Champions League'}], count:1});
    }
    if (parsed.pathname.endsWith('/leagues/7/season/')) {
      return json({id:2607, year:2026, is_current:true});
    }
    if (parsed.pathname.endsWith('/events/')) {
      const offset = Number(parsed.searchParams.get('offset') || 0);
      if (offset === 0) {
        return json({
          count:201,
          results:Array.from({length:200}, (_, index) => ({
            id:index + 1,
            event_date:`2026-09-${String((index % 28) + 1).padStart(2,'0')}T19:00:00Z`,
            home_team:{id:100 + index,name:`Home ${index}`},
            away_team:{id:500 + index,name:`Away ${index}`},
          })),
        });
      }
      return json({count:201, results:[{id:201, event_date:'2026-09-30T19:00:00Z'}]});
    }
    if (parsed.pathname.endsWith('/leagues/7/standings/')) {
      return json({standings:[{position:1,team:{id:57,name:'Real Madrid'},points:6}]});
    }
    if (parsed.pathname.endsWith('/teams/')) {
      return json({results:[
        {id:77,name:'Inter',country_code:'IT'},
        {id:73,name:'Juventus',country_code:'IT'},
      ], count:2});
    }
    if (parsed.pathname.endsWith('/events/1001/')) return json({id:1001,section:'overview'});
    if (parsed.pathname.endsWith('/events/1001/stats/')) return json({section:'stats'});
    if (parsed.pathname.endsWith('/events/1001/incidents/')) return json({section:'events'});
    if (parsed.pathname.endsWith('/events/1001/lineups/')) return json({section:'lineups'});
    if (parsed.pathname.endsWith('/events/1001/player-stats/')) return json({section:'players'});

    throw new Error(`unexpected BSD URL: ${href}`);
  };
}

test('raw provider resolves league/current season, paginates events and preserves provider payloads', async () => {
  const requests = [];
  const provider = createBsdModularProvider({apiKey:'server-secret', fetchImpl:makeFetch(requests)});
  const events = await provider.listMatches({competition:'ucl', from:'2026-09-01', to:'2026-09-30'});

  assert.equal(events.length, 201);
  assert.deepEqual(events.at(-1), {id:201,event_date:'2026-09-30T19:00:00Z'});
  const eventRequests = requests.filter(item => item.path.endsWith('/events/'));
  assert.equal(eventRequests.length, 2);
  assert.equal(eventRequests[0].params.league_id, '7');
  assert.equal(eventRequests[0].params.season_id, '2607');
  assert.equal(eventRequests[0].params.date_from, '2026-09-01');
  assert.equal(eventRequests[0].params.date_to, '2026-09-30');
  assert.equal(eventRequests[1].params.offset, '200');
  assert.ok(requests.every(item => item.authorization === 'Token server-secret'));
});

test('standings are returned raw and Italian team ids are a provider capability', async () => {
  const provider = createBsdModularProvider({apiKey:'server-secret', fetchImpl:makeFetch([])});
  assert.deepEqual(await provider.getStandings({competition:'ucl'}), {
    standings:[{position:1,team:{id:57,name:'Real Madrid'},points:6}],
  });
  assert.deepEqual([...await provider.listItalianTeamIds()].sort(), ['73','77']);
});

test('all five Match Center sections map to BSD paths without canonical-id parsing', async () => {
  const requests = [];
  const provider = createBsdModularProvider({apiKey:'server-secret', fetchImpl:makeFetch(requests)});
  const expected = {
    overview:'overview',
    stats:'stats',
    events:'events',
    lineups:'lineups',
    players:'players',
  };

  for (const [section, marker] of Object.entries(expected)) {
    const payload = await provider.getMatchSection({competition:'ucl', providerMatchId:'1001', section});
    assert.equal(payload.section, marker);
  }

  assert.ok(requests.some(item => item.path.endsWith('/events/1001/')));
  assert.ok(requests.some(item => item.path.endsWith('/events/1001/stats/')));
  assert.ok(requests.some(item => item.path.endsWith('/events/1001/incidents/')));
  assert.ok(requests.some(item => item.path.endsWith('/events/1001/lineups/')));
  assert.ok(requests.some(item => item.path.endsWith('/events/1001/player-stats/')));
});

test('provider object does not expose server credentials or browser-token transport', () => {
  const provider = createBsdModularProvider({apiKey:'server-secret', fetchImpl:makeFetch([])});
  assert.equal(provider.apiKey, undefined);
  assert.equal(provider.token, undefined);
  assert.equal(JSON.stringify(provider).includes('server-secret'), false);
  assert.deepEqual(Object.keys(provider).sort(), [
    'getMatchSection',
    'getStandings',
    'listItalianTeamIds',
    'listMatches',
  ]);
});
