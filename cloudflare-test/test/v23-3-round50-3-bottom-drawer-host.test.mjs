import test from 'node:test';
import assert from 'node:assert/strict';

import { createBrowserMatchCenterHost } from '../src/v23.3/match-center-runtime.mjs';

function fakeDocument(viewportHeight = 800) {
  const listeners = new Map();
  const children = [];
  const root = { appendChild(node) { children.push(node); } };
  const documentRef = {
    defaultView:{ innerHeight:viewportHeight },
    head:{ appendChild() {} },
    getElementById(id) {
      return id === 'ciao-miniapp-root' ? root : null;
    },
    createElement(tag) {
      return {
        tag,
        id:'',
        innerHTML:'',
        textContent:'',
        dataset:{},
        style:{},
        hidden:false,
        scrollTop:0,
        setAttribute() {},
        removeAttribute() {},
        addEventListener(type, handler) { listeners.set(type, handler); },
        removeEventListener(type) { listeners.delete(type); },
        setPointerCapture() {},
        releasePointerCapture() {},
        contains() { return true; },
        remove() {},
      };
    },
  };
  return { documentRef, listeners, children };
}

function handleTarget() {
  const handle = { dataset:{ cw503DrawerHandle:'1' } };
  return {
    closest(selector) {
      return selector === '[data-cw503-drawer-handle]' ? handle : null;
    },
  };
}

test('Round 50.3 browser host opens as a standard bottom drawer instead of a fullscreen overlay', () => {
  const { documentRef, children } = fakeDocument(800);
  const host = createBrowserMatchCenterHost(documentRef);

  assert.equal(host.node.style.position, 'fixed');
  assert.equal(host.node.style.bottom, '0');
  assert.equal(host.node.style.left, '0');
  assert.equal(host.node.style.right, '0');
  assert.notEqual(host.node.style.inset, '0');
  assert.equal(host.node.style.height, '624px');
  assert.equal(host.node.dataset.matchCenterSnap, 'standard');
  assert.match(host.node.style.borderRadius, /24px 24px 0 0/);
  assert.equal(children[0], host.node);

  host.render('<main>CONTENT</main>');
  assert.match(host.node.innerHTML, /data-cw503-drawer-handle/);
  assert.match(host.node.innerHTML, /CONTENT/);
});

test('Round 50.3 drawer snaps upward and dismisses only by dragging down from compact', () => {
  const { documentRef, listeners } = fakeDocument(800);
  const host = createBrowserMatchCenterHost(documentRef);
  let backCalls = 0;
  host.bind({ back() { backCalls += 1; } });
  host.render('<main>CONTENT</main>');

  const target = handleTarget();
  listeners.get('pointerdown')?.({ target, clientY:600, pointerId:1, preventDefault() {} });
  listeners.get('pointermove')?.({ target, clientY:480, pointerId:1, preventDefault() {} });
  listeners.get('pointerup')?.({ target, clientY:480, pointerId:1, preventDefault() {} });

  assert.equal(host.node.dataset.matchCenterSnap, 'expanded');
  assert.equal(host.node.style.height, '752px');
  assert.equal(backCalls, 0);

  host.snapTo('compact');
  assert.equal(host.node.style.height, '368px');
  listeners.get('pointerdown')?.({ target, clientY:500, pointerId:2, preventDefault() {} });
  listeners.get('pointermove')?.({ target, clientY:620, pointerId:2, preventDefault() {} });
  listeners.get('pointerup')?.({ target, clientY:620, pointerId:2, preventDefault() {} });

  assert.equal(backCalls, 1);
});
