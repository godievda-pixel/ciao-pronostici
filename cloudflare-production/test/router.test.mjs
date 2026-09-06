import test from 'node:test';
import assert from 'node:assert/strict';
import { createRouter } from '../src/modular/core/router.mjs';

function makeHarness() {
  const rendered = [];
  const restored = [];
  let scrollY = 0;
  let popHandler = null;
  const stack = [];
  let index = -1;
  const history = {
    get length() { return stack.length; },
    get state() { return index >= 0 ? stack[index] : null; },
    pushState(state) { stack.splice(index + 1); stack.push(state); index = stack.length - 1; },
    replaceState(state) { if (index < 0) { stack.push(state); index = 0; } else stack[index] = state; },
    back() {
      if (index <= 0) return;
      index -= 1;
      popHandler?.({ state:stack[index] });
    },
  };
  const router = createRouter({
    history,
    renderRoute: route => { rendered.push(route); },
    readScroll: () => scrollY,
    restoreScroll: value => restored.push(value),
    afterRender: fn => fn(),
    fallbackRoute: { screen:'home' },
  });
  popHandler = event => router.handlePopState(event);
  return { router, history, rendered, restored, setScroll:value => { scrollY = value; } };
}

test('Матчи → UCL → scroll → Match Center → visible Back restores exact origin', () => {
  const h = makeHarness();
  h.router.navigate({ screen:'matches', tournament:'ucl' }, { replace:true });
  h.setScroll(740);
  h.router.openMatchCenter({ competition:'ucl', matchId:'ucl:77' });
  assert.equal(h.router.current().screen, 'match-center');
  h.router.back();
  assert.deepEqual(h.router.current(), {
    screen:'matches', subview:'', tournament:'ucl', matchId:'', scrollY:740, origin:null,
  });
  assert.equal(h.restored.at(-1), 740);
});

test('browser popstate and visible Back use the same restoration path', () => {
  const visible = makeHarness();
  visible.router.navigate({ screen:'calcio' }, { replace:true });
  visible.setScroll(120);
  visible.router.openMatchCenter({ competition:'serie_a', matchId:'serie_a:1' });
  visible.router.back();

  const system = makeHarness();
  system.router.navigate({ screen:'calcio' }, { replace:true });
  system.setScroll(120);
  system.router.openMatchCenter({ competition:'serie_a', matchId:'serie_a:1' });
  system.history.back();

  assert.deepEqual(visible.router.current(), system.router.current());
  assert.equal(visible.restored.at(-1), system.restored.at(-1));
});

test('Predictions inner subview is preserved through Match Center navigation', () => {
  const h = makeHarness();
  h.router.navigate({ screen:'predictions', subview:'mine' }, { replace:true });
  h.router.openMatchCenter({ competition:'serie_a', matchId:'serie_a:44' });
  h.router.back();
  assert.equal(h.router.current().screen, 'predictions');
  assert.equal(h.router.current().subview, 'mine');
});

test('invalid popstate never renders an empty shell and falls back to last valid top-level route', () => {
  const h = makeHarness();
  h.router.navigate({ screen:'tables', tournament:'uel' }, { replace:true });
  h.router.handlePopState({ state:{ ciaoRoute:{ screen:'does-not-exist' } } });
  assert.equal(h.router.current().screen, 'tables');
  assert.equal(h.rendered.at(-1).screen, 'tables');
  assert.ok(h.rendered.every(route => route && route.screen));
});

test('History API write failures never block a modular navigation render', () => {
  const rendered = [];
  const history = {
    length:1,
    replaceState(){ throw new Error('telegram_history_blocked'); },
    pushState(){ throw new Error('telegram_history_blocked'); },
  };
  const router = createRouter({
    history,
    renderRoute:route => rendered.push(route),
    readScroll:() => 64,
    restoreScroll:() => {},
    afterRender:fn => fn(),
    fallbackRoute:{ screen:'home' },
  });

  assert.doesNotThrow(() => router.navigate({ screen:'predictions', subview:'predictions' }));
  assert.equal(router.current().screen, 'predictions');
  assert.equal(rendered.at(-1).screen, 'predictions');
});
