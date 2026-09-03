import test from 'node:test';
import assert from 'node:assert/strict';
import { renderHomeTodaySection } from '../src/v23.3/home-integration.mjs';
import { renderCompetitionScreen } from '../src/v23.2/matches-ui.mjs';
import { renderProfileTournamentSection } from '../src/v23.2/profile-integration.mjs';
import { applyHomeV233SourcePatch } from '../scripts/home-v23-3-source-patch.mjs';

async function matchCenterModule() {
  const mod = await import('../src/v23.3/match-center.mjs').catch(() => null);
  assert.ok(mod, 'v23.3 Match Center module must exist');
  return mod;
}

async function matchLinksModule() {
  const mod = await import('../src/v23.3/match-center-links.mjs').catch(() => null);
  assert.ok(mod, 'v23.3 canonical Match Center links module must exist');
  return mod;
}

function team(id, name) {
  return {
    id: String(id),
    name,
    crestUrl: `https://img.test/${id}.png`,
  };
}

function match(status = 'scheduled', overrides = {}) {
  return {
    matchId: 'ucl:1001',
    competition: 'ucl',
    kickoffAt: '2026-09-16T19:00:00Z',
    status,
    minute: null,
    homeTeam: team(77, 'Интер'),
    awayTeam: team(359, 'Арсенал'),
    homeScore: null,
    awayScore: null,
    ...overrides,
  };
}

function documentStub() {
  const listeners = new Map();
  return {
    hidden: false,
    addEventListener(type, fn) {
      const list = listeners.get(type) || [];
      list.push(fn);
      listeners.set(type, list);
    },
    removeEventListener(type, fn) {
      listeners.set(type, (listeners.get(type) || []).filter(item => item !== fn));
    },
    emit(type) {
      for (const fn of listeners.get(type) || []) fn({ type });
    },
  };
}

function fakeTimers() {
  let nextId = 1;
  const active = new Map();
  const cleared = [];
  return {
    setTimer(fn, ms) {
      const id = nextId++;
      active.set(id, { fn, ms });
      return id;
    },
    clearTimer(id) {
      cleared.push(id);
      active.delete(id);
    },
    first() {
      return [...active.entries()][0] || null;
    },
    active,
    cleared,
  };
}

test('v23.3 Match Center renders scheduled, live and finished states without inventing a minute', async () => {
  const { renderMatchCenter } = await matchCenterModule();

  const scheduled = renderMatchCenter({ match: match('scheduled'), timeZone: 'Europe/Moscow' });
  assert.match(scheduled, /Лига Чемпионов/);
  assert.match(scheduled, /Интер/);
  assert.match(scheduled, /Арсенал/);
  assert.match(scheduled, /22:00/);
  assert.doesNotMatch(scheduled, /LIVE/);

  const live = renderMatchCenter({
    match: match('live', { minute: 67, homeScore: 2, awayScore: 1 }),
    timeZone: 'Europe/Moscow',
  });
  assert.match(live, /2:1/);
  assert.match(live, /LIVE · 67′/);

  const liveWithoutMinute = renderMatchCenter({
    match: match('live', { homeScore: 1, awayScore: 0 }),
  });
  assert.match(liveWithoutMinute, />LIVE</);
  assert.doesNotMatch(liveWithoutMinute, /NaN|undefined′|null′/);

  const finished = renderMatchCenter({
    match: match('finished', { homeScore: 3, awayScore: 2 }),
  });
  assert.match(finished, /3:2/);
  assert.match(finished, /Матч завершён/);
});

test('v23.3 Match Center polls every 15 seconds only while the opened match is live', async () => {
  const { createMatchCenterController } = await matchCenterModule();
  const timers = fakeTimers();
  const doc = documentStub();
  let calls = 0;
  const controller = createMatchCenterController({
    loadSnapshot: async () => {
      calls += 1;
      return { match: match('live', { minute: 12, homeScore: 0, awayScore: 0 }) };
    },
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
    documentRef: doc,
  });

  await controller.open({ competition: 'ucl', matchId: 'ucl:1001' });
  assert.equal(calls, 1);
  assert.equal(timers.first()?.[1]?.ms, 15_000);

  const firstTimer = timers.first();
  timers.active.delete(firstTimer[0]);
  await firstTimer[1].fn();
  assert.equal(calls, 2);
  assert.equal(timers.first()?.[1]?.ms, 15_000);

  controller.close();
  assert.equal(timers.active.size, 0);
});

test('v23.3 Match Center never schedules recurring polling for scheduled or finished matches', async () => {
  const { createMatchCenterController } = await matchCenterModule();

  for (const status of ['scheduled', 'finished']) {
    const timers = fakeTimers();
    const controller = createMatchCenterController({
      loadSnapshot: async () => ({
        match: match(status, status === 'finished' ? { homeScore: 1, awayScore: 1 } : {}),
      }),
      setTimer: timers.setTimer,
      clearTimer: timers.clearTimer,
      documentRef: documentStub(),
    });
    await controller.open({ competition: 'ucl', matchId: 'ucl:1001' });
    assert.equal(timers.active.size, 0, `${status} must not poll`);
    controller.close();
  }
});

