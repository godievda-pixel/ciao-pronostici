import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RELEASE_SOURCE_URL = 'https://dkefzepiiudehhzbbrjn.supabase.co/storage/v1/object/public/ciao-miniapp/migration/v22-5-resolved-no-x2.html';
export const RELEASE_PATH = '/releases/v22-5.html';
export const NO_X2_MARKER = 'ciao-prod-no-x2-20260903';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distDir = resolve(root, 'dist');
const releaseOut = resolve(distDir, 'releases/v22-5.html');

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

export async function build() {
  const releaseResponse = await fetch(RELEASE_SOURCE_URL, { headers: { 'cache-control': 'no-cache' } });
  if (!releaseResponse.ok) throw new Error(`release source HTTP ${releaseResponse.status}`);
  const release = await releaseResponse.text();
  validateReleaseHtml(release);
  const rootHtml = rootHtmlFor({ release });
  await mkdir(resolve(distDir, 'releases'), { recursive: true });
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
