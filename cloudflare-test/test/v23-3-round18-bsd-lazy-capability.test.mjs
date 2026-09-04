import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchBsdMatchCenterBase } from '../src/v23.2/bsd-provider.mjs';

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers:{ 'content-type':'application/json' },
  });
}

test('Round 18 BSD base advertises dedicated Match Center sections for lazy loading even when event detail is static-only', async () => {
  const event = {
    id:77,
    league:{ id:10, name:'UEFA Champions League' },
    season:{ id:20, name:'2026/27' },
    event_date:'2026-09-03T19:00:00Z',
    status:'finished',
    home_score:5,
    away_score:2,
    home_team:{ id:501, name:'Inter', country_code:'ITA' },
    away_team:{ id:502, name:'Arsenal', country_code:'ENG' },
  };
  const fetchImpl = async url => {
    const href = String(url);
    if (href.includes('/leagues/?')) return jsonResponse({ results:[{ id:10, name:'UEFA Champions League' }] });
    if (href.includes('/leagues/10/season/')) return jsonResponse({ id:20, name:'2026/27' });
    if (href.includes('/events/77/')) return jsonResponse(event);
    return jsonResponse({ results:[] });
  };

  const base = await fetchBsdMatchCenterBase({
    competition:'ucl',
    matchId:'ucl:77',
    apiKey:'test',
    fetchImpl,
  });

  assert.deepEqual(base.coverage, {
    overview:true,
    stats:true,
    events:true,
    lineups:true,
    players:true,
    momentum:false,
    shotmap:false,
  });
});