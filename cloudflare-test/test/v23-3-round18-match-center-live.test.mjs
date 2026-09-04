import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createMatchCenterController,
  patchMatchCenterOverlay,
} from '../src/v23.3/match-center-core.mjs';

function liveMatch({ minute = 67, homeScore = 2, awayScore = 1 } = {}) {
  return {
    competition:'ucl',
    matchId:'ucl:77',
    status:'live',
    minute,
    homeScore,
    awayScore,
    kickoffAt:'2026-09-20T18:00:00Z',
    homeTeam:{ name:'Интер', crestUrl:'' },
    awayTeam:{ name:'Арсенал', crestUrl:'' },
    coverage:{
      overview:true,
      stats:true,
      events:true,
      lineups:true,
      players:true,
      momentum:true,
      shotmap:true,
    },
  };
}

function fakeTimers() {
  const timers = [];
  return {
    timers,
    setTimer(fn, ms) {
      const timer = { fn, ms, cancelled:false };
      timers.push(timer);
      return timer;
    },
    clearTimer(timer) {
      if (timer) timer.cancelled = true;
    },
    latestActive() {
      return [...timers].reverse().find(timer => !timer.cancelled) || null;
    },
  };
}

test('Round 18 LIVE tick refreshes base plus the active tab only', async () => {
  const timer = fakeTimers();
  const baseCalls = [];
  const sectionCalls = [];
  let baseRevision = 0;
  const controller = createMatchCenterController({
    loadSnapshot:async (competition, matchId) => {
      baseRevision += 1;
      baseCalls.push({ competition, matchId, baseRevision });
      return { match:liveMatch({ minute:66 + baseRevision, homeScore:baseRevision > 1 ? 3 : 2 }) };
    },
    loadSection:async (competition, matchId, section, options = {}) => {
      sectionCalls.push({ competition, matchId, section, force:options.force === true });
      return {
        competition,
        matchId,
        section,
        coverage:liveMatch().coverage,
        data:{ revision:sectionCalls.length, section },
      };
    },
    documentRef:{ hidden:false, addEventListener(){} },
    setTimer:timer.setTimer,
    clearTimer:timer.clearTimer,
  });

  await controller.open({ competition:'ucl', matchId:'ucl:77', initialMatch:liveMatch() });
  controller.setActiveTab('stats');
  await new Promise(resolve => setImmediate(resolve));

  baseCalls.length = 0;
  sectionCalls.length = 0;
  const scheduled = timer.latestActive();
  assert.ok(scheduled, 'LIVE poll must be scheduled');
  assert.equal(scheduled.ms, 15_000);

  await scheduled.fn();

  assert.equal(baseCalls.length, 1, 'LIVE tick refreshes the lightweight hero/base once');
  assert.deepEqual(sectionCalls, [{
    competition:'ucl',
    matchId:'ucl:77',
    section:'stats',
    force:true,
  }]);
  assert.equal(controller.getState().activeTab, 'stats');
  assert.equal(controller.getState().match.minute, 68);
  assert.equal(controller.getState().match.homeScore, 3);
  assert.equal(controller.getState().sections.stats?.section, 'stats');
  assert.equal(controller.getState().sections.events, null);
  assert.equal(controller.getState().sections.lineups, null);
  assert.equal(controller.getState().sections.players, null);

  controller.close();
});

function nodeStub() {
  return {
    dataset:{},
    style:{ setProperty(){} },
    classList:{ toggle(){} },
    textContent:'',
    innerHTML:'',
    setAttribute(name, value) { this[name] = String(value); },
    getAttribute(name) { return this[name] ?? null; },
    querySelector() { return null; },
  };
}

test('Round 18 LIVE patch preserves the mounted Match Center root shell node', () => {
  const competitionLabel = nodeStub();
  const kickoff = nodeStub();
  const board = nodeStub();
  const homeName = nodeStub();
  const awayName = nodeStub();
  const score = nodeStub();
  const status = nodeStub();
  const detailFrame = nodeStub();
  const details = nodeStub();
  const notice = nodeStub();
  const homeLogo = nodeStub();
  const awayLogo = nodeStub();
  const tabs = ['overview','stats','events','lineups','players'].map(key => ({
    dataset:{ cw233McTab:key },
    classList:{ toggle(){} },
    setAttribute() {},
  }));
  const selectors = new Map([
    ['[data-cw233-mc-competition-label]', competitionLabel],
    ['[data-cw233-mc-kickoff]', kickoff],
    ['[data-cw233-mc-board]', board],
    ['[data-cw233-mc-home-name]', homeName],
    ['[data-cw233-mc-away-name]', awayName],
    ['[data-cw233-mc-score]', score],
    ['[data-cw233-mc-status]', status],
    ['[data-cw233-mc-detail-frame]', detailFrame],
    ['[data-cw233-mc-details-slot]', details],
    ['[data-cw233-mc-notice-slot]', notice],
    ['[data-cw233-mc-logo-slot="home"]', homeLogo],
    ['[data-cw233-mc-logo-slot="away"]', awayLogo],
  ]);
  const shell = {
    dataset:{ cw233Competition:'ucl', cw233Match:'ucl:77' },
    style:{ setProperty(){} },
    classList:{ toggle(){} },
    querySelector(selector) { return selectors.get(selector) || null; },
    querySelectorAll(selector) { return selector === '[data-cw233-mc-tab]' ? tabs : []; },
  };
  const overlay = {
    dataset:{},
    style:{ setProperty(){} },
    querySelector(selector) { return selector === '[data-cw233-mc-view]' ? shell : null; },
  };
  Object.defineProperty(overlay, 'innerHTML', {
    set() { throw new Error('root_shell_replaced'); },
  });

  const originalShell = overlay.querySelector('[data-cw233-mc-view]');
  const patched = patchMatchCenterOverlay(overlay, {
    competition:'ucl',
    matchId:'ucl:77',
    match:liveMatch({ minute:68, homeScore:3 }),
    activeTab:'stats',
    sections:{ overview:null, stats:{ home:{ shots:10 }, away:{ shots:8 } }, events:null, lineups:null, players:null },
    sectionState:{ stats:{ status:'ready', error:'' } },
  });

  assert.equal(patched, true);
  assert.strictEqual(overlay.querySelector('[data-cw233-mc-view]'), originalShell);
  assert.equal(score.textContent, '3:1');
  assert.equal(status.textContent, 'LIVE · 68′');
});
