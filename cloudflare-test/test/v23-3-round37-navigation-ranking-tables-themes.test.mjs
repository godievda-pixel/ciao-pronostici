import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { normalizeFavoriteTeam } from '../src/v23.3/prediction-auth.mjs';
import { resolveCanonicalMatchTarget } from '../src/v23.3/match-center-links.mjs';

const indexSource = readFileSync(new URL('../src/v23.3/index.mjs', import.meta.url), 'utf8');
const predictorProfileUrl = new URL('../src/v23.3/predictor-profile-ui.mjs', import.meta.url);
const round37Url = new URL('../src/v23.3/round37-runtime.mjs', import.meta.url);

function predictionMatchTarget() {
  const card = {
    dataset:{
      cw233Competition:'coppa_italia',
      cw233Match:'coppa_italia:123',
      cw233PredCard:'coppa_italia:123',
    },
    closest(){ return null; },
  };
  return {
    closest(selector) {
      if (selector.includes('data-cw233-delta') || selector.startsWith('button,')) return null;
      if (selector === '[data-cw233-match][data-cw233-competition]') return card;
      if (selector === '[data-cw233-pred-card]') return card;
      return null;
    },
  };
}

test('Round 37 match routing remembers that a match was opened from Predictions', () => {
  const payload = resolveCanonicalMatchTarget(predictionMatchTarget());
  assert.equal(payload?.source?.surface, 'predictions');
  assert.equal(payload?.source?.tab, 'mine');
});

test('Round 37 favorite-team normalization accepts flattened legacy state fields', () => {
  assert.deepEqual(normalizeFavoriteTeam({
    favorite_team_id:7,
    favorite_team_name:'Милан',
    favorite_team_logo:'https://img.test/milan.png',
  }), {
    id:7,
    name:'Милан',
    crestUrl:'https://img.test/milan.png',
    customEmojiId:null,
  });
});

test('Round 37 runtime defines source-aware Match Center back navigation', async () => {
  assert.equal(existsSync(round37Url), true, 'round37-runtime.mjs must exist');
  const runtime = await import(round37Url.href);
  assert.deepEqual(runtime.normalizeMatchSource({ surface:'predictions', tab:'mine', competition:'ucl' }), {
    surface:'predictions', tab:'mine', competition:'ucl',
  });
  assert.deepEqual(runtime.normalizeMatchSource({ surface:'unknown' }), {
    surface:'home', tab:'predict', competition:'',
  });
  assert.equal(runtime.MATCH_CENTER_BACK_EVENT, 'ciao-v233-match-center-back');
});

test('Round 37 Ranking restores clickable predictor profiles through the legacy public_predictor contract', async () => {
  assert.equal(existsSync(predictorProfileUrl), true, 'predictor-profile-ui.mjs must exist');
  const source = existsSync(predictorProfileUrl) ? readFileSync(predictorProfileUrl, 'utf8') : '';
  assert.match(source, /public_predictor/);
  assert.match(source, /data-cw233-predictor-id/);
  assert.match(indexSource, /predictor-profile-ui\.mjs/);
});

test('Round 37 compact tables keep only #, team, played, goal difference and points', async () => {
  assert.equal(existsSync(round37Url), true, 'round37-runtime.mjs must exist');
  const runtime = await import(round37Url.href);
  assert.deepEqual(runtime.COMPACT_STANDING_KEEP, [0, 1, 2, 7, 8]);
  assert.deepEqual(runtime.compactStandingValues(['#','Команда','И','В','Н','П','Г','РМ','О']), ['#','Команда','И','РМ','О']);
});

test('Round 37 prediction card theme variables follow the selected tournament', async () => {
  assert.equal(existsSync(round37Url), true, 'round37-runtime.mjs must exist');
  const runtime = await import(round37Url.href);
  assert.deepEqual(runtime.predictionCardTheme('coppa'), { accent:'#e53b49', accent2:'#087e46' });
  assert.deepEqual(runtime.predictionCardTheme('champions'), { accent:'#4b63ff', accent2:'#222b9d' });
  assert.deepEqual(runtime.predictionCardTheme('europa'), { accent:'#ff790d', accent2:'#b84000' });
  assert.deepEqual(runtime.predictionCardTheme('conference'), { accent:'#22c875', accent2:'#087b46' });
  assert.deepEqual(runtime.predictionCardTheme('serie-a'), { accent:'#0c5aa8', accent2:'#287fc7' });
});
