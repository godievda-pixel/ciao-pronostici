import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LEGACY_ROOT_SELECTOR,
  LEGACY_TAB_ROUTES,
  LEGACY_NAV_RENAMES,
  MIGRATED_NAV_LABELS,
  resolveLegacyScreen,
  renameLegacyNavigation,
  createLegacySurfaceAdapter,
} from '../src/modular/core/legacy-surface-adapter.mjs';

function clickable({ text='', aria='', screen='', tab='' } = {}) {
  return {
    textContent:text,
    dataset:{ ...(screen ? { screen } : {}), ...(tab ? { tab } : {}) },
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

test('stable v22.5 tab ids cut over to the approved modular routes including Home', () => {
  assert.deepEqual(LEGACY_TAB_ROUTES, {
    predict:'home',
    mine:'predictions',
    table:'ranking',
    calendar:'matches',
    seriea:'tables',
  });
  assert.equal(resolveLegacyScreen(clickable({ tab:'predict', text:'Прогноз' })), 'home');
  assert.equal(resolveLegacyScreen(clickable({ tab:'mine', text:'Мои прогнозы' })), 'predictions');
  assert.equal(resolveLegacyScreen(clickable({ tab:'table', text:'Таблица' })), 'ranking');
  assert.equal(resolveLegacyScreen(clickable({ tab:'calendar', text:'Матчи' })), 'matches');
  assert.equal(resolveLegacyScreen(clickable({ tab:'seriea', text:'Серия А' })), 'tables');
});

test('legacy navigation maps only approved migrated labels', () => {
  assert.deepEqual(MIGRATED_NAV_LABELS, {
    'главная':'home',
    'прогноз':'home',
    'прогнозы':'predictions',
    'мои прогнозы':'predictions',
    'рейтинг':'ranking',
    'таблица':'ranking',
    'матчи':'matches',
    'таблицы':'tables',
    'серия а':'tables',
  });
  assert.equal(resolveLegacyScreen(clickable({ text:'Прогнозы' })), 'predictions');
  assert.equal(resolveLegacyScreen(clickable({ aria:'Рейтинг' })), 'ranking');
  assert.equal(resolveLegacyScreen(clickable({ text:'Серия А' })), 'tables');
  assert.equal(resolveLegacyScreen(clickable({ text:'Настройки' })), '');
});

test('stable legacy bottom navigation is relabeled without destroying its icon node', () => {
  assert.deepEqual(LEGACY_NAV_RENAMES, {
    predict:'Главная',
    mine:'Прогнозы',
    table:'Рейтинг',
    seriea:'Таблицы',
  });
  const nodes = new Map();
  for (const [tab, oldLabel] of Object.entries({ predict:'Прогноз', mine:'Мои прогнозы', table:'Таблица', seriea:'Серия А' })) {
    const icon = { textContent:'◉' };
    const label = { textContent:oldLabel };
    nodes.set(tab, { children:[icon,label], querySelector(selector){ return selector === 'span:last-child' ? label : null; } });
  }
  const root = { querySelector(selector){ const match=selector.match(/data-tab="([^"]+)"/); return match ? nodes.get(match[1]) || null : null; } };
  const renamed = renameLegacyNavigation(root);
  assert.equal(renamed, 4);
  assert.equal(nodes.get('predict').children[0].textContent, '◉');
  assert.equal(nodes.get('predict').children[1].textContent, 'Главная');
  assert.equal(nodes.get('mine').children[1].textContent, 'Прогнозы');
  assert.equal(nodes.get('table').children[1].textContent, 'Рейтинг');
  assert.equal(nodes.get('seriea').children[1].textContent, 'Таблицы');
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
