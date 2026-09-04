import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  favoriteTeamAssetUrl,
  predictorIdFromRankingRow,
  renderRankingRow,
} from '../src/v23.3/ranking-ui.mjs';

test('favorite team supports Telegram custom emoji in initial renderer', () => {
  assert.equal(
    favoriteTeamAssetUrl({ custom_emoji_id:'emoji with spaces' }),
    '/api/ciao-core-api-fast-v4?asset=emoji&id=emoji%20with%20spaces',
  );
  assert.equal(favoriteTeamAssetUrl({ crestUrl:'https://img.test/milan.png' }), 'https://img.test/milan.png');
});

test('predictor id is available to initial ranking render', () => {
  assert.equal(predictorIdFromRankingRow({ user_id:'telegram:42' }), 42);
  const html = renderRankingRow({
    position:1,
    user_id:'telegram:42',
    display_name:'Daniil',
    username:'danx95',
    points:2,
    favorite_team:{ name:'Милан', custom_emoji_id:'milan-emoji' },
  });
  assert.match(html, /data-cw233-predictor-id="42"/);
  assert.match(html, /asset=emoji&amp;id=milan-emoji|asset=emoji&id=milan-emoji/);
  assert.doesNotMatch(html, />⚽</);
});

test('profile UI contains no whole-document ranking hydration/refetch observer', async () => {
  const source = await readFile(new URL('../src/v23.3/predictor-profile-ui.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /hydrateRankingPredictors/);
  assert.doesNotMatch(source, /scheduleHydrate/);
  assert.doesNotMatch(source, /createPredictionClient/);
  assert.doesNotMatch(source, /observer\.observe\?\.\(documentRef\.documentElement/);
});

test('ranking UI has no all-scope background prefetch storm', async () => {
  const source = await readFile(new URL('../src/v23.3/ranking-ui.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /warmCompetitions|requestIdleCallback/);
});
