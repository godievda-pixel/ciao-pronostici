import test from 'node:test';
import assert from 'node:assert/strict';

import { fetchBsdMatchCenterSection } from '../src/v23.2/bsd-provider.mjs';
import { renderMatchCenterOverview } from '../src/v23.3/match-center-overview.mjs';
import { renderMatchCenterStats } from '../src/v23.3/match-center-stats.mjs';
import { renderMatchCenterEvents } from '../src/v23.3/match-center-events.mjs';
import { renderMatchCenterLineups } from '../src/v23.3/match-center-lineups.mjs';

function json(payload, status = 200) {
  return Response.json(payload, { status });
}

function fixtureFetcher(requests) {
  return async url => {
    const value = String(url);
    requests.push(value);
    if (value.includes('/api/v2/leagues/?')) return json({ count:1, results:[{ id:10, name:'Coppa Italia' }] });
    if (value.endsWith('/api/v2/leagues/10/season/')) return json({ id:1810, name:'Coppa Italia 2026/27', year:2026, is_current:true });
    if (value.endsWith('/api/v2/events/901/')) {
      return json({
        id:901,
        league:{ id:10, name:'Coppa Italia' },
        season:{ id:1810 },
        home_team:{ id:1, name:'Parma', country_code:'IT' },
        away_team:{ id:2, name:'Cremonese', country_code:'IT' },
        event_date:'2026-09-01T19:00:00+00:00',
        status:'finished',
        home_score:0,
        away_score:2,
      });
    }
    if (value.endsWith('/api/v2/events/901/stats/')) {
      return json({
        stats:{
          home:{ expected_goals:.58, ball_possession:49, total_shots:9, shots_on_target:2, big_chances:1, corners:10 },
          away:{ expected_goals:1.44, ball_possession:51, total_shots:13, shots_on_target:6, big_chances:5, corners:10 },
        },
        momentum:Array.from({ length:60 }, (_, index) => ({ minute:index + 1, home:40 + (index % 20), away:60 - (index % 20) })),
        shots:[
          { player_id:11, x:88, y:47, xg:.12, type:'save', is_home:true, minute:32 },
          { player_id:22, x:84, y:55, xg:.18, type:'miss', is_home:false, minute:41 },
        ],
      });
    }
    if (value.endsWith('/api/v2/events/901/prediction/')) {
      return json({ markets:{ match_result:{ prob_home:.44, prob_draw:.29, prob_away:.27 } } });
    }
    if (value.endsWith('/api/v2/events/901/incidents/')) {
      return json({ incidents:[
        { type:'goal', minute:5, is_home:false, player_id:22, player:{ name:'Simone Lottici Tessadri' }, home_score:0, away_score:1 },
        { type:'goal', minute:41, is_home:false, player_id:23, player:{ name:'A. Ljajic' }, home_score:0, away_score:2 },
        { type:'ht', minute:45, text:'HT' },
        { type:'event', minute:45, text:'HT' },
      ] });
    }
    if (value.endsWith('/api/v2/events/901/player-stats/')) {
      return json({ player_stats:[
        { player_id:11, team_id:1, rating:8.4, minutes_played:90 },
        { player_id:22, team_id:2, rating:8.1, minutes_played:90 },
      ] });
    }
    if (value.endsWith('/api/v2/events/901/lineups/')) {
      return json({ lineups:{
        home:{ formation:'4-3-3', coach:{ name:'Carlos Cuesta' }, starters:[
          { id:11, full_name:'Adrian Bernabe', jersey_number:10, position:'M' },
          ...Array.from({ length:10 }, (_, index) => ({ id:100 + index, full_name:`Parma ${index + 2}`, jersey_number:index + 2, position:index < 3 ? 'D' : index < 7 ? 'M' : 'F' })),
        ], substitutes:[] },
        away:{ formation:'4-2-3-1', coach:{ name:'Davide Nicola' }, starters:[
          { id:22, full_name:'Simone Lottici Tessadri', jersey_number:9, position:'F' },
          ...Array.from({ length:10 }, (_, index) => ({ id:200 + index, full_name:`Cremonese ${index + 2}`, jersey_number:index + 12, position:index < 4 ? 'D' : index < 8 ? 'M' : 'F' })),
        ], substitutes:[] },
      } });
    }
    throw new Error(`unexpected URL ${value}`);
  };
}

const match = {
  competition:'coppa_italia',
  matchId:'coppa_italia:901',
  homeTeam:{ name:'Парма' },
  awayTeam:{ name:'Кремонезе' },
  kickoffAt:'2026-09-01T19:00:00Z',
  homeScore:0,
  awayScore:2,
};

