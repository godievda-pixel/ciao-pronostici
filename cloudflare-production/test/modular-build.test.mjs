import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as productionBuild from '../scripts/build.mjs';

const BASE = `<!doctype html><html><head><style id="ciao-prod-no-x2-20260903">
#ciao-miniapp-root .cw18-x2,
#ciao-miniapp-root .cw18-summary-bonus,
#ciao-miniapp-root .cw18-rule.x2{display:none!important}
#ciao-miniapp-root .cw18-rules-copy::after{content:'Дедлайн: прогноз на конкретный матч закрывается за 15 минут до начала.'}
#ciao-miniapp-root .cw18-rules-card .settings-row>div>div::after{content:'5 / 3 / 2 / 0 · дедлайн −15 минут'}
</style></head><body>app</body></html>`;

test('modular build injects exactly one inert css and module entry', () => {
  assert.equal(typeof productionBuild.injectModularAssets, 'function');
  const html = productionBuild.injectModularAssets(BASE);
  assert.equal((html.match(/data-ciao-modular="main-v1"/g) || []).length, 2);
  assert.equal((html.match(/href="\/modular\/app\.css"/g) || []).length, 1);
  assert.equal((html.match(/src="\/modular\/app\.mjs"/g) || []).length, 1);
  assert.match(html, /ciao-prod-no-x2-20260903/);
});

test('modular build copies only the clean local shell assets', async () => {
  assert.equal(typeof productionBuild.copyModularAssets, 'function');
  const out = await mkdtemp(join(tmpdir(), 'ciao-modular-build-'));
  try {
    await productionBuild.copyModularAssets({
      sourceDir: new URL('../src/modular/', import.meta.url),
      distDir: out,
    });
    const app = await readFile(join(out, 'app.mjs'), 'utf8');
    const css = await readFile(join(out, 'app.css'), 'utf8');
    assert.match(app, /main-modular-v1/);
    assert.doesNotMatch(`${app}\n${css}`, /round51|round50|cw239|ciao-web-app-test/i);
  } finally {
    await rm(out, { recursive: true, force: true });
  }
});
