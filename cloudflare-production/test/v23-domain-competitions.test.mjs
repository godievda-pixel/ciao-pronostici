import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COMPETITIONS,
  competitionById,
  rankingCompetitionIds,
  isEuropeanCompetition,
  isQualificationStage,
  isCoppaVisibleStage,
} from '../../supabase/functions/ciao-v23-api/domain/competitions.mjs';

test('v23 competition registry is stable and Russian-labelled', () => {
  assert.deepEqual(COMPETITIONS.map(x => x.id), ['serie_a','coppa_italia','ucl','uel','uecl']);
  assert.equal(competitionById('serie_a').nameRu, 'Серия А');
  assert.equal(competitionById('coppa_italia').nameRu, 'Кубок Италии');
  assert.equal(competitionById('ucl').nameRu, 'Лига чемпионов');
  assert.equal(competitionById('uel').nameRu, 'Лига Европы');
  assert.equal(competitionById('uecl').nameRu, 'Лига конференций');
});

test('ranking scopes are exact', () => {
  assert.deepEqual(rankingCompetitionIds('all'), ['serie_a','coppa_italia','ucl','uel','uecl']);
  assert.deepEqual(rankingCompetitionIds('italy'), ['serie_a','coppa_italia']);
  assert.deepEqual(rankingCompetitionIds('europe'), ['ucl','uel','uecl']);
});

test('European and stage policies are deterministic', () => {
  assert.equal(isEuropeanCompetition('ucl'), true);
  assert.equal(isEuropeanCompetition('uel'), true);
  assert.equal(isEuropeanCompetition('uecl'), true);
  assert.equal(isEuropeanCompetition('serie_a'), false);
  assert.equal(isQualificationStage('Qualifying round 3'), true);
  assert.equal(isQualificationStage('Preliminary round'), true);
  assert.equal(isQualificationStage('League phase'), false);
  assert.equal(isCoppaVisibleStage('Round of 16'), true);
  assert.equal(isCoppaVisibleStage('Quarter-finals'), true);
  assert.equal(isCoppaVisibleStage('Round of 32'), false);
});