test('v23.3 Match Center pauses live polling while hidden and refreshes once visibility returns', async () => {
  const { createMatchCenterController } = await matchCenterModule();
  const timers = fakeTimers();
  const doc = documentStub();
  let calls = 0;
  const controller = createMatchCenterController({
    loadSnapshot: async () => {
      calls += 1;
      return { match: match('live', { minute: calls, homeScore: 1, awayScore: 0 }) };
    },
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
    documentRef: doc,
  });

  await controller.open({ competition: 'ucl', matchId: 'ucl:1001' });
  assert.equal(timers.active.size, 1);

  doc.hidden = true;
  doc.emit('visibilitychange');
  assert.equal(timers.active.size, 0);

  doc.hidden = false;
  doc.emit('visibilitychange');
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(calls, 2);
  assert.equal(timers.active.size, 1);
  controller.close();
});

test('v23.3 Match Center keeps the last good live snapshot after a transient refresh error', async () => {
  const { createMatchCenterController } = await matchCenterModule();
  const timers = fakeTimers();
  let calls = 0;
  const controller = createMatchCenterController({
    loadSnapshot: async () => {
      calls += 1;
      if (calls > 1) throw new Error('temporary failure');
      return { match: match('live', { minute: 44, homeScore: 1, awayScore: 1 }) };
    },
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
    documentRef: documentStub(),
  });

  await controller.open({ competition: 'ucl', matchId: 'ucl:1001' });
  const firstTimer = timers.first();
  timers.active.delete(firstTimer[0]);
  await firstTimer[1].fn();

  const state = controller.getState();
  assert.equal(state.match.minute, 44);
  assert.match(state.error, /temporary failure/);
  assert.equal(timers.active.size, 1, 'live polling should recover after a transient error');
  controller.close();
});

test('canonical match center identity is present in Home, tournament schedule and club profile DOM context', () => {
  const row = match('scheduled');
  const home = renderHomeTodaySection([row], {
    now: new Date('2026-09-16T10:00:00Z'),
    timeZone: 'UTC',
  });
  const schedule = renderCompetitionScreen('ucl', { matches: [row] });
  const profile = renderProfileTournamentSection([row]);

  assert.match(home, /data-cw233-competition="ucl"/);
  assert.match(home, /data-cw233-match="ucl:1001"/);
  assert.match(schedule, /data-cw232-competition="ucl"/);
  assert.match(schedule, /data-cw232-match="ucl:1001"/);
  assert.match(profile, /data-cw232-competition="ucl"/);
  assert.match(profile, /data-cw232-profile-match="ucl:1001"/);
});

test('canonical match links resolve external schedule and profile cards to competition plus canonical match id', async () => {
  const { resolveCanonicalMatchTarget } = await matchLinksModule();

  const scheduleScreen = { dataset: { cw232Competition: 'ucl' } };
  const scheduleCard = {
    dataset: { cw232Match: 'ucl:1001' },
    closest(selector) {
      return selector === '[data-cw232-competition]' ? scheduleScreen : null;
    },
  };
  const scheduleTarget = {
    closest(selector) {
      return selector === '[data-cw232-match]' ? scheduleCard : null;
    },
  };
  const scheduleResolved = resolveCanonicalMatchTarget(scheduleTarget);
  assert.equal(scheduleResolved?.competition, 'ucl');
  assert.equal(scheduleResolved?.matchId, 'ucl:1001');
  if (scheduleResolved?.initialMatch) assert.equal(scheduleResolved.initialMatch.matchId, 'ucl:1001');

  const profileCard = {
    dataset: { cw232Competition: 'uel', cw232ProfileMatch: 'uel:2002' },
  };
  const profileTarget = {
    closest(selector) {
      return selector === '[data-cw232-profile-match][data-cw232-competition]' ? profileCard : null;
    },
  };
  const profileResolved = resolveCanonicalMatchTarget(profileTarget);
  assert.equal(profileResolved?.competition, 'uel');
  assert.equal(profileResolved?.matchId, 'uel:2002');
  if (profileResolved?.initialMatch) assert.equal(profileResolved.initialMatch.matchId, 'uel:2002');
});

test('Serie A canonical route delegates back to the proven legacy full Match Center', () => {
  const patched = applyHomeV233SourcePatch('predict = __cw231HomeHtml;');
  assert.match(patched, /ciao-v233-open-serie-a-match/);
  assert.match(patched, /openMatchCenter\(legacyId\)/);
  assert.doesNotMatch(patched, /__cw233LegacyOpenMatchCenter/);
  assert.doesNotMatch(patched, /CiaoV233MatchCenter/);
  assert.doesNotMatch(patched, /openCanonicalMatchCenter/);
});
