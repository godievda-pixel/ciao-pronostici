import test from 'node:test';
import assert from 'node:assert/strict';
import { createLegacySurfaceAdapter, LEGACY_ROOT_SELECTOR } from '../src/modular/core/legacy-surface-adapter.mjs';

function navButton(tab, active=false) {
  const classes = new Set(active ? ['active'] : []);
  return {
    dataset:{ tab },
    textContent:tab,
    children:[],
    classList:{
      contains(name){ return classes.has(name); },
      toggle(name,on){ if (on) classes.add(name); else classes.delete(name); },
    },
    setAttribute(){},
    querySelector(){ return null; },
    getAttribute(){ return null; },
    closest(selector) {
      if (selector === '[data-ciao-modular-host]') return null;
      if (selector.includes('button') || selector.includes('[data-tab]')) return this;
      return null;
    },
  };
}

test('intercepted modular tab updates legacy bottom-nav active state immediately', () => {
  const buttons = [
    navButton('predict', true),
    navButton('mine'),
    navButton('table'),
    navButton('calendar'),
    navButton('seriea'),
    navButton('profile'),
  ];
  const listeners = [];
  const root = {
    addEventListener(type, listener, capture){ listeners.push({type,listener,capture}); },
    removeEventListener(){},
    querySelector(selector){
      const match = selector.match(/data-tab="([^"]+)"/);
      if (match) return buttons.find(button => button.dataset.tab === match[1]) || null;
      return null;
    },
    querySelectorAll(selector){ return selector === '.nav button' ? buttons : []; },
  };
  const documentRef = { querySelector(selector){ return selector === LEGACY_ROOT_SELECTOR ? root : null; } };
  const navigated = [];
  const adapter = createLegacySurfaceAdapter({ documentRef, onNavigate:screen => navigated.push(screen) });
  assert.equal(adapter.start(), true);

  listeners[0].listener({
    target:buttons[2],
    preventDefault(){},
    stopImmediatePropagation(){},
  });

  assert.deepEqual(navigated, ['ranking']);
  assert.equal(buttons[0].classList.contains('active'), false, 'Главная must stop looking active');
  assert.equal(buttons[2].classList.contains('active'), true, 'Рейтинг must become active');
});
