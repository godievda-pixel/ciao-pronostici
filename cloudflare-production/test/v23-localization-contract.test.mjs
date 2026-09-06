import test from 'node:test';
import assert from 'node:assert/strict';
import {
  localizeCompetition,
  localizeStage,
  localizeTeam,
} from '../../supabase/functions/ciao-v23-api/domain/localization.mjs';

test('v23 competition names are Russian-only and exact', () => {
  assert.equal(localizeCompetition('serie_a'), 'Серия А');
  assert.equal(localizeCompetition('coppa_italia'), 'Кубок Италии');
  assert.equal(localizeCompetition('ucl'), 'Лига чемпионов');
  assert.equal(localizeCompetition('uel'), 'Лига Европы');
  assert.equal(localizeCompetition('uecl'), 'Лига конференций');
  assert.throws(() => localizeCompetition('epl'), /competition_not_supported:epl/);
});

test('v23 stage names are localized before reaching user-facing API fields', () => {
  assert.equal(localizeStage('Round of 16'), '1/8 финала');
  assert.equal(localizeStage('Quarter-finals'), '1/4 финала');
  assert.equal(localizeStage('Quarter-final'), '1/4 финала');
  assert.equal(localizeStage('Semi-finals'), '1/2 финала');
  assert.equal(localizeStage('Semi-final'), '1/2 финала');
  assert.equal(localizeStage('Final'), 'Финал');
  assert.equal(localizeStage('League phase'), 'Общий этап');
  assert.equal(localizeStage('Group stage'), 'Групповой этап');
  assert.equal(localizeStage('Matchday 3'), '3-й тур');
  assert.throws(() => localizeStage('Unknown provider stage'), /stage_localization_missing:Unknown provider stage/);
});

test('team localization returns Russian canonical and grammatical forms without provider name leakage', () => {
  const lookup = new Map([
    ['10', {
      provider_team_id: '10',
      name_ru: 'Интер',
      genitive_ru: 'Интера',
      dative_ru: 'Интеру',
      prepositional_ru: 'Интере',
      aliases_ru: ['Интер Милан'],
    }],
  ]);

  const localized = localizeTeam({
    id: 10,
    nameProvider: 'Inter',
    countryCode: 'IT',
    crestUrl: 'https://sports.example/team/10.png',
  }, lookup);

  assert.deepEqual(localized, {
    id: '10',
    nameRu: 'Интер',
    genitiveRu: 'Интера',
    dativeRu: 'Интеру',
    prepositionalRu: 'Интере',
    aliasesRu: ['Интер Милан'],
    countryCode: 'IT',
    crestUrl: 'https://sports.example/team/10.png',
  });
  assert.equal('nameProvider' in localized, false);
});

test('missing team localization fails closed instead of returning an English fallback', () => {
  assert.throws(
    () => localizeTeam({id: '999', nameProvider: 'Unknown FC', countryCode: 'GB'}, new Map()),
    /team_localization_missing:999/,
  );
});
