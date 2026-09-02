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
  assert.equal(files.includes('tables-ui.mjs'), true);
  assert.equal(files.includes('match-center.mjs'), true);
  assert.equal(files.includes('match-center-links.mjs'), true);
  assert.equal(files.includes('prediction-client.mjs'), true);
  assert.equal(files.includes('predictions-ui.mjs'), true);
  assert.equal(files.includes('navigation-ui.mjs'), true);
  assert.equal(files.includes('ranking-ui.mjs'), true);

  const competitionData = await readFile(new URL('../dist/v23.3/competition-data.mjs', import.meta.url), 'utf8');
  const dataClient = await readFile(new URL('../dist/v23.3/data-client.mjs', import.meta.url), 'utf8');
  const homeRuntime = await readFile(new URL('../dist/v23.3/home-integration.mjs', import.meta.url), 'utf8');
  const tablesRuntime = await readFile(new URL('../dist/v23.3/tables-ui.mjs', import.meta.url), 'utf8');
  const matchCenterRuntime = await readFile(new URL('../dist/v23.3/match-center.mjs', import.meta.url), 'utf8');
  const matchCenterLinksRuntime = await readFile(new URL('../dist/v23.3/match-center-links.mjs', import.meta.url), 'utf8');
  const predictionClient = await readFile(new URL('../dist/v23.3/prediction-client.mjs', import.meta.url), 'utf8');
  const predictionsRuntime = await readFile(new URL('../dist/v23.3/predictions-ui.mjs', import.meta.url), 'utf8');
  const navigationRuntime = await readFile(new URL('../dist/v23.3/navigation-ui.mjs', import.meta.url), 'utf8');
  const rankingRuntime = await readFile(new URL('../dist/v23.3/ranking-ui.mjs', import.meta.url), 'utf8');

  assert.match(competitionData, /predictionDeadlineForKickoff/);
  assert.match(dataClient, /loadCompetitionStandings/);
  assert.match(dataClient, /loadMatchCenterSnapshot/);
  assert.match(homeRuntime, /CiaoV233Home/);
  assert.match(homeRuntime, /Кальчо сегодня/);
  assert.match(homeRuntime, /installCanonicalMatchCenter/);
  assert.match(homeRuntime, /installCanonicalMatchLinks/);
  assert.match(tablesRuntime, /installTablesUi/);
  assert.match(tablesRuntime, /TABLE_COMPETITIONS/);
  assert.match(tablesRuntime, /coppa_italia/);
  assert.match(matchCenterRuntime, /createMatchCenterController/);
  assert.match(matchCenterRuntime, /openCanonicalMatchCenter/);
  assert.match(matchCenterLinksRuntime, /resolveCanonicalMatchTarget/);
  assert.match(matchCenterLinksRuntime, /installCanonicalMatchLinks/);
  assert.match(predictionClient, /\/api\/v23\.3\/predictions/);
  assert.match(predictionsRuntime, /installPredictionsUi/);
  assert.match(navigationRuntime, /NAVIGATION_LABELS/);
  assert.match(rankingRuntime, /installRankingUi/);
  assert.doesNotMatch(`${predictionClient}\n${predictionsRuntime}\n${rankingRuntime}`, /localStorage|indexedDB|supabase|save_predictions/i);
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

test('v23.3 build injects the Tables module exactly once', async () => {
  const { injectV233TablesEntry } = await buildModule();
  assert.equal(typeof injectV233TablesEntry, 'function');
  const base = '<html><head></head><body><main>app</main></body></html>';
  const once = injectV233TablesEntry(base);
  const twice = injectV233TablesEntry(once);
  assert.equal(twice, once);
  assert.equal((once.match(/id="ciao-v233-tables"/g) || []).length, 1);
  assert.match(once, /src="\/v23\.3\/tables-ui\.mjs"/);
});

test('v23.3 build removes only the legacy SERIE A 2026/27 label and preserves the new-season notice', async () => {
  const { applyV233HomeBuildPatch } = await buildModule();
  assert.equal(typeof applyV233HomeBuildPatch, 'function');
  const resetNotice = 'Начало нового сезона! Счёт обнулен, все начинают с нуля. Удачи!';
  const source = `
    <div class="season-label">SERIE A 2026/27</div>
    <div class="season-notice">${resetNotice}</div>
    <script>
      function __cw231HomeHtml(){ return '<section class="cw231-today">legacy</section>'; }
      predict = __cw231HomeHtml;
    </script>
  `;
  const patched = applyV233HomeBuildPatch(source);
  assert.match(patched, /cw233-home-multicompetition/);
  assert.doesNotMatch(patched, /SERIE A 2026\/27/);
  assert.match(patched, /Начало нового сезона! Счёт обнулен, все начинают с нуля\. Удачи!/);
  assert.throws(() => applyV233HomeBuildPatch('<html><body>unexpected stable source</body></html>'), /v23\.3 Home anchor missing/);
});

test('v23.3 unified build entry is injected exactly once and replaces split runtime entries', async () => {
  const { injectV233Entry } = await buildModule();
  assert.equal(typeof injectV233Entry, 'function');
  const base = '<html><head></head><body><script id="ciao-v232-core"></script><script id="ciao-v232-matches-ui"></script></body></html>';
  const once = injectV233Entry(base);
  const twice = injectV233Entry(once);
  assert.equal(twice, once);
  assert.equal((once.match(/id="ciao-v233"/g) || []).length, 1);
  assert.match(once, /src="\/v23\.3\/index\.mjs"/);
  assert.doesNotMatch(once, /id="ciao-v233-home"/);
  assert.doesNotMatch(once, /id="ciao-v233-tables"/);
  assert.match(once, /id="ciao-v232-core"/);
  assert.match(once, /id="ciao-v232-matches-ui"/);
});

test('v23.3 browser entry enables predictions and ranking without exposing reset tooling', async () => {
  const { copyV233Modules } = await buildModule();
  const files = await copyV233Modules();
  assert.equal(files.includes('index.mjs'), true);
  const entry = await readFile(new URL('../dist/v23.3/index.mjs', import.meta.url), 'utf8');
  assert.match(entry, /navigation-ui\.mjs/);
  assert.match(entry, /home-integration\.mjs/);
  assert.match(entry, /tables-ui\.mjs/);
  assert.match(entry, /predictions-ui\.mjs/);
  assert.match(entry, /ranking-ui\.mjs/);
  assert.match(entry, /CiaoV233/);
  assert.match(entry, /Object\.freeze/);
  assert.match(entry, /predictions[^\n]*enabled/i);
  assert.match(entry, /ranking[^\n]*enabled/i);
  assert.doesNotMatch(entry, /reset-contract\.mjs/);
  assert.doesNotMatch(entry, /createReset|executeReset|resetUser/i);
});

test('v23.3 build pipeline uses the unified entry while preserving the Home source patch', async () => {
  const source = await readFile(new URL('../scripts/build.mjs', import.meta.url), 'utf8');
  assert.match(source, /injectV233Entry\s*\(/);
  assert.match(source, /applyV233HomeBuildPatch\s*\(/);
  assert.doesNotMatch(source, /injectV233TablesEntry\s*\(\s*\n?\s*injectV233HomeEntry\s*\(/);
});

test('TEST wrangler binds the SQLite PredictionLeague without a Production binding', async () => {
  const source = await readFile(new URL('../wrangler.jsonc', import.meta.url), 'utf8');
  assert.match(source, /"PREDICTION_LEAGUE"/);
  assert.match(source, /"PredictionLeague"/);
  assert.match(source, /"new_sqlite_classes"\s*:\s*\[\s*"PredictionLeague"\s*\]/);
  assert.match(source, /"CIAO_ENV"\s*:\s*"test"/);
  assert.match(source, /"PREDICTION_SEASON"\s*:\s*"2026-27"/);
  assert.doesNotMatch(source, /ciao-web-app"/);
});
