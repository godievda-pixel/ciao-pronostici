import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { listCanonicalPredictionMatches } from '../src/v23.3/prediction-match-resolver.mjs';
import { createPredictionService } from '../src/v23.3/prediction-service.mjs';
import { predictionNavigationGroups } from '../src/v23.3/predictions-ui.mjs';
import { renderTablesHub } from '../src/v23.3/tables-ui.mjs';

const request = new Request('https://ciao-web-app-test.example/api/v23.3/predictions', {
  headers:{ 'x-telegram-init-data':'tg' },
});

function serieAMatch(id, round, status = 'scheduled') {
  return {
    matchId:`serie_a:${id}`,
    competition:'serie_a',
    season:'2026-27',
    stage:`Round ${round}`,
    round,
    kickoffAt:`2026-09-${String(3 + round).padStart(2,'0')}T19:00:00Z`,
    status,
    homeTeam:{ id:`h${id}`, name:'Милан', crestUrl:'' },
    awayTeam:{ id:`a${id}`, name:'Ювентус', crestUrl:'' },
    homeScore:status === 'finished' ? 1 : null,
    awayScore:status === 'finished' ? 0 : null,
    rawVersion:`r${round}`,
  };
}

function predictionNamespace({ reconciled = [] } = {}) {
  const requests = [];
  return {
    requests,
    idFromName(name) { return `id:${name}`; },
    get() {
      return {
        async fetch(req) {
          requests.push(req);
          const url = new URL(req.url);
          if (url.pathname === '/user') return Response.json({ ok:true, predictions:[] });
          if (url.pathname === '/reconciled') return Response.json({ ok:true, match_ids:reconciled });
          if (url.pathname === '/participants') return Response.json({ ok:true, participants:[] });
          if (url.pathname === '/rankings') return Response.json({ ok:true, ranking:[] });
          if (url.pathname === '/rankings/me') return Response.json({ ok:true, ranking:null });
          if (url.pathname === '/reconcile') return Response.json({ ok:true, affected:0, skipped:0 });
          if (url.pathname === '/write') return Response.json({ ok:true, predictions:[] });
          throw new Error(`unexpected ${url.pathname}`);
        },
      };
    },
  };
}

function legacyMatch(id, kickoff, home, away) {
  return {
    id,
    kickoff_at:kickoff,
    status:'SCHEDULED',
    home:{ id:`h${id}`, name:home },
    away:{ id:`a${id}`, name:away },
  };
}

test('Serie A prediction source keeps the full schedule instead of collapsing to only the selected state round', async () => {
  const env = {
    PREDICTION_SEASON:'2026-27',
    CIAO_WEB_API:{
      async fetch(req) {
        const path = new URL(req.url).pathname;
        if (path === '/api/ciao-core-api-fast-v4') {
          return Response.json({
            ok:true,
            selected_round:3,
            round:{ number:3, matches:[legacyMatch(301,'2026-09-04T19:00:00Z','Дженоа','Комо')] },
          });
        }
        if (path === '/api/ciao-schedule-fast-v1') {
          return Response.json({
            ok:true,
            current_round:3,
            rounds:[
              { number:3, matches:[legacyMatch(301,'2026-09-04T19:00:00Z','Дженоа','Комо')] },
              { number:4, matches:[legacyMatch(401,'2026-09-12T19:00:00Z','Милан','Ювентус')] },
              { number:5, matches:[legacyMatch(501,'2026-09-19T19:00:00Z','Интер','Рома')] },
            ],
          });
        }
        throw new Error(`unexpected ${path}`);
      },
    },
  };

  const result = await listCanonicalPredictionMatches({
    request,
    env,
    competition:'serie_a',
    now:new Date('2026-09-03T00:00:00Z'),
  });

  assert.deepEqual(result.matches.map(row => row.round), [3,4,5]);
});

