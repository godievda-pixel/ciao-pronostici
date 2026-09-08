import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { injectBsdCrestPatch, validateBsdCrestPatchedHtml } from './bsd-crests.mjs';
import { injectMultitournamentPatch, validateMultitournamentPatchedHtml } from './multitournament-runtime.mjs';
import {
  injectMultitournamentCardThemePatch,
  validateMultitournamentCardThemePatchedHtml,
} from './multitournament-card-theme.mjs';
import {
  injectMultitournamentPredictionsPatch,
  validateMultitournamentPredictionsPatchedHtml,
} from './multitournament-predictions-runtime.mjs';
import {
  injectMultitournamentPredictionsThemePatch,
  validateMultitournamentPredictionsThemePatchedHtml,
} from './multitournament-predictions-theme.mjs';
import {
  injectGlobalRefreshPatch,
  validateGlobalRefreshPatchedHtml,
} from './global-refresh-runtime.mjs';
import {
  injectHomePredictionsNavFixPatch,
  validateHomePredictionsNavFixPatchedHtml,
} from './home-predictions-nav-fix.mjs';
import {
  injectPredictionStageLockUiPatch,
  validatePredictionStageLockUiPatchedHtml,
} from './prediction-stage-lock-ui.mjs';
import {
  injectPredictionLiveScrollPolishPatch,
  validatePredictionLiveScrollPolishPatchedHtml,
} from './prediction-live-scroll-polish.mjs';
import {
  injectPredictionMineStagePolishPatch,
  validatePredictionMineStagePolishPatchedHtml,
} from './prediction-mine-stage-polish.mjs';
import {
  injectHomeCalcioPolishSafePatch,
  validateHomeCalcioPolishSafePatchedHtml,
} from './home-calcio-polish-safe.mjs';
import {
  injectHomeCalcioSafetyPatch,
  validateHomeCalcioSafetyPatchedHtml,
} from './home-calcio-safety.mjs';
import { releaseRevision } from './release-revision.mjs';

// v22.5 is retained as rollback/history only. Active production builds from tracked v23 source below.
export const RELEASE_SOURCE_URL = 'https://dkefzepiiudehhzbbrjn.supabase.co/storage/v1/object/public/ciao-miniapp/migration/v22-5-resolved-no-x2.html';
export const RELEASE_PATH = '/releases/v22-5.html';
export const V23_RELEASE_PATH = '/releases/v23.html';
export const NO_X2_MARKER = 'ciao-prod-no-x2-20260903';
export const V23_PREDICTIONS_MARKER = 'ciao-prod-multitournament-predictions-20260907';
export const V23_CAPTURED_HOME_MARKER = 'ciao-prod-home-calcio-polish-20260908';
export const V23_NATIVE_HOME_MARKER = 'ciao-v23-native-home-20260908';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distDir = resolve(root, 'dist');
const v23SourcePath = resolve(root, 'src', 'v23', 'index.html');

export function rootHtmlFor({ release }) {
  return String(release || '');
}

export function validateReleaseHtml(input) {
  const html = String(input || '');
  const markerAt = html.indexOf(NO_X2_MARKER);
  if (markerAt < 0) throw new Error(`production no-x2 marker missing: ${NO_X2_MARKER}`);

  const styleStart = html.lastIndexOf('<style', markerAt);
  const styleEnd = html.indexOf('</style>', markerAt);
  if (styleStart < 0 || styleEnd < 0) throw new Error('production no-x2 style block missing');
  const patch = html.slice(styleStart, styleEnd + '</style>'.length);

  const groupedHide = /#ciao-miniapp-root\s+\.cw18-x2\s*,\s*#ciao-miniapp-root\s+\.cw18-summary-bonus\s*,\s*#ciao-miniapp-root\s+\.cw18-rule\.x2\s*\{\s*display\s*:\s*none\s*!important\s*\}/;
  if (!groupedHide.test(patch)) throw new Error('production grouped no-x2 hide rule missing');
  if (!patch.includes('5 / 3 / 2 / 0 · дедлайн −15 минут')) throw new Error('production no-x2 rules copy missing');
  if (!patch.includes('Дедлайн: прогноз на конкретный матч закрывается за 15 минут до начала.')) throw new Error('production deadline copy missing');
  return true;
}

