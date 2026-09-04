import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { normalizeFavoriteTeam } from '../src/v23.3/prediction-auth.mjs';
import { resolveCanonicalMatchTarget } from '../src/v23.3/match-center-links.mjs';
import { captureMatchSource } from '../src/v23.3/match-center-lifecycle.mjs';

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

test('Round 38 match routing identifies that a match was opened from Predictions', () => {
  const target = predictionMatchTarget();
  const payload = resolveCanonicalMatchTarget(target);
  assert.equal(payload?.source?.surface, 'predictions');
  assert.equal(payload?.source?.tab, 'mine');
  const source = captureMatchSource({ querySelector:() => null, getElementById:() => null }, target);
  assert.equal(source.surface, 'predictions');
  assert.equal(source.navTab, 'mine');
  assert.equal(source.competition, 'coppa_italia');
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

test('Round 38 replaces Round 37 Match Center lifecycle ownership', async () => {
  assert.equal(existsSync(round37Url), true, 'round37-runtime.mjs must exist');
  const runtime = await import(round37Url.href);
  assert.equal('normalizeMatchSource' in runtime, false);
  assert.equal('MATCH_CENTER_BACK_EVENT' in runtime, false);
  assert.match(indexSource, /match-center-lifecycle\.mjs/);
});

test('Ranking keeps predictor profile public contract', async () => {
  assert.equal(existsSync(predictorProfileUrl), true, 'predictor-profile-ui.mjs must exist');
  const source = existsSync(predictorProfileUrl) ? readFileSync(predictorProfileUrl, 'utf8') : '';
  assert.match(source, /public_predictor/);
  assert.match(source, /data-cw233-predictor-id/);
  assert.match(indexSource, /predictor-profile-ui\.mjs/);
});

test('favorite-club asset resolver supports legacy custom emoji', async () => {
  const profiles = await import(predictorProfileUrl.href);
  assert.equal(
    profiles.favoriteTeamAssetUrl({ customEmojiId:'emoji-123' }),
    '/api/ciao-core-api-fast-v4?asset=emoji&id=emoji-123',
  );
  assert.equal(
    profiles.favoriteTeamAssetUrl({ custom_emoji_id:'emoji with spaces' }),
    '/api/ciao-core-api-fast-v4?asset=emoji&id=emoji%20with%20spaces',
  );
  assert.equal(profiles.favoriteTeamAssetUrl({ crestUrl:'https://img.test/club.png' }), 'https://img.test/club.png');
});

test('Round 37 no longer performs post-render standings compaction', async () => {
  const runtime = await import(round37Url.href);
  assert.equal('COMPACT_STANDING_KEEP' in runtime, false);
  assert.equal('compactStandingValues' in runtime, false);
});

test('Round 37 prediction card theme variables follow the selected tournament', async () => {
  const runtime = await import(round37Url.href);
  assert.deepEqual(runtime.predictionCardTheme('coppa'), { accent:'#e53b49', accent2:'#087e46' });
  assert.deepEqual(runtime.predictionCardTheme('champions'), { accent:'#4b63ff', accent2:'#222b9d' });
  assert.deepEqual(runtime.predictionCardTheme('europa'), { accent:'#ff790d', accent2:'#b84000' });
  assert.deepEqual(runtime.predictionCardTheme('conference'), { accent:'#22c875', accent2:'#087b46' });
  assert.deepEqual(runtime.predictionCardTheme('serie-a'), { accent:'#0c5aa8', accent2:'#287fc7' });
});
