import test from 'node:test';
import assert from 'node:assert/strict';
import { createBsdModularProvider } from '../../supabase/functions/ciao-core-api-fast-v6/bsd-modular-provider.mjs';

function json(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers:{ 'content-type':'application/json' } });
}

function makeFetch(requests) {
  return async (url, options = {}) => {
    const href = String(url);
    requests.push({ href, authorization:new Headers(options.headers).get('authorization') });
    if (href.includes('/leagues/?')) return json({ results:[{ id:7, name:'Champions League' }] });
    if (href.includes('/leagues/7/season/')) return json({ id:2607, year:2026, is_current:true });
    if (href.includes('/teams/?')) return json({ results:[{ id:110, name:'Inter', country_code:'IT' }] });
    if (href.includes('/events/?')) return json({ results:[
      { id:1001, event_date:'2026-09-16T19:00:00Z', status:'upcoming', round_name:'League Phase', home_team:{ id:110, name:'Inter', country_code:'IT' }, away_team:{ id:359, name:'Arsenal', country_code:'GB' } },
      { id:1002, event_date:'2026-09-16T19:00:00Z', status:'upcoming', round_name:'League Phase', home_team:{ id:1, name:'Barcelona', country_code:'ES' }, away_team:{ id:2, name:'Bayern', country_code:'DE' } },
    ] });
    if (href.includes('/leagues/7/standings/')) return json({ standings:[{ position:1, team:{ id:110, name:'Inter' }, played:2, wins:2, draws:0, losses:0, goals_for:5, goals_against:1, points:6 }] });
    if (href.includes('/events/1001/stats/')) return json({ possession:{ home:55, away:45 } });
    if (href.endsWith('/events/1001/')) return json({ id:1001, status:'upcoming', home_team:{ id:110, name:'Inter' }, away_team:{ id:359, name:'Arsenal' } });
    throw new Error(`unexpected BSD URL: ${href}`);
  };
}

test('BSD modular provider filters UEFA fixtures to Italian-club matches and keeps canonical ids', async () => {
  const requests = [];
  const provider = createBsdModularProvider({ apiKey:'probe', fetchImpl:makeFetch(requests) });
  const matches = await provider.loadMatches({ competition:'ucl', from:'2026-09-01', to:'2026-10-01' });
  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, 'ucl:1001');
  assert.equal(matches[0].home.name, 'Inter');
  assert.ok(requests.every(item => item.authorization === 'Token probe'));
});

test('BSD modular provider normalizes European standings for the shared tables screen', async () => {
  const provider = createBsdModularProvider({ apiKey:'probe', fetchImpl:makeFetch([]) });
  const value = await provider.loadStandings({ competition:'ucl' });
  assert.equal(value.rows.length, 1);
  assert.deepEqual(value.rows[0], {
    position:1,
    team:{ id:110, name:'Inter', crestUrl:'https://sports.bzzoiro.com/img/team/110/?bg=transparent' },
    played:2, wins:2, draws:0, losses:0, goalsFor:5, goalsAgainst:1, goalDifference:4, points:6,
  });
});

test('BSD modular provider maps shared Match Center sections to provider endpoints', async () => {
  const requests = [];
  const provider = createBsdModularProvider({ apiKey:'probe', fetchImpl:makeFetch(requests) });
  const stats = await provider.loadMatchCenter({ competition:'ucl', matchId:'ucl:1001', section:'stats' });
  assert.deepEqual(stats, { possession:{ home:55, away:45 } });
  assert.ok(requests.some(item => item.href.includes('/events/1001/stats/')));
});