test('Serie A uses the same round navigation model and exposes future locked rounds', () => {
  const groups = predictionNavigationGroups([
    { ...serieAMatch('r3',3), state:'open' },
    { ...serieAMatch('r4',4), state:'round_locked' },
    { ...serieAMatch('r5',5), state:'round_locked' },
  ], 'serie_a');

  assert.deepEqual(groups.map(group => group.label), ['Тур 3','Тур 4','Тур 5']);
  assert.equal(groups[0].locked, false);
  assert.equal(groups[1].locked, true);
  assert.equal(groups[2].locked, true);
});

test('Serie A future round is server-locked until the previous round has been reconciled', async () => {
  const ns = predictionNamespace({ reconciled:[] });
  const round3 = serieAMatch('r3',3,'finished');
  const round4 = serieAMatch('r4',4,'scheduled');
  const service = createPredictionService({
    request,
    env:{ CIAO_ENV:'test', PREDICTION_SEASON:'2026-27', PREDICTION_LEAGUE:ns },
    now:new Date('2026-09-05T00:00:00Z'),
    deps:{
      resolveAuthenticatedUser:async () => ({ userId:'telegram:42', displayName:'Daniil', username:'danx95' }),
      listCanonicalPredictionMatches:async () => ({ matches:[round3,round4], errors:{} }),
    },
  });

  const result = await service.available('serie_a');
  assert.equal(result.matches.find(row => row.round === 4).state, 'round_locked');
});

test('locked prediction round renders exactly one lock affordance', async () => {
  const [ui, themes] = await Promise.all([
    readFile(new URL('../src/v23.3/predictions-ui.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../src/v23.3/round11-performance-themes.mjs', import.meta.url), 'utf8'),
  ]);
  assert.match(ui, /group\.locked \? ' 🔒' : ''/);
  assert.doesNotMatch(themes, /data-cw233-pred-locked=['"]true['"]::after\s*\{[^}]*content:\s*['"] 🔒['"]/s);
});

test('first uncached Ranking load uses a neutral loading hero and never renders fake participant identity', async () => {
  const source = await readFile(new URL('../src/v23.3/ranking-ui.mjs', import.meta.url), 'utf8');
  assert.match(source, /cw233-ranking-loading-hero/);
  assert.match(source, /function\s+loadingHeroHtml\s*\(/);
  const loadStart = source.indexOf('async function load');
  const loadEnd = source.indexOf('function close', loadStart);
  const load = source.slice(loadStart, loadEnd);
  assert.match(load, /showRankingLoading/);
  assert.doesNotMatch(load, /rows=\[\];me=null;updateRankingChrome\(\);renderRankingContent\(\{loading:true\}\)/);
});

test('Matches bottom-nav transition is synchronous so the hub cannot flash over stale match content', async () => {
  const source = await readFile(new URL('../src/v23.2/matches-ui.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /const handleNav = nav => \{ defer\(\(\) =>/);
  assert.match(source, /background:#07101f/);
});

test('Match Center opening a Euro or Coppa match does not force a scroll reset', async () => {
  const source = await readFile(new URL('../src/v23.3/match-center.mjs', import.meta.url), 'utf8');
  const start = source.indexOf('async function open(payload');
  const end = source.indexOf('function close()', start);
  const open = source.slice(start, end);
  assert.doesNotMatch(open, /scrollTo\(0,\s*0\)|scrollTop\s*=\s*0/);
});

test('Tables tournament selector uses compact UEFA labels while the table header keeps the full title', () => {
  const html = renderTablesHub({ selectedCompetition:'ucl', data:{ rows:[] } });
  const selectorStart = html.indexOf('cw233-table-selectors');
  const selectorEnd = html.indexOf('cw233-tables-content', selectorStart);
  const selectors = html.slice(selectorStart, selectorEnd);

  assert.match(selectors, />Серия А<\/button>/);
  assert.match(selectors, />ЛЧ<\/button>/);
  assert.match(selectors, />ЛЕ<\/button>/);
  assert.match(selectors, />ЛК<\/button>/);
  assert.doesNotMatch(selectors, />Лига Чемпионов<\/button>|>Лига Европы<\/button>|>Лига Конференций<\/button>/);
  assert.match(html, /<p>Лига Чемпионов<\/p>/);
});
