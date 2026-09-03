import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalizeStandingRows } from '../src/v23.3/standing-normalizer.mjs';
import { renderTablesHub } from '../src/v23.3/tables-ui.mjs';
import { PREDICTION_FILTERS } from '../src/v23.3/predictions-ui.mjs';
import { resolveCurrentRankingRow } from '../src/v23.3/ranking-ui.mjs';
import { createPredictionService } from '../src/v23.3/prediction-service.mjs';
import { listCanonicalPredictionMatches } from '../src/v23.3/prediction-match-resolver.mjs';

function namespace(handler) {
  return {
    idFromName(name) { return `id:${name}`; },
    get() { return { fetch: handler }; },
  };
}

function predictionRequest() {
  return new Request('https://ciao-web-app-test.example/api/v23.3/predictions', {
    headers: { 'x-telegram-init-data':'tg' },
  });
}

test('Serie A prediction matches enrich missing state crests from the stable schedule without replacing state data', async () => {
  const calls = [];
  const env = {
    PREDICTION_SEASON:'2026-27',
    CIAO_WEB_API:{
      async fetch(request) {
        const path = new URL(request.url).pathname;
        calls.push(path);
        if (path === '/api/ciao-core-api-fast-v4') {
          return Response.json({
            ok:true,
            selected_round:2,
            round:{
              number:2,
              matches:[{
                id:101,
                kickoff_at:'2026-09-05T18:00:00Z',
                status:'SCHEDULED',
                home:{id:1,name:'Фиорентина'},
                away:{id:2,name:'Торино'},
              }],
            },
          });
        }
        if (path === '/api/ciao-schedule-fast-v1') {
          return Response.json({
            ok:true,
            current_round:2,
            rounds:[{
              number:2,
              matches:[{
                id:101,
                kickoff_at:'2026-09-05T20:00:00Z',
                status:'SCHEDULED',
                home:{id:1,name:'Фиорентина',logo_url:'https://img.example/fiorentina.png'},
                away:{id:2,name:'Торино',logo_url:'https://img.example/torino.png'},
              }],
            }],
          });
        }
        throw new Error(`unexpected ${path}`);
      },
    },
  };

  const result = await listCanonicalPredictionMatches({
    request:predictionRequest(),
    env,
    competition:'serie_a',
    now:new Date('2026-09-03T00:00:00Z'),
  });

  assert.deepEqual(calls, ['/api/ciao-core-api-fast-v4', '/api/ciao-schedule-fast-v1']);
  assert.equal(result.matches[0].kickoffAt, '2026-09-05T18:00:00Z', 'state remains authoritative for match data');
  assert.equal(result.matches[0].homeTeam.crestUrl, 'https://img.example/fiorentina.png');
  assert.equal(result.matches[0].awayTeam.crestUrl, 'https://img.example/torino.png');
});

test('prediction available payload exposes the authenticated participant for the hero without rankingMe', async () => {
  const ns = namespace(async request => {
    if (new URL(request.url).pathname === '/user') return Response.json({ ok:true, predictions:[] });
    throw new Error('unexpected DO request');
  });
  const service = createPredictionService({
    request:predictionRequest(),
    env:{ CIAO_ENV:'test', PREDICTION_SEASON:'2026-27', PREDICTION_LEAGUE:ns },
    deps:{
      resolveAuthenticatedUser:async () => ({ userId:'telegram:42', displayName:'Daniil', username:'danx95' }),
      listCanonicalPredictionMatches:async () => ({ matches:[], errors:{} }),
    },
  });

  const result = await service.available('all');
  assert.deepEqual(result.participant, {
    user_id:'telegram:42',
    display_name:'Daniil',
    username:'danx95',
  });
});

test('ranking resolves the server-marked current participant even when initDataUnsafe is absent', () => {
  const current = resolveCurrentRankingRow([
    { user_id:'telegram:11', display_name:'Other', points:1 },
    { user_id:'telegram:42', display_name:'Daniil', username:'danx95', points:0, is_current:true },
  ], {});
  assert.equal(current?.display_name, 'Daniil');
  assert.equal(current?.position, 2);
});

test('prediction tournament filters contain only tournaments and do not expose Not filled as a pseudo tournament', () => {
  assert.deepEqual(PREDICTION_FILTERS.map(item => item.key), [
    'all','serie_a','coppa_italia','ucl','uel','uecl',
  ]);
});

