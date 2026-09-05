import test from 'node:test';
import assert from 'node:assert/strict';

import { createMatchCenterProviders } from '../src/v23.3/match-center-providers.mjs';
import { createCanonicalMatchCenterRuntime } from '../src/v23.3/match-center-runtime.mjs';

const competitions = ['serie_a','coppa_italia','ucl','uel','uecl'];

function baseMatch(competition = 'serie_a') {
  return {
    competition,
    matchId:`${competition}:901`,
    status:'finished',
    kickoffAt:'2026-09-04T19:45:00Z',
    homeTeam:{ id:'1', name:'Фиорентина', crestUrl:'https://bad.example/fio.png' },
    awayTeam:{ id:'2', name:'Торино', crestUrl:'https://bad.example/tor.png' },
    score:{ home:1, away:2 },
    homeScore:1,
    awayScore:2,
    goals:{ home:[], away:[] },
    coverage:{ overview:true, stats:true, events:true, lineups:true, players:true },
  };
}

function sectionState(active, data, competition = 'serie_a') {
  const sections = { overview:null, stats:null, events:null, lineups:null, players:null };
  const statuses = Object.fromEntries(Object.keys(sections).map(key => [key, { status:key === active ? 'ready' : 'idle', error:'' }]));
  sections[active] = data;
  return {
    open:true,
    phase:'ready',
    competition,
    matchId:`${competition}:901`,
    match:baseMatch(competition),
    activeTab:active,
    sections,
    sectionState:statuses,
    error:'',
  };
}

function runtimeHarness(state) {
  let listener = null;
  let html = '';
  let current = state;
  const store = {
    subscribe(fn) { listener = fn; return () => {}; },
    getState() { return current; },
    open() { return current; },
    close() { return current; },
    setActiveTab(tab) { current = { ...current, activeTab:tab }; listener?.(current); return current; },
    retryBase() { return current; },
    retrySection() { return current; },
  };
  const host = {
    bind() {},
    render(value) { html = String(value || ''); },
    hide() {},
    scrollToTop() {},
    destroy() {},
  };
  const runtime = createCanonicalMatchCenterRuntime({ store, host });
  listener(state);
  return { runtime, html:() => html, emit(next) { current = next; listener(next); } };
}

function overviewLoader() {
  return async () => ({
    available:true,
    coverage:{ overview:true },
    data:{ predictionSplit:{ home:42, draw:31, away:27 } },
  });
}

test('Round 50.2 personal prediction enrichment is shared by all five supported competitions', async () => {
  const calls = [];
  const providers = createMatchCenterProviders({
    loadSerieABase:async () => ({ match:baseMatch('serie_a') }),
    loadSerieASection:overviewLoader(),
    loadExternalBase:async ({ competition }) => ({ match:baseMatch(competition) }),
    loadExternalSection:overviewLoader(),
    loadUserPrediction:async ({ competition, matchId }) => {
      calls.push(`${competition}|${matchId}`);
      return { homeScore:2, awayScore:1, kind:'user' };
    },
  });

  for (const competition of competitions) {
    const result = await providers.loadSection({
      competition,
      matchId:`${competition}:901`,
      section:'overview',
      request:new Request('https://test.invalid/api'),
      env:{},
    });
    assert.deepEqual(result.data.prediction, { homeScore:2, awayScore:1, kind:'user' });
  }
  assert.deepEqual(calls, competitions.map(key => `${key}|${key}:901`));
});

test('Round 50.2 prediction enrichment failure is non-fatal to sports Overview', async () => {
  const providers = createMatchCenterProviders({
    loadSerieABase:async () => ({ match:baseMatch('serie_a') }),
    loadSerieASection:overviewLoader(),
    loadExternalBase:async ({ competition }) => ({ match:baseMatch(competition) }),
    loadExternalSection:overviewLoader(),
    loadUserPrediction:async () => { throw new Error('prediction backend unavailable'); },
  });
  const result = await providers.loadSection({ competition:'ucl', matchId:'ucl:901', section:'overview' });
  assert.equal(result.available, true);
  assert.deepEqual(result.data.predictionSplit, { home:42, draw:31, away:27 });
  assert.equal(result.data.prediction, undefined);
});

test('Round 50.2 Lineups defaults to pitch plus collapsed active-team disclosures, without duplicated full lists', () => {
  const lineups = {
    home:{ formation:'4-3-3', coach:'Coach Home', starters:[
      { playerId:'11', name:'Home One', shirtNumber:11, position:'F', x:50, y:82, rating:8.1 },
      { playerId:'12', name:'Home Two', shirtNumber:12, position:'M', x:45, y:55 },
    ], substitutes:[{ playerId:'19', name:'Home Sub', shirtNumber:19, position:'F' }] },
    away:{ formation:'3-4-2-1', coach:'Coach Away', starters:[
      { playerId:'21', name:'Away One', shirtNumber:21, position:'F', x:50, y:82 },
    ], substitutes:[{ playerId:'29', name:'Away Sub', shirtNumber:29, position:'M' }] },
  };
  const harness = runtimeHarness(sectionState('lineups', lineups));
  const html = harness.html();
  assert.doesNotMatch(html, /class="cw233-mc-lineup-text/);
  assert.match(html, /data-cw502-lineup-team="home"/);
  assert.match(html, /data-cw502-lineup-disclosure="starters"/);
  assert.match(html, /Стартовый состав · 2/);
  assert.match(html, /data-cw502-lineup-disclosure="substitutes"/);
  assert.match(html, /Запасные · 1/);
  assert.doesNotMatch(html, /data-cw502-lineup-expanded/);
});

test('Round 50.2 lineup UI actions expand only the selected team and reset disclosure on team switch', () => {
  const lineups = {
    home:{ formation:'4-3-3', starters:[{ name:'Home One', shirtNumber:11, position:'F' }], substitutes:[{ name:'Home Sub', shirtNumber:19, position:'M' }] },
    away:{ formation:'3-4-2-1', starters:[{ name:'Away One', shirtNumber:21, position:'F' }], substitutes:[{ name:'Away Sub', shirtNumber:29, position:'M' }] },
  };
  const harness = runtimeHarness(sectionState('lineups', lineups));
  assert.equal(typeof harness.runtime.uiAction, 'function');
  harness.runtime.uiAction('lineup-disclosure', 'substitutes');
  assert.match(harness.html(), /data-cw502-lineup-expanded="substitutes"/);
  assert.match(harness.html(), /Home Sub/);
  harness.runtime.uiAction('lineup-team', 'away');
  assert.match(harness.html(), /data-cw502-lineup-team="away"/);
  assert.doesNotMatch(harness.html(), /data-cw502-lineup-expanded/);
});

test('Round 50.2 Stats uses interactive shot markers, one selected-shot card, and exact two-decimal shot xG', () => {
  const stats = {
    home:{ xg:.67, possession:38, shots:11, shotsOnTarget:2 },
    away:{ xg:1.53, possession:62, shots:20, shotsOnTarget:9 },
    shots:[
      { side:'home', x:88, y:47, minute:84, player:'M. Liberali', outcome:'saved', xg:.0253 },
      { side:'away', x:84, y:55, minute:78, player:'A. Diao', outcome:'goal', xg:.1255 },
    ],
  };
  const harness = runtimeHarness(sectionState('stats', stats));
  assert.doesNotMatch(harness.html(), /data-cw233-mc-shot-list/);
  assert.match(harness.html(), /data-cw502-shot-action="0"/);
  assert.match(harness.html(), /aria-pressed="false"/);
  assert.equal(typeof harness.runtime.uiAction, 'function');
  harness.runtime.uiAction('shot', '0');
  const html = harness.html();
  assert.match(html, /data-cw502-selected-shot="0"/);
  assert.match(html, /M\. Liberali/);
  assert.match(html, /0\.03/);
  assert.doesNotMatch(html, /0\.0253/);
  assert.match(html, /aria-pressed="true"/);
});

test('Round 50.2 tapping the selected shot again collapses its detail card', () => {
  const stats = { home:{ shots:1 }, away:{ shots:0 }, shots:[{ side:'home', x:88, y:47, minute:84, player:'Player', outcome:'saved', xg:.1 }] };
  const harness = runtimeHarness(sectionState('stats', stats));
  assert.equal(typeof harness.runtime.uiAction, 'function');
  harness.runtime.uiAction('shot', '0');
  assert.match(harness.html(), /data-cw502-selected-shot="0"/);
  harness.runtime.uiAction('shot', '0');
  assert.doesNotMatch(harness.html(), /data-cw502-selected-shot/);
});

test('Round 50.2 empty Stats and Events render intentional compact states without blank shells or timeline rail', () => {
  const statsHarness = runtimeHarness(sectionState('stats', { home:{}, away:{}, shots:[], momentum:[] }));
  assert.match(statsHarness.html(), /Статистика появится после начала матча/);
  assert.doesNotMatch(statsHarness.html(), /data-cw233-mc-shotmap/);

  const eventsHarness = runtimeHarness(sectionState('events', []));
  assert.match(eventsHarness.html(), /Событий матча пока нет/);
  assert.doesNotMatch(eventsHarness.html(), /data-cw233-mc-events-timeline/);
});

test('Round 50.2 Match Center hero precomputes deterministic crest fallback initials for broken images', () => {
  const harness = runtimeHarness(sectionState('overview', { form:{ home:[], away:[] } }));
  const html = harness.html();
  assert.match(html, /data-cw502-crest-fallback="ФИО"/);
  assert.match(html, /data-cw502-crest-fallback="ТОР"/);
  assert.match(html, /data-cw502-crest-side="home"/);
  assert.match(html, /data-cw502-crest-side="away"/);
});
