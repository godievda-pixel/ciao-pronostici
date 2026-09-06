import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRoute, serializeRoute } from '../src/v23/core/route-codec.mjs';
import { createRouter } from '../src/v23/core/router.mjs';

const ROUTES = [
  '/home',
  '/settings',
  '/predictions',
  '/predictions/mine',
  '/ranking/all',
  '/ranking/italy',
  '/ranking/europe',
  '/matches/serie-a',
  '/matches/coppa-italia',
  '/matches/ucl',
  '/matches/uel',
  '/matches/uecl',
  '/match/ucl/12345/events',
  '/tables/serie-a',
  '/tables/ucl',
  '/tables/uel',
  '/tables/uecl',
];

test('approved v23 routes parse and serialize without ambiguity', () => {
  for (const path of ROUTES) {
    const parsed = parseRoute(path);
    assert.notEqual(parsed.screen, 'invalid', path);
    assert.equal(serializeRoute(parsed), path, path);
  }
  const match = parseRoute('/match/ucl/12345/events');
  assert.equal(match.screen, 'match');
  assert.equal(match.tournament, 'ucl');
  assert.equal(match.matchId, 'ucl:12345');
  assert.equal(match.section, 'events');
});

test('invalid or unsupported routes fall back to Home and never serialize blank', () => {
  for (const value of ['', '/', '/wat', '/tables/coppa-italia', '/match/ucl//events', '/ranking/nope']) {
    const route = parseRoute(value);
    assert.equal(route.screen, 'home', value);
    assert.equal(serializeRoute(route), '/home', value);
  }
});

function fakeEventTarget() {
  const listeners = new Map();
  return {
    addEventListener(type, handler) { listeners.set(type, handler); },
    removeEventListener(type, handler) { if (listeners.get(type) === handler) listeners.delete(type); },
    emit(type, event = {}) { listeners.get(type)?.(event); },
    count(type) { return listeners.has(type) ? 1 : 0; },
  };
}

test('Match Center Back restores exact prior route and scroll after render', async () => {
  const location = { pathname:'/matches/ucl' };
  const calls = [];
  let scroll = 730;
  const eventTarget = fakeEventTarget();
  const history = {
    state:null,
    pushState(state, _title, path) { this.state = state; location.pathname = path; },
    replaceState(state, _title, path) { this.state = state; location.pathname = path; },
    back() {},
  };
  const router = createRouter({
    history,
    location,
    eventTarget,
    render:async route => { calls.push(`render:${serializeRoute(route)}`); },
    readScroll:() => scroll,
    restoreScroll:value => calls.push(`scroll:${value}`),
    onBackAvailability:() => {},
  });

  await router.start();
  scroll = 730;
  await router.navigate(parseRoute('/match/ucl/12345/events'));
  scroll = 0;
  await router.back();

  assert.equal(serializeRoute(router.current()), '/matches/ucl');
  const renderIndex = calls.lastIndexOf('render:/matches/ucl');
  const scrollIndex = calls.lastIndexOf('scroll:730');
  assert.ok(renderIndex >= 0);
  assert.ok(scrollIndex > renderIndex, calls.join('\n'));
  assert.equal(eventTarget.count('popstate'), 1);
});

test('History API SecurityError falls back to router-owned memory history', async () => {
  const location = { pathname:'/home' };
  const rendered = [];
  const eventTarget = fakeEventTarget();
  const securityError = () => { const error = new Error('blocked'); error.name = 'SecurityError'; throw error; };
  const history = {
    state:null,
    pushState:securityError,
    replaceState:securityError,
    back:securityError,
  };
  const router = createRouter({
    history,
    location,
    eventTarget,
    render:route => rendered.push(serializeRoute(route)),
    readScroll:() => 0,
    restoreScroll:() => {},
    onBackAvailability:() => {},
  });

  await router.start();
  await router.navigate({ screen:'ranking', subview:'europe' });
  assert.equal(serializeRoute(router.current()), '/ranking/europe');
  await router.back();
  assert.equal(serializeRoute(router.current()), '/home');
  assert.deepEqual(rendered.slice(-2), ['/ranking/europe', '/home']);
});

test('section route memory keeps the exact last inner route', async () => {
  const location = { pathname:'/home' };
  const router = createRouter({
    history:{ state:null, pushState(){}, replaceState(){}, back(){} },
    location,
    eventTarget:fakeEventTarget(),
    render:() => {},
    readScroll:() => 0,
    restoreScroll:() => {},
    onBackAvailability:() => {},
  });
  await router.start();
  const remembered = { ...parseRoute('/predictions/mine'), scrollY:240 };
  router.rememberSectionRoute('predictions', remembered);
  assert.deepEqual(router.sectionRoute('predictions'), remembered);
  assert.notEqual(router.sectionRoute('predictions'), remembered);
});
