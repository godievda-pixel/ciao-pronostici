import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createBrowserMatchCenterHost,
  MATCH_CENTER_HOST_SCROLLBAR_CSS,
} from '../src/v23.3/match-center-runtime.mjs';

test('Premium Match Center hides scrollbar on actual runtime overlay host', () => {
  const injected = [];
  const children = [];
  const root = { appendChild(node) { children.push(node); } };
  const documentRef = {
    head:{ appendChild(node) { injected.push(node); } },
    getElementById(id) {
      return id === 'ciao-miniapp-root' ? root : null;
    },
    createElement(tag) {
      return {
        tag,
        id:'',
        textContent:'',
        dataset:{},
        style:{},
        hidden:false,
        scrollTop:0,
        setAttribute() {},
        removeAttribute() {},
        addEventListener() {},
        removeEventListener() {},
        contains() { return false; },
        remove() {},
      };
    },
  };

  const host = createBrowserMatchCenterHost(documentRef);

  assert.equal(host.node.id, 'ciao-v239-match-center-overlay');
  assert.equal(host.node.style.overflowY, 'auto');
  assert.equal(host.node.style.scrollbarWidth, 'none');
  assert.equal(host.node.style.msOverflowStyle, 'none');
  assert.equal(injected.length, 1);
  assert.equal(injected[0].textContent, MATCH_CENTER_HOST_SCROLLBAR_CSS);
  assert.match(MATCH_CENTER_HOST_SCROLLBAR_CSS, /#ciao-v239-match-center-overlay\{[^}]*scrollbar-width:none[^}]*-ms-overflow-style:none/s);
  assert.match(MATCH_CENTER_HOST_SCROLLBAR_CSS, /#ciao-v239-match-center-overlay::-webkit-scrollbar\{[^}]*display:none[^}]*width:0[^}]*height:0/s);
  assert.equal(children[0], host.node);
});
