import test from 'node:test';
import assert from 'node:assert/strict';

import { createMatchCenterStore } from '../src/v23.3/match-center-store.mjs';
import { renderMatchCenterView } from '../src/v23.3/match-center-view.mjs';

function falseCoverage() {
  return {
    overview:false,
    stats:false,
    events:false,
    lineups:false,
    players:false,
  };
}

test('Round 40 summary coverage=false does not block the lazy rich overview request', async () => {
  let sectionCalls = 0;
  const store = createMatchCenterStore({
    repository:{
      base:async () => ({
        match:{
          competition:'serie_a',
          matchId:'serie_a:77',
          status:'scheduled',
          kickoffAt:'2026-09-20T18:00:00Z',
          homeTeam:{ id:'1', name:'Интер', crestUrl:'' },
          awayTeam:{ id:'2', name:'Ювентус', crestUrl:'' },
          score:{ home:null, away:null },
          coverage:falseCoverage(),
        },
      }),
      section:async (_competition, _matchId, section) => {
        sectionCalls += 1;
        return {
          section,
          available:true,
          coverage:{ ...falseCoverage(), [section]:true },
          data:{ venue:'San Siro', referee:'Orsato' },
        };
      },
    },
    documentRef:null,
  });

  await store.open({ competition:'serie_a', matchId:'serie_a:77' });
  const state = store.getState();

  assert.equal(sectionCalls, 1);
  assert.equal(state.sectionState.overview.status, 'ready');
  assert.equal(state.match.coverage.overview, true);
  assert.deepEqual(state.sections.overview, { venue:'San Siro', referee:'Orsato' });
});

test('Round 40 Match Center tabs are one premium segmented control themed by competition accent', () => {
  const html = renderMatchCenterView({
    open:true,
    phase:'ready',
    competition:'uel',
    matchId:'uel:77',
    activeTab:'overview',
    match:{
      competition:'uel',
      matchId:'uel:77',
      status:'scheduled',
      kickoffAt:'2026-09-20T18:00:00Z',
      homeTeam:{ name:'Рома', crestUrl:'' },
      awayTeam:{ name:'Бетис', crestUrl:'' },
      score:{ home:null, away:null },
      coverage:{ overview:true, stats:true, events:true, lineups:true, players:true },
    },
    sections:{ overview:{}, stats:null, events:null, lineups:null, players:null },
    sectionState:{
      overview:{ status:'ready', error:'' },
      stats:{ status:'idle', error:'' },
      events:{ status:'idle', error:'' },
      lineups:{ status:'idle', error:'' },
      players:{ status:'idle', error:'' },
    },
  });

  assert.match(html, /\.cw239-mc-tabs\{[^}]*padding:4px[^}]*border:1px solid var\(--mc-border\)[^}]*border-radius:16px[^}]*background:/s);
  assert.match(html, /\.cw239-mc-tab\{[^}]*border:0[^}]*border-radius:12px/s);
  assert.match(html, /\.cw239-mc-tab\.is-active\{[^}]*linear-gradient\([^)]*var\(--mc-accent\)[^)]*var\(--mc-accent-2\)[^)]*\)[^}]*box-shadow:/s);
  assert.match(html, /--mc-accent:#f06722;--mc-accent-2:#ff9b32/);
  assert.equal((html.match(/class="cw239-mc-tabs"/g) || []).length, 1);
  assert.equal((html.match(/class="cw239-mc-tab(?: is-active)?"/g) || []).length, 5);
});
