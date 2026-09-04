import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { adaptSerieALegacyMatchCenter } from '../src/v23.3/serie-a-match-center-adapter.mjs';
import { evaluateSerieAParity } from '../src/v23.3/match-center-parity.mjs';
import { readSerieALegacyMatchCenterData } from '../src/v23.3/serie-a-legacy-bridge.mjs';

function richLegacyFixture() {
  return {
    match:{
      id:77,
      competition:'serie_a',
      kickoff_at:'2026-09-20T18:00:00Z',
      status:'live',
      minute:67,
      home_score:2,
      away_score:1,
      home:{ id:1, name:'Интер', logo_url:'https://img.test/inter.png' },
      away:{ id:2, name:'Ювентус', logo_url:'https://img.test/juve.png' },
      round:4,
      stage:'Регулярный сезон',
    },
    overview_meta:{
      venue:{ name:'San Siro', city:'Milano', capacity:75817 },
      referee:{ name:'Daniele Orsato' },
      form:{ home:['W','W','D','L','W'], away:['D','W','W','L','D'] },
      prediction:{ home_score:2, away_score:1 },
      prediction_split:{ home:48, draw:27, away:25 },
      momentum:[
        { minute:15, home:62, away:38 },
        { minute:30, home:44, away:56 },
      ],
      shot_map:[
        { side:'home', x:72, y:45, xg:0.31 },
        { side:'away', x:28, y:59, xg:0.12 },
      ],
    },
    stats:{
      stats:{
        home:{ xg:1.83, possession:54, shots:14, shotsOnTarget:6, corners:5, fouls:9 },
        away:{ xg:0.91, possession:46, shots:9, shotsOnTarget:4, corners:3, fouls:12 },
      },
    },
    incidents:{
      incidents:[
        { type:'goal', minute:11, side:'home', player:'Lautaro', home_score:1, away_score:0 },
        { type:'yellow_card', minute:18, side:'away', player:'Locatelli', reason:'Фол' },
      ],
    },
    lineups:{
      lineups:{
        home:{
          formation:'3-5-2',
          starters:[{ id:10, name:'Lautaro', position:'FW', number:10 }],
          substitutes:[{ id:16, name:'Frattesi', position:'MF', number:16 }],
        },
        away:{
          formation:'4-3-3',
          starters:[{ id:9, name:'Vlahovic', position:'FW', number:9 }],
          substitutes:[{ id:7, name:'Chiesa', position:'FW', number:7 }],
        },
      },
    },
    player_stats:{
      player_stats:[
        { player_id:10, name:'Lautaro', team_name:'Интер', rating:8.4, minutes:90, goals:1, assists:1, xg:0.82, xa:0.34, shots:4, key_passes:3 },
        { player_id:9, name:'Vlahovic', team_name:'Ювентус', rating:7.1, minutes:90, goals:1, assists:0, xg:0.65, xa:0.1, shots:3, key_passes:1 },
      ],
    },
    capabilities:{ navigation:true, live:true },
  };
}

test('Round 18 adapts a rich Serie A legacy fixture into every canonical Match Center section', () => {
  const canonical = adaptSerieALegacyMatchCenter(richLegacyFixture());

  assert.equal(canonical.base.competition, 'serie_a');
  assert.equal(canonical.base.matchId, 'serie_a:77');
  assert.equal(canonical.base.status, 'live');
  assert.equal(canonical.base.minute, 67);
  assert.equal(canonical.base.homeScore, 2);
  assert.equal(canonical.base.awayScore, 1);
  assert.equal(canonical.coverage.overview, true);
  assert.equal(canonical.coverage.stats, true);
  assert.equal(canonical.coverage.events, true);
  assert.equal(canonical.coverage.lineups, true);
  assert.equal(canonical.coverage.players, true);
  assert.equal(canonical.coverage.momentum, true);
  assert.equal(canonical.coverage.shotmap, true);
  assert.equal(canonical.overview.venue.name, 'San Siro');
  assert.equal(canonical.overview.referee.name, 'Daniele Orsato');
  assert.deepEqual(canonical.overview.form.home, ['W','W','D','L','W']);
  assert.equal(canonical.overview.prediction.homeScore, 2);
  assert.equal(canonical.overview.predictionSplit.home, 48);
  assert.equal(canonical.stats.home.xg, 1.83);
  assert.equal(canonical.events[0].type, 'goal');
  assert.equal(canonical.lineups.home.formation, '3-5-2');
  assert.equal(canonical.players[0].rating, 8.4);
  assert.equal(canonical.players[0].keyPasses, 3);
});

test('Round 18 legacy bridge reads Match Center blocks without mutating or switching routing', () => {
  const fixture = richLegacyFixture();
  const wrapped = { data:{ match_center:fixture } };
  const read = readSerieALegacyMatchCenterData(wrapped);

  assert.equal(read.match, fixture.match);
  assert.equal(read.overview_meta, fixture.overview_meta);
  assert.equal(read.stats, fixture.stats);
  assert.equal(read.incidents, fixture.incidents);
  assert.equal(read.lineups, fixture.lineups);
  assert.equal(read.player_stats, fixture.player_stats);
  assert.equal(read.capabilities, fixture.capabilities);
  assert.equal(Object.isFrozen(read), true);
});

test('Round 18 Serie A parity gate explicitly covers every legacy capability', () => {
  const legacy = richLegacyFixture();
  const canonical = adaptSerieALegacyMatchCenter(legacy);
  const result = evaluateSerieAParity(legacy, canonical);

  assert.equal(result.passed, true);
  assert.deepEqual(result.missing, []);
  assert.deepEqual(result.checks, {
    hero:true,
    form:true,
    matchInfo:true,
    predictions:true,
    momentum:true,
    shotmap:true,
    stats:true,
    events:true,
    lineups:true,
    players:true,
    navigation:true,
    live:true,
  });
});

test('Round 18 Serie A parity gate fails when legacy blocks are missing instead of claiming parity', () => {
  const legacy = richLegacyFixture();
  legacy.player_stats = null;
  legacy.overview_meta.shot_map = null;
  legacy.capabilities.live = false;
  const canonical = adaptSerieALegacyMatchCenter(legacy);
  const result = evaluateSerieAParity(legacy, canonical);

  assert.equal(result.passed, false);
  assert.ok(result.missing.includes('players'));
  assert.ok(result.missing.includes('shotmap'));
  assert.ok(result.missing.includes('live'));
});

test('Round 18 source guard keeps Serie A delegated to the proven legacy Match Center', async () => {
  const core = await readFile(new URL('../src/v23.3/match-center-core.mjs', import.meta.url), 'utf8');
  const homePatch = await readFile(new URL('../scripts/home-v23-3-source-patch.mjs', import.meta.url), 'utf8');

  assert.match(core, /function delegateSerieA\(/);
  assert.match(core, /payload\?\.competition === 'serie_a'/);
  assert.match(core, /return delegateSerieA\(payload, root\) \? 'legacy'/);
  assert.match(homePatch, /openMatchCenter\(legacyId\)/);
  assert.doesNotMatch(homePatch, /openMatchCenter\s*=\s*[^;]*CiaoV233MatchCenter/);
});
