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

function printAround(text, needle, label, span = 1800) {
  const at = text.indexOf(needle);
  console.log(`DIAG ${label}:`, at >= 0 ? text.slice(at, at + span) : 'NOT FOUND');
}

function diagnoseBase(source) {
  const text = String(source);
  printAround(text, 'function __cw231RawScheduleMatches', 'raw schedule function', 1800);
  printAround(text, 'function __cw211FavoriteDashboard', 'favorite dashboard', 5200);
  printAround(text, 'const m=', 'first const m', 2200);
  printAround(text, '__kind', 'favorite match kind', 2600);
}

export function applyScheduleSourcePatch(input) {
  const source = String(input);
  if (source.includes('cw231-empty__schedule-source')) return source;

  const startNeedle = 'const nearest = visible.length ? null : __cw231NearestMatch(rawSchedule);';
  const start = source.indexOf(startNeedle);
  if (start < 0) return source;

  const bodyStart = source.indexOf('const body = visible.length', start);
  if (bodyStart < 0) throw new Error('v23.1 today body anchor missing');

  const nextAnchor = "let dateLabel = '';";
  let end = source.indexOf(nextAnchor, bodyStart);
  if (end < 0) end = source.length;

  const indentMatch = source.slice(Math.max(0, start - 8), start).match(/(^|\n)([ \t]*)$/);
  const i = indentMatch?.[2] || '  ';

  const replacement = `${i}const nearest = visible.length ? null : __cw231NearestMatch(rawSchedule);\n${i}const body = visible.length\n${i}  ? \`<div class="cw231-today-list">\${visible.map(__cw231TodayCard).join('')}</div>\`\n${i}  : \`<div class="cw231-empty cw231-empty__schedule-source">\n${i}      <div class="cw231-empty__title">Сегодня матчей нет</div>\n${i}      \${nearest ? \`<div class="cw231-empty__next-card">\n${i}        <div class="cw231-empty__next-label">Ближайший матч</div>\n${i}        <div class="cw231-empty__match">\${esc(nearest.homeTeam?.name || '—')} — \${esc(nearest.awayTeam?.name || '—')}</div>\n${i}        <div class="cw231-empty__time">\${__cw231Status(nearest)}</div>\n${i}      </div>\` : ''}\n${i}    </div>\`;\n\n`;

  return source.slice(0, start) + replacement + source.slice(end);
}

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
  diagnoseBase(base);
  const schedulePatched = applyScheduleSourcePatch(base);
  if (!schedulePatched.includes('cw231-empty__schedule-source')) {
    throw new Error('v23.1 rawSchedule source patch did not apply');
  }
  const html = applyPatch(schedulePatched, css, js);
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
