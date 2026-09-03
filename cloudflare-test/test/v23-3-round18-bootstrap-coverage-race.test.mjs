import test from 'node:test';
import assert from 'node:assert/strict';
import { createMatchCenterController } from '../src/v23.3/match-center-core.mjs';
import { prepareCanonicalMatchCenterPayload } from '../src/v23.3/match-center.mjs';

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

test('Round 18 routed open treats bootstrap coverage as non-authoritative before first lazy section request', async () => {
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

  const payload = prepareCanonicalMatchCenterPayload({
    competition:'coppa_italia',
    matchId:'coppa_italia:77',
    initialMatch:bootstrap,
  });
  assert.equal(Object.prototype.hasOwnProperty.call(payload.initialMatch, 'coverage'), false);

  await controller.open(payload);

  assert.equal(sectionCalls, 1);
  assert.equal(controller.getState().sectionState.overview.status, 'ready');
  assert.equal(controller.getState().sections.overview.venue.name, 'Renzo Barbera');
  assert.equal(controller.getState().match.coverage.overview, true);
});

test('Round 18 bootstrap preparation leaves Serie A legacy delegation payload untouched', () => {
  const payload = {
    competition:'serie_a',
    matchId:'serie_a:77',
    initialMatch:{ ...bootstrapMatch(), competition:'serie_a', matchId:'serie_a:77' },
  };
  assert.equal(prepareCanonicalMatchCenterPayload(payload), payload);
});
