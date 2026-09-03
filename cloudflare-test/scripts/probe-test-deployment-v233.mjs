import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  profileFeedCheck,
  standingsReleaseCheck,
  probePredictionAuthGuard,
} from './probe-test-deployment.mjs';

export { profileFeedCheck, standingsReleaseCheck, probePredictionAuthGuard };

const ORIGIN = 'https://ciao-web-app-test.ciao-web.workers.dev/';
const RANGE = Object.freeze({ from:'2026-07-01', to:'2027-06-30' });
const EXTERNAL_COMPETITIONS = Object.freeze(['coppa_italia','ucl','uel','uecl']);
const UEFA_COMPETITIONS = Object.freeze(['ucl','uel','uecl']);
const EXPECTED_HEALTH = Object.freeze({
  service:'ciao-web-app-test',
  build:'ciao-web-v23-3-user-feedback-r4-20260902',
  api:'ciao-web-api',
  matchesProvider:'bsd-v2',
  predictionBackend:'durable-object-sqlite',
  predictionEnvironment:'test',
  predictionSeason:'2026-27',
  predictionDoConfigured:true,
});
const HOME_SEASON_LABEL = 'SERIE A 2026/27';
const RESET_NOTICE_TEXT = 'Начало нового сезона!';
const ITALIAN_NAMES = new Set([
  'Интер','Милан','Наполи','Рома','Ювентус','Фиорентина','Аталанта','Лацио','Болонья','Торино',
  'Дженоа','Комо','Удинезе','Кальяри','Парма','Лечче','Верона','Сассуоло','Пиза','Кремонезе',
]);
const MODULES = Object.freeze([
  '/v23.3/index.mjs',
  '/v23.3/navigation-ui.mjs',
  '/v23.3/home-integration.mjs',
  '/v23.3/tables-ui.mjs',
  '/v23.3/match-center.mjs',
  '/v23.3/match-center-links.mjs',
  '/v23.3/prediction-client.mjs',
  '/v23.3/predictions-ui.mjs',
  '/v23.3/ranking-ui.mjs',
  '/v23.3/premium-polish-ui.mjs',
  '/v23.3/round7-regression-fixes.mjs',
  '/v23.3/round12-stability-performance.mjs',
  '/v23.3/round13-mobile-regressions.mjs',
]);

const sleep = ms => new Promise(resolveSleep => setTimeout(resolveSleep, ms));

function telegramHeaders() {
  return {
    accept:'application/json',
    'cache-control':'no-cache, no-store, max-age=0',
    'x-telegram-init-data':'deployment-probe',
  };
}

async function fetchText(url, fetchImpl = fetch) {
  const response = await fetchImpl(url, { headers:{ 'cache-control':'no-cache, no-store, max-age=0', pragma:'no-cache' } });
  return { response, text:await response.text() };
}

async function fetchJson(url, options = {}, fetchImpl = fetch) {
  const response = await fetchImpl(url, options);
  let payload = null;
  try { payload = await response.json(); } catch {}
  return { response, payload };
}

function isItalianTeam(team = {}) {
  const code = String(team.countryCode || '').toUpperCase();
  return code === 'IT' || code === 'ITA' || ITALIAN_NAMES.has(String(team.name || '').trim());
}

function italianOnly(matches = []) {
  return matches.every(match => isItalianTeam(match?.homeTeam) || isItalianTeam(match?.awayTeam));
}

async function probeHealth(fetchImpl) {
  const { response, payload } = await fetchJson(new URL('/healthz', ORIGIN), {}, fetchImpl);
  return {
    ok:Boolean(response.ok && payload?.ok),
    status:response.status,
    service:payload?.service || null,
    build:payload?.build || null,
    api:payload?.api || null,
    matchesProvider:payload?.matches_provider || null,
    bsdConfigured:payload?.bsd_configured ?? null,
    predictionBackend:payload?.prediction_backend || null,
    predictionEnvironment:payload?.prediction_environment || null,
    predictionSeason:payload?.prediction_season || null,
    predictionDoConfigured:payload?.prediction_do_configured ?? null,
  };
}

async function probeCompetition(competition, fetchImpl) {
  const url = new URL('/api/v23.2/matches', ORIGIN);
  url.searchParams.set('competition', competition);
  url.searchParams.set('from', RANGE.from);
  url.searchParams.set('to', RANGE.to);
  const { response, payload } = await fetchJson(url, { headers:telegramHeaders() }, fetchImpl);
  const matches = Array.isArray(payload?.data?.matches) ? payload.data.matches : [];
  return {
    competition,
    ok:Boolean(response.ok && payload?.ok),
    status:response.status,
    matchCount:matches.length,
    italianOnly:UEFA_COMPETITIONS.includes(competition) ? italianOnly(matches) : null,
    matches,
    error:payload?.error || null,
  };
}

