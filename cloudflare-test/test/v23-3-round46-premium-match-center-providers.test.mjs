import test from 'node:test';
import assert from 'node:assert/strict';
import { adaptBsdMatchCenterSections } from '../src/v23.3/bsd-match-center-adapter.mjs';
import { normalizeSerieALegacyMatchCenter } from '../src/v23.3/serie-a-match-center-legacy-normalizer.mjs';
import { adaptSerieALegacyMatchCenter } from '../src/v23.3/serie-a-match-center-adapter.mjs';
import { loadSerieAMatchCenterBase } from '../src/v23.3/serie-a-match-center-provider.mjs';

const richGoal = {
  type:'goal',
  minute:45,
  added_time:2,
  is_home:true,
  player:{ name:'Marco Rossi' },
  assist:{ name:'Luca Assist' },
  home_score:2,
  away_score:1,
  goal_kind:'penalty',
};

const ownGoal = {
  type:'goal',
  minute:61,
  is_home:false,
  player:{ name:'Paolo Neri' },
  home_score:2,
  away_score:2,
  own_goal:true,
};

const richShots = [
  {
    side:'home', x:78, y:44, minute:45, added_time:2,
    player:{ name:'Marco Rossi' }, assist:{ name:'Luca Assist' },
    xg:0.78, outcome:'goal', situation:'penalty', body_part:'right_foot', goal_kind:'penalty',
  },
  {
    is_home:false, pos:{ x:64, y:31 }, minute:72,
    player_name:'Away Shooter', xg:0.18, result:'saved', play_pattern:'open_play', body_part:'head',
  },
];

const richLineups = {
  home:{
    formation:'4-3-3',
    coach:{ name:'Home Coach' },
    players:[
      { id:1, short_name:'Keeper', position:'GK', number:1, x:50, y:8, grid:'1:1' },
      { id:2, short_name:'Defender', position:'DF', number:4, grid:'2:2' },
    ],
    substitutes:[{ id:12, short_name:'Bench', position:'MF', number:12 }],
  },
  away:{ formation:'4-4-2', coach_name:'Away Coach', players:[], substitutes:[] },
};

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers:{ 'content-type':'application/json' },
  });
}

test('BSD adapter preserves rich goal qualifiers, detailed shots and lineup placement', () => {
  const result = adaptBsdMatchCenterSections({
    statistics:{ home:{ expected_goals:1.7 }, away:{ expected_goals:0.9 } },
    incidents:[richGoal, ownGoal],
    shotmap:richShots,
    lineups:richLineups,
  });

  assert.equal(result.events[0].player, 'Marco Rossi');
  assert.equal(result.events[0].goalKind, 'penalty');
  assert.equal(result.events[1].goalKind, 'own_goal');
  assert.equal(result.stats.shots.length, 2);
  assert.equal(result.stats.shots[0].outcome, 'goal');
  assert.equal(result.stats.shots[0].situation, 'penalty');
  assert.equal(result.stats.shots[1].player, 'Away Shooter');
  assert.equal(result.stats.shots[1].outcome, 'saved');
  assert.equal(result.lineups.home.coach, 'Home Coach');
  assert.equal(result.lineups.away.coach, 'Away Coach');
  assert.equal(result.lineups.home.starters[0].x, 50);
  assert.equal(result.lineups.home.starters[1].grid, '2:2');
});

test('Serie A legacy boundary emits the same rich canonical semantics and hero goals', () => {
  const normalized = normalizeSerieALegacyMatchCenter({
    match:{
      id:900,
      status:'finished',
      home_score:2,
      away_score:2,
      home_team:{ id:10, name:'Home', logo:'home.png' },
      away_team:{ id:20, name:'Away', logo:'away.png' },
    },
    stats:{
      stats:{ home:{ expected_goals:1.7 }, away:{ expected_goals:0.9 } },
      shotmap:richShots,
    },
    incidents:{ incidents:[richGoal, ownGoal] },
    lineups:{ lineups:richLineups },
  });
  const result = adaptSerieALegacyMatchCenter(normalized);

  assert.equal(result.events[0].player, 'Marco Rossi');
  assert.equal(result.events[0].goalKind, 'penalty');
  assert.equal(result.events[1].goalKind, 'own_goal');
  assert.equal(result.stats.shots.length, 2);
  assert.equal(result.stats.shots[1].outcome, 'saved');
  assert.equal(result.lineups.home.coach, 'Home Coach');
  assert.equal(result.lineups.home.starters[0].x, 50);
  assert.equal(result.lineups.home.starters[1].grid, '2:2');

  assert.equal(result.base.goals.home.length, 1);
  assert.equal(result.base.goals.home[0].minute, 45);
  assert.equal(result.base.goals.home[0].addedTime, 2);
  assert.equal(result.base.goals.home[0].kind, 'penalty');
  assert.equal(result.base.goals.away[0].kind, 'own_goal');
});

test('finished Serie A base enriches hero scorers while scheduled base stays summary-only', async () => {
  const finishedCalls = [];
  const finishedEnv = {
    CIAO_WEB_API:{
      fetch:async req => {
        const url = new URL(req.url);
        const body = await req.clone().json();
        finishedCalls.push({ path:url.pathname, body });
        if (url.pathname.endsWith('summary-fast-v2')) {
          return json({
            ok:true,
            match:{
              id:900,
              status:'finished',
              home_score:2,
              away_score:1,
              home:{ id:10, name:'Home' },
              away:{ id:20, name:'Away' },
            },
          });
        }
        return json({
          ok:true,
          match:{
            id:900,
            status:'finished',
            home_score:2,
            away_score:1,
            home:{ id:10, name:'Home' },
            away:{ id:20, name:'Away' },
          },
          incidents:{ incidents:[richGoal] },
        });
      },
    },
  };
  const request = new Request('https://test.local/api/v23.3/match-center');
  const finished = await loadSerieAMatchCenterBase({
    request,
    env:finishedEnv,
    initData:'signed-user',
    matchId:'serie_a:900',
  });

  assert.equal(finished.match.goals.home.length, 1);
  assert.equal(finished.match.goals.home[0].kind, 'penalty');
  assert.equal(finishedCalls.length, 2);
  assert.deepEqual(finishedCalls[1].body.sections, ['incidents']);

  const scheduledCalls = [];
  const scheduledEnv = {
    CIAO_WEB_API:{
      fetch:async req => {
        const url = new URL(req.url);
        const body = await req.clone().json();
        scheduledCalls.push({ path:url.pathname, body });
        return json({
          ok:true,
          match:{
            id:901,
            status:'scheduled',
            home:{ id:10, name:'Home' },
            away:{ id:20, name:'Away' },
          },
        });
      },
    },
  };
  const scheduled = await loadSerieAMatchCenterBase({
    request,
    env:scheduledEnv,
    initData:'signed-user',
    matchId:'serie_a:901',
  });
  assert.deepEqual(scheduled.match.goals, { home:[], away:[] });
  assert.equal(scheduledCalls.length, 1);
});
