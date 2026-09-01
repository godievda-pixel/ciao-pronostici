import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COMPETITION_KEYS,
  COMPETITIONS,
  getCompetitionConfig,
} from '../src/v23.2/competition-config.mjs';

test('v23.2 defines exactly five competition configs', () => {
  assert.deepEqual(COMPETITION_KEYS, [
    'serie_a',
    'coppa_italia',
    'ucl',
    'uel',
    'uecl',
  ]);
  assert.equal(Object.keys(COMPETITIONS).length, 5);
});

test('competition themes and navigation models are stable', () => {
  assert.deepEqual(getCompetitionConfig('serie_a'), {
    key: 'serie_a',
    title: 'Serie A',
    shortTitle: 'Serie A',
    theme: 'serie-a',
    navigation: 'rounds',
    european: false,
  });
  assert.equal(getCompetitionConfig('coppa_italia').navigation, 'stages');
  assert.equal(getCompetitionConfig('ucl').theme, 'champions');
  assert.equal(getCompetitionConfig('uel').theme, 'europa');
  assert.equal(getCompetitionConfig('uecl').theme, 'conference');
  assert.throws(() => getCompetitionConfig('unknown'), /Unknown competition/);
});
