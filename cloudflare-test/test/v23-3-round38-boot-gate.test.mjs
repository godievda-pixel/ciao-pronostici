import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { createBootGate } from '../src/v23.3/boot-gate.mjs';
import { applyRound38BootGateSourcePatch } from '../scripts/round38-boot-gate-source-patch.mjs';

test('gate releases only after app runtime and Home have settled', () => {
  const gate = createBootGate({ documentRef:null, rootRef:null, autoTimer:false });
  gate.markRuntimeReady();
  assert.equal(gate.state().released, false);
  gate.markHomeReady();
  assert.equal(gate.state().released, true);
});

test('source patch places premium boot curtain before v23.3 module execution', () => {
  const html = '<html><head></head><body><main>legacy</main><script type="module" id="ciao-v233" src="/v23.3/index.mjs"></script></body></html>';
  const patched = applyRound38BootGateSourcePatch(html);
  assert.match(patched, /id="ciao-v233-boot-gate-inline-style"/);
  assert.match(patched, /id="ciao-v233-boot-gate"/);
  assert.ok(patched.indexOf('id="ciao-v233-boot-gate"') < patched.indexOf('id="ciao-v233"'));
  assert.match(patched, /#061128/);
});

test('Home loading source no longer emits fake match cards and dispatches settled signal', async () => {
  const source = await readFile(new URL('../src/v23.3/home-integration.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /function renderHomeBootstrapCard/);
  assert.doesNotMatch(source, /cw233-home-bootstrap-card/);
  assert.match(source, /ciao-v233-home-settled/);
});

test('v23.3 entry emits runtime-ready only after the module graph has initialized', async () => {
  const source = await readFile(new URL('../src/v23.3/index.mjs', import.meta.url), 'utf8');
  assert.match(source, /dispatchEvent\(new globalThis\.Event\(['"]ciao-v233-ready['"]\)\)/);
  assert.ok(
    source.indexOf("globalThis.dispatchEvent(new globalThis.Event('ciao-v233-ready'))") > source.indexOf('export const CiaoV233'),
    'runtime-ready signal must be emitted only after the v23.3 module graph has initialized',
  );
});

test('TEST build pipeline applies round38 boot patch to final dist', async () => {
  const source = await readFile(new URL('../scripts/build-with-test-baseline.mjs', import.meta.url), 'utf8');
  assert.match(source, /applyRound38BootGateSourcePatch/);
});
