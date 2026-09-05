import test from 'node:test';
import assert from 'node:assert/strict';

import { fetchBsdMatchCenterSection } from '../src/v23.2/bsd-provider.mjs';

function json(payload, status = 200) {
  return Response.json(payload, { status });
}

function fetcher(requests) {
  return async url => {
    const value = String(url);
    requests.push(value);
    if (value.includes('/api/v2/leagues/?')) {
      return json({ count:1, results:[{ id:7, name:'Champions League' }] });
    }
    if (value.endsWith('/api/v2/leagues/7/season/')) {
      return json({ id:1800, name:'Champions League 2026/27', year:2026, is_current:true });
    }
    if (value.endsWith('/api/v2/events/601024/')) {
      return json({
        id:601024,
        league:{ id:7, name:'Champions League' },
        season:{ id:1800 },
        home_team:{ id:57, name:'Inter', country_code:'IT' },
        away_team:{ id:77, name:'Real Madrid', country_code:'ES' },
        event_date:'2026-09-08T19:00:00+00:00',
        status:'finished',
        home_score:2,
        away_score:1,
        venue:{ name:'San Siro', city:'Milano' },
      });
    }
    if (value.endsWith('/api/v2/events/601024/stats/')) {
      return json({
        stats:{
          home:{ expected_goals:1.74, ball_possession:55, total_shots:14, shots_on_target:6 },
          away:{ expected_goals:1.03, ball_possession:45, total_shots:9, shots_on_target:4 },
        },
      });
    }
    if (value.endsWith('/api/v2/events/601024/prediction/')) {
      return json({ markets:{ match_result:{ prob_home:.51, prob_draw:.25, prob_away:.24 } } });
    }
    if (value.endsWith('/api/v2/events/601024/incidents/')) {
      return json({ incidents:[
        { type:'yellow_card', minute:22, is_home:false, player:{ name:'A. Player' } },
        { type:'goal', minute:37, is_home:true, player:{ name:'Lautaro' }, home_score:1, away_score:0 },
        { type:'substitution', minute:61, is_home:false, player_in:{ name:'Brahim' }, player_out:{ name:'Rodrygo' } },
        { type:'goal', minute:78, is_home:false, player:{ name:'Mbappe' }, home_score:1, away_score:1 },
        { type:'var', minute:84, is_home:true, player:{ name:'Lautaro' }, var_result:'goal_confirmed' },
      ] });
    }
    if (value.endsWith('/api/v2/events/601024/player-stats/')) {
      return json({ player_stats:[
        { player_id:10, name:'Lautaro', team_id:57, team_name:'Inter', rating:8.8, minutes_played:90 },
        { player_id:9, name:'Mbappe', team_id:77, team_name:'Real Madrid', rating:8.4, minutes_played:90 },
      ] });
    }
    throw new Error(`unexpected URL ${value}`);
  };
}

test('Round 50 BSD Overview fetches ratings/incidents and derives best player plus latest important events', async () => {
  const requests = [];
  const result = await fetchBsdMatchCenterSection({
    competition:'ucl',
    matchId:'ucl:601024',
    section:'overview',
    apiKey:'test-key',
    fetchImpl:fetcher(requests),
  });

  assert.equal(requests.some(value => value.endsWith('/events/601024/player-stats/')), true);
  assert.equal(requests.some(value => value.endsWith('/events/601024/incidents/')), true);
  assert.equal(result.available, true);
  assert.equal(result.data.summaryStats.home.xg, 1.74);
  assert.equal(result.data.bestPlayer.name, 'Lautaro');
  assert.equal(result.data.bestPlayer.teamName, 'Inter');
  assert.equal(result.data.bestPlayer.rating, 8.8);
  assert.deepEqual(result.data.recentEvents.map(event => event.minute), [37, 61, 78, 84]);
  assert.equal(result.data.recentEvents.at(-1).type, 'var');
});
