import test from 'node:test';
import assert from 'node:assert/strict';
import { createMatchCenterController } from '../src/v23.3/match-center-core.mjs';

function bootstrapMatch() {
  return {
    competition:'coppa_italia',
    matchId:'coppa_italia:77',
    status:'finished',
    kickoffAt:'2026-09-03T16:00:00Z',
    homeTeam:{ name:'Палермо' },
    awayTeam:{ name:'Мантова' },
    coverage:{
      overview:false,
      stats:false,
      events:false,
      lineups:false,
      players:false,
      momentum:false,
      shotmap:false,
    },
  };
}

test('Round 18 first lazy section request ignores stale false coverage from bootstrap card', async () => {
  const bootstrap = bootstrapMatch();
  const authoritative = {
    ...bootstrap,
    coverage:{
      overview:true,
      stats:true,
      events:true,
      lineups:true,
      players:true,
      momentum:false,
      shotmap:false,
    },
  };
  let sectionCalls = 0;
  const controller = createMatchCenterController({
    loadSnapshot:async () => ({ match:authoritative }),
    loadSection:async (_competition, _matchId, section) => {
      sectionCalls += 1;
      assert.equal(section, 'overview');
      return {
        section:'overview',
        available:true,
        coverage:authoritative.coverage,
        data:{
          venue:{ name:'Renzo Barbera', city:'Palermo', capacity:null },
          referee:null,
          form:{ home:[], away:[] },
          prediction:null,
          predictionSplit:null,
          momentum:null,
          shotmap:null,
        },
      };
    },
    documentRef:{ hidden:false, addEventListener(){} },
  });

  await controller.open({
    competition:'coppa_italia',
    matchId:'coppa_italia:77',
    initialMatch:bootstrap,
  });

  assert.equal(sectionCalls, 1);
  assert.equal(controller.getState().sectionState.overview.status, 'ready');
  assert.equal(controller.getState().sections.overview.venue.name, 'Renzo Barbera');
  assert.equal(controller.getState().match.coverage.overview, true);
});
