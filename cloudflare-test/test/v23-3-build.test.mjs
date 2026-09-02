import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function buildModule() {
  return import('../scripts/build.mjs');
}

test('build copies v23.3 browser modules required by multi-competition UI', async () => {
  const { copyV233Modules } = await buildModule();
  assert.equal(typeof copyV233Modules, 'function');

  const files = await copyV233Modules();
  assert.equal(files.includes('competition-data.mjs'), true);
  assert.equal(files.includes('data-client.mjs'), true);
  assert.equal(files.includes('home-integration.mjs'), true);

  const competitionData = await readFile(
    new URL('../dist/v23.3/competition-data.mjs', import.meta.url),
    'utf8',
  );
  const dataClient = await readFile(
    new URL('../dist/v23.3/data-client.mjs', import.meta.url),
    'utf8',
  );
  const homeRuntime = await readFile(
    new URL('../dist/v23.3/home-integration.mjs', import.meta.url),
    'utf8',
  );

  assert.match(competitionData, /predictionDeadlineForKickoff/);
  assert.match(dataClient, /loadCompetitionStandings/);
  assert.match(dataClient, /loadMatchCenterSnapshot/);
  assert.match(homeRuntime, /CiaoV233Home/);
  assert.match(homeRuntime, /Кальчо сегодня/);
});

test('v23.3 build injects the Home module exactly once', async () => {
  const { injectV233HomeEntry } = await buildModule();
  assert.equal(typeof injectV233HomeEntry, 'function');

  const base = '<html><head></head><body><main>app</main></body></html>';
  const once = injectV233HomeEntry(base);
  const twice = injectV233HomeEntry(once);

  assert.equal(twice, once);
  assert.equal((once.match(/id="ciao-v233-home"/g) || []).length, 1);
  assert.match(once, /src="\/v23\.3\/home-integration\.mjs"/);
});

test('v23.3 build applies the stable Home patch and refuses a missing anchor', async () => {
  const { applyV233HomeBuildPatch } = await buildModule();
  assert.equal(typeof applyV233HomeBuildPatch, 'function');

  const source = `
    <div>Начало нового сезона! Счёт обнулен, все начинают с нуля. Удачи!</div>
    <script>
      function __cw231HomeHtml(){ return '<section class="cw231-today">legacy</section>'; }
      predict = __cw231HomeHtml;
    </script>
  `;
  const patched = applyV233HomeBuildPatch(source);

  assert.match(patched, /cw233-home-multicompetition/);
  assert.doesNotMatch(patched, /Начало нового сезона! Счёт обнулен/);
  assert.throws(
    () => applyV233HomeBuildPatch('<html><body>unexpected stable source</body></html>'),
    /v23\.3 Home anchor missing/,
  );
});