export function validateBrowserScripts(input) {
  const html = String(input || '');
  const scriptRe = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
  let match;
  let classicIndex = 0;
  while ((match = scriptRe.exec(html))) {
    const attrs = String(match[1] || '');
    if (/\bsrc\s*=/i.test(attrs)) continue;
    const typeMatch = attrs.match(/\btype\s*=\s*(?:(["'])(.*?)\1|([^\s>]+))/i);
    const type = String(typeMatch?.[2] || typeMatch?.[3] || '').trim().toLowerCase();
    if (type && !/^(?:text|application)\/(?:java|ecma)script$/.test(type)) continue;
    classicIndex += 1;
    try {
      new Function(String(match[2] || ''));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`browser script syntax invalid at inline script ${classicIndex}: ${message}`);
    }
  }
  return true;
}

export function validateV23Source(input) {
  const html = String(input || '');
  if (!html.includes('Ciao, Web!')) throw new Error('v23 Ciao marker missing');
  if (!html.includes(V23_PREDICTIONS_MARKER)) throw new Error(`v23 predictions marker missing: ${V23_PREDICTIONS_MARKER}`);
  if (!html.includes(V23_CAPTURED_HOME_MARKER) && !html.includes(V23_NATIVE_HOME_MARKER)) {
    throw new Error('v23 Home marker missing');
  }
  validateBrowserScripts(html);
  return true;
}

// Legacy v22.5 transformer retained for rollback/history tests. Active build() does not call it.
export function prepareReleaseHtml(input) {
  const source = String(input || '');
  validateReleaseHtml(source);
  const withCrests = injectBsdCrestPatch(source);
  validateBsdCrestPatchedHtml(withCrests);
  const withTournaments = injectMultitournamentPatch(withCrests);
  validateMultitournamentPatchedHtml(withTournaments);
  const withMatchTheme = injectMultitournamentCardThemePatch(withTournaments);
  validateMultitournamentCardThemePatchedHtml(withMatchTheme);
  const withPredictions = injectMultitournamentPredictionsPatch(withMatchTheme);
  validateMultitournamentPredictionsPatchedHtml(withPredictions);
  const withPredictionTheme = injectMultitournamentPredictionsThemePatch(withPredictions);
  validateMultitournamentPredictionsThemePatchedHtml(withPredictionTheme);
  const withGlobalRefresh = injectGlobalRefreshPatch(withPredictionTheme);
  validateGlobalRefreshPatchedHtml(withGlobalRefresh);
  const withHomeFix = injectHomePredictionsNavFixPatch(withGlobalRefresh);
  validateHomePredictionsNavFixPatchedHtml(withHomeFix);
  const withStageLockUi = injectPredictionStageLockUiPatch(withHomeFix);
  validatePredictionStageLockUiPatchedHtml(withStageLockUi);
  const withLiveScrollPolish = injectPredictionLiveScrollPolishPatch(withStageLockUi);
  validatePredictionLiveScrollPolishPatchedHtml(withLiveScrollPolish);
  const withMineStagePolish = injectPredictionMineStagePolishPatch(withLiveScrollPolish);
  validatePredictionMineStagePolishPatchedHtml(withMineStagePolish);
  const withHomeCalcioPolish = injectHomeCalcioPolishSafePatch(withMineStagePolish);
  validateHomeCalcioPolishSafePatchedHtml(withHomeCalcioPolish);
  const release = injectHomeCalcioSafetyPatch(withHomeCalcioPolish);
  validateHomeCalcioSafetyPatchedHtml(release);
  return release;
}

export async function writeBuildOutputs({ outputDir = distDir, rootHtml, release, releaseFile = 'v22-5.html' }) {
  const releasesDir = resolve(outputDir, 'releases');
  await mkdir(releasesDir, { recursive: true });
  await writeFile(resolve(outputDir, 'index.html'), rootHtml, 'utf8');
  await writeFile(resolve(releasesDir, releaseFile), release, 'utf8');
  const revision = releaseRevision(Buffer.from(rootHtml, 'utf8'));
  await writeFile(resolve(outputDir, 'release-revision.txt'), `${revision}\n`, 'utf8');
  return { revision };
}

export async function buildV23({ sourceHtml, outputDir = distDir } = {}) {
  const source = sourceHtml == null ? await readFile(v23SourcePath, 'utf8') : String(sourceHtml);
  validateV23Source(source);
  const { revision } = await writeBuildOutputs({
    outputDir,
    rootHtml: source,
    release: source,
    releaseFile: 'v23.html',
  });
  return {
    ok: true,
    version: 'v23.0',
    entry: 'dist/index.html',
    release: 'dist/releases/v23.html',
    revision,
    bytes: Buffer.byteLength(source),
  };
}

export async function build() {
  return buildV23();
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  build().then(x => console.log(JSON.stringify(x))).catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