async function probeStandings(competition, fetchImpl) {
  const url = new URL('/api/v23.3/standings', ORIGIN);
  url.searchParams.set('competition', competition);
  const { response, payload } = await fetchJson(url, { headers:telegramHeaders() }, fetchImpl);
  const rows = Array.isArray(payload?.data?.rows) ? payload.data.rows : [];
  const hasForeignClub = rows.some(row => !isItalianTeam(row?.team));
  return {
    competition,
    ok:Boolean(response.ok && payload?.ok),
    status:response.status,
    rowCount:rows.length,
    hasForeignClub,
    rows,
    releaseStatus:standingsReleaseCheck({ ok:Boolean(response.ok && payload?.ok), rowCount:rows.length, hasForeignClub }).status,
  };
}

async function probeModules(fetchImpl) {
  const rows = [];
  for (const path of MODULES) {
    const url = new URL(path, ORIGIN);
    url.searchParams.set('probe', String(Date.now()));
    const { response, text } = await fetchText(url, fetchImpl);
    rows.push({
      path,
      ok:response.ok,
      status:response.status,
      bytes:Buffer.byteLength(text),
      hasUnifiedRuntime:path === '/v23.3/index.mjs'
        ? text.includes('CiaoV233')
          && text.includes("predictions: 'enabled'")
          && text.includes("ranking: 'enabled'")
          && text.includes('premium-polish-ui.mjs')
          && text.includes('round7-regression-fixes.mjs')
          && text.includes('round12-stability-performance.mjs')
          && text.includes('round13-mobile-regressions.mjs')
        : undefined,
      predictionsEnabled:path === '/v23.3/index.mjs' ? text.includes("predictions: 'enabled'") : undefined,
      rankingEnabled:path === '/v23.3/index.mjs' ? text.includes("ranking: 'enabled'") : undefined,
      homeMultiCompetition:path === '/v23.3/home-integration.mjs' ? text.includes('Кальчо сегодня') && text.includes('cw233-home-multicompetition') : undefined,
      hasTablesRuntime:path === '/v23.3/tables-ui.mjs' ? text.includes('installTablesUi') && text.includes('renderCoppaBracket') : undefined,
      hasCoppaBracket:path === '/v23.3/tables-ui.mjs' ? text.includes('buildCoppaBracket') : undefined,
      documentOverflowGuard:path === '/v23.3/tables-ui.mjs' ? text.includes('overflow-x:hidden') && text.includes('max-width:100%') : undefined,
      hasMatchCenterRuntime:path === '/v23.3/match-center.mjs' ? text.includes('createMatchCenterController') && text.includes('openCanonicalMatchCenter') : undefined,
      hasMatchCenterLinksRuntime:path === '/v23.3/match-center-links.mjs' ? text.includes('resolveCanonicalMatchTarget') && text.includes('installCanonicalMatchLinks') : undefined,
      hasPredictionClient:path === '/v23.3/prediction-client.mjs' ? text.includes('/api/v23.3/predictions') : undefined,
      hasPredictionsRuntime:path === '/v23.3/predictions-ui.mjs' ? text.includes('installPredictionsUi') && !text.includes('Загружаем прогнозы') : undefined,
      hasRankingRuntime:path === '/v23.3/ranking-ui.mjs' ? text.includes('installRankingUi') : undefined,
      hasNavigationRuntime:path === '/v23.3/navigation-ui.mjs' ? text.includes('NAVIGATION_LABELS') : undefined,
      hasPremiumPolish:path === '/v23.3/premium-polish-ui.mjs'
        ? text.includes('installPremiumPolishUi') && text.includes('cw232-tournament-card__eyebrow') && text.includes('@media(max-width:620px)')
        : undefined,
      hasRound7Runtime:path === '/v23.3/round7-regression-fixes.mjs'
        ? text.includes('USER_FEEDBACK_ROUND7_BUILD') && text.includes('cw232-serie-a-back') && text.includes('z-index:80!important')
        : undefined,
      hasRound12Runtime:path === '/v23.3/round12-stability-performance.mjs'
        ? text.includes('USER_FEEDBACK_ROUND12_BUILD')
          && text.includes('@media(min-width:420px)')
          && text.includes('min-width:0!important')
          && text.includes('max-width:100%!important')
        : undefined,
      hasRound13Runtime:path === '/v23.3/round13-mobile-regressions.mjs'
        ? text.includes('USER_FEEDBACK_ROUND13_BUILD')
          && text.includes('cw233-serie-a-round-nav-shell')
          && text.includes('content:none!important')
          && text.includes('compactTableLabel')
        : undefined,
    });
  }
  return rows;
}

