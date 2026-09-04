import test from 'node:test';
import assert from 'node:assert/strict';

import { createMatchCenterStore } from '../src/v23.3/match-center-store.mjs';

function canonicalBase() {
  return {
    competition:'ucl',
    matchId:'ucl:42',
    status:'scheduled',
    minute:null,
    kickoffAt:'2026-09-10T19:00:00Z',
    homeTeam:{ id:'1', name:'Inter', crestUrl:'inter.png' },
    awayTeam:{ id:'2', name:'Milan', crestUrl:'milan.png' },
    score:{ home:null, away:null },
    venue:null,
    referee:null,
    coverage:{ overview:true, stats:true, events:true, lineups:true, players:true },
    updatedAt:null,
  };
}

test('opening canonical Match Center loads the active Overview section without a second tab click', async () => {
  const sectionCalls = [];
  const store = createMatchCenterStore({
    repository:{
      base:async () => canonicalBase(),
      section:async (competition, matchId, section, options) => {
        sectionCalls.push({ competition, matchId, section, options });
        return {
          section,
          available:true,
          coverage:{ overview:true, stats:true, events:true, lineups:true, players:true },
          data:{ venue:'San Siro' },
        };
      },
    },
    documentRef:{ hidden:false, addEventListener() {} },
  });

  await store.open({ competition:'ucl', matchId:'ucl:42' });

  const state = store.getState();
  assert.equal(state.activeTab, 'overview');
  assert.equal(state.sectionState.overview.status, 'ready');
  assert.deepEqual(state.sections.overview, { venue:'San Siro' });
  assert.deepEqual(sectionCalls, [{
    competition:'ucl',
    matchId:'ucl:42',
    section:'overview',
    options:{ force:false, status:'scheduled' },
  }]);
});
