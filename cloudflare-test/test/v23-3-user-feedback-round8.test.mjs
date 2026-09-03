import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { listCanonicalPredictionMatches } from '../src/v23.3/prediction-match-resolver.mjs';
import { round8ThemeForCompetition } from '../src/v23.3/round8-performance-premium.mjs';

function predictionRequest() {
  return new Request('https://ciao-web-app-test.example/api/v23.3/predictions', {
    headers: { 'x-telegram-init-data':'tg' },
  });
}

test('favorite club nearest match uses hydrated v23.3 Home state instead of stale legacy schedule state', async () => {
  const source = await readFile(new URL('../scripts/build.mjs', import.meta.url), 'utf8');
  const start = source.indexOf('export function applyFavoriteHtmlSourcePatch');
  const end = source.indexOf('export function applyLogoSourcePatch', start);
  const patch = source.slice(start, end);

  assert.match(patch, /CiaoV233Home\?\.state\?\.\(\)/);
  assert.match(patch, /hydrated/);
  assert.doesNotMatch(patch, /__cw231RawScheduleMatches\(\)/);
});

test('Predictions uses one all-competition available request and avoids five progressive full-page renders', async () => {
  const source = await readFile(new URL('../src/v23.3/predictions-ui.mjs', import.meta.url), 'utf8');
  const start = source.indexOf('async function reloadMatches');
  const end = source.indexOf('async function open()', start);
  const reload = source.slice(start, end);

  assert.match(reload, /client\.available\(['"]all['"]\)/);
  assert.doesNotMatch(reload, /loadPredictionCompetitionsProgressively/);
  assert.doesNotMatch(reload, /onUpdate\s*\(/);
});

test('Predictions keeps cached matches on reopen while refreshing in background', async () => {
  const source = await readFile(new URL('../src/v23.3/predictions-ui.mjs', import.meta.url), 'utf8');
  const start = source.indexOf('async function open()');
  const end = source.indexOf('function close()', start);
  const open = source.slice(start, end);

  assert.doesNotMatch(open, /matches\s*=\s*\[\]/);
  assert.match(source, /loadedAt|lastLoadedAt|cache/i);
});

test('Serie A crest enrichment tolerates different match and team ids when canonical team names agree', async () => {
  const env = {
    PREDICTION_SEASON:'2026-27',
    CIAO_WEB_API:{
      async fetch(request) {
        const path = new URL(request.url).pathname;
        if (path === '/api/ciao-core-api-fast-v4') {
          return Response.json({
            ok:true,
            selected_round:3,
            round:{
              number:3,
              matches:[{
                id:101,
                kickoff_at:'2026-09-10T18:00:00Z',
                status:'SCHEDULED',
                home:{id:'state-1',name:'Милан'},
                away:{id:'state-2',name:'Интер'},
              }],
            },
          });
        }
        if (path === '/api/ciao-schedule-fast-v1') {
          return Response.json({
            ok:true,
            current_round:3,
            rounds:[{
              number:3,
              matches:[{
                id:999,
                kickoff_at:'2026-09-10T18:00:00Z',
                status:'SCHEDULED',
                home:{id:'schedule-99',name:'AC Milan',logo_url:'https://img.example/milan.png'},
                away:{id:'schedule-88',name:'Internazionale',logo_url:'https://img.example/inter.png'},
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

  assert.equal(result.matches[0].matchId, 'serie_a:101');
  assert.equal(result.matches[0].homeTeam.crestUrl, 'https://img.example/milan.png');
  assert.equal(result.matches[0].awayTeam.crestUrl, 'https://img.example/inter.png');
});

test('ranking reconciliation is scheduled off the ranking response critical path', async () => {
  const source = await readFile(new URL('../src/v23.3/prediction-service.mjs', import.meta.url), 'utf8');
  const start = source.indexOf('async function rankings');
  const end = source.indexOf('async function rankingMe', start);
  const rankings = source.slice(start, end);

  assert.match(source, /scheduleBackground|waitUntil/);
  assert.doesNotMatch(rankings, /await\s+reconcileFinishedMatches/);
});

test('non-Serie-A Match screens receive the premium Serie A card hierarchy from the Round 8 decorator', async () => {
  const source = await readFile(new URL('../src/v23.3/round8-performance-premium.mjs', import.meta.url), 'utf8');
  assert.equal(round8ThemeForCompetition('ucl'), 'champions');
  assert.match(source, /cw232-match-card__topline/);
  assert.match(source, /cw232-match-card__status/);
  assert.match(source, /cw232-match-card__kickoff/);
  assert.match(source, /cw232-match-card__versus/);
  assert.match(source, /Матчи · \$\{round\}-й тур/);
});

test('premium Match UI defines tournament-specific accent variables for Coppa and UEFA competitions', async () => {
  const source = await readFile(new URL('../src/v23.3/round8-performance-premium.mjs', import.meta.url), 'utf8');
  assert.match(source, /--cw232-accent/);
  assert.match(source, /data-cw232-theme='champions'/);
  assert.match(source, /data-cw232-theme='europa'/);
  assert.match(source, /data-cw232-theme='conference'/);
  assert.match(source, /data-cw232-theme='coppa'/);
});

test('Tables premium surface derives its theme from the selected tournament', () => {
  assert.equal(round8ThemeForCompetition('serie_a'), 'serie-a');
  assert.equal(round8ThemeForCompetition('coppa_italia'), 'coppa');
  assert.equal(round8ThemeForCompetition('ucl'), 'champions');
  assert.equal(round8ThemeForCompetition('uel'), 'europa');
  assert.equal(round8ThemeForCompetition('uecl'), 'conference');
});

test('Tables premium polish uses tournament accent variables instead of a fixed blue active state', async () => {
  const source = await readFile(new URL('../src/v23.3/round8-performance-premium.mjs', import.meta.url), 'utf8');
  assert.match(source, /--cw233-table-accent/);
  assert.match(source, /data-cw233-theme='coppa'/);
  assert.match(source, /data-cw233-theme='champions'/);
  assert.match(source, /data-cw233-theme='europa'/);
  assert.match(source, /data-cw233-theme='conference'/);
});

test('Round 8 runtime is enabled from the v23.3 entry point', async () => {
  const source = await readFile(new URL('../src/v23.3/index.mjs', import.meta.url), 'utf8');
  assert.match(source, /round8-performance-premium\.mjs/);
  assert.match(source, /round8PerformancePremium:\s*'enabled'/);
});

test('Serie A standings crest lookup canonicalizes aliases such as AC Milan and Милан', async () => {
  const source = await readFile(new URL('../src/worker.js', import.meta.url), 'utf8');
  assert.match(source, /normalizeTeamAlias|russianTeamName/);
  assert.match(source, /serieACrestLookup/);
});