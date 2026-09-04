import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { installMatchesUi } from '../src/v23.2/matches-ui.mjs';

function fakeDocument() {
  const nodes = new Map();
  const listeners = [];
  const append = node => { if (node.id) nodes.set(node.id, node); };
  const documentRef = {
    head: { appendChild: append },
    body: { appendChild: append },
    createElement(tagName) {
      return {
        tagName,
        id: '',
        className: '',
        hidden: false,
        innerHTML: '',
        textContent: '',
        dataset: {},
        scrollTop: 0,
        setAttribute(name, value) { if (name.startsWith('data-')) this.dataset[name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = String(value); },
        removeAttribute(name) { if (name.startsWith('data-')) delete this.dataset[name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())]; },
      };
    },
    getElementById(id) { return nodes.get(id) || null; },
    querySelectorAll() { return []; },
    addEventListener(type, handler, options) { listeners.push({ type, handler, options }); },
    removeEventListener(type, handler) {
      const index = listeners.findIndex(item => item.type === type && item.handler === handler);
      if (index >= 0) listeners.splice(index, 1);
    },
    dispatchEvent(event) {
      for (const item of [...listeners].filter(item => item.type === event?.type)) item.handler(event);
      return true;
    },
  };
  return { documentRef, nodes, listeners };
}

function navEvent(tab) {
  const nav = { dataset: { tab } };
  return {
    target: {
      closest(selector) { return selector === 'button[data-tab]' ? nav : null; },
    },
  };
}

test('Round 27 keeps Matches covering legacy calendar until each destination tab reports a visible shell', () => {
  const { documentRef, nodes, listeners } = fakeDocument();
  installMatchesUi(documentRef, { defer: fn => fn() });
  const capture = listeners.find(item => item.type === 'click' && item.options === true)?.handler;
  assert.equal(typeof capture, 'function');
  const overlay = nodes.get('ciao-v232-matches-overlay');
  assert.ok(overlay);

  for (const tab of ['predict', 'mine', 'table', 'seriea', 'profile']) {
    capture(navEvent('calendar'));
    assert.equal(overlay.hidden, false, `Matches must be visible before leaving for ${tab}`);

    capture(navEvent(tab));
    assert.equal(overlay.hidden, false, `Matches must stay visible while ${tab} is not ready`);

    documentRef.dispatchEvent({ type:'ciao-v233-navigation-ready', detail:{ tab:'wrong-tab' } });
    assert.equal(overlay.hidden, false, `A different ready event must not release ${tab}`);

    documentRef.dispatchEvent({ type:'ciao-v233-navigation-ready', detail:{ tab } });
    assert.equal(overlay.hidden, true, `Matches must release only after ${tab} reports ready`);
  }
});

test('Round 27 central navigation coordinator maps every destination to a visible-shell readiness check', async () => {
  const navigation = await readFile(new URL('../src/v23.3/navigation-ui.mjs', import.meta.url), 'utf8');
  assert.match(navigation, /dispatchNavigationReady/);
  for (const tab of ['predict', 'mine', 'table', 'profile']) {
    assert.match(navigation, new RegExp(`\\b${tab}\\s*:`), `navigation coordinator must cover ${tab}`);
  }
  assert.match(navigation, /tab\s*===\s*['"]seriea['"]/);
  assert.match(navigation, /data-cw233-home/);
  assert.match(navigation, /cw233-prediction-page/);
  assert.match(navigation, /cw233-ranking-page/);
  assert.match(navigation, /stats-grid/);
  assert.match(navigation, /ciao-v233-tables-overlay/);
});

test('Round 27 removes obsolete pointerdown paths that expose the legacy calendar before handoff completes', async () => {
  const [round13, round16] = await Promise.all([
    readFile(new URL('../src/v23.3/round13-mobile-regressions.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../src/v23.3/round16-runtime.mjs', import.meta.url), 'utf8'),
  ]);

  assert.doesNotMatch(round13, /hideOverlay\(documentRef,\s*['"]ciao-v232-matches-overlay['"]\)/);
  assert.doesNotMatch(round16, /getElementById\?\.\(['"]ciao-v232-matches-overlay['"]\)\?\.setAttribute\(['"]hidden['"]/);
  assert.match(round13, /ciao-v233-match-center-overlay/);
  assert.match(round16, /ciao-v233-match-center-overlay/);
});
