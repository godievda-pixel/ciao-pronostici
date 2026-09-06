import { copyFile, mkdir, readdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RELEASE_SOURCE_URL = 'https://dkefzepiiudehhzbbrjn.supabase.co/storage/v1/object/public/ciao-miniapp/migration/v22-5-resolved-no-x2.html';
export const RELEASE_PATH = '/releases/v22-5.html';
export const NO_X2_MARKER = 'ciao-prod-no-x2-20260903';
export const MODULAR_MARKER = 'main-v1';
export const PROD_SUPABASE_REF = 'dkefzepiiudehhzbbrjn';
export const TEST_SUPABASE_REF = 'lcnwccnkkxaosxnfvjvr';
export const TEST_SUPABASE_ORIGIN = `https://${TEST_SUPABASE_REF}.supabase.co`;

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distDir = resolve(root, 'dist');
const releaseOut = resolve(distDir, 'releases/v22-5.html');
const modularSourceDir = resolve(root, 'src/modular');
const modularDistDir = resolve(distDir, 'modular');

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

export function rewriteTestSupabaseOrigin(input) {
  let html = String(input || '').split(PROD_SUPABASE_REF).join(TEST_SUPABASE_REF);
  const legacyCoreSlugs = ['ciao-core-api-fast-v6','ciao-core-api-fast-v5','ciao-core-api-fast-v4','ciao-core-api-fast'];
  for (const slug of legacyCoreSlugs) html = html.split(`/functions/v1/${slug}`).join('/functions/v1/ciao-v23-api');
  if (html.includes(PROD_SUPABASE_REF)) throw new Error('production Supabase reference remains in TEST release');
  return html;
}

export function injectModularAssets(input) {
  const html = String(input || '')
    .replace(/<link\b[^>]*data-ciao-modular=["']main-v1["'][^>]*>\s*/gi, '')
    .replace(/<script\b[^>]*data-ciao-modular=["']main-v1["'][^>]*>\s*<\/script>\s*/gi, '');
  const assets = `<link rel="stylesheet" href="/modular/app.css" data-ciao-modular="${MODULAR_MARKER}">\n<script type="module" src="/modular/app.mjs" data-ciao-modular="${MODULAR_MARKER}"></script>\n`;
  return html.includes('</head>') ? html.replace('</head>', `${assets}</head>`) : `${assets}${html}`;
}

async function copyTree(source, target) {
  await mkdir(target, { recursive:true });
  for (const entry of await readdir(source, { withFileTypes:true })) {
    const from = resolve(source, entry.name), to = resolve(target, entry.name);
    if (entry.isDirectory()) await copyTree(from, to);
    else if (entry.isFile()) await copyFile(from, to);
  }
}

export async function copyModularAssets({ sourceDir = modularSourceDir, distDir: targetDir = modularDistDir } = {}) {
  const source = sourceDir instanceof URL ? fileURLToPath(sourceDir) : resolve(String(sourceDir));
  const target = targetDir instanceof URL ? fileURLToPath(targetDir) : resolve(String(targetDir));
  await copyTree(source, target);
}

export async function build() {
  const releaseResponse = await fetch(RELEASE_SOURCE_URL, { headers: { 'cache-control': 'no-cache' } });
  if (!releaseResponse.ok) throw new Error(`release source HTTP ${releaseResponse.status}`);
  const release = await releaseResponse.text();
  validateReleaseHtml(release);
  const isolatedRelease = rewriteTestSupabaseOrigin(release);
  const modularRelease = injectModularAssets(isolatedRelease);
  if (modularRelease.includes(PROD_SUPABASE_REF)) throw new Error('production Supabase reference remains in TEST build');
  const rootHtml = rootHtmlFor({ release: modularRelease });
  await mkdir(resolve(distDir, 'releases'), { recursive: true });
  await copyModularAssets();
  await writeFile(resolve(distDir, 'index.html'), rootHtml, 'utf8');
  await writeFile(releaseOut, modularRelease, 'utf8');
  return { ok: true, entry: 'dist/index.html', release: 'dist/releases/v22-5.html', bytes: Buffer.byteLength(modularRelease), environment:'v23-test' };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  build().then(x => console.log(JSON.stringify(x))).catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
