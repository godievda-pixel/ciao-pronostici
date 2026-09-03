import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RELEASE_SOURCE_URL = 'https://dkefzepiiudehhzbbrjn.supabase.co/storage/v1/object/public/ciao-miniapp/migration/v22-5-resolved-no-x2.html';
export const RELEASE_PATH = '/releases/v22-5.html';
export const NO_X2_MARKER = 'ciao-prod-no-x2-20260903';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const entryPath = resolve(root, 'src/index.html');
const distDir = resolve(root, 'dist');
const releaseOut = resolve(distDir, 'releases/v22-5.html');

export function validateEntryHtml(input) {
  const html = String(input || '');
  if (!html.includes(RELEASE_PATH)) throw new Error('production entry release route missing');
  return true;
}

export function validateReleaseHtml(input) {
  const html = String(input || '');
  const required = [
    NO_X2_MARKER,
    '.cw18-x2{display:none!important}',
    '.cw18-summary-bonus{display:none!important}',
    '.cw18-rule.x2{display:none!important}',
    '5 / 3 / 2 / 0 · дедлайн −15 минут',
  ];
  for (const marker of required) {
    if (!html.includes(marker)) throw new Error(`production no-x2 marker missing: ${marker}`);
  }
  return true;
}

export async function build() {
  const [entry, releaseResponse] = await Promise.all([
    readFile(entryPath, 'utf8'),
    fetch(RELEASE_SOURCE_URL, { headers: { 'cache-control': 'no-cache' } }),
  ]);
  if (!releaseResponse.ok) throw new Error(`release source HTTP ${releaseResponse.status}`);
  const release = await releaseResponse.text();
  validateEntryHtml(entry);
  validateReleaseHtml(release);
  await mkdir(resolve(distDir, 'releases'), { recursive: true });
  await writeFile(resolve(distDir, 'index.html'), entry, 'utf8');
  await writeFile(releaseOut, release, 'utf8');
  return { ok: true, entry: 'dist/index.html', release: 'dist/releases/v22-5.html', bytes: Buffer.byteLength(release) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  build().then(x => console.log(JSON.stringify(x))).catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
