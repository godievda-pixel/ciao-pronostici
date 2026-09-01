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

export function applyFavoriteMatchResolverPatch(input) {
  let source = String(input);
  if (source.includes('cw231-favorite-calendar-resolver')) return source;
  const startNeedle = 'function __cw211FavoriteMatch(t,d){';
  const start = source.indexOf(startNeedle);
  if (start < 0) return source;
  const endNeedle = '\n  }';
  const end = source.indexOf(endNeedle, start);
  if (end < 0) throw new Error('v23.1 favorite match resolver end anchor missing');
  const replacement = `function __cw211FavoriteMatch(t,d){\n    /* cw231-favorite-calendar-resolver */\n    const id=Number(t?.id)||0,live=__cw2017ActiveLeagueMatches().find(m=>Number(m?.home?.id)===id||Number(m?.away?.id)===id);if(live)return {...live,id:Number(live.id),__kind:'live'};\n    const now=Date.now(),calendarMatches=[];\n    for(const round of __cw209Schedule?.rounds||[])for(const match of round?.matches||[]){\n      const matchId=Number(match?.id||match?.match_id)||0,kickoff=new Date(match?.kickoff_at).getTime();\n      const homeId=Number(match?.home?.id||match?.home_team_id||match?.home_team?.id)||0,awayId=Number(match?.away?.id||match?.away_team_id||match?.away_team?.id)||0;\n      if(matchId&&Number.isFinite(kickoff)&&kickoff>=now-120000&&(homeId===id||awayId===id))calendarMatches.push(match);\n    }\n    const calendarMatch=calendarMatches.sort((a,b)=>new Date(a.kickoff_at)-new Date(b.kickoff_at))[0]||null;\n    if(calendarMatch)return {...calendarMatch,id:Number(calendarMatch.id||calendarMatch.match_id)||0,__kind:'next'};\n    const next=d?.overview?.next_match||null;if(next)return {...next,id:Number(next.id||next.match_id)||0,__kind:'next'};return null;\n  }`;
  return source.slice(0, start) + replacement + source.slice(end + endNeedle.length);
}

export function applyFavoriteMatchSourcePatch(input) {
  let source = String(input);
  if (source.includes('cw231-favorite-source-link')) return source;
  const needle = `<div class="cw211-info-card"><small>\${m?.__kind==='live'?'Матч идёт':'Ближайший матч'}</small>`;
  if (!source.includes(needle)) return source;
  const replacement = `<div class="cw211-info-card cw231-favorite-source-link" data-cw231-action="match" data-cw231-match="\${mid}" data-cw231-round="\${Number(m?.round_number) || 0}" data-cw211-match="\${mid}" role="button" tabindex="0"><small>\${m?.__kind==='live'?'Матч идёт':'Ближайший матч'}</small>`;
  return source.replace(needle, replacement);
}

export function applyPatch(baseHtml, css, js) {
  let html = String(baseHtml);
  if (!html.includes(BASE_BUILD)) throw new Error(`base build marker missing: ${BASE_BUILD}`);
  if (!/<\/head>/i.test(html) || !/<\/body>/i.test(html)) throw new Error('base HTML is missing head/body anchors');
  if (/ciao-web-github-test-patch/.test(html)) return html;
  html = html.replace(/<\/head>/i, `<meta name="ciao-test-build" content="${TEST_BUILD}">\n<style id="ciao-web-github-test-patch">\n${css}\n</style>\n</head>`);
  html = html.replace(/<\/body>/i, `<script id="ciao-web-github-test-runtime">\n${js}\n</script>\n</body>`);
  return html;
}

async function loadBase() {
  if (process.env.BASE_FILE) return readFile(resolve(process.env.BASE_FILE), 'utf8');
  const url = process.env.BASE_URL || DEFAULT_BASE_URL;
  const response = await fetch(url, { headers: { 'cache-control': 'no-cache' } });
  if (!response.ok) throw new Error(`base fetch failed: HTTP ${response.status}`);
  return response.text();
}

function diagNeedle(source, needle) {
  const at = source.indexOf(needle);
  console.log(`DIAG ${needle}:`, at < 0 ? 'missing' : source.slice(Math.max(0, at - 1200), Math.min(source.length, at + 3400)));
}

export async function build() {
  const [base, css, js] = await Promise.all([loadBase(), readFile(cssPath, 'utf8'), readFile(jsPath, 'utf8')]);
  diagNeedle(base, 'function __cw231RawScheduleMatches()');
  diagNeedle(base, 'function __cw231NormalizeMatch');
  diagNeedle(base, 'normalizeMatch');
  const schedulePatched = applyScheduleSourcePatch(base);
  if (!schedulePatched.includes('cw231-empty__schedule-source')) throw new Error('v23.1 rawSchedule source patch did not apply');
  const resolverPatched = applyFavoriteMatchResolverPatch(schedulePatched);
  if (!resolverPatched.includes('cw231-favorite-calendar-resolver')) throw new Error('v23.1 favorite calendar resolver patch did not apply');
  const favoritePatched = applyFavoriteMatchSourcePatch(resolverPatched);
  if (!favoritePatched.includes('cw231-favorite-source-link')) throw new Error('v23.1 favorite match source patch did not apply');
  const html = applyPatch(favoritePatched, css, js);
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, html, 'utf8');
  return { output: outPath, bytes: Buffer.byteLength(html), build: TEST_BUILD };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  build().then((result) => console.log(JSON.stringify({ ok: true, ...result }))).catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
}
