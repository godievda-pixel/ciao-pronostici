import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.js';

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers:{ 'content-type':'application/json' },
  });
}

function request(query) {
  return new Request(`https://test.local/api/v23.3/match-center?${query}`, {
    headers:{ 'x-telegram-init-data':'signed-user' },
  });
}

function serieARichFixture() {
  return {
    match:{
      id:77,
      kickoff_at:'2026-09-20T18:00:00Z',
      status:'live',
      minute:67,
      home_score:2,
      away_score:1,
      home:{ id:1, name:'Интер', logo_url:'https://img/inter.png' },
      away:{ id:2, name:'Ювентус', logo_url:'https://img/juve.png' },
    },
    overview_meta:{ venue:{ name:'San Siro' }, referee:{ name:'Orsato' }, form:{ home:['W'], away:['D'] } },
    stats:{ stats:{ home:{ xg:1.8 }, away:{ xg:.9 } } },
    incidents:{ incidents:[{ type:'goal', minute:11, side:'home' }] },
    lineups:{ lineups:{ home:{ formation:'3-5-2', starters:[] }, away:{ formation:'4-3-3', starters:[] } } },
    player_stats:{ player_stats:[{ player_id:10, name:'Lautaro', rating:8.4 }] },
    capabilities:{ navigation:true, live:true },
  };
}

function serieAEnv() {
  const calls = [];
  const fixture = serieARichFixture();
  return {
    calls,
    env:{
      CIAO_WEB_API:{
        fetch:async req => {
          const url = new URL(req.url);
          const body = req.method === 'POST' ? await req.clone().json() : null;
          calls.push({ path:url.pathname, method:req.method, body });
          if (url.pathname === '/api/ciao-match-summary-fast-v2') {
            return json({ ok:true, ...fixture });
          }
          if (url.pathname === '/api/ciao-match-center-fast-v3') {
            return json({ ok:true, ...fixture });
          }
          return json({ ok:false, error:'unexpected_route' }, 404);
        },
      },
    },
  };
}

test('Round 39 Serie A base uses the stable data API through the Cloudflare binding and returns canonical shape', async () => {
  const { env, calls } = serieAEnv();
  const response = await worker.fetch(request('competition=serie_a&match_id=serie_a%3A77'), env, {});
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.ok, true);
  assert.equal(payload.data.competition, 'serie_a');
  assert.equal(payload.data.matchId, 'serie_a:77');
  assert.equal(payload.data.match.matchId, 'serie_a:77');
  assert.equal(payload.data.match.minute, 67);
  assert.deepEqual(payload.data.match.score, { home:2, away:1 });
  assert.deepEqual(Object.keys(payload.data.match.coverage), ['overview','stats','events','lineups','players']);
  assert.equal(calls[0].path, '/api/ciao-match-summary-fast-v2');
  assert.deepEqual(calls[0].body, { match_id:77 });
});

test('Round 39 Serie A sections are lazy data-only requests and never return legacy UI metadata', async () => {
  const { env, calls } = serieAEnv();
  const response = await worker.fetch(request('competition=serie_a&match_id=serie_a%3A77&section=events'), env, {});
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.data.section, 'events');
  assert.equal(payload.data.available, true);
  assert.deepEqual(Object.keys(payload.data.coverage), ['overview','stats','events','lineups','players']);
  assert.equal(Array.isArray(payload.data.data), true);
  assert.equal('html' in payload.data, false);
  assert.equal('event' in payload.data, false);
  assert.equal(calls[0].path, '/api/ciao-match-center-fast-v3');
  assert.equal(calls[0].body.match_id, 77);
  assert.deepEqual(calls[0].body.sections, ['incidents','lineups']);
});

test('Round 39 external Match Center response also exposes only the five canonical coverage capabilities', async () => {
  const previous = globalThis.fetch;
  globalThis.fetch = async url => {
    const href = String(url);
    if (href.includes('/leagues/?')) return json({ results:[{ id:10, name:'UEFA Champions League' }] });
    if (href.includes('/leagues/10/season/')) return json({ id:20, name:'2026/27' });
    if (href.includes('/events/77/')) return json({
      id:77,
      event_date:'2026-09-10T19:00:00Z',
      status:'live', minute:37, home_score:1, away_score:0,
      home_team:{ id:501, name:'Inter', country_code:'ITA' },
      away_team:{ id:502, name:'Arsenal', country_code:'ENG' },
      statistics:{ home:{ expected_goals:1.4 }, away:{ expected_goals:.8 } },
      incidents:[],
      lineups:{ home:{ players:[] }, away:{ players:[] } },
      player_stats:[],
    });
    return json({ results:[] });
  };
  try {
    const response = await worker.fetch(request('competition=ucl&match_id=ucl%3A77&section=stats'), { BSD_API_KEY:'test' }, {});
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.deepEqual(Object.keys(payload.data.coverage), ['overview','stats','events','lineups','players']);
  } finally {
    globalThis.fetch = previous;
  }
});
