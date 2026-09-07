import test from 'node:test';
import assert from 'node:assert/strict';
import { installPredictionsScreen } from '../src/predictions/predictions-screen.mjs';

class FakeElement {
  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase();
    this.dataset = {};
    this.children = [];
    this.listeners = new Map();
    this.hidden = false;
    this.innerHTML = '';
    this.scrollTop = 0;
    this.scrollLeft = 0;
    this.id = '';
  }
  appendChild(child) { this.children.push(child); child.parentElement = this; return child; }
  addEventListener(type, fn) { this.listeners.set(type, fn); }
  removeEventListener(type) { this.listeners.delete(type); }
  contains(node) { return node === this || this.children.includes(node); }
  querySelector(selector) {
    if (selector === '.cw-pred-native-stages') return null;
    return null;
  }
  scrollTo({ left = 0, top = this.scrollTop } = {}) { this.scrollLeft = left; this.scrollTop = top; }
}

function fakeDocument() {
  const root = new FakeElement('div');
  root.id = 'ciao-miniapp-root';
  const listeners = new Map();
  const ids = new Map([['ciao-miniapp-root', root]]);
  return {
    root,
    listeners,
    hidden:false,
    body:root,
    createElement(tag){ const el = new FakeElement(tag); const original = Object.getOwnPropertyDescriptor(el, 'id'); void original; return el; },
    getElementById(id){
      if (id === 'ciao-native-predictions-root') return root.children.find(child => child.id === id) || null;
      return ids.get(id) || null;
    },
    addEventListener(type, fn){ listeners.set(type, fn); },
    removeEventListener(type){ listeners.delete(type); },
  };
}

function navTarget(tab) {
  const nav = { dataset:{ tab } };
  return { closest(selector){ return selector === 'button[data-tab]' ? nav : null; } };
}

function controllerStub() {
  const calls = [];
  let open = false;
  return {
    calls,
    open(){ calls.push('open'); open = true; },
    close(){ calls.push('close'); open = false; },
    openHub(){ calls.push('hub'); },
    openCompetition(key){ calls.push(['competition',key]); },
    setMode(mode){ calls.push(['mode',mode]); },
    setStage(stage){ calls.push(['stage',stage]); },
    setSerieRound(round){ calls.push(['round',round]); },
    adjustScore(id,side,delta){ calls.push(['delta',id,side,delta]); },
    save(){ calls.push('save'); return Promise.resolve({saved:0}); },
    refresh(){ calls.push('refresh'); return Promise.resolve(null); },
    isOpen(){ return open; },
    snapshot(){ return { open }; },
  };
}

test('existing data-tab mine opens native screen and other nav closes it', () => {
  const documentRef = fakeDocument();
  const controller = controllerStub();
  const screen = installPredictionsScreen(documentRef, { controller, defer: fn => fn() });
  const click = documentRef.listeners.get('click');
  click({ target: navTarget('mine') });
  assert.equal(screen.isOpen(), true);
  click({ target: navTarget('table') });
  assert.equal(screen.isOpen(), false);
  assert.deepEqual(controller.calls.slice(0,2), ['open','close']);
});

test('installer keeps the mount separate from legacy main content', () => {
  const documentRef = fakeDocument();
  const controller = controllerStub();
  installPredictionsScreen(documentRef, { controller, defer: fn => fn() });
  const mount = documentRef.getElementById('ciao-native-predictions-root');
  assert.ok(mount);
  assert.equal(mount.parentElement, documentRef.root);
});

test('installer does not overwrite legacy prediction globals', () => {
  const legacy = { predict(){}, mine(){}, render(){}, bind(){}, saveAll(){} };
  Object.assign(globalThis, legacy);
  const documentRef = fakeDocument();
  installPredictionsScreen(documentRef, { controller: controllerStub(), defer: fn => fn() });
  for (const [key, value] of Object.entries(legacy)) assert.equal(globalThis[key], value);
});

test('installer creates no MutationObserver', () => {
  let constructed = 0;
  const old = globalThis.MutationObserver;
  globalThis.MutationObserver = class { constructor(){ constructed += 1; } };
  try {
    installPredictionsScreen(fakeDocument(), { controller: controllerStub(), defer: fn => fn() });
    assert.equal(constructed, 0);
  } finally {
    globalThis.MutationObserver = old;
  }
});
