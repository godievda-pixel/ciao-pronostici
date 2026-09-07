import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { injectBsdCrestPatch, validateBsdCrestPatchedHtml } from './bsd-crests.mjs';
import { injectMultitournamentPatch, validateMultitournamentPatchedHtml } from './multitournament-runtime.mjs';
import {
  injectMultitournamentCardThemePatch,
  validateMultitournamentCardThemePatchedHtml,
} from './multitournament-card-theme.mjs';
import {
  injectGlobalRefreshPatch,
  validateGlobalRefreshPatchedHtml,
} from './global-refresh-runtime.mjs';

export const RELEASE_PATH = '/releases/v22-5.html';
export const NO_X2_MARKER = 'ciao-prod-no-x2-20260903';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const APP_SHELL_PATH = resolve(root, 'src/app-shell.html');
const predictionsSourceDir = resolve(root, 'src/predictions');
const competitionConfigSource = resolve(root, 'src/matches/competition-config.mjs');
const distDir = resolve(root, 'dist');
const predictionsOutDir = resolve(distDir, 'predictions');
const matchesOutDir = resolve(distDir, 'matches');
const releaseOut = resolve(distDir, 'releases/v22-5.html');

export async function loadAppShell() {
  return readFile(APP_SHELL_PATH, 'utf8');
}

async function copyTree(sourceDir, targetDir, copied, prefix = '') {
  await mkdir(targetDir, { recursive: true });
  const entries = await readdir(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    const source = resolve(sourceDir, entry.name);
    const target = resolve(targetDir, entry.name);
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      await copyTree(source, target, copied, relative);
      continue;
    }
    if (!entry.isFile() || !/\.(?:mjs|css)$/.test(entry.name)) continue;
    await copyFile(source, target);
    copied.push(relative);
  }
}

export async function copyPredictionsAssets() {
  const copied = [];
  await copyTree(predictionsSourceDir, predictionsOutDir, copied);
  await mkdir(matchesOutDir, { recursive: true });
  await copyFile(competitionConfigSource, resolve(matchesOutDir, 'competition-config.mjs'));
  return copied.sort();
}

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

export function prepareReleaseHtml(input) {
  const source = String(input || '');
  validateReleaseHtml(source);
  const withCrests = injectBsdCrestPatch(source);
  validateBsdCrestPatchedHtml(withCrests);
  const withTournaments = injectMultitournamentPatch(withCrests);
  validateMultitournamentPatchedHtml(withTournaments);
  const withMatchTheme = injectMultitournamentCardThemePatch(withTournaments);
  validateMultitournamentCardThemePatchedHtml(withMatchTheme);
  const release = injectGlobalRefreshPatch(withMatchTheme);
  validateGlobalRefreshPatchedHtml(release);
  return release;
}

export async function build() {
  const source = await loadAppShell();
  const release = prepareReleaseHtml(source);
  const rootHtml = rootHtmlFor({ release });
  await mkdir(resolve(distDir, 'releases'), { recursive: true });
  await copyPredictionsAssets();
  await writeFile(resolve(distDir, 'index.html'), rootHtml, 'utf8');
  await writeFile(releaseOut, release, 'utf8');
  return { ok: true, entry: 'dist/index.html', release: 'dist/releases/v22-5.html', bytes: Buffer.byteLength(release) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  build().then(x => console.log(JSON.stringify(x))).catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