async function probeHome(fetchImpl) {
  let latest = null;
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    const url = new URL(ORIGIN);
    url.searchParams.set('probe', `${Date.now()}-${attempt}`);
    const { response, text } = await fetchText(url, fetchImpl);
    latest = {
      status:response.status,
      ok:response.ok,
      unifiedV233Marker:text.includes('id="ciao-v233"'),
      homeSeasonLabelAbsent:!text.includes(HOME_SEASON_LABEL),
      homeResetNoticePresent:text.includes(RESET_NOTICE_TEXT),
      homeMultiCompetition:text.includes('cw233-home-multicompetition'),
      profileMarker:text.includes('cw232-profile-tournament-enrichment'),
    };
    if (latest.ok && latest.unifiedV233Marker && latest.homeSeasonLabelAbsent && latest.homeMultiCompetition) break;
    if (attempt < 8) await sleep(6_000);
  }
  return latest;
}

async function probeMatchCenter(match, fetchImpl) {
  if (!match) return { ok:false, status:0, error:'no_external_match_candidate' };
  const url = new URL('/api/v23.3/match-center', ORIGIN);
  url.searchParams.set('competition', match.competition);
  url.searchParams.set('match_id', match.matchId);
  const { response, payload } = await fetchJson(url, { headers:telegramHeaders() }, fetchImpl);
  return { ok:Boolean(response.ok && payload?.ok), status:response.status, error:payload?.error || null };
}

