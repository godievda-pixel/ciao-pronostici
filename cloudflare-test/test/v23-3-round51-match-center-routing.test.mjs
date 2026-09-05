import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  resolveRound51MatchTarget,
  installRound51MatchLinks,
} from '../src/v23.3/round51-match-center-links.mjs';

function fakeTarget(kind, { competition = 'serie_a', matchId = 'serie_a:77' } = {}) {
  const canonical = {
    dataset:{ cw233Competition:competition, cw233Match:matchId },
  };
  const prediction = {
    dataset:{ cw233PredCard:matchId },
  };
  const profile = {
    dataset:{ cw232Competition:competition, cw232ProfileMatch:matchId },
  };
  const competitionHost = {
    dataset:{ cw232Competition:competition },
  };
  const schedule = {
    dataset:{ cw232Match:matchId },
    closest(selector) {
      return selector === '[data-cw232-competition]' ? competitionHost : null;
    },
  };

  return {
    closest(selector) {
      if (kind === 'prediction-control' && selector.includes('[data-cw233-delta]')) return {};
      if (kind === 'interactive' && selector.includes('button')) return {};
      if (selector.includes('[data-cw233-delta]') || selector.includes('button,input,select,textarea,a')) return null;
      if (selector === '[data-cw233-match][data-cw233-competition]') return kind === 'home' ? canonical : null;
      if (selector === '[data-cw233-pred-card]') return kind === 'predictions' ? prediction : null;
      if (selector === '[data-cw232-profile-match][data-cw232-competition]') return kind === 'club-profile' ? profile : null;
      if (selector === '[data-cw232-match]') return kind === 'matches' ? schedule : null;
      return null;
    },
  };
}

function stripOptionalBootstrap(payload) {
  const { initialMatch, ...rest } = payload || {};
  return rest;
}

test('Round 51 resolves Home match cards with source metadata only', () => {
  const payload = resolveRound51MatchTarget(fakeTarget('home', { competition:'serie_a', matchId:'serie_a:10' }));
  assert.deepEqual(stripOptionalBootstrap(payload), {
    competition:'serie_a',
    matchId:'serie_a:10',
    source:{ surface:'home', tab:'predict', competition:'serie_a' },
  });
});

test('Round 51 resolves Predictions cards without lifecycle capture', () => {
  const payload = resolveRound51MatchTarget(fakeTarget('predictions', { competition:'ucl', matchId:'ucl:20' }));
  assert.deepEqual(stripOptionalBootstrap(payload), {
    competition:'ucl',
    matchId:'ucl:20',
    source:{ surface:'predictions', tab:'mine', competition:'ucl' },
  });
});

test('Round 51 resolves Club Profile matches', () => {
  const payload = resolveRound51MatchTarget(fakeTarget('club-profile', { competition:'uel', matchId:'uel:30' }));
  assert.deepEqual(stripOptionalBootstrap(payload), {
    competition:'uel',
    matchId:'uel:30',
    source:{ surface:'club-profile', tab:'profile', competition:'uel' },
  });
});

test('Round 51 resolves Matches overlay schedule cards', () => {
  const payload = resolveRound51MatchTarget(fakeTarget('matches', { competition:'uecl', matchId:'uecl:40' }));
  assert.deepEqual(stripOptionalBootstrap(payload), {
    competition:'uecl',
    matchId:'uecl:40',
    source:{ surface:'matches', tab:'calendar', competition:'uecl' },
  });
});

test('Round 51 ignores prediction controls and generic interactive targets', () => {
  assert.equal(resolveRound51MatchTarget(fakeTarget('prediction-control')), null);
  assert.equal(resolveRound51MatchTarget(fakeTarget('interactive')), null);
});

test('Round 51 router opens the new runtime directly and leaves source page untouched', () => {
  let handler = null;
  const opened = [];
  const sourcePage = { hidden:false, scrollTop:144, className:'source-page' };
  const documentRef = {
    addEventListener(type, fn, capture) {
      if (type === 'click' && capture === true) handler = fn;
    },
    removeEventListener() {},
  };
  const router = installRound51MatchLinks(documentRef, {
    open(payload) { opened.push(payload); },
  });
  assert.ok(router);
  assert.equal(typeof handler, 'function');

  let prevented = 0;
  let stopped = 0;
  let immediate = 0;
  handler({
    target:fakeTarget('matches', { competition:'serie_a', matchId:'serie_a:55' }),
    preventDefault() { prevented += 1; },
    stopPropagation() { stopped += 1; },
    stopImmediatePropagation() { immediate += 1; },
  });

  assert.equal(opened.length, 1);
  assert.equal(opened[0].competition, 'serie_a');
  assert.equal(opened[0].matchId, 'serie_a:55');
  assert.deepEqual(opened[0].source, { surface:'matches', tab:'calendar', competition:'serie_a' });
  assert.deepEqual(sourcePage, { hidden:false, scrollTop:144, className:'source-page' });
  assert.equal(prevented, 1);
  assert.equal(stopped, 1);
  assert.equal(immediate, 1);
});

test('Round 51 router/runtime source contains no legacy lifecycle escape hatch', async () => {
  const [links, runtime] = await Promise.all([
    readFile(new URL('../src/v23.3/round51-match-center-links.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../src/v23.3/round51-match-center-runtime.mjs', import.meta.url), 'utf8'),
  ]);
  const combined = `${links}\n${runtime}`;
  assert.doesNotMatch(combined, /match-center-lifecycle|CiaoV233MatchCenterLifecycle|suspendMatchSource|restoreMatchSource|MATCH_CENTER_OWNER_CLASS/);
  assert.doesNotMatch(combined, /ciao-v233-open-serie-a-match|ciao-v233-open-external-legacy-match/);
  assert.match(links, /openRound51MatchCenter/);
});