test('Round 50.1 Overview keeps the reference hierarchy visible and enriches unnamed best player from lineups', async () => {
  const requests = [];
  const result = await fetchBsdMatchCenterSection({
    competition:'coppa_italia', matchId:'coppa_italia:901', section:'overview', apiKey:'test', fetchImpl:fixtureFetcher(requests),
  });

  assert.equal(requests.some(value => value.endsWith('/events/901/lineups/')), true);
  assert.equal(result.data.bestPlayer.name, 'Adrian Bernabe');
  assert.equal(result.data.bestPlayer.teamName, 'Parma');
  assert.equal(result.data.bestPlayer.rating, 8.4);

  const html = renderMatchCenterOverview(result.data, { match });
  const key = html.indexOf('data-cw250-key-indicators');
  const form = html.indexOf('data-cw233-mc-overview-region="form"');
  const info = html.indexOf('data-cw233-mc-overview-region="context"');
  const prediction = html.indexOf('data-cw233-mc-overview-region="prediction"');
  assert.ok(key >= 0 && key < form && form < info && info < prediction);
  assert.match(html, /data-cw251-overview-form-unavailable/);
  assert.match(html, /data-cw251-overview-context-unavailable/);
  assert.doesNotMatch(html, /<strong>Игрок<\/strong>/);
});

test('Round 50.1 Stats removes duplicate summary, compacts pressure and fixes shot names/outcomes/display direction', async () => {
  const requests = [];
  const result = await fetchBsdMatchCenterSection({
    competition:'coppa_italia', matchId:'coppa_italia:901', section:'stats', apiKey:'test', fetchImpl:fixtureFetcher(requests),
  });

  assert.equal(requests.some(value => value.endsWith('/events/901/player-stats/')), true);
  assert.equal(requests.some(value => value.endsWith('/events/901/lineups/')), true);
  assert.equal(result.data.shots[0].player, 'Adrian Bernabe');
  assert.equal(result.data.shots[0].outcome, 'saved');
  assert.equal(result.data.shots[1].player, 'Simone Lottici Tessadri');
  assert.equal(result.data.shots[1].outcome, 'off_target');

  const html = renderMatchCenterStats(result.data, { match });
  assert.doesNotMatch(html, /cw233-mc-key-metrics/);
  assert.match(html, /data-cw251-mc-pressure-chart/);
  assert.ok((html.match(/data-cw251-mc-pressure-sample/g) || []).length <= 24);
  assert.match(html, /Adrian Bernabe/);
  assert.match(html, /Simone Lottici Tessadri/);
  assert.match(html, /--shot-x:47%;--shot-y:88%/);
  assert.match(html, /--shot-x:45%;--shot-y:16%/);
});

test('Round 50.1 Events treats provider HT variants as one period and collapses wide mobile timeline earlier', () => {
  const html = renderMatchCenterEvents([
    { type:'goal', minute:5, side:'away', player:'S. L. Tessadri', homeScore:0, awayScore:1 },
    { type:'goal', minute:41, side:'away', player:'A. Ljajic', homeScore:0, awayScore:2 },
    { type:'ht', minute:45, text:'HT' },
    { type:'event', minute:45, text:'HT' },
  ], { match });

  assert.equal((html.match(/data-cw250-mc-period/g) || []).length, 1);
  assert.doesNotMatch(html, />Событие</);
  assert.match(html, /@media\(max-width:520px\)/);
});

test('Round 50.1 Lineups restores shirt numbers, official heading and real player micro-badges', async () => {
  const requests = [];
  const result = await fetchBsdMatchCenterSection({
    competition:'coppa_italia', matchId:'coppa_italia:901', section:'lineups', apiKey:'test', fetchImpl:fixtureFetcher(requests),
  });

  assert.equal(requests.some(value => value.endsWith('/events/901/player-stats/')), true);
  assert.equal(requests.some(value => value.endsWith('/events/901/incidents/')), true);
  assert.equal(result.data.home.starters[0].shirtNumber, 10);
  assert.equal(result.data.home.starters[0].rating, 8.4);

  const html = renderMatchCenterLineups(result.data, { match });
  assert.match(html, /Официальные составы/);
  assert.match(html, />10</);
  assert.match(html, /Adrian Bernabe/);
  assert.match(html, /data-cw251-mc-pitch-badge/);
  assert.match(html, /8\.4/);
  assert.doesNotMatch(html, /font-size:6\.5px/);
});
