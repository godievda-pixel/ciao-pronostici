import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LEGACY_ROOT_SELECTOR,
  MIGRATED_NAV_LABELS,
  resolveLegacyScreen,
  createLegacySurfaceAdapter,
} from '../src/modular/core/legacy-surface-adapter.mjs';

function clickable({ text='', aria='', screen='' } = {}) {
  return {
    textContent:text,
    dataset:screen ? { screen } : {},
    getAttribute(name) { return name === 'aria-label' ? aria : null; },
    closest(selector) {
      if (selector === '[data-ciao-modular-host]') return null;
      if (selector.includes('button') || selector.includes('[role="button"]')) return this;
      return null;
    },
  };
}

test('legacy adapter is anchored only to the stable production root', () => {
  assert.equal(LEGACY_ROOT_SELECTOR, '#ciao-miniapp-root');
});

test('legacy navigation maps only approved migrated surfaces', () => {
  assert.deepEqual(MIGRATED_NAV_LABELS, {
    'прогнозы':'predictions',
    'рейтинг':'ranking',
    'матчи':'matches',
    'таблицы':'tables',
    'серия а':'tables',
  });
  assert.equal(resolveLegacyScreen(clickable({ text:'Прогнозы' })), 'predictions');
  assert.equal(resolveLegacyScreen(clickable({ aria:'Рейтинг' })), 'ranking');
  assert.equal(resolveLegacyScreen(clickable({ text:'Серия А' })), 'tables');
  assert.equal(resolveLegacyScreen(clickable({ text:'Настройки' })), '');
});

test('adapter is idempotent and never intercepts clicks from its own modular host', () => {
  const listeners = [];
  const root = {
    addEventListener(type, listener, capture) { listeners.push({ type, listener, capture }); },
    removeEventListener(type, listener, capture) {
      const i = listeners.findIndex(x => x.type === type && x.listener === listener && x.capture === capture);
      if (i >= 0) listeners.splice(i, 1);
    },
    querySelector() { return null; },
  };
  const documentRef = { querySelector(selector) { return selector === LEGACY_ROOT_SELECTOR ? root : null; } };
  const navigated = [];
  const adapter = createLegacySurfaceAdapter({ documentRef, onNavigate:screen => navigated.push(screen) });

  assert.equal(adapter.start(), true);
  assert.equal(adapter.start(), true);
  assert.equal(listeners.length, 1);
  assert.equal(listeners[0].capture, true);

  const target = clickable({ text:'Матчи' });
  let prevented = 0;
  listeners[0].listener({ target, preventDefault(){prevented++}, stopImmediatePropagation(){} });
  assert.deepEqual(navigated, ['matches']);
  assert.equal(prevented, 1);

  const modularTarget = clickable({ text:'Матчи' });
  modularTarget.closest = selector => selector === '[data-ciao-modular-host]' ? {} : modularTarget;
  listeners[0].listener({ target:modularTarget, preventDefault(){prevented++}, stopImmediatePropagation(){} });
  assert.deepEqual(navigated, ['matches']);

  adapter.stop();
  assert.equal(listeners.length, 0);
});

test('adapter fails closed when the legacy host disappears', () => {
  const adapter = createLegacySurfaceAdapter({ documentRef:{ querySelector(){ return null; } }, onNavigate(){} });
  assert.equal(adapter.start(), false);
  assert.equal(adapter.showModular('<b>never mounted</b>'), null);
  assert.equal(adapter.hideModular(), false);
});
