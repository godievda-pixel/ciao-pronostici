import test from 'node:test';
import assert from 'node:assert/strict';
import { createLegacySurfaceAdapter, LEGACY_ROOT_SELECTOR } from '../src/modular/core/legacy-surface-adapter.mjs';

function target(tab='mine') {
  return {
    dataset:{ tab },
    textContent:'Прогнозы',
    getAttribute(){ return null; },
    closest(selector) {
      if (selector === '[data-ciao-modular-host]') return null;
      if (selector.includes('button') || selector.includes('[data-tab]')) return this;
      return null;
    },
  };
}

test('failed modular handoff leaves the legacy bottom-nav onclick available as fallback', () => {
  const listeners = [];
  const root = {
    addEventListener(type, listener, capture){ listeners.push({ type, listener, capture }); },
    removeEventListener(){},
    querySelector(){ return null; },
  };
  const documentRef = { querySelector(selector){ return selector === LEGACY_ROOT_SELECTOR ? root : null; } };
  const adapter = createLegacySurfaceAdapter({
    documentRef,
    onNavigate(){ throw new Error('telegram_history_blocked'); },
  });
  assert.equal(adapter.start(), true);

  let prevented = 0;
  let stopped = 0;
  assert.doesNotThrow(() => listeners[0].listener({
    target:target('mine'),
    preventDefault(){ prevented += 1; },
    stopImmediatePropagation(){ stopped += 1; },
  }));
  assert.equal(prevented, 0);
  assert.equal(stopped, 0);
});

test('explicitly rejected modular handoff also preserves the legacy bottom-nav fallback', () => {
  const listeners = [];
  const root = {
    addEventListener(type, listener, capture){ listeners.push({ type, listener, capture }); },
    removeEventListener(){},
    querySelector(){ return null; },
  };
  const documentRef = { querySelector(selector){ return selector === LEGACY_ROOT_SELECTOR ? root : null; } };
  const adapter = createLegacySurfaceAdapter({ documentRef, onNavigate(){ return false; } });
  assert.equal(adapter.start(), true);

  let prevented = 0;
  let stopped = 0;
  listeners[0].listener({
    target:target('table'),
    preventDefault(){ prevented += 1; },
    stopImmediatePropagation(){ stopped += 1; },
  });
  assert.equal(prevented, 0);
  assert.equal(stopped, 0);
});
