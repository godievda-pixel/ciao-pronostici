import test from 'node:test';
import assert from 'node:assert/strict';

import { adaptSerieALegacyMatchCenter } from '../src/v23.3/serie-a-match-center-adapter.mjs';
import { normalizeSerieALegacyMatchCenter } from '../src/v23.3/serie-a-match-center-legacy-normalizer.mjs';
import { loadSerieAMatchCenterSection } from '../src/v23.3/serie-a-match-center-provider.mjs';
import { renderMatchCenterOverview } from '../src/v23.3/match-center-overview.mjs';
import { renderMatchCenterView } from '../src/v23.3/match-center-view.mjs';

const legacyRichMatch = {
  status:'finished',
  match:{
    id:77,
    kickoff_at:'2026-09-04T19:45:00Z',
    is_finished:true,
    home:{ id:1, name:'Дженоа' },
    away:{ id:2, name:'Комо' },
    home_logo_url:'https://img.test/genoa.png',
    away_logo_url:'https://img.test/como.png',
    home_score:2,
    away_score:1,
  },
  detail:{
    stadium:'Luigi Ferraris',
    city:'Genova',
    stadium_capacity:33205,
    referee:'Marco Guida',
  },
  stats:{
    stats:{
      home:{
        expected_goals:1.42,
        ball_possession:53,
        total_shots:15,
        shots_on_target:6,
        big_chances:4,
        corner_kicks:5,
        fouls:8,
        offsides:6,
        yellow_cards:2,
        total_tackles:14,
        interceptions:9,
      },
      away:{
        expected_goals:0.88,
        ball_possession:47,
        total_shots:10,
        shots_on_target:3,
        big_chances:2,
        corner_kicks:4,
        fouls:7,
        offsides:2,
        yellow_cards:1,
        total_tackles:13,
        interceptions:3,
      },
    },
    momentum:[
      { m:12, v:24 },
      { m:33, v:-18 },
    ],
    shotmap:[
      { pos:{ x:38, y:62 }, home:true, xg:0.31 },
      { pos:{ x:72, y:48 }, home:false, xg:0.18 },
    ],
  },
  incidents:{
    incidents:[
      {
        type:'goal',
        minute:37,
        is_home:true,
        player:{ name:'Vitinha' },
        assist:{ name:'Morten Frendrup' },
        home_score:1,
        away_score:0,
      },
    ],
  },
  lineups:{
    lineups:{
      home:{
        formation:'3-5-2',
        players:[{ id:11, name:'Justin Bijlow', position:'G', shirt_number:1 }],
        substitutes:[],
      },
      away:{
        formation:'4-2-3-1',
        players:[{ id:22, name:'Jean Butez', position:'G', shirt_number:30 }],
        substitutes:[],
      },
    },
  },
  player_stats:{
    player_stats:[
      { player_id:101, name:'Vitinha', team_id:1, team_name:'Дженоа', rating:7.8, goals:1, expected_goals:0.52, minutes_played:90 },
    ],
  },
  form:{
    home:['W','D','W','L','W'],
    away:['D','W','L','W','D'],
  },
  prediction_model:{
    home_score:2,
    away_score:1,
  },
  prediction_split:{
    home:52,
    draw:27,
    away:21,
  },
};

test('Round 42 provider-boundary normalizer restores the complete legacy rich payload before the thin canonical adapter', () => {
  const normalized = normalizeSerieALegacyMatchCenter(legacyRichMatch);
  const adapted = adaptSerieALegacyMatchCenter(normalized);

  assert.equal(adapted.base.status, 'finished');
  assert.equal(adapted.base.homeScore, 2);
  assert.equal(adapted.base.awayScore, 1);
  assert.equal(adapted.base.homeTeam.crestUrl, 'https://img.test/genoa.png');
  assert.equal(adapted.base.awayTeam.crestUrl, 'https://img.test/como.png');

  assert.equal(adapted.coverage.overview, true);
  assert.equal(adapted.coverage.stats, true);
  assert.equal(adapted.coverage.events, true);
  assert.equal(adapted.coverage.lineups, true);
  assert.equal(adapted.coverage.players, true);
  assert.equal(adapted.coverage.momentum, true);
  assert.equal(adapted.coverage.shotmap, true);

  assert.deepEqual(adapted.overview.venue, {
    name:'Luigi Ferraris',
    city:'Genova',
    capacity:33205,
  });
  assert.deepEqual(adapted.overview.referee, { name:'Marco Guida' });
  assert.deepEqual(adapted.overview.form.home, ['W','D','W','L','W']);
  assert.equal(adapted.overview.prediction.homeScore, 2);
  assert.equal(adapted.overview.prediction.awayScore, 1);
  assert.deepEqual(adapted.overview.predictionSplit, { home:52, draw:27, away:21 });

  assert.equal(adapted.stats.home.xg, 1.42);
  assert.equal(adapted.stats.home.possession, 53);
  assert.equal(adapted.stats.home.shots, 15);
  assert.equal(adapted.stats.home.shotsOnTarget, 6);
  assert.equal(adapted.stats.home.bigChances, 4);
  assert.equal(adapted.stats.home.corners, 5);
  assert.equal(adapted.stats.home.tackles, 14);
  assert.equal(adapted.stats.away.xg, 0.88);
  assert.equal(adapted.stats.away.possession, 47);
  assert.equal(adapted.stats.away.shots, 10);
  assert.equal(adapted.stats.away.shotsOnTarget, 3);
  assert.equal(adapted.stats.away.bigChances, 2);
  assert.equal(adapted.stats.away.corners, 4);
  assert.equal(adapted.stats.away.tackles, 13);

  assert.equal(adapted.overview.momentum.length, 2);
  assert.equal(adapted.overview.momentum[0].minute, 12);
  assert.equal(adapted.overview.shotmap.length, 2);
  assert.equal(adapted.overview.shotmap[0].x, 38);
  assert.equal(adapted.overview.shotmap[1].side, 'away');

  assert.equal(adapted.events[0].player, 'Vitinha');
  assert.equal(adapted.events[0].assist, 'Morten Frendrup');
  assert.equal(adapted.lineups.home.starters[0].shirtNumber, 1);
  assert.equal(adapted.players[0].rating, 7.8);
});

