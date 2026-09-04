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
    dispatchEvent(event) {
      for (const item of listeners.filter(item => item.type === event?.type)) item.handler(event);
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

test('Round 27 destination modules publish readiness from their first visible shell', async () => {
  const [navigation, predictions, ranking, tables] = await Promise.all([
    readFile(new URL('../src/v23.3/navigation-ui.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../src/v23.3/predictions-ui.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../src/v23.3/ranking-ui.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../src/v23.3/tables-ui.mjs', import.meta.url), 'utf8'),
  ]);

  assert.match(navigation, /dispatchNavigationReady\(['"]predict['"]/);
  assert.match(navigation, /dispatchNavigationReady\(['"]profile['"]/);
  assert.match(predictions, /dispatchNavigationReady\(['"]mine['"]/);
  assert.match(ranking, /dispatchNavigationReady\(['"]table['"]/);
  assert.match(tables, /dispatchNavigationReady\(['"]seriea['"]/);
});
