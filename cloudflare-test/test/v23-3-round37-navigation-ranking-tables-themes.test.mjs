import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { normalizeFavoriteTeam } from '../src/v23.3/prediction-auth.mjs';
import { resolveCanonicalMatchTarget } from '../src/v23.3/match-center-links.mjs';
import { renderTablesHub } from '../src/v23.3/tables-ui.mjs';

const rankingSource = readFileSync(new URL('../src/v23.3/ranking-ui.mjs', import.meta.url), 'utf8');
const matchCenterSource = readFileSync(new URL('../src/v23.3/match-center.mjs', import.meta.url), 'utf8');
const round11Source = readFileSync(new URL('../src/v23.3/round11-performance-themes.mjs', import.meta.url), 'utf8');
const indexSource = readFileSync(new URL('../src/v23.3/index.mjs', import.meta.url), 'utf8');
const predictorProfileUrl = new URL('../src/v23.3/predictor-profile-ui.mjs', import.meta.url);

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

test('Round 37 Match Center has an explicit back-handoff event instead of falling through to a blank shell', () => {
  assert.match(matchCenterSource, /ciao-v233-match-center-back/);
  assert.match(matchCenterSource, /source/i);
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

test('Round 37 Ranking restores clickable predictor profiles through the legacy public_predictor contract', () => {
  assert.equal(existsSync(predictorProfileUrl), true, 'predictor-profile-ui.mjs must exist');
  assert.match(rankingSource, /data-cw233-predictor-id/);
  assert.match(indexSource, /predictor-profile-ui\.mjs/);
});

test('Round 37 league tables use the compact production columns', () => {
  const html = renderTablesHub({
    selectedCompetition:'serie_a',
    data:{ rows:[{
      position:1,
      team:{ id:1, name:'Рома', crestUrl:'https://img.test/roma.png' },
      played:2,
      wins:2,
      draws:0,
      losses:0,
      goalsFor:8,
      goalsAgainst:0,
      goalDifference:8,
      points:6,
    }] },
  });
  assert.match(html, /<th>#<\/th><th>Команда<\/th><th>И<\/th><th>РМ<\/th><th>О<\/th>/);
  assert.doesNotMatch(html, /<th>В<\/th>|<th>Н<\/th>|<th>П<\/th>|<th>Г<\/th>/);
  assert.match(html, /data-cw233-theme="serie-a"/);
});

test('Round 37 prediction match cards use tournament variables instead of hard-coded Serie A blue', () => {
  assert.doesNotMatch(round11Source, /rgba\(24,42,91/);
  assert.doesNotMatch(round11Source, /rgba\(12,24,55/);
  assert.match(round11Source, /\.cw233-prediction-page \.match[\s\S]*var\(--r11a\)/);
  assert.match(round11Source, /\.cw233-prediction-page \.match[\s\S]*var\(--r11b\)/);
});
