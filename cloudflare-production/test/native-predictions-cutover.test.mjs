import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const buildUrl = new URL('../scripts/build.mjs', import.meta.url);
const shellUrl = new URL('../src/app-shell.html', import.meta.url);
const screenUrl = new URL('../src/predictions/predictions-screen.mjs', import.meta.url);

test('production build has no prediction injector stack after native cutover', async () => {
  const source = await readFile(buildUrl, 'utf8');
  const forbidden = [
    'multitournament-predictions-runtime',
    'multitournament-predictions-theme',
    'prediction-stage-lock-ui',
    'prediction-live-scroll-polish',
    'prediction-mine-stage-polish',
    'home-predictions-nav-fix',
    'injectMultitournamentPredictionsPatch',
    'injectMultitournamentPredictionsThemePatch',
    'injectPredictionStageLockUiPatch',
    'injectPredictionLiveScrollPolishPatch',
    'injectPredictionMineStagePolishPatch',
    'injectHomePredictionsNavFixPatch',
  ];
  for (const token of forbidden) assert.doesNotMatch(source, new RegExp(token));
});

test('tracked shell owns final bottom-nav labels and static native entries', async () => {
  const shell = await readFile(shellUrl, 'utf8');
  assert.match(shell, /data-tab="mine"[^>]*>[\s\S]*?<span class="nav-label">Прогнозы<\/span>/);
  assert.match(shell, /href="\/predictions\/predictions-screen\.css"/);
  assert.match(shell, /type="module" src="\/predictions\/predictions-screen\.mjs"/);
});

test('native predictions installs by default without canary guard', async () => {
  const source = await readFile(screenUrl, 'utf8');
  assert.match(source, /if \(typeof document !== 'undefined'\) \{\s*globalThis\.CiaoPredictionsScreen = installPredictionsScreen\(document\);\s*\}/);
  assert.doesNotMatch(source, /native_predictions/);
  assert.doesNotMatch(source, /nativePredictionsEnabled/);
});

test('native predictions source does not patch legacy globals or observe legacy DOM', async () => {
  const source = await readFile(screenUrl, 'utf8');
  assert.doesNotMatch(source, /MutationObserver/);
  assert.doesNotMatch(source, /\bpredict\s*=/);
  assert.doesNotMatch(source, /\bmine\s*=/);
  assert.doesNotMatch(source, /\brender\s*=/);
  assert.doesNotMatch(source, /\bbind\s*=/);
  assert.doesNotMatch(source, /\bsaveAll\s*=/);
});
