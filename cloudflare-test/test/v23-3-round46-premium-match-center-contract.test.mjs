import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCanonicalBase } from '../src/v23.3/match-center-contract.mjs';
import {
  canonicalMatchCenterBase,
  canonicalStatsSection,
  canonicalEventsSection,
  canonicalLineupsSection,
} from '../src/v23.3/match-center-sections.mjs';

test('Premium Match Center base preserves canonical goal summaries additively', () => {
  const input = {
    competition:'serie_a',
    matchId:'serie_a:100',
    status:'finished',
    kickoffAt:'2026-09-05T18:00:00Z',
    homeTeam:{ id:'1', name:'Home', crestUrl:'https://cdn/home.png' },
    awayTeam:{ id:'2', name:'Away', crestUrl:'https://cdn/away.png' },
    score:{ home:2, away:1 },
    goals:{
      home:[
        { player:'Marco Rossi', minute:34, kind:'penalty', scoreAfter:{ home:1, away:0 } },
        { player:'Luca Bianchi', minute:45, addedTime:2, kind:'open_play', scoreAfter:{ home:2, away:1 } },
      ],
      away:[{ player:'Paolo Neri', minute:41, kind:'own_goal', scoreAfter:{ home:1, away:1 } }],
    },
    coverage:{ overview:true, stats:true, events:true, lineups:true, players:true },
  };

  const normalized = normalizeCanonicalBase(input, 'serie_a', 'serie_a:100');
  assert.deepEqual(normalized.goals.home[0], {
    player:'Marco Rossi',
    minute:34,
    addedTime:null,
    kind:'penalty',
    scoreAfter:{ home:1, away:0 },
  });
  assert.equal(normalized.goals.home[1].addedTime, 2);
  assert.equal(normalized.goals.away[0].kind, 'own_goal');

  const sectionBase = canonicalMatchCenterBase({ ...input, homeScore:2, awayScore:1 }, input.coverage);
  assert.equal(sectionBase.goals.home.length, 2);
  assert.equal(sectionBase.goals.away[0].player, 'Paolo Neri');

  // Backward compatibility: existing stable fields remain available.
  assert.equal(normalized.homeTeam.name, 'Home');
  assert.deepEqual(normalized.score, { home:2, away:1 });
});

test('Premium Match Center canonical events preserve goal/card/VAR semantics', () => {
  const events = canonicalEventsSection([
    {
      type:'goal', side:'home', minute:45, addedTime:2,
      player:'Marco Rossi', assist:'Assist Man', homeScore:2, awayScore:1,
      goalKind:'penalty',
    },
    { type:'red_card', side:'away', minute:70, player:'Away Player', cardKind:'second_yellow' },
    { type:'var', side:'home', minute:73, player:'Marco Rossi', varDecision:'goal_confirmed' },
  ]);

  assert.equal(events[0].goalKind, 'penalty');
  assert.equal(events[1].cardKind, 'second_yellow');
  assert.equal(events[2].varDecision, 'goal_confirmed');
  assert.equal(events[0].addedTime, 2);
});

test('Premium Match Center Stats keeps rich shots and invalid coordinates off the pitch', () => {
  const stats = canonicalStatsSection({
    home:{ xg:1.52, shots:11, shotsOnTarget:5 },
    away:{ xg:0.71, shots:7, shotsOnTarget:2 },
    shots:[
      {
        side:'home', x:77.5, y:42.2, minute:34, player:'Marco Rossi', xg:0.76,
        outcome:'goal', situation:'penalty', bodyPart:'right_foot', goalKind:'penalty',
      },
      {
        side:'away', x:140, y:-8, minute:60, player:'Away Player', xg:0.12,
        outcome:'saved', situation:'open_play', bodyPart:'head',
      },
    ],
  });

  assert.equal(stats.shots.length, 2);
  assert.deepEqual(stats.shots[0], {
    side:'home',
    x:77.5,
    y:42.2,
    minute:34,
    addedTime:null,
    player:'Marco Rossi',
    assist:'',
    xg:0.76,
    outcome:'goal',
    situation:'penalty',
    bodyPart:'right_foot',
    goalKind:'penalty',
  });
  assert.equal(stats.shots[1].x, null);
  assert.equal(stats.shots[1].y, null);
  assert.equal(stats.shots[1].outcome, 'saved');

  // Backward-compatible aggregate keys remain unchanged.
  assert.equal(stats.home.shots, 11);
  assert.equal(stats.away.xg, 0.71);
});

test('Premium Match Center lineups preserve placement metadata and coach', () => {
  const lineups = canonicalLineupsSection({
    home:{
      formation:'4-3-3',
      coach:'Home Coach',
      starters:[
        { playerId:1, name:'Keeper', position:'GK', shirtNumber:1, x:50, y:8, grid:'1:1', starter:true },
        { playerId:2, name:'Defender', position:'DF', shirtNumber:4, grid:'2:2', starter:true },
      ],
      substitutes:[{ playerId:12, name:'Bench', position:'MF', shirtNumber:12, starter:false }],
    },
    away:{ formation:'4-4-2', coach:'Away Coach', starters:[], substitutes:[] },
  });

  assert.equal(lineups.home.coach, 'Home Coach');
  assert.equal(lineups.home.starters[0].x, 50);
  assert.equal(lineups.home.starters[0].y, 8);
  assert.equal(lineups.home.starters[0].grid, '1:1');
  assert.equal(lineups.home.starters[0].starter, true);
  assert.equal(lineups.home.substitutes[0].starter, false);
});