async function probeDeployedRegistry(fetchImpl) {
  const url = new URL('/v23.2/team-registry.mjs', ORIGIN);
  url.searchParams.set('probe', String(Date.now()));
  const { response, text } = await fetchText(url, fetchImpl);
  if (!response.ok) return { ok:false, isKnownTeamName:()=>false };
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(text).toString('base64')}`;
  const registry = await import(moduleUrl);
  return { ok:true, isKnownTeamName:registry.isKnownTeamName, russianTeamName:registry.russianTeamName };
}

function unknownNames(competitions, standings, registry) {
  const names = new Set();
  const teams = [
    ...competitions.flatMap(row => row.matches.flatMap(match => [match.homeTeam, match.awayTeam])),
    ...standings.flatMap(row => row.rows.map(item => item.team)),
  ];
  for (const team of teams) {
    const raw = String(team?.rawName || team?.name || '').trim();
    if (raw && !registry?.isKnownTeamName?.(raw)) names.add(raw);
  }
  return [...names].sort((a,b) => a.localeCompare(b));
}

export async function probe({ fetchImpl = fetch } = {}) {
  const [home, health, predictionAuthGuard, modules, registry, competitions, standings] = await Promise.all([
    probeHome(fetchImpl),
    probeHealth(fetchImpl),
    probePredictionAuthGuard({ baseUrl:ORIGIN, fetchImpl }),
    probeModules(fetchImpl),
    probeDeployedRegistry(fetchImpl),
    Promise.all(EXTERNAL_COMPETITIONS.map(key => probeCompetition(key, fetchImpl))),
    Promise.all(UEFA_COMPETITIONS.map(key => probeStandings(key, fetchImpl))),
  ]);

  const allUnknownTeamNames = unknownNames(competitions, standings, registry);
  const releaseHeldForUnknownTeams = allUnknownTeamNames.length > 0;
  const indexModule = modules.find(row => row.path === '/v23.3/index.mjs');
  const tablesModule = modules.find(row => row.path === '/v23.3/tables-ui.mjs');
  const matchCenterModule = modules.find(row => row.path === '/v23.3/match-center.mjs');
  const matchLinksModule = modules.find(row => row.path === '/v23.3/match-center-links.mjs');
  const predictionsModule = modules.find(row => row.path === '/v23.3/predictions-ui.mjs');
  const rankingModule = modules.find(row => row.path === '/v23.3/ranking-ui.mjs');
  const navigationModule = modules.find(row => row.path === '/v23.3/navigation-ui.mjs');
  const premiumModule = modules.find(row => row.path === '/v23.3/premium-polish-ui.mjs');
  const round7Module = modules.find(row => row.path === '/v23.3/round7-regression-fixes.mjs');
  const round12Module = modules.find(row => row.path === '/v23.3/round12-stability-performance.mjs');
  const round13Module = modules.find(row => row.path === '/v23.3/round13-mobile-regressions.mjs');
  const predictionsEnabled = Boolean(indexModule?.predictionsEnabled);
  const rankingEnabled = Boolean(indexModule?.rankingEnabled);
  const documentOverflowGuard = Boolean(tablesModule?.documentOverflowGuard);
  const profileFeed = profileFeedCheck(competitions);
  const candidate = competitions.find(row => row.competition === 'ucl')?.matches?.[0] || competitions.flatMap(row => row.matches)[0] || null;
  const matchCenter = await probeMatchCenter(candidate, fetchImpl);

  const report = {
    observedAt:new Date().toISOString(), home, health, predictionAuthGuard, competitions, standings,
    allUnknownTeamNames, releaseHeldForUnknownTeams, predictionsEnabled, rankingEnabled,
    documentOverflowGuard, profileFeed, matchCenter, modules,
  };
  await mkdir('artifacts', { recursive:true });
  await writeFile('artifacts/test-deployment-probe.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));

  if (!home?.ok || !home?.unifiedV233Marker || !home?.homeSeasonLabelAbsent || !home?.homeMultiCompetition) {
    throw new Error('deployed TEST is missing v23.3 Home runtime markers');
  }
  if (
    !health.ok || health.service !== EXPECTED_HEALTH.service || health.build !== EXPECTED_HEALTH.build
    || health.api !== EXPECTED_HEALTH.api || health.matchesProvider !== EXPECTED_HEALTH.matchesProvider
    || health.predictionBackend !== EXPECTED_HEALTH.predictionBackend
    || health.predictionEnvironment !== EXPECTED_HEALTH.predictionEnvironment
    || health.predictionSeason !== EXPECTED_HEALTH.predictionSeason
    || health.predictionDoConfigured !== EXPECTED_HEALTH.predictionDoConfigured
  ) throw new Error(`deployed TEST health contract mismatch: predictionBackend=${health.predictionBackend}`);
  if (!predictionAuthGuard.ok || predictionAuthGuard.status !== 401 || predictionAuthGuard.error !== 'telegram_auth_required') {
    throw new Error('deployed TEST prediction auth guard failed');
  }
  if (!indexModule?.hasUnifiedRuntime || !predictionsEnabled || !rankingEnabled) throw new Error('deployed TEST v23.3 runtime is incomplete');
  if (!navigationModule?.hasNavigationRuntime) throw new Error('deployed TEST navigation runtime missing');
  if (!tablesModule?.hasTablesRuntime || !tablesModule?.hasCoppaBracket || !documentOverflowGuard) throw new Error('deployed TEST Tables runtime incomplete');
  if (!matchCenterModule?.hasMatchCenterRuntime || !matchLinksModule?.hasMatchCenterLinksRuntime) throw new Error('deployed TEST Match Center runtime incomplete');
  if (!predictionsModule?.hasPredictionsRuntime || !rankingModule?.hasRankingRuntime) throw new Error('deployed TEST predictions/ranking runtime incomplete');
  if (!premiumModule?.hasPremiumPolish) throw new Error('deployed TEST is missing v23.3 premium polish runtime');
  if (!round7Module?.hasRound7Runtime) throw new Error('deployed TEST is missing exact round7 regression runtime');
  if (!round12Module?.hasRound12Runtime) throw new Error('deployed TEST is missing Round 12 adaptive table runtime');
  if (!round13Module?.hasRound13Runtime) throw new Error('deployed TEST is missing Round 13 mobile regression runtime');

  for (const row of competitions) {
    if (!row.ok || row.matchCount < 1) throw new Error(`deployed TEST ${row.competition} has no usable matches`);
    if (UEFA_COMPETITIONS.includes(row.competition) && !row.italianOnly) {
      throw new Error(`deployed TEST ${row.competition} leaked a foreign-vs-foreign fixture`);
    }
  }
  for (const row of standings) {
    const release = standingsReleaseCheck(row);
    if (!release.pass) throw new Error(`deployed TEST ${row.competition} standings failed: ${release.status}`);
  }
  if (!matchCenter.ok) throw new Error(`deployed TEST external Match Center failed: ${matchCenter.status}`);
  if (!profileFeed.ok) throw new Error(`deployed TEST profile tournament feed unavailable: ${profileFeed.reason || 'no_matches'}`);
  if (releaseHeldForUnknownTeams) throw new Error(`deployed TEST release held for unknown team names: ${allUnknownTeamNames.join(', ')}`);
  return report;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  probe().catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}