import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MULTITOURNAMENT_PATCH_MARKER,
  multitournamentRuntimeSource,
  injectMultitournamentPatch,
  validateMultitournamentPatchedHtml,
} from '../scripts/multitournament-runtime.mjs';

const source = () => multitournamentRuntimeSource();

test('runtime patch renames only the three approved bottom navigation labels', () => {
  const s = source();
  assert.match(s, /data-tab="mine"[\s\S]*Прогнозы/);
  assert.match(s, /data-tab="table"[\s\S]*Рейтинг/);
  assert.match(s, /data-tab="seriea"[\s\S]*Таблицы/);
  assert.doesNotMatch(s, /data-tab="predict"[\s\S]*Прогнозы/);
});

test('hub has exactly five tournament buttons and no explanatory subtitles', () => {
  const s = source();
  const matches = s.match(/data-cwmt-competition=/g) || [];
  assert.equal(matches.length, 5);
  assert.match(s, /data-cwmt-competition="serie_a"[^>]*cwmt-tournament-card--wide/);
  for (const key of ['coppa_italia','ucl','uel','uecl']) {
    assert.match(s, new RegExp(`data-cwmt-competition="${key}"`));
  }
  assert.doesNotMatch(s, /cwmt-tournament-card__hint|cwmt-tournament-card__subtitle/);
});

test('all competitions share one match-card renderer and have distinct cover themes', () => {
  const s = source();
  for (const theme of ['serie-a','coppa','champions','europa','conference']) {
    assert.match(s, new RegExp(`data-cwmt-theme="${theme}"`));
  }
  assert.match(s, /function __cwMtMatchCardHtml\(/);
  assert.equal((s.match(/function __cwMtMatchCardHtml\(/g) || []).length, 1);
});

test('external match cards cannot invoke Match Center and only mapped Italian clubs are interactive', () => {
  const s = source();
  assert.doesNotMatch(s, /data-cwmt-match[^\n]*data-mid=/);
  assert.doesNotMatch(s, /data-cwmt-match[^\n]*openMatchCenter/);
  assert.match(s, /data-cwmt-local-club=/);
  assert.match(s, /"77":8/);
  assert.match(s, /"63":12/);
  assert.match(s, /"62":14/);
});

test('patch injection is idempotent and validated inside the final v22.5 IIFE', () => {
  const html = '<html><script>\n(function(){\n  const app=true;\n  /* ===== /Ciao, Web! v22.5 product polish layer ===== */\n\n})();\n</script></html>';
  const once = injectMultitournamentPatch(html);
  const twice = injectMultitournamentPatch(once);
  assert.equal(once, twice);
  assert.match(once, new RegExp(MULTITOURNAMENT_PATCH_MARKER));
  assert.equal(validateMultitournamentPatchedHtml(once), true);
});

import vm from 'node:vm';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function runtimeHarness(fetchImpl) {
  const context = {
    calendar: () => '<legacy-calendar>',
    bind: () => {},
    refreshLive: async () => 'legacy-refresh',
    render: () => {},
    openClubProfile: () => {},
    initData: 'telegram-test',
    tab: 'calendar',
    location: { origin: 'https://ciao-web-app.example' },
    fetch: fetchImpl,
    URL,
    Date,
    Intl,
    setInterval: () => 99,
    clearInterval: () => {},
    root: {
      querySelector: () => null,
      querySelectorAll: () => [],
    },
    document: {
      hidden: false,
      head: { appendChild() {} },
      createElement: () => ({ id: '', textContent: '' }),
      getElementById: () => ({ id: 'existing-style' }),
    },
  };
  const expose = `\nglobalThis.__cwMtTest={
    setCompetition:key=>{__cwMtCompetition=key},
    setStage:key=>{__cwMtStageKey=key},
    setPayload:value=>{__cwMtPayload=value},
    groups:()=>__cwMtGroups().map(g=>g.key),
    load:(key,options)=>__cwMtLoadCompetition(key,options),
    state:()=>({payload:__cwMtPayload,stage:__cwMtStageKey,error:__cwMtError,version:__cwMtRequestVersion})
  };`;
  vm.runInNewContext(multitournamentRuntimeSource() + expose, context);
  return context.__cwMtTest;
}

function payload(score, stages = ['league:2']) {
  return {
    competition: 'ucl',
    matches: stages.map((stageKey, index) => ({
      matchId: `ucl:${index + 1}`,
      competition: 'ucl',
      stageKey,
      stageLabel: `Общий этап · ${index + 2} тур`,
      stageOrder: index + 2,
      status: 'live',
      minute: 60 + index,
      homeScore: score,
      awayScore: 1,
      homeTeam: { id: '77', name: 'Интер', isItalian: true, crestUrl: '' },
      awayTeam: { id: '500', name: 'Арсенал', isItalian: false, crestUrl: '' },
    })),
  };
}

test('newer external refresh response wins over an older stale response', async () => {
  const first = deferred();
  const second = deferred();
  let call = 0;
  const harness = runtimeHarness(() => (++call === 1 ? first.promise : second.promise));
  harness.setCompetition('ucl');

  const a = harness.load('ucl', { quiet: true });
  const b = harness.load('ucl', { quiet: true });
  second.resolve({ ok: true, json: async () => ({ ok: true, data: payload(2) }) });
  await b;
  first.resolve({ ok: true, json: async () => ({ ok: true, data: payload(1) }) });
  await a;

  assert.equal(harness.state().payload.matches[0].homeScore, 2);
});

test('quiet refresh failure preserves the last successful external payload', async () => {
  let call = 0;
  const harness = runtimeHarness(async () => {
    call += 1;
    if (call === 1) return { ok: true, json: async () => ({ ok: true, data: payload(3) }) };
    throw new Error('temporary network error');
  });
  harness.setCompetition('ucl');
  await harness.load('ucl', { quiet: false });
  await harness.load('ucl', { quiet: true });

  assert.equal(harness.state().payload.matches[0].homeScore, 3);
});

test('quiet refresh preserves selected stage when it still exists', async () => {
  let score = 1;
  const harness = runtimeHarness(async () => ({
    ok: true,
    json: async () => ({ ok: true, data: payload(score++, ['league:2','league:3']) }),
  }));
  harness.setCompetition('ucl');
  await harness.load('ucl', { quiet: false });
  harness.setStage('league:3');
  await harness.load('ucl', { quiet: true });

  assert.equal(harness.state().stage, 'league:3');
});

test('runtime stage switcher follows actual match chronology', () => {
  const harness = runtimeHarness(async () => ({ ok:true, json:async()=>({ok:true,data:{competition:'uecl',matches:[]}}) }));
  harness.setCompetition('uecl');
  harness.setPayload({ competition:'uecl', matches:[
    { matchId:'uecl:1', stageKey:'playoff', stageLabel:'Стыковые матчи', stageOrder:250, kickoffAt:'2026-08-20T18:30:00Z' },
    { matchId:'uecl:2', stageKey:'league-1', stageLabel:'Общий этап · 1 тур', stageOrder:101, kickoffAt:'2026-10-15T19:00:00Z' },
    { matchId:'uecl:3', stageKey:'league-2', stageLabel:'Общий этап · 2 тур', stageOrder:102, kickoffAt:'2026-10-22T19:00:00Z' },
  ]});
  assert.equal(JSON.stringify(harness.groups()), JSON.stringify(['playoff','league-1','league-2']));
});