test('Round 42 Overview provider composes normalized match stats into the canonical overview section', async () => {
  const env = {
    CIAO_WEB_API:{
      async fetch() {
        return new Response(JSON.stringify({ ok:true, ...legacyRichMatch }), {
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

  assert.equal(result.available, true);
  assert.equal(result.coverage.overview, true);
  assert.equal(result.data.summaryStats.home.xg, 1.42);
  assert.equal(result.data.summaryStats.home.shots, 15);
  assert.equal(result.data.summaryStats.away.xg, 0.88);
  assert.equal(result.data.summaryStats.away.shots, 10);
  assert.deepEqual(result.data.form.home, ['W','D','W','L','W']);
});

test('Round 42 Overview renders form and prediction data already present in the canonical section', () => {
  const html = renderMatchCenterOverview({
    venue:{ name:'Luigi Ferraris', city:'Genova', capacity:33205 },
    referee:{ name:'Marco Guida' },
    form:{ home:['W','D','W','L','W'], away:['D','W','L','W','D'] },
    prediction:{ homeScore:2, awayScore:1 },
    predictionSplit:{ home:52, draw:27, away:21 },
    summaryStats:{
      home:{ xg:1.42, shots:15 },
      away:{ xg:0.88, shots:10 },
    },
    momentum:[],
    shotmap:[],
  }, {
    coverage:{ overview:true, momentum:false, shotmap:false },
    match:{ homeTeam:{ name:'Дженоа' }, awayTeam:{ name:'Комо' } },
  });

  assert.match(html, /data-cw233-mc-overview-region="form"/);
  assert.match(html, /Форма/);
  assert.match(html, /Дженоа/);
  assert.match(html, /Комо/);
  assert.match(html, /data-cw233-mc-overview-region="prediction"/);
  assert.match(html, /Прогноз/);
  assert.match(html, /2:1/);
  assert.match(html, /52%/);
  assert.match(html, /27%/);
  assert.match(html, /21%/);
});

test('Round 42 finished canonical base shows the actual score and shared section headings are not glued together', () => {
  const html = renderMatchCenterView({
    open:true,
    phase:'ready',
    competition:'serie_a',
    matchId:'serie_a:77',
    activeTab:'stats',
    match:{
      competition:'serie_a',
      matchId:'serie_a:77',
      status:'finished',
      kickoffAt:'2026-09-04T19:45:00Z',
      homeTeam:{ name:'Дженоа', crestUrl:'https://img.test/genoa.png' },
      awayTeam:{ name:'Комо', crestUrl:'https://img.test/como.png' },
      homeScore:2,
      awayScore:1,
      coverage:{ overview:true, stats:true, events:true, lineups:true, players:true },
    },
    sections:{
      overview:null,
      stats:{ home:{ fouls:8 }, away:{ fouls:7 } },
      events:null,
      lineups:null,
      players:null,
    },
    sectionState:{
      overview:{ status:'idle', error:'' },
      stats:{ status:'ready', error:'' },
      events:{ status:'idle', error:'' },
      lineups:{ status:'idle', error:'' },
      players:{ status:'idle', error:'' },
    },
  });

  assert.match(html, /data-cw239-score>2:1</);
  assert.match(html, /Матч завершён/);
  assert.match(html, /\.cw233-mc-section-heading\{[^}]*display:grid/);
  assert.match(html, /\.cw233-mc-overview-title\{[^}]*display:flex/);
});