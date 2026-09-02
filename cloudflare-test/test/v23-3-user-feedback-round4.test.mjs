import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { listCanonicalPredictionMatches } from '../src/v23.3/prediction-match-resolver.mjs';
import { renderTablesHub } from '../src/v23.3/tables-ui.mjs';
import worker from '../src/worker.js';

const predictionsUi = await import('../src/v23.3/predictions-ui.mjs');
const rankingUi = await import('../src/v23.3/ranking-ui.mjs');

function canonicalMatch(competition, id, extra = {}) {
  return {
    matchId:`${competition}:${id}`,
    competition,
    season:'',
    stage:'',
    round:1,
    kickoffAt:'2026-09-10T19:00:00Z',
    status:'scheduled',
    minute:null,
    homeTeam:{ id:'1', name:'Рома', crestUrl:'https://img.test/roma.png' },
    awayTeam:{ id:'2', name:'Интер', crestUrl:'https://img.test/inter.png' },
    homeScore:null,
    awayScore:null,
    predictionDeadline:'2026-09-10T18:45:00Z',
    rawVersion:'test',
    ...extra,
  };
}

test('prediction list treats seasonless matches from the resolved current-season provider as the active season', async () => {
  const result = await listCanonicalPredictionMatches({
    request:new Request('https://ciao-web-app-test.example/api/v23.3/predictions/available', {
      headers:{ 'x-telegram-init-data':'tg' },
    }),
    env:{ PREDICTION_SEASON:'2026-27', BSD_API_KEY:'server-only' },
    competition:'ucl',
    now:new Date('2026-09-02T18:00:00Z'),
    deps:{
      fetchBsdMatches:async () => [canonicalMatch('ucl', '1001')],
    },
  });

  assert.equal(result.matches.length, 1);
  assert.equal(result.matches[0].season, '2026-27');
});

test('prediction UI exposes progressive competition loading so one slow provider cannot blank the whole screen', async () => {
  assert.equal(typeof predictionsUi.loadPredictionCompetitionsProgressively, 'function');

  let releaseUcl;
  const uclGate = new Promise(resolve => { releaseUcl = resolve; });
  const snapshots = [];
  const finished = predictionsUi.loadPredictionCompetitionsProgressively({
    competitions:['serie_a', 'ucl'],
    load:async competition => {
      if (competition === 'serie_a') return { matches:[canonicalMatch('serie_a', '1', { season:'2026-27' })] };
      await uclGate;
      return { matches:[canonicalMatch('ucl', '2', { season:'2026-27' })] };
    },
    onUpdate:state => snapshots.push(state.matches.map(match => match.competition)),
  });

  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(snapshots[0], ['serie_a']);
  releaseUcl();
  await finished;
  assert.deepEqual(snapshots.at(-1), ['serie_a', 'ucl']);
});

test('all standings use the compact v22.5 five-column layout: #, team, played, goal difference, points', () => {
  const row = {
    position:1,
    team:{ id:'65', name:'Рома', crestUrl:'https://img.test/roma.png' },
    played:2,
    wins:2,
    draws:0,
    losses:0,
    goalDifference:4,
    points:6,
  };

  for (const competition of ['serie_a', 'ucl', 'uel', 'uecl']) {
    const html = renderTablesHub({ selectedCompetition:competition, data:{ rows:[row] } });
    assert.match(html, /<th>#<\/th><th>Команда<\/th><th>И<\/th><th>РМ<\/th><th>О<\/th>/);
    assert.doesNotMatch(html, /<th>В<\/th>|<th>Н<\/th>|<th>П<\/th>/);
    assert.match(html, /cw233-standing-goal-difference/);
  }
});

test('table selectors keep the v22.5 clean horizontal scroller without a visible scrollbar', async () => {
  const source = await readFile(new URL('../src/v23.3/tables-ui.mjs', import.meta.url), 'utf8');
  assert.match(source, /\.cw233-table-selectors-viewport[^}]*scrollbar-width:none/);
  assert.match(source, /\.cw233-table-selectors-viewport::-webkit-scrollbar\{display:none/);
});

test('Serie A standings enrich missing crests from the stable Serie A schedule instead of rendering initials', async () => {
  const upstreamCalls = [];
  const response = await worker.fetch(
    new Request('https://ciao-web-app-test.example/api/v23.3/standings?competition=serie_a', {
      headers:{ 'x-telegram-init-data':'tg' },
    }),
    {
      CIAO_WEB_API:{
        async fetch(request) {
          const url = new URL(request.url);
          upstreamCalls.push(url.pathname);
          if (url.pathname === '/api/ciao-core-api-fast-v4') {
            return Response.json({
              ok:true,
              serie_a_table:{
                rows:[{ position:1, team:{ id:65, name:'Рома' }, played:2, goal_difference:4, points:6 }],
              },
            });
          }
          if (url.pathname === '/api/ciao-schedule-fast-v1') {
            return Response.json({
              ok:true,
              current_round:3,
              rounds:[{
                number:3,
                matches:[{
                  id:101,
                  kickoff_at:'2026-09-10T19:00:00Z',
                  home:{ id:65, name:'Рома', logo:'https://img.test/roma.png' },
                  away:{ id:77, name:'Интер', logo:'https://img.test/inter.png' },
                }],
              }],
            });
          }
          throw new Error(`unexpected upstream ${url.pathname}`);
        },
      },
      ASSETS:{ fetch:async () => new Response('asset') },
    },
  );

  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.data.rows[0].team.crestUrl, 'https://img.test/roma.png');
  assert.deepEqual(upstreamCalls.sort(), ['/api/ciao-core-api-fast-v4', '/api/ciao-schedule-fast-v1'].sort());
});

test('ranking text uses participant wording and proper Russian point forms', () => {
  assert.equal(typeof rankingUi.rankingParticipantCountLabel, 'function');
  assert.equal(typeof rankingUi.rankingPointsLabel, 'function');
  assert.equal(rankingUi.rankingParticipantCountLabel(1), '1 участник');
  assert.equal(rankingUi.rankingParticipantCountLabel(2), '2 участника');
  assert.equal(rankingUi.rankingParticipantCountLabel(9), '9 участников');
  assert.equal(rankingUi.rankingPointsLabel(0), '0 очков');
  assert.equal(rankingUi.rankingPointsLabel(1), '1 очко');
  assert.equal(rankingUi.rankingPointsLabel(3), '3 очка');
  assert.equal(rankingUi.rankingPointsLabel(11), '11 очков');
});
