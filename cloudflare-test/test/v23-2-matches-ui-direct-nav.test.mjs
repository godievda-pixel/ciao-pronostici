import test from 'node:test';
import assert from 'node:assert/strict';
import { installMatchesUi } from '../src/v23.2/matches-ui.mjs';

test('installer binds directly to the existing calendar nav button so legacy bubbling cannot hide the hub', () => {
  const nodes = new Map();
  const documentListeners = {};
  const calendarListeners = {};
  const calendar = {
    dataset: { tab: 'calendar' },
    addEventListener(type, handler) { calendarListeners[type] = handler; },
  };
  const profile = {
    dataset: { tab: 'profile' },
    addEventListener() {},
  };
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
        setAttribute() {},
        addEventListener() {},
      };
    },
    getElementById(id) { return nodes.get(id) || null; },
    querySelectorAll(selector) {
      return selector === 'button[data-tab]' ? [calendar, profile] : [];
    },
    addEventListener(type, handler) { documentListeners[type] = handler; },
  };

  installMatchesUi(documentRef, { defer: fn => fn() });

  assert.equal(typeof calendarListeners.click, 'function');
  calendarListeners.click({ preventDefault() {} });

  const overlay = nodes.get('ciao-v232-matches-overlay');
  assert.equal(overlay.hidden, false);
  assert.match(overlay.innerHTML, /data-cw232-view="hub"/);
});
