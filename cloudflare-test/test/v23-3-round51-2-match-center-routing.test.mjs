import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  installRound512MatchLinks,
  resolveRound512MatchTarget,
} from '../src/v23.3/round51-2-match-center-links.mjs';
import { rememberMatchBootstrap } from '../src/v23.3/match-bootstrap-cache.mjs';

function targetWith(map = {}) {
  return { closest(selector) { return map[selector] || null; } };
}

function canonicalCard(competition, matchId) {
  return { dataset:{ cw233Competition:competition, cw233Match:matchId } };
}

test('Round 51.2 routes Home, Predictions, Matches and Club Profile with source metadata', () => {
  const homeCard = canonicalCard('serie_a', 'serie_a:910');
  assert.deepEqual(resolveRound512MatchTarget(targetWith({
    '[data-cw233-match][data-cw233-competition]':homeCard,
  })), {
    competition:'serie_a',
    matchId:'serie_a:910',
    source:{ surface:'home', tab:'predict', competition:'serie_a' },
  });

  const predCard = { dataset:{ cw233PredCard:'ucl:911' } };
  assert.deepEqual(resolveRound512MatchTarget(targetWith({
    '[data-cw233-pred-card]':predCard,
  })), {
    competition:'ucl',
    matchId:'ucl:911',
    source:{ surface:'predictions', tab:'mine', competition:'ucl' },
  });

  const profileCard = { dataset:{ cw232Competition:'uel', cw232ProfileMatch:'uel:912' } };
  assert.deepEqual(resolveRound512MatchTarget(targetWith({
    '[data-cw232-profile-match][data-cw232-competition]':profileCard,
    '[data-cw232-profile-match]':profileCard,
  })), {
    competition:'uel',
    matchId:'uel:912',
    source:{ surface:'club-profile', tab:'profile', competition:'uel' },
  });

  const scheduleCard = { dataset:{ cw232Match:'uecl:913' }, closest(selector) {
    return selector === '[data-cw232-competition]' ? { dataset:{ cw232Competition:'uecl' } } : null;
  } };
  assert.deepEqual(resolveRound512MatchTarget(targetWith({ '[data-cw232-match]':scheduleCard })), {
    competition:'uecl',
    matchId:'uecl:913',
    source:{ surface:'matches', tab:'calendar', competition:'uecl' },
  });
});

test('Round 51.2 carries the richest cached bootstrap into the new runtime', () => {
  rememberMatchBootstrap({
    competition:'serie_a', matchId:'serie_a:914',
    homeTeam:{ name:'Рома', crestUrl:'https://img/roma.svg' },
    awayTeam:{ name:'Лацио', crestUrl:'https://img/lazio.svg' },
  });
  const payload = resolveRound512MatchTarget(targetWith({
    '[data-cw233-match][data-cw233-competition]':canonicalCard('serie_a', 'serie_a:914'),
  }));
  assert.equal(payload.initialMatch.homeTeam.crestUrl, 'https://img/roma.svg');
  assert.equal(payload.initialMatch.awayTeam.crestUrl, 'https://img/lazio.svg');
});

test('Round 51.2 ignores prediction controls and unrelated interactive elements but accepts the explicit Match Center button', () => {
  const card = canonicalCard('serie_a', 'serie_a:915');
  const delta = { dataset:{ cw233Delta:'h:1' } };
  assert.equal(resolveRound512MatchTarget(targetWith({
    '[data-cw233-delta],[data-cw233-save-all],[data-cw231-action="predict"]':delta,
    '[data-cw233-match][data-cw233-competition]':card,
  })), null);

  const genericButton = { dataset:{} };
  assert.equal(resolveRound512MatchTarget(targetWith({
    'button,input,select,textarea,a,[data-cw233-pred-nav]':genericButton,
    '[data-cw233-match][data-cw233-competition]':card,
  })), null);

  const matchButton = { dataset:{ cw231Action:'match-center' } };
  const target = targetWith({
    'button,input,select,textarea,a,[data-cw233-pred-nav]':matchButton,
    '[data-cw231-action="match-center"]':matchButton,
    '[data-cw233-match][data-cw233-competition]':card,
  });
  assert.equal(resolveRound512MatchTarget(target)?.matchId, 'serie_a:915');
});

test('Round 51.2 installs one capture click owner and directly opens the new runtime', () => {
  let handler = null;
  const documentRef = {
    addEventListener(type, fn, capture) {
      assert.equal(type, 'click');
      assert.equal(capture, true);
      handler = fn;
    },
    removeEventListener() {},
  };
  const opened = [];
  const router = installRound512MatchLinks(documentRef, { open:payload => opened.push(payload) });
  const card = canonicalCard('serie_a', 'serie_a:916');
  const sourcePage = { hidden:false, scrollTop:225 };
  const calls = { prevent:0, stop:0, immediate:0 };
  handler({
    target:targetWith({ '[data-cw233-match][data-cw233-competition]':card }),
    preventDefault(){ calls.prevent += 1; },
    stopPropagation(){ calls.stop += 1; },
    stopImmediatePropagation(){ calls.immediate += 1; },
  });
  assert.equal(opened.length, 1);
  assert.equal(opened[0].matchId, 'serie_a:916');
  assert.deepEqual(calls, { prevent:1, stop:1, immediate:1 });
  assert.deepEqual(sourcePage, { hidden:false, scrollTop:225 });
  assert.equal(typeof router.disconnect, 'function');
});

test('Round 51.2 router and Home wiring contain no legacy lifecycle ownership', async () => {
  const [routerSource, homeSource] = await Promise.all([
    readFile(new URL('../src/v23.3/round51-2-match-center-links.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../src/v23.3/home-integration.mjs', import.meta.url), 'utf8'),
  ]);
  assert.doesNotMatch(routerSource, /match-center-lifecycle|CiaoV233MatchCenterLifecycle|ciao-v233-match-center-open/);
  assert.match(homeSource, /round51-2-match-center-links\.mjs/);
  assert.match(homeSource, /installRound512MatchLinks/);
  assert.doesNotMatch(homeSource, /installCanonicalMatchLinks\(globalThis\.document\)/);
});