test('Serie A standings preserve canonical Worker crestUrl', () => {
  const [row] = normalizeStandingRows({ rows:[{
    position:1,
    team:{ id:'7', name:'Рома', crestUrl:'https://img.example/roma.png' },
    played:2, wins:2, draws:0, losses:0,
    goals_for:9, goals_against:1, goal_difference:8, points:6,
  }] }, 'serie_a');
  assert.equal(row.team.crestUrl, 'https://img.example/roma.png');
});

test('standings render the full compact football stat line instead of only five columns', () => {
  const html = renderTablesHub({
    selectedCompetition:'serie_a',
    data:{ rows:[{
      position:1,
      team:{ id:'7', name:'Рома', crestUrl:'https://img.example/roma.png' },
      played:2, wins:2, draws:0, losses:0,
      goalsFor:9, goalsAgainst:1, goalDifference:8, points:6,
    }] },
  });
  assert.match(html, /<th>И<\/th><th>В<\/th><th>Н<\/th><th>П<\/th><th>Г<\/th><th>РМ<\/th><th>О<\/th>/);
  assert.match(html, /data-cw233-stat="wins">2<\/td>/);
  assert.match(html, /data-cw233-stat="draws">0<\/td>/);
  assert.match(html, /data-cw233-stat="losses">0<\/td>/);
  assert.match(html, /data-cw233-stat="goals">9:1<\/td>/);
});

test('Home predict button is excluded from Match Center capture and routed to Predictions', async () => {
  const matchCenter = await readFile(new URL('../src/v23.3/match-center.mjs', import.meta.url), 'utf8');
  const predictions = await readFile(new URL('../src/v23.3/predictions-ui.mjs', import.meta.url), 'utf8');
  assert.match(matchCenter, /data-cw231-action[^\n]*predict|cw231Action\s*===\s*['"]predict['"]/);
  assert.match(predictions, /data-cw231-action[^\n]*predict|cw231Action\s*===\s*['"]predict['"]/);
});

test('prediction rerenders preserve horizontal tournament and round scroll positions', async () => {
  const source = await readFile(new URL('../src/v23.3/predictions-ui.mjs', import.meta.url), 'utf8');
  assert.match(source, /scrollLeft/);
  assert.match(source, /cw233-pred-filters/);
  assert.match(source, /cw233-pred-nav/);
});

test('ranking gives the whole top-three rows strong gold silver and bronze treatments', async () => {
  const source = await readFile(new URL('../src/v23.3/ranking-ui.mjs', import.meta.url), 'utf8');
  assert.match(source, /cw233-ranking-row[^\n]*is-podium-1/);
  assert.match(source, /cw233-ranking-row[^\n]*is-podium-2/);
  assert.match(source, /cw233-ranking-row[^\n]*is-podium-3/);
});

test('Serie A legacy calendar keeps a visible Back-to-tournaments bridge without replacing the legacy calendar', async () => {
  const source = await readFile(new URL('../src/v23.3/round7-regression-fixes.mjs', import.meta.url), 'utf8');
  assert.match(source, /cw232-serie-a-back/);
  assert.match(source, /Назад к турнирам/);
  assert.match(source, /button\[data-tab=\\?"calendar\\?"\]/);
});

test('round7 compatibility layer paints custom overlays through the bottom navigation seam', async () => {
  const source = await readFile(new URL('../src/v23.3/round7-regression-fixes.mjs', import.meta.url), 'utf8');
  assert.match(source, /ciao-v232-matches-overlay/);
  assert.match(source, /ciao-v233-tables-overlay/);
  assert.match(source, /ciao-v233-match-center-overlay/);
  assert.match(source, /inset:0!important/);
  assert.match(source, /padding-bottom:calc\(104px \+ env\(safe-area-inset-bottom/);
});

test('round7 mobile standings keep every stat visible through a horizontal viewport instead of hiding columns', async () => {
  const source = await readFile(new URL('../src/v23.3/round7-regression-fixes.mjs', import.meta.url), 'utf8');
  assert.match(source, /cw233-standing-viewport[^}]*overflow-x:auto!important/);
  assert.match(source, /cw233-standing-table[^}]*min-width:(?:6|7)\d\dpx!important/);
  assert.match(source, /nth-child\(4\)[^}]*display:table-cell!important/);
  assert.match(source, /nth-child\(7\)[^}]*display:table-cell!important/);
});
