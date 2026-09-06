import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ROUND51_HOST_ID,
  round51SnapHeights,
  resolveRound51Snap,
  createRound51MatchCenterHost,
} from '../src/v23.3/round51-match-center-host.mjs';

class FakeNode {
  constructor(tagName = 'div') {
    this.tagName = String(tagName).toUpperCase();
    this.id = '';
    this.className = '';
    this.dataset = {};
    this.style = {};
    this.hidden = false;
    this.children = [];
    this.parentNode = null;
    this.scrollTop = 0;
    this.innerHTML = '';
    this.attributes = new Map();
    this.listeners = new Map();
  }

  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  remove() {
    if (!this.parentNode) return;
    this.parentNode.children = this.parentNode.children.filter(child => child !== this);
    this.parentNode = null;
  }

  setAttribute(name, value) {
    this.attributes.set(String(name), String(value));
    if (name === 'aria-hidden') this.ariaHidden = String(value);
  }

  removeAttribute(name) {
    this.attributes.delete(String(name));
    if (name === 'aria-hidden') delete this.ariaHidden;
  }

  addEventListener(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(handler);
  }

  removeEventListener(type, handler) {
    const list = this.listeners.get(type) || [];
    this.listeners.set(type, list.filter(item => item !== handler));
  }

  dispatch(type, event = {}) {
    for (const handler of this.listeners.get(type) || []) handler(event);
  }

  contains(node) {
    if (node === this) return true;
    return this.children.some(child => child.contains?.(node));
  }

  matchesSelector(selector) {
    if (selector === '[data-cw51-drawer-handle]') return Object.hasOwn(this.dataset, 'cw51DrawerHandle');
    if (selector === '[data-cw51-drawer-scroll]') return Object.hasOwn(this.dataset, 'cw51DrawerScroll');
    return false;
  }

  querySelector(selector) {
    for (const child of this.children) {
      if (child.matchesSelector?.(selector)) return child;
      const nested = child.querySelector?.(selector);
      if (nested) return nested;
    }
    return null;
  }
}

function fakeDocument(viewportHeight = 800) {
  const body = new FakeNode('body');
  const root = new FakeNode('main');
  root.id = 'ciao-miniapp-root';
  body.appendChild(root);
  const documentRef = {
    body,
    defaultView:{ innerHeight:viewportHeight },
    createElement:tag => new FakeNode(tag),
    getElementById(id) {
      if (id === 'ciao-miniapp-root') return root;
      const visit = node => {
        if (node.id === id) return node;
        for (const child of node.children) {
          const found = visit(child);
          if (found) return found;
        }
        return null;
      };
      return visit(body);
    },
  };
  return { documentRef, root };
}

test('Round 51 snap heights are deterministic viewport-relative targets', () => {
  assert.deepEqual(round51SnapHeights(800), {
    compact:368,
    standard:624,
    expanded:752,
  });
});

test('Round 51 advances and retreats one snap per meaningful drag', () => {
  assert.deepEqual(
    resolveRound51Snap({ viewportHeight:800, snap:'standard', deltaY:-120 }),
    { action:'snap', snap:'expanded', height:752 },
  );
  assert.deepEqual(
    resolveRound51Snap({ viewportHeight:800, snap:'expanded', deltaY:120 }),
    { action:'snap', snap:'standard', height:624 },
  );
  assert.deepEqual(
    resolveRound51Snap({ viewportHeight:800, snap:'standard', deltaY:120 }),
    { action:'snap', snap:'compact', height:368 },
  );
  assert.deepEqual(
    resolveRound51Snap({ viewportHeight:800, snap:'compact', deltaY:-120 }),
    { action:'snap', snap:'standard', height:624 },
  );
});

test('Round 51 dismisses only a deliberate downward drag from compact', () => {
  assert.deepEqual(
    resolveRound51Snap({ viewportHeight:800, snap:'compact', deltaY:120 }),
    { action:'dismiss' },
  );
  assert.deepEqual(
    resolveRound51Snap({ viewportHeight:800, snap:'compact', deltaY:40 }),
    { action:'snap', snap:'compact', height:368 },
  );
});

test('Round 51 host is a bottom drawer, never a fullscreen owner', () => {
  const { documentRef, root } = fakeDocument();
  const host = createRound51MatchCenterHost(documentRef);
  const node = host.node;

  assert.equal(ROUND51_HOST_ID, 'ciao-v251-match-center-drawer');
  assert.equal(node.id, ROUND51_HOST_ID);
  assert.equal(node.parentNode, root);
  assert.equal(node.style.position, 'fixed');
  assert.equal(node.style.bottom, '0px');
  assert.equal(node.style.left, '0px');
  assert.equal(node.style.right, '0px');
  assert.notEqual(node.style.inset, '0');
  assert.equal(node.dataset.cw51Snap, 'standard');
  assert.ok(node.querySelector('[data-cw51-drawer-handle]'));
  assert.ok(node.querySelector('[data-cw51-drawer-scroll]'));
});

test('Round 51 host renders only into the internal scroll area and starts at standard', () => {
  const { documentRef } = fakeDocument();
  const host = createRound51MatchCenterHost(documentRef);
  const scroll = host.node.querySelector('[data-cw51-drawer-scroll]');

  host.render('<main>ONE</main>');
  assert.equal(scroll.innerHTML, '<main>ONE</main>');
  assert.equal(host.node.dataset.cw51Snap, 'standard');
  assert.equal(host.node.style.height, '624px');
  assert.equal(host.node.hidden, false);

  host.setSnap('expanded');
  assert.equal(host.node.dataset.cw51Snap, 'expanded');
  assert.equal(host.node.style.height, '752px');

  host.hide();
  assert.equal(host.node.hidden, true);
});
