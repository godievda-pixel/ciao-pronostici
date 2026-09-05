import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ROUND503_VIEW_TABS,
  canonicalRound503ViewTab,
  providerTabForRound503View,
  round503SnapHeights,
  resolveRound503Snap,
  enhanceRound503MatchCenterView,
} from '../src/v23.3/round50-3-match-center-view.mjs';

test('Round 50.3 exposes exactly the approved five user views in order', () => {
  assert.deepEqual(ROUND503_VIEW_TABS.map(tab => [tab.key, tab.label]), [
    ['overview', 'Обзор'],
    ['lineups', 'Составы'],
    ['events', 'События'],
    ['statistics', 'Статистика'],
    ['shots', 'Удары'],
  ]);
});

test('Round 50.3 maps Statistics and Shots to the existing stats provider contract', () => {
  assert.equal(providerTabForRound503View('overview'), 'overview');
  assert.equal(providerTabForRound503View('lineups'), 'lineups');
  assert.equal(providerTabForRound503View('events'), 'events');
  assert.equal(providerTabForRound503View('statistics'), 'stats');
  assert.equal(providerTabForRound503View('shots'), 'stats');
  assert.equal(canonicalRound503ViewTab('unknown'), 'overview');
});

test('Round 50.3 drawer snap targets are deterministic viewport-relative heights', () => {
  assert.deepEqual(round503SnapHeights(800), {
    compact:368,
    standard:624,
    expanded:752,
  });
});

test('Round 50.3 drawer expands on a meaningful upward drag and dismisses only downward from compact', () => {
  assert.deepEqual(
    resolveRound503Snap({ viewportHeight:800, currentHeight:624, deltaY:-120 }),
    { action:'snap', snap:'expanded', height:752 },
  );
  assert.deepEqual(
    resolveRound503Snap({ viewportHeight:800, currentHeight:368, deltaY:120 }),
    { action:'dismiss' },
  );
});

const providerStatsHtml = `<main>
  <nav class="cw239-mc-tabs" data-cw239-tabs>
    <button data-cw239-tab="overview">Обзор</button>
    <button data-cw239-tab="stats">Статистика</button>
    <button data-cw239-tab="events">События</button>
    <button data-cw239-tab="lineups">Составы</button>
    <button data-cw239-tab="players">Игроки</button>
  </nav>
  <section data-cw239-active-section="stats">
    <div class="cw233-mc-stat-group" data-cw233-mc-stats-section="primary">PRIMARY_STATS</div>
    <section class="cw250-mc-pressure" data-cw250-mc-pressure>PRESSURE</section>
    <section class="cw233-mc-shot-analysis" data-cw233-mc-shotmap>
      <button class="cw233-mc-shot-marker cw502-shot-marker" data-cw502-action="shot">SHOTMAP</button>
    </section>
    <div class="cw502-selected-shot">SELECTED_SHOT</div>
    <section class="cw233-mc-shot-list-wrap" data-cw233-mc-shot-list>SHOT_LIST</section>
  </section>
</main>`;

test('Round 50.3 Statistics keeps metrics and pressure but removes shot-specific content', () => {
  const html = enhanceRound503MatchCenterView(
    providerStatsHtml,
    { activeTab:'stats' },
    { activeViewTab:'statistics' },
  );

  assert.match(html, /Обзор/);
  assert.match(html, /Составы/);
  assert.match(html, /События/);
  assert.match(html, /Статистика/);
  assert.match(html, /Удары/);
  assert.doesNotMatch(html, />Игроки</);
  assert.match(html, /PRIMARY_STATS/);
  assert.match(html, /PRESSURE/);
  assert.doesNotMatch(html, /SHOTMAP/);
  assert.doesNotMatch(html, /SELECTED_SHOT/);
  assert.doesNotMatch(html, /SHOT_LIST/);
});

test('Round 50.3 Shots keeps interactive shot content and removes long general statistics', () => {
  const html = enhanceRound503MatchCenterView(
    providerStatsHtml,
    { activeTab:'stats' },
    { activeViewTab:'shots' },
  );

  assert.match(html, /SHOTMAP/);
  assert.match(html, /data-cw502-action="shot"/);
  assert.match(html, /SELECTED_SHOT/);
  assert.match(html, /SHOT_LIST/);
  assert.doesNotMatch(html, /PRIMARY_STATS/);
  assert.doesNotMatch(html, /PRESSURE/);
});
