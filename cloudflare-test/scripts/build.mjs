import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const BASE_BUILD = 'ciao-web-v23-1-cloudflare-test-20260901';
export const TEST_BUILD = 'ciao-web-v23-1-github-test-20260901';
export const DEFAULT_BASE_URL = 'https://ciao-web-app.ciao-web.workers.dev/releases/v23.1/';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cssPath = resolve(root, 'src/ui-v23.1.css');
const jsPath = resolve(root, 'src/ui-v23.1.js');
const outPath = resolve(root, 'dist/index.html');

export function applyPatch(baseHtml, css, js) {
  let html = String(baseHtml);
  if (!html.includes(BASE_BUILD)) {
    throw new Error(`base build marker missing: ${BASE_BUILD}`);
  }
  if (!/<\/head>/i.test(html) || !/<\/body>/i.test(html)) {
    throw new Error('base HTML is missing head/body anchors');
  }
  if (/ciao-web-github-test-patch/.test(html)) return html;

  html = html.replace(
    /<\/head>/i,
    `<meta name="ciao-test-build" content="${TEST_BUILD}">\n<style id="ciao-web-github-test-patch">\n${css}\n</style>\n</head>`,
  );
  html = html.replace(
    /<\/body>/i,
    `<script id="ciao-web-github-test-runtime">\n${js}\n</script>\n</body>`,
  );
  return html;
}

async function loadBase() {
  if (process.env.BASE_FILE) return readFile(resolve(process.env.BASE_FILE), 'utf8');
  const url = process.env.BASE_URL || DEFAULT_BASE_URL;
  const response = await fetch(url, { headers: { 'cache-control': 'no-cache' } });
  if (!response.ok) throw new Error(`base fetch failed: HTTP ${response.status}`);
  return response.text();
}

export async function build() {
  const [base, css, js] = await Promise.all([
    loadBase(),
    readFile(cssPath, 'utf8'),
    readFile(jsPath, 'utf8'),
  ]);
  const html = applyPatch(base, css, js);
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, html, 'utf8');
  return { output: outPath, bytes: Buffer.byteLength(html), build: TEST_BUILD };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  build().then((result) => console.log(JSON.stringify({ ok: true, ...result }))).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
