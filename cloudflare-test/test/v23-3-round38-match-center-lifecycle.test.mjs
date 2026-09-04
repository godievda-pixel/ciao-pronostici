import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  captureMatchSource,
  restoreMatchSource,
  MATCH_CENTER_OWNER_CLASS,
} from '../src/v23.3/match-center-lifecycle.mjs';

function fakeTarget(kind, competition = '') {
  return {
    closest(selector) {
      if (kind === 'matches' && selector === '[data-cw232-match]') {
        return {
          closest(inner) {
            if (inner === '[data-cw232-competition]') return { dataset:{ cw232Competition:competition } };
            return null;
          },
        };
      }
      if (kind === 'predictions' && selector.includes('[data-cw233-pred-card]')) {
        return { dataset:{ cw233Competition:competition } };
      }
      if (kind === 'club-profile' && selector === '[data-cw232-profile-match]') {
        return { dataset:{ cw232Competition:competition } };
      }
      return null;
    },
  };
}

function fakeDocument() {
  const rootClasses = new Set();
  const htmlClasses = new Set([MATCH_CENTER_OWNER_CLASS]);
  const matchesOverlay = {
    hidden:true,
    scrollTop:61,
    dataset:{ cw238MatchCenterSuspended:'1' },
    removeAttribute(name) { if (name === 'aria-hidden') this.ariaHidden = false; },
  };
  const content = { scrollTop:27 };
  const navClicks = [];
  return {
    documentElement:{ classList:{ add:v=>htmlClasses.add(v), remove:v=>htmlClasses.delete(v), contains:v=>htmlClasses.has(v) } },
    getElementById(id) {
      if (id === 'ciao-miniapp-root') return { classList:{ add:v=>rootClasses.add(v), remove:v=>rootClasses.delete(v), contains:v=>rootClasses.has(v) } };
      if (id === 'ciao-v232-matches-overlay') return matchesOverlay;
      return null;
    },
    querySelector(selector) {
      if (selector === '#ciao-miniapp-root .content') return content;
      const match = selector.match(/button\[data-tab="([^"]+)"\]/);
      if (match) return { click:() => navClicks.push(match[1]) };
      return null;
    },
    __state:{ rootClasses, htmlClasses, matchesOverlay, content, navClicks },
  };
}

test('captures matches source without guessing from Match Center state', () => {
  const doc = fakeDocument();
  const source = captureMatchSource(doc, fakeTarget('matches', 'serie_a'));
  assert.equal(source.surface, 'matches');
  assert.equal(source.competition, 'serie_a');
  assert.equal(source.navTab, 'calendar');
  assert.equal(source.scrollTop, 27);
  assert.equal(source.matchesOverlayScrollTop, 61);
});

test('captures predictions and club profile sources explicitly', () => {
  const doc = fakeDocument();
  assert.equal(captureMatchSource(doc, fakeTarget('predictions', 'ucl')).surface, 'predictions');
  assert.equal(captureMatchSource(doc, fakeTarget('club-profile', 'serie_a')).surface, 'club-profile');
});

test('restores Matches surface and clears viewport ownership', () => {
  const doc = fakeDocument();
  restoreMatchSource(doc, {
    surface:'matches', competition:'serie_a', navTab:'calendar', scrollTop:27, matchesOverlayScrollTop:61,
  });
  assert.equal(doc.__state.htmlClasses.has(MATCH_CENTER_OWNER_CLASS), false);
  assert.equal(doc.__state.matchesOverlay.hidden, false);
  assert.equal(doc.__state.matchesOverlay.scrollTop, 61);
  assert.deepEqual(doc.__state.navClicks, ['calendar']);
});

test('round37 no longer owns Match Center back or parent overlay lifecycle', async () => {
  const source = await import('../src/v23.3/round37-runtime.mjs?round38-lifecycle');
  assert.equal('dispatchMatchCenterBack' in source, false);
  assert.equal('restoreMatchSource' in source, false);
});

test('round31 no longer watches root class or owns parent Match Center viewport', async () => {
  const source = await readFile(new URL('../src/v23.3/round31-match-center-stability.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /cw233-r31-match-center-owned/);
  assert.doesNotMatch(source, /MutationObserver/);
  assert.doesNotMatch(source, /closest\?\.\('\.mc-back'\)/);
});
