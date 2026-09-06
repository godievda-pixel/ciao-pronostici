import test from 'node:test';
import assert from 'node:assert/strict';
import { createLegacySurfaceAdapter, LEGACY_ROOT_SELECTOR } from '../src/modular/core/legacy-surface-adapter.mjs';

function element(className='') {
  const attrs = new Map();
  return {
    className,
    hidden:false,
    children:[],
    parentElement:null,
    previousElementSibling:null,
    nextElementSibling:null,
    innerHTML:'',
    isConnected:true,
    classList:{ contains(name){ return className.split(/\s+/).includes(name); } },
    setAttribute(name,value){ attrs.set(name,String(value)); },
    getAttribute(name){ return attrs.get(name) || null; },
  };
}

function linkChildren(content, nodes) {
  content.children = [...nodes];
  content.children.forEach((node,index) => {
    node.parentElement = content;
    node.previousElementSibling = content.children[index - 1] || null;
    node.nextElementSibling = content.children[index + 1] || null;
  });
}

function harness() {
  const content = element('content');
  const initial = [element('hero'), element('rounds'), element('matches'), element('savebar')];
  linkChildren(content, initial);
  content.appendChild = node => {
    content.children.push(node);
    linkChildren(content, content.children);
  };
  content.querySelectorAll = selector => content.children.filter(node => {
    if (selector === '[data-ciao-modular-host]') return node.getAttribute?.('data-ciao-modular-host') != null;
    if (selector.startsWith('.')) return node.className.split(/\s+/).includes(selector.slice(1));
    return false;
  });
  content.querySelector = selector => content.querySelectorAll(selector)[0] || null;

  const root = {
    addEventListener(){},
    removeEventListener(){},
    querySelector(selector){
      if (selector === '.content') return content;
      if (selector.startsWith('[data-tab=')) return null;
      return content.querySelector(selector);
    },
    querySelectorAll(selector){ return content.querySelectorAll(selector); },
  };
  const documentRef = {
    querySelector(selector){ return selector === LEGACY_ROOT_SELECTOR ? root : null; },
    createElement(){ return element(''); },
  };
  return { content, initial, root, documentRef };
}

test('modular screen repairs itself after a late v22.5 content replacement', async () => {
  const h = harness();
  let mutationCallback = null;
  const mutationObserverFactory = callback => ({
    observe(){ mutationCallback = callback; },
    disconnect(){},
  });
  const adapter = createLegacySurfaceAdapter({ documentRef:h.documentRef, mutationObserverFactory });
  assert.equal(adapter.start(), true);

  const firstHost = adapter.showModular('<section data-screen="ranking">RANKING</section>');
  assert.ok(firstHost);
  assert.equal(firstHost.hidden, false);

  const replacement = [element('legacy-rendered-hero'), element('legacy-rendered-content')];
  firstHost.isConnected = false;
  linkChildren(h.content, replacement);

  mutationCallback?.();
  await Promise.resolve();

  const repaired = adapter.host();
  assert.notEqual(repaired, firstHost, 'late legacy render must recreate the modular host');
  assert.equal(repaired?.innerHTML, '<section data-screen="ranking">RANKING</section>');
  assert.equal(repaired?.hidden, false);
  assert.equal(replacement[0].hidden, true);
  assert.equal(replacement[1].hidden, true);
});
