import test from 'node:test';
import assert from 'node:assert/strict';

import { canonicalOverviewSection } from '../src/v23.3/match-center-sections.mjs';
import {
  SERIE_A_SECTION_REQUESTS,
  loadSerieAMatchCenterSection,
} from '../src/v23.3/serie-a-match-center-provider.mjs';

const richPayload = {
  ok:true,
  status:'finished',
  match:{
    id:77,
    kickoff_at:'2026-09-04T19:45:00Z',
    is_finished:true,
    home:{ id:1, name:'Дженоа' },
    away:{ id:2, name:'Комо' },
    home_score:2,
    away_score:1,
  },
  detail:{ stadium:'Luigi Ferraris', city:'Genova', referee:'Marco Guida' },
  stats:{
    stats:{
      home:{ expected_goals:1.42, ball_possession:53, total_shots:15, shots_on_target:6 },
      away:{ expected_goals:0.88, ball_possession:47, total_shots:10, shots_on_target:3 },
    },
  },
  incidents:{
    incidents:[
      { type:'yellow_card', minute:31, is_home:false, player:{ name:'Marc-Oliver Kempf' } },
      { type:'goal', minute:37, is_home:true, player:{ name:'Vitinha' }, home_score:1, away_score:0 },
      { type:'substitution', minute:74, is_home:false, player_in:{ name:'Nico Paz' }, player_out:{ name:'Lucas Da Cunha' } },
      { type:'goal', minute:84, is_home:false, player:{ name:'Nico Paz' }, home_score:1, away_score:1 },
      { type:'var', minute:88, is_home:true, player:{ name:'Vitinha' }, var_result:'confirmed' },
    ],
  },
  player_stats:{
    player_stats:[
      { player_id:101, name:'Vitinha', team_id:1, team_name:'Дженоа', rating:7.8, minutes_played:90 },
      { player_id:202, name:'Nico Paz', team_id:2, team_name:'Комо', rating:8.6, minutes_played:90 },
      { player_id:203, name:'Maximo Perrone', team_id:2, team_name:'Комо', rating:7.4, minutes_played:90 },
    ],
  },
  overview_meta:{
    form:{ home:['W','D','W','L','W'], away:['D','W','L','W','D'] },
  },
};

test('Round 50 canonical Overview preserves provider-derived best player and recent events', () => {
  const overview = canonicalOverviewSection({
    bestPlayer:{ playerId:202, name:'Nico Paz', teamName:'Комо', rating:8.6 },
    recentEvents:[
      { type:'goal', minute:84, side:'away', player:'Nico Paz', homeScore:1, awayScore:1 },
      { type:'var', minute:88, side:'home', player:'Vitinha', varDecision:'confirmed' },
    ],
  });

  assert.equal(overview.bestPlayer.name, 'Nico Paz');
  assert.equal(overview.bestPlayer.teamName, 'Комо');
  assert.equal(overview.bestPlayer.rating, 8.6);
  assert.equal(overview.recentEvents.length, 2);
  assert.equal(overview.recentEvents[0].type, 'goal');
  assert.equal(overview.recentEvents[1].varDecision, 'confirmed');
});

test('Round 50 Serie A Overview requests incidents and derives best player plus four latest real events', async () => {
  assert.ok(SERIE_A_SECTION_REQUESTS.overview.includes('incidents'));

  const requestBodies = [];
  const env = {
    CIAO_WEB_API:{
      async fetch(request) {
        const body = JSON.parse(await request.text());
        requestBodies.push({ path:new URL(request.url).pathname, body });
        return new Response(JSON.stringify(richPayload), {
          status:200,
          headers:{ 'content-type':'application/json' },
        });
      },
    },
  };

  const result = await loadSerieAMatchCenterSection({
    request:new Request('https://test.example/match'),
    env,
    initData:'test-init',
    matchId:'serie_a:77',
    section:'overview',
  });

  const richCall = requestBodies.find(call => call.path.endsWith('/ciao-match-center-fast-v3'));
  assert.ok(richCall);
  assert.ok(richCall.body.sections.includes('player_stats'));
  assert.ok(richCall.body.sections.includes('incidents'));

  assert.equal(result.data.bestPlayer.name, 'Nico Paz');
  assert.equal(result.data.bestPlayer.teamName, 'Комо');
  assert.equal(result.data.bestPlayer.rating, 8.6);
  assert.equal(result.data.recentEvents.length, 4);
  assert.deepEqual(result.data.recentEvents.map(event => event.minute), [37, 74, 84, 88]);
  assert.equal(result.data.recentEvents.at(-1).type, 'var');
});
