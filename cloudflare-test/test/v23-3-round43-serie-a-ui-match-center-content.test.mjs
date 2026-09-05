import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { matchCenterTheme } from '../src/v23.3/match-center-theme.mjs';
import { renderMatchCenterOverview } from '../src/v23.3/match-center-overview.mjs';
import { createMatchCenterStore } from '../src/v23.3/match-center-store.mjs';
import { createCanonicalMatchCenterRuntime } from '../src/v23.3/match-center-runtime.mjs';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('Round 43 canonical Serie A Match Center uses the same palette as Predictions', () => {
  const theme = matchCenterTheme('serie_a');
  assert.equal(theme.vars['--mc-bg'], '#071626');
  assert.equal(theme.vars['--mc-accent'], '#0c5aa8');
  assert.equal(theme.vars['--mc-accent-2'], '#287fc7');
});

test('Round 43 Serie A match cards reuse the premium Predictions card surface', async () => {
  const source = await read('../src/v23.3/round43-serie-a-ui.mjs');
  assert.match(
    source,
    /\.cw232-competition\[data-cw232-competition=['"]serie_a['"]\][\s\S]*?\.cw232-match-card[\s\S]*?radial-gradient\(circle at 92% 8%,rgba\(12,90,168,\.15\),transparent 48%\)[\s\S]*?linear-gradient\(145deg,rgba\(24,42,91,\.90\),rgba\(12,24,55,\.94\)\)/,
  );
  const index = await read('../src/v23.3/index.mjs');
  assert.match(index, /import ['"]\.\/round43-serie-a-ui\.mjs['"]/);
});

test('Round 43 Overview renders structured form results instead of [object Object]', () => {
  const html = renderMatchCenterOverview({
    form:{
      home:[{ result:'W' }, { outcome:'D' }, { code:'L' }],
      away:[{ value:'WIN' }, { status:'DRAW' }, { result:'LOSS' }],
    },
  }, {
    match:{ homeTeam:{ name:'Фиорентина' }, awayTeam:{ name:'Торино' } },
    coverage:{ overview:true },
  });

  assert.doesNotMatch(html, /\[object Object\]/i);
  assert.doesNotMatch(html, />\[</);
  assert.match(html, /is-win[^>]*>В<\/span>/);
  assert.match(html, /is-draw[^>]*>Н<\/span>/);
  assert.match(html, /is-loss[^>]*>П<\/span>/);
});

test('Round 43 Match Center preserves card crests when provider base omits them', async () => {
  const repository = {
    async base() {
      return {
        match:{
          competition:'serie_a',
          matchId:'serie_a:77',
          status:'scheduled',
          kickoffAt:'2026-09-05T13:00:00Z',
          homeTeam:{ id:1, name:'Фиорентина', crestUrl:'' },
          awayTeam:{ id:2, name:'Торино', crestUrl:'' },
          coverage:{ overview:false, stats:false, events:false, lineups:false, players:false },
        },
      };
    },
    async section() {
      return { available:false, coverage:{ overview:false }, data:null };
    },
  };
  const documentRef = { hidden:false, addEventListener(){} };
  const store = createMatchCenterStore({
    repository,
    documentRef,
    setTimer:() => null,
    clearTimer() {},
  });
  const host = {
    bind() {},
    render() {},
    hide() {},
    scrollToTop() {},
  };
  const runtime = createCanonicalMatchCenterRuntime({
    store,
    host,
    renderView:() => '',
  });

  await runtime.open({
    competition:'serie_a',
    matchId:'serie_a:77',
    initialMatch:{
      competition:'serie_a',
      matchId:'serie_a:77',
      status:'scheduled',
      kickoffAt:'2026-09-05T13:00:00Z',
      homeTeam:{ id:1, name:'Фиорентина', crestUrl:'https://cdn.example/fiorentina.png' },
      awayTeam:{ id:2, name:'Торино', crestUrl:'https://cdn.example/torino.png' },
    },
  });

  const match = store.getState().match;
  assert.equal(match.homeTeam.crestUrl, 'https://cdn.example/fiorentina.png');
  assert.equal(match.awayTeam.crestUrl, 'https://cdn.example/torino.png');
});
