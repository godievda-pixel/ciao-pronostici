import test from 'node:test';
import assert from 'node:assert/strict';
import { installMatchesUi } from '../src/v23.2/matches-ui.mjs';

function fakeDocument(initialNav = []) {
  const nodes = new Map();
  const documentListeners = [];
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
      return selector === 'button[data-tab]' ? initialNav : [];
    },
    addEventListener(type, handler, options) {
      documentListeners.push({ type, handler, options });
    },
  };
  return { documentRef, documentListeners, nodes };
}

test('installer binds directly to the existing calendar nav button so legacy bubbling cannot hide the hub', () => {
  const calendarListeners = {};
  const calendar = {
    dataset: { tab: 'calendar' },
    addEventListener(type, handler) { calendarListeners[type] = handler; },
  };
  const profile = {
    dataset: { tab: 'profile' },
    addEventListener() {},
  };
  const { documentRef, nodes } = fakeDocument([calendar, profile]);

  installMatchesUi(documentRef, { defer: fn => fn() });

  assert.equal(typeof calendarListeners.click, 'function');
  calendarListeners.click({ preventDefault() {} });

  const overlay = nodes.get('ciao-v232-matches-overlay');
  assert.equal(overlay.hidden, false);
  assert.match(overlay.innerHTML, /data-cw232-view="hub"/);
});

test('capture listener opens the hub for a calendar button created after install even when legacy stops bubbling', () => {
  const { documentRef, documentListeners, nodes } = fakeDocument([]);
  installMatchesUi(documentRef, { defer: fn => fn() });

  const capture = documentListeners.find(item => item.type === 'click' && item.options === true);
  assert.ok(capture, 'calendar navigation must be observed in capture phase');

  const replacementCalendar = { dataset: { tab: 'calendar' } };
  const target = {
    closest(selector) {
      return selector === 'button[data-tab]' ? replacementCalendar : null;
    },
  };

  capture.handler({ target });

  const overlay = nodes.get('ciao-v232-matches-overlay');
  assert.equal(overlay.hidden, false);
  assert.match(overlay.innerHTML, /data-cw232-view="hub"/);
});

test('capture listener opens a tournament before legacy miniapp bubbling can stop the card click', async () => {
  const { documentRef, documentListeners, nodes } = fakeDocument([]);
  const loaded = [];
  installMatchesUi(documentRef, {
    defer: fn => fn(),
    async loadScreen(competition) {
      loaded.push(competition);
      return `<section data-loaded="${competition}">${competition}</section>`;
    },
  });

  const capture = documentListeners.find(item => item.type === 'click' && item.options === true);
  assert.ok(capture, 'v23.2 interactions must be observed in capture phase');

  const card = { dataset: { cw232Competition: 'ucl' } };
  const target = {
    closest(selector) {
      if (selector === 'button[data-tab]') return null;
      if (selector === '.cw232-tournament-card[data-cw232-competition]') return card;
      return null;
    },
  };

  capture.handler({ target, preventDefault() {} });
  await new Promise(resolve => setTimeout(resolve, 0));

  assert.deepEqual(loaded, ['ucl']);
  const overlay = nodes.get('ciao-v232-matches-overlay');
  assert.equal(overlay.hidden, false);
  assert.match(overlay.innerHTML, /data-loaded="ucl"/);
});

test('matches overlay mounts inside the miniapp root so it cannot sit behind the legacy app stacking context', () => {
  const { documentRef, nodes } = fakeDocument([]);
  let mounted = null;
  const miniappRoot = {
    id: 'ciao-miniapp-root',
    appendChild(node) {
      mounted = node;
      if (node.id) nodes.set(node.id, node);
    },
  };
  nodes.set('ciao-miniapp-root', miniappRoot);

  installMatchesUi(documentRef, { defer: fn => fn() });

  assert.ok(mounted, 'overlay must be mounted inside #ciao-miniapp-root');
  assert.equal(mounted.id, 'ciao-v232-matches-overlay');
});

test('default calendar navigation exposes the new Matches hub before the browser can paint legacy calendar', async () => {
  const { documentRef, documentListeners, nodes } = fakeDocument([]);
  installMatchesUi(documentRef);

  const capture = documentListeners.find(item => item.type === 'click' && item.options === true);
  assert.ok(capture, 'calendar navigation must be observed in capture phase');

  const calendar = { dataset: { tab: 'calendar' } };
  capture.handler({
    target: {
      closest(selector) {
        return selector === 'button[data-tab]' ? calendar : null;
      },
    },
  });

  await Promise.resolve();

  const overlay = nodes.get('ciao-v232-matches-overlay');
  assert.equal(overlay.hidden, false);
  assert.match(overlay.innerHTML, /data-cw232-view="hub"/);
});
