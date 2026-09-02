import { copyFile, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyProfileTournamentSourcePatch } from './profile-source-patch.mjs';

export const BASE_BUILD = 'ciao-web-v23-1-cloudflare-test-20260901';
export const TEST_BUILD = 'ciao-web-v23-1-github-test-20260901';
export const DEFAULT_BASE_URL = 'https://ciao-web-app.ciao-web.workers.dev/releases/v23.1/';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cssPath = resolve(root, 'src/ui-v23.1.css');
const jsPath = resolve(root, 'src/ui-v23.1.js');
const outPath = resolve(root, 'dist/index.html');
const v232SourceDir = resolve(root, 'src/v23.2');
const v232OutDir = resolve(root, 'dist/v23.2');
const v233SourceDir = resolve(root, 'src/v23.3');
const v233OutDir = resolve(root, 'dist/v23.3');

export function applyScheduleSourcePatch(input) {
  let source = String(input);
  if (source.includes('cw231-empty__schedule-source')) return source;

  const homeNeedle = 'const rawSchedule = __cw231RawScheduleMatches();';
  const homeAt = source.indexOf(homeNeedle);
  if (homeAt >= 0) {
    const indentMatch = source.slice(Math.max(0, homeAt - 8), homeAt).match(/(^|\n)([ \t]*)$/);
    const i = indentMatch?.[2] || '  ';
    const prefetch = `${i}if (!__cw209Schedule && !__cw209ScheduleLoading && !__cw209ScheduleError && typeof __cw209LoadSchedule === 'function') {\n${i}  setTimeout(() => {\n${i}    __cw209LoadSchedule().then(() => {\n${i}      if (!matchViewId && !clubViewId && main?.querySelector?.('.cw231-today-head')) render();\n${i}    }).catch(() => {});\n${i}  }, 0);\n${i}}\n${i}${homeNeedle}`;
    source = source.slice(0, homeAt) + prefetch + source.slice(homeAt + homeNeedle.length);
  }

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

  const replacement = `${i}const nearest = visible.length ? null : __cw231NearestMatch(rawSchedule);\n${i}const body = visible.length\n${i}  ? \`<div class="cw231-today-list">\${visible.map(__cw231TodayCard).join('')}</div>\`\n${i}  : \`<div class="cw231-empty cw231-empty__schedule-source">\n${i}      <div class="cw231-empty__title">Сегодня матчей нет</div>\n${i}      \${nearest ? \`<button type="button" class="cw231-empty__next-card" data-cw231-action="match" data-cw231-match="\${nearest.matchId}" data-cw231-round="\${Number(nearest.raw?.round_number) || 0}">\n${i}        <div class="cw231-empty__next-label">Ближайший матч</div>\n${i}        <div class="cw231-empty__match">\n${i}          <span class="cw231-empty__team">\${__cw231Logo(nearest.homeTeam)}<b>\${esc(nearest.homeTeam?.name || '—')}</b></span>\n${i}          <span class="cw231-empty__dash">—</span>\n${i}          <span class="cw231-empty__team away"><b>\${esc(nearest.awayTeam?.name || '—')}</b>\${__cw231Logo(nearest.awayTeam)}</span>\n${i}        </div>\n${i}        <div class="cw231-empty__time">\${__cw231Status(nearest)}</div>\n${i}      </button>\` : ''}\n${i}    </div>\`;\n\n`;

  return source.slice(0, start) + replacement + source.slice(end);
}

