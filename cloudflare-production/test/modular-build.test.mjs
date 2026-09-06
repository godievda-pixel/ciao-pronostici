import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as productionBuild from '../scripts/build.mjs';

const sampleRelease = `<!doctype html><html><head><style id="ciao-prod-no-x2-20260903">
#ciao-miniapp-root .cw18-x2,
#ciao-miniapp-root .cw18-summary-bonus,
#ciao-miniapp-root .cw18-rule.x2{display:none!important}
#ciao-miniapp-root .cw18-rules-copy::after{content:'Дедлайн: прогноз на конкретный матч закрывается за 15 минут до начала.'}
#ciao-miniapp-root .cw18-rules-card .settings-row>div>div::after{content:'5 / 3 / 2 / 0 · дедлайн −15 минут'}
</style></head><body><div id="ciao-miniapp-root"></div></body></html>`;

test('modular build injects one inert stylesheet and one module entry', () => {
  assert.equal(typeof productionBuild.injectModularAssets, 'function');
  const html = productionBuild.injectModularAssets(sampleRelease);
  assert.equal((html.match(/data-ciao-modular="main-v1"/g) || []).length, 2);
  assert.equal((html.match(/href="\/modular\/app\.css"/g) || []).length, 1);
  assert.equal((html.match(/src="\/modular\/app\.mjs"/g) || []).length, 1);
  assert.equal(productionBuild.injectModularAssets(html), html);
});

test('modular assets copy into dist without legacy TEST runtime markers', async () => {
  assert.equal(typeof productionBuild.copyModularAssets, 'function');
  const root = await mkdtemp(join(tmpdir(), 'ciao-modular-'));
  const sourceDir = join(root, 'src');
  const distDir = join(root, 'dist');
  await mkdir(sourceDir, { recursive:true });
  await writeFile(join(sourceDir, 'app.mjs'), "export const MODULAR_BUILD = 'main-modular-v1';\n", 'utf8');
  await writeFile(join(sourceDir, 'app.css'), '/* inert modular shell */\n', 'utf8');

  await productionBuild.copyModularAssets({ sourceDir, distDir });
  const app = await readFile(join(distDir, 'app.mjs'), 'utf8');
  const css = await readFile(join(distDir, 'app.css'), 'utf8');
  assert.match(app, /main-modular-v1/);
  assert.doesNotMatch(`${app}\n${css}`, /round51|round50|cw239|ciao-web-app-test/i);
});
