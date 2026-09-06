import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ROUND512_USER_VIEW_TABS,
  canonicalRound512UserView,
  providerSectionForRound512UserView,
  enhanceRound512MatchCenterView,
} from '../src/v23.3/round51-2-match-center-view.mjs';

test('Round 51.2 exposes exactly the five approved user-facing Match Center tabs', () => {
  assert.deepEqual(ROUND512_USER_VIEW_TABS, [
    { key:'overview', label:'Обзор' },
    { key:'lineups', label:'Составы' },
    { key:'events', label:'События' },
    { key:'statistics', label:'Статистика' },
    { key:'shots', label:'Удары' },
  ]);
});

test('Round 51.2 maps statistics and shots to the same canonical stats provider section', () => {
  assert.equal(providerSectionForRound512UserView('overview'), 'overview');
  assert.equal(providerSectionForRound512UserView('lineups'), 'lineups');
  assert.equal(providerSectionForRound512UserView('events'), 'events');
  assert.equal(providerSectionForRound512UserView('statistics'), 'stats');
  assert.equal(providerSectionForRound512UserView('shots'), 'stats');
});

test('Round 51.2 canonicalizes unknown user views to overview without exposing provider-only players', () => {
  assert.equal(canonicalRound512UserView('shots'), 'shots');
  assert.equal(canonicalRound512UserView('players'), 'overview');
  assert.equal(canonicalRound512UserView('anything'), 'overview');
});

const statsHtml = `
<div class="cw239-mc">
  <div class="cw239-mc-tabs">
    <button data-cw239-tab="overview">Обзор</button>
    <button data-cw239-tab="stats">Статы</button>
    <button data-cw239-tab="events">События</button>
    <button data-cw239-tab="lineups">Составы</button>
    <button data-cw239-tab="players">Игроки</button>
  </div>
  <section class="cw239-mc-detail" data-cw239-active-section="stats">
    <div data-cw233-mc-stats-section><b>Владение</b></div>
    <div data-cw250-mc-pressure><b>Давление</b></div>
    <div data-cw233-mc-shotmap><button data-cw502-action="shot">xG 0.31</button></div>
    <div data-cw233-mc-shot-list><article>Paulo Dybala</article></div>
    <article class="cw502-selected-shot" data-cw502-selected-shot="0">Paulo Dybala · xG 0.31</article>
  </section>
</div>`;

const state = {
  activeTab:'stats',
  match:{ homeTeam:{ name:'Рома' }, awayTeam:{ name:'Аталанта' } },
  sectionState:{ stats:{ status:'ready' } },
  sections:{
    stats:{
      shots:[{ player:'Paulo Dybala', minute:64, xg:0.31, outcome:'saved', side:'home' }],
    },
  },
};

test('Round 51.2 Statistics view keeps metrics but removes shot-specific UI', () => {
  const html = enhanceRound512MatchCenterView(statsHtml, state, { activeUserView:'statistics' });
  assert.match(html, />Статистика<\/button>/);
  assert.match(html, /data-cw512-user-view="statistics"[^>]*aria-selected="true"/);
  assert.match(html, /data-cw233-mc-stats-section/);
  assert.match(html, /data-cw250-mc-pressure/);
  assert.doesNotMatch(html, /data-cw233-mc-shotmap/);
  assert.doesNotMatch(html, /data-cw233-mc-shot-list/);
  assert.doesNotMatch(html, /cw502-selected-shot/);
});

test('Round 51.2 Shots view keeps shot map/list but removes general statistics', () => {
  const html = enhanceRound512MatchCenterView(statsHtml, state, { activeUserView:'shots' });
  assert.match(html, />Удары<\/button>/);
  assert.match(html, /data-cw512-user-view="shots"[^>]*aria-selected="true"/);
  assert.doesNotMatch(html, /data-cw233-mc-stats-section/);
  assert.doesNotMatch(html, /data-cw250-mc-pressure/);
  assert.match(html, /data-cw233-mc-shotmap/);
  assert.match(html, /data-cw233-mc-shot-list/);
  assert.match(html, /Paulo Dybala/);
});

test('Round 51.2 mobile view prevents recent event chips from being clipped horizontally', () => {
  const html = enhanceRound512MatchCenterView('<div class="cw239-mc"></div>', {}, { activeUserView:'overview' });
  assert.match(html, /data-cw512-mobile-layout-style/);
  assert.match(html, /@media\(max-width:430px\)/);
  assert.match(html, /\.cw250-recent-events\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\);overflow:visible/);
  assert.match(html, /\.cw250-event-chip\{min-width:0;max-width:none;overflow:hidden;text-overflow:ellipsis/);
});