export function applyFavoriteHtmlSourcePatch(input) {
  let source = String(input);
  if (source.includes('cw231-favorite-normalized-link')) return source;

  const pattern = /function __cw231FavoriteHtml\(\)\s*\{\s*const host = document\.createElement\('div'\);\s*host\.innerHTML = __cw231LegacyHomeAndPredict\(\);\s*return host\.querySelector\('\.cw18-favorite-home,\.cw2017-favorite-reminder'\)\?\.outerHTML \|\| '';\s*\}/;
  if (!pattern.test(source)) return source;

  const replacement = `function __cw231FavoriteHtml() {
  /* cw231-favorite-normalized-link */
  const host = document.createElement('div');
  host.innerHTML = __cw231LegacyHomeAndPredict();
  const favorite = host.querySelector('.cw18-favorite-home,.cw2017-favorite-reminder');
  if (!favorite) return '';

  const favoriteTeam = S?.user?.favorite_team || null;
  const favoriteId = Number(favoriteTeam?.id) || 0;
  const favoriteName = String(favoriteTeam?.name || '').trim().toLowerCase();
  const now = Date.now() - 120000;

  const match = __cw231RawScheduleMatches()
    .map(CiaoV23Today.normalizeMatch)
    .filter(item => item.matchId && Date.parse(item.kickoffAt) >= now)
    .filter(item => {
      const homeId = Number(item.homeTeam?.id) || 0;
      const awayId = Number(item.awayTeam?.id) || 0;
      const homeName = String(item.homeTeam?.name || '').trim().toLowerCase();
      const awayName = String(item.awayTeam?.name || '').trim().toLowerCase();
      return (favoriteId && (homeId === favoriteId || awayId === favoriteId))
        || (favoriteName && (homeName === favoriteName || awayName === favoriteName));
    })
    .sort((a, b) => Date.parse(a.kickoffAt) - Date.parse(b.kickoffAt))[0] || null;

  const card = favorite.querySelector('.cw211-favorite-body .cw211-info-card:nth-child(2)');
  if (card) {
    const prediction = card.querySelector('.cw211-prediction')?.outerHTML || '';
    card.classList.add('cw231-favorite-shell');

    if (match?.matchId) {
      const live = match.status === 'live';
      const score = __cw231Score(match);
      const status = __cw231Status(match);

      card.classList.add('cw231-favorite-source-link');
      card.dataset.cw231Action = 'match';
      card.dataset.cw231Match = String(match.matchId);
      card.dataset.cw231Round = String(Number(match.raw?.round_number) || 0);
      card.setAttribute('role', 'button');
      card.setAttribute('aria-label', 'Открыть ближайший матч любимого клуба');
      card.tabIndex = 0;
      card.innerHTML =
        '<small>' + (live ? 'Матч идёт' : 'Ближайший матч') + '</small>' +
        '<div class="cw231-favorite-match-teams">' +
          '<span class="cw231-favorite-team home">' + __cw231Logo(match.homeTeam) + '<b>' + esc(match.homeTeam?.name || '—') + '</b></span>' +
          '<span class="cw231-favorite-match-score">' + (live ? esc(score) : '—') + '</span>' +
          '<span class="cw231-favorite-team away"><b>' + esc(match.awayTeam?.name || '—') + '</b>' + __cw231Logo(match.awayTeam) + '</span>' +
        '</div>' +
        '<div class="cw231-favorite-match-status">' + esc(status) + '</div>' +
        prediction;
    } else {
      card.removeAttribute('data-cw231-action');
      card.removeAttribute('data-cw231-match');
      card.removeAttribute('data-cw231-round');
      card.removeAttribute('role');
      card.removeAttribute('aria-label');
      card.removeAttribute('tabindex');
      card.classList.remove('cw231-favorite-source-link');
      card.innerHTML =
        '<small>Ближайший матч</small>' +
        '<div class="cw231-favorite-match-teams cw231-favorite-match-placeholder" aria-hidden="true">' +
          '<span class="cw231-favorite-team home"><span class="cw231-favorite-logo-placeholder"></span><b>—</b></span>' +
          '<span class="cw231-favorite-match-score">—</span>' +
          '<span class="cw231-favorite-team away"><b>—</b><span class="cw231-favorite-logo-placeholder"></span></span>' +
        '</div>' +
        '<div class="cw231-favorite-match-status cw231-favorite-match-placeholder" aria-hidden="true">—</div>' +
        prediction;
    }
  }

  return favorite.outerHTML;
}`;

  return source.replace(pattern, replacement);
}

export function applyLogoSourcePatch(input) {
  const source = String(input);
  if (source.includes('data-cw231-stable-logo-load="1"')) return source;

  return source.replace(
    /<img class="logo" loading="lazy" decoding="async" fetchpriority="low"/g,
    '<img class="logo" width="48" height="48" loading="eager" decoding="sync" fetchpriority="auto" data-cw231-stable-logo-load="1"',
  );
}

export function applyPatch(baseHtml, css, js) {
  let html = String(baseHtml);
  if (!html.includes(BASE_BUILD)) throw new Error(`base build marker missing: ${BASE_BUILD}`);
  if (!/<\/head>/i.test(html) || !/<\/body>/i.test(html)) throw new Error('base HTML is missing head/body anchors');
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

export function injectV232Entry(input) {
  let html = String(input);
  if (!/<\/body>/i.test(html)) throw new Error('v23.2 module entry requires body anchor');

  if (!html.includes('id="ciao-v232-core"')) {
    html = html.replace(
      /<\/body>/i,
      '<script type="module" id="ciao-v232-core" src="/v23.2/index.mjs"></script>\n</body>',
    );
  }

  if (!html.includes('id="ciao-v232-matches-ui"')) {
    html = html.replace(
      /<\/body>/i,
      '<script type="module" id="ciao-v232-matches-ui" src="/v23.2/matches-ui.mjs"></script>\n</body>',
    );
  }

  return html;
}

async function copyModules(sourceDir, outDir) {
  await mkdir(outDir, { recursive: true });
  const files = (await readdir(sourceDir)).filter(name => name.endsWith('.mjs'));
  for (const name of files) {
    await copyFile(resolve(sourceDir, name), resolve(outDir, name));
  }
  return files.sort();
}

export function copyV232Modules() {
  return copyModules(v232SourceDir, v232OutDir);
}

export function copyV233Modules() {
  return copyModules(v233SourceDir, v233OutDir);
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

  const schedulePatched = applyScheduleSourcePatch(base);
  if (!schedulePatched.includes('cw231-empty__schedule-source')) {
    throw new Error('v23.1 rawSchedule source patch did not apply');
  }

  const favoritePatched = applyFavoriteHtmlSourcePatch(schedulePatched);
  if (!favoritePatched.includes('cw231-favorite-normalized-link')) {
    throw new Error('v23.1 favorite normalized link patch did not apply');
  }

  const logoPatched = applyLogoSourcePatch(favoritePatched);
  if (!logoPatched.includes('data-cw231-stable-logo-load="1"')) {
    throw new Error('v23.1 stable logo source patch did not apply');
  }

  const profilePatched = applyProfileTournamentSourcePatch(logoPatched);
  if (!profilePatched.includes('cw232-profile-tournament-enrichment')) {
    throw new Error('v23.2 club profile tournament source patch did not apply');
  }

  await Promise.all([copyV232Modules(), copyV233Modules()]);
  const html = injectV232Entry(applyPatch(profilePatched, css, js));
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, html, 'utf8');
  return { output: outPath, bytes: Buffer.byteLength(html), build: TEST_BUILD };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  build()
    .then(result => console.log(JSON.stringify({ ok: true, ...result })))
    .catch(error => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
