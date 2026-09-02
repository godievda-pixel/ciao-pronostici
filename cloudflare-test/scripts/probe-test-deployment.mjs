import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { matchFingerprint } from '../src/v23.2/match-deduper.mjs';
import { profileCompetitionMatches } from '../src/v23.2/profile-matches.mjs';

const ORIGIN = 'https://ciao-web-app-test.ciao-web.workers.dev/';
const RANGE = Object.freeze({ from: '2026-07-01', to: '2027-06-30' });
const EXTERNAL_COMPETITIONS = Object.freeze(['coppa_italia', 'ucl', 'uel', 'uecl']);
const UEFA_COMPETITIONS = Object.freeze(['ucl', 'uel', 'uecl']);
const EXPECTED_HEALTH = Object.freeze({
  service: 'ciao-web-app-test',
  build: 'ciao-web-v23-2-bsd-test-20260902',
  matchesProvider: 'bsd-v2',
});
const HOME_SEASON_LABEL = 'SERIE A 2026/27';
const RESET_NOTICE_TEXT = 'Начало нового сезона!';
const CURRENT_REGISTRY_MARKER = 'CURRENT_UEFA_QUALIFIER_ALIASES';
const ITALIAN_PROFILE_NAMES = new Set([
  'Интер', 'Милан', 'Наполи', 'Рома', 'Ювентус', 'Фиорентина', 'Аталанта', 'Лацио',
  'Болонья', 'Торино', 'Дженоа', 'Комо', 'Удинезе', 'Кальяри', 'Парма', 'Лечче',
  'Верона', 'Сассуоло', 'Пиза', 'Кремонезе',
]);
const EXPECTED = [
  'id="ciao-v232-core"',
  'id="ciao-v232-matches-ui"',
  'id="ciao-v233"',
  'cw231-favorite-normalized-link',
  'cw233-home-multicompetition',
];
const MODULES = [
  '/v23.2/index.mjs',
  '/v23.2/matches-ui.mjs',
  '/v23.2/data-client.mjs',
  '/v23.2/competition-config.mjs',
  '/v23.2/tournament-engine.mjs',
  '/v23.2/team-registry.mjs',
  '/v23.2/profile-matches.mjs',
  '/v23.2/profile-integration.mjs',
  '/v23.2/coppa-bracket.mjs',
  '/v23.3/index.mjs',
  '/v23.3/home-integration.mjs',
  '/v23.3/tables-ui.mjs',
  '/v23.3/match-center.mjs',
  '/v23.3/match-center-links.mjs',
];
const NAV_MARKERS = [
  "root.addEventListener('click'",
  'root.addEventListener("click"',
  "querySelectorAll('.nav",
  'querySelectorAll(".nav',
  '.nav button',
  'dataset.tab',
  'data-tab="calendar"',
  'stopPropagation()',
  '#ciao-miniapp-root{',
  '#ciao-miniapp-root {',
  '.scoreboard-card',
  '.board-team',
  'class="logo"',
  'loading="lazy"',
];

const sleep = ms => new Promise(resolveSleep => setTimeout(resolveSleep, ms));

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      'cache-control': 'no-cache, no-store, max-age=0',
      pragma: 'no-cache',
    },
  });
  return { response, text: await response.text() };
}

function telegramHeaders() {
  return {
    accept: 'application/json',
    'cache-control': 'no-cache, no-store, max-age=0',
    'x-telegram-init-data': 'deployment-probe',
  };
}

async function probeHealth() {
  try {
    const { response, text } = await fetchText(new URL('/healthz', ORIGIN));
    let json = null;
    try { json = JSON.parse(text); } catch {}
    return {
      status: response.status,
      ok: Boolean(response.ok && json?.ok),
      service: json?.service || null,
      build: json?.build || null,
      matchesProvider: json?.matches_provider || null,
      bsdConfigured: typeof json?.bsd_configured === 'boolean' ? json.bsd_configured : null,
    };
  } catch (error) {
    return { status: 0, ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function safeTeam(team) {
  return {
    id: team?.id || null,
    name: team?.name || null,
    rawName: team?.rawName || null,
    countryCode: team?.countryCode || null,
  };
}

function isItalianTeam(team) {
  const code = String(team?.countryCode || '').toUpperCase();
  if (code === 'IT' || code === 'ITA') return true;
  return ITALIAN_PROFILE_NAMES.has(String(team?.name || '').trim());
}

function foreignVsForeign(matches = []) {
  return matches.some(match => !isItalianTeam(match?.homeTeam) && !isItalianTeam(match?.awayTeam));
}

function duplicateFingerprints(matches = []) {
  const counts = new Map();
  for (const match of matches) {
    const fingerprint = matchFingerprint(match);
    counts.set(fingerprint, (counts.get(fingerprint) || 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([fingerprint, count]) => ({ fingerprint, count }));
}

async function probeDeployedTeamRegistry() {
  let latest = null;
  for (let attempt = 1; attempt <= 7; attempt += 1) {
    try {
      const url = new URL('/v23.2/team-registry.mjs', ORIGIN);
      url.searchParams.set('probe', `${Date.now()}-${attempt}`);
      const { response, text } = await fetchText(url);
      if (!response.ok) {
        latest = { ok: false, status: response.status, attempt, bytes: Buffer.byteLength(text), currentFeedReady: false };
      } else {
        const moduleUrl = `data:text/javascript;base64,${Buffer.from(text).toString('base64')}`;
        const registry = await import(moduleUrl);
        const callable = typeof registry.isKnownTeamName === 'function'
          && typeof registry.russianTeamName === 'function';
        latest = {
          ok: callable,
          status: response.status,
          attempt,
          bytes: Buffer.byteLength(text),
          currentFeedReady: text.includes(CURRENT_REGISTRY_MARKER),
          isKnownTeamName: callable ? registry.isKnownTeamName : () => false,
          russianTeamName: callable ? registry.russianTeamName : value => String(value ?? ''),
        };
      }
    } catch (error) {
      latest = {
        ok: false,
        status: 0,
        attempt,
        bytes: 0,
        currentFeedReady: false,
        error: error instanceof Error ? error.message : String(error),
        isKnownTeamName: () => false,
        russianTeamName: value => String(value ?? ''),
      };
    }

    if (latest?.ok && latest?.currentFeedReady) return latest;
    if (attempt < 7) await sleep(5_000);
  }
  return latest || {
    ok: false,
    status: 0,
    attempt: 0,
    bytes: 0,
    currentFeedReady: false,
    error: 'registry_probe_unavailable',
    isKnownTeamName: () => false,
    russianTeamName: value => String(value ?? ''),
  };
}

function unknownNamesFromTeams(teams = [], deployedRegistry) {
  const unknown = new Set();
  for (const team of teams) {
    const raw = String(team?.rawName || team?.name || '').trim();
    if (!raw) continue;
    const known = Boolean(deployedRegistry?.isKnownTeamName?.(raw));
    const localized = String(deployedRegistry?.russianTeamName?.(raw) || raw).trim();
    if (!known || localized === raw) unknown.add(raw);
  }
  return [...unknown];
}

function unknownTeamNames(matches = [], deployedRegistry) {
  return unknownNamesFromTeams(
    matches.flatMap(match => [match?.homeTeam, match?.awayTeam]),
    deployedRegistry,
  ).sort((a, b) => a.localeCompare(b));
}

async function probeLiveCompetition(competition) {
  const url = new URL('/api/v23.2/matches', ORIGIN);
  url.searchParams.set('competition', competition);
  url.searchParams.set('from', RANGE.from);
  url.searchParams.set('to', RANGE.to);
  try {
    const response = await fetch(url, { headers: telegramHeaders() });
    let payload = null;
    try { payload = await response.json(); } catch {}
    const matches = Array.isArray(payload?.data?.matches) ? payload.data.matches : [];
    const fiorentina = competition === 'coppa_italia'
      ? matches
        .filter(match => [match?.homeTeam?.name, match?.awayTeam?.name].includes('Фиорентина'))
        .map(match => ({
          matchId: match?.matchId || null,
          stage: match?.stage || null,
          kickoffAt: match?.kickoffAt || null,
          home: match?.homeTeam?.name || null,
          away: match?.awayTeam?.name || null,
          fingerprint: matchFingerprint(match),
        }))
      : [];
    return {
      status: response.status,
      ok: Boolean(response.ok && payload?.ok),
      provider: payload?.data?.provider || payload?.provider || null,
      competition: payload?.data?.competition || payload?.competition || competition,
      matchCount: matches.length,
      matches,
      foreignVsForeign: UEFA_COMPETITIONS.includes(competition) ? foreignVsForeign(matches) : null,
      duplicateFingerprints: duplicateFingerprints(matches),
      fiorentina,
      sample: matches.slice(0, 3).map(match => ({
        matchId: match?.matchId || null,
        kickoffAt: match?.kickoffAt || null,
        stage: match?.stage || null,
        home: safeTeam(match?.homeTeam),
        away: safeTeam(match?.awayTeam),
      })),
      error: payload?.error || null,
      upstreamStage: payload?.upstream_stage || null,
      upstreamStatus: payload?.upstream_status ?? null,
      upstreamCode: payload?.upstream_code || null,
    };
  } catch (error) {
    return {
      status: 0,
      ok: false,
      competition,
      matchCount: 0,
      matches: [],
      foreignVsForeign: false,
      duplicateFingerprints: [],
      fiorentina: [],
      sample: [],
      error: error instanceof Error ? error.message : String(error),
      upstreamStage: null,
      upstreamStatus: null,
      upstreamCode: null,
    };
  }
}

async function probeStandings(competition) {
  const url = new URL('/api/v23.3/standings', ORIGIN);
  url.searchParams.set('competition', competition);
  try {
    const response = await fetch(url, { headers: telegramHeaders() });
    let payload = null;
    try { payload = await response.json(); } catch {}
    const rows = Array.isArray(payload?.data?.rows) ? payload.data.rows : [];
    const foreignRows = rows.filter(row => !isItalianTeam(row?.team));
    return {
      status: response.status,
      ok: Boolean(response.ok && payload?.ok),
      provider: payload?.data?.provider || null,
      competition,
      rowCount: rows.length,
      foreignClubCount: foreignRows.length,
      hasForeignClub: foreignRows.length > 0,
      rows,
      sample: rows.slice(0, 3).map(row => ({
        position: row?.position ?? null,
        team: safeTeam(row?.team),
        played: row?.played ?? null,
        points: row?.points ?? null,
      })),
      error: payload?.error || null,
    };
  } catch (error) {
    return {
      status: 0,
      ok: false,
      competition,
      rowCount: 0,
      foreignClubCount: 0,
      hasForeignClub: false,
      rows: [],
      sample: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function standingsReleaseCheck(row = {}) {
  if (!row.ok) return { pass: false, status: 'provider_error' };
  if (Number(row.rowCount) === 0) return { pass: true, status: 'pending_provider' };
  if (!row.hasForeignClub) return { pass: false, status: 'missing_foreign_clubs' };
  return { pass: true, status: 'ready' };
}

async function probeMatchCenter(match) {
  if (!match?.competition || !match?.matchId) {
    return { ok: false, status: 0, error: 'no_external_match_candidate' };
  }
  const url = new URL('/api/v23.3/match-center', ORIGIN);
  url.searchParams.set('competition', match.competition);
  url.searchParams.set('match_id', match.matchId);
  try {
    const response = await fetch(url, { headers: telegramHeaders() });
    let payload = null;
    try { payload = await response.json(); } catch {}
    const snapshot = payload?.data?.match || null;
    return {
      status: response.status,
      ok: Boolean(response.ok && payload?.ok && snapshot),
      provider: payload?.data?.provider || null,
      competition: match.competition,
      matchId: snapshot?.matchId || match.matchId,
      matchStatus: snapshot?.status || null,
      minute: snapshot?.minute ?? null,
      homeScore: snapshot?.homeScore ?? null,
      awayScore: snapshot?.awayScore ?? null,
      error: payload?.error || null,
    };
  } catch (error) {
    return {
      status: 0,
      ok: false,
      competition: match.competition,
      matchId: match.matchId,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function profileFeedCheck(competitionRows) {
  const data = Object.fromEntries(
    competitionRows.map(row => [row.competition, { matches: row.matches }]),
  );
  let candidate = null;
  for (const row of competitionRows) {
    for (const match of row.matches) {
      candidate = [match?.homeTeam, match?.awayTeam]
        .find(team => (
          team?.name
          && (team?.countryCode === 'ITA'
            || team?.countryCode === 'IT'
            || ITALIAN_PROFILE_NAMES.has(String(team.name).trim()))
        ));
      if (candidate) break;
    }
    if (candidate) break;
  }
  if (!candidate) return { ok: false, reason: 'no_italian_team_candidate', team: null, matchCount: 0 };
  const matches = profileCompetitionMatches(data, candidate);
  return {
    ok: matches.length > 0,
    team: safeTeam(candidate),
    matchCount: matches.length,
    competitions: [...new Set(matches.map(match => match.competition))],
    sampleMatchIds: matches.slice(0, 4).map(match => match.matchId),
  };
}

function snippets(text, markers) {
  return markers.map(marker => {
    const index = text.indexOf(marker);
    if (index < 0) return { marker, found: false };
    return {
      marker,
      found: true,
      index,
      snippet: text.slice(Math.max(0, index - 1200), Math.min(text.length, index + 2600))
        .replace(/\s+/g, ' ')
        .trim(),
    };
  });
}

async function probeModules() {
  const rows = [];
  for (const path of MODULES) {
    try {
      const url = new URL(path, ORIGIN);
      url.searchParams.set('probe', String(Date.now()));
      const { response, text } = await fetchText(url);
      rows.push({
        path,
        status: response.status,
        contentType: response.headers.get('content-type'),
        contentSecurityPolicy: response.headers.get('content-security-policy'),
        bytes: Buffer.byteLength(text),
        hasInstallMatchesUi: path === '/v23.2/matches-ui.mjs' ? text.includes('installMatchesUi') : undefined,
        hasTournamentCapture: path === '/v23.2/matches-ui.mjs'
          ? text.includes('event.stopPropagation?.();') && text.includes('controller.openCompetition(card.dataset.cw232Competition)')
          : undefined,
        hasCoppaScheduleOnly: path === '/v23.2/matches-ui.mjs'
          ? !text.includes('${renderCoppaTabs()}') && !text.includes('data-cw232-coppa-panel="bracket"')
          : undefined,
        hasCoreMarker: path === '/v23.2/index.mjs' ? text.includes('CiaoV232Core') : undefined,
        hasProfileImport: path === '/v23.2/index.mjs' ? text.includes('profile-integration.mjs') : undefined,
        hasProfileRuntime: path === '/v23.2/profile-integration.mjs'
          ? text.includes('CiaoV232Profile') && text.includes('cw232-profile-tournament-enrichment')
          : undefined,
        hasSerieALabel: path === '/v23.2/competition-config.mjs'
          ? text.includes("title: 'Серия А'") && text.includes("shortTitle: 'Серия А'")
          : undefined,
        hasUnifiedRuntime: path === '/v23.3/index.mjs'
          ? text.includes('CiaoV233') && text.includes('home-integration.mjs') && text.includes('tables-ui.mjs')
          : undefined,
        predictionsBlocked: path === '/v23.3/index.mjs'
          ? text.includes("predictions: 'blocked'") && !text.includes('predictions-ui.mjs')
          : undefined,
        hasHomeRuntime: path === '/v23.3/home-integration.mjs'
          ? text.includes('CiaoV233Home') && text.includes('Кальчо сегодня')
          : undefined,
        homeMultiCompetition: path === '/v23.3/home-integration.mjs'
          ? text.includes('loadAllCompetitionMatches') && text.includes('Все турниры')
          : undefined,
        hasTablesRuntime: path === '/v23.3/tables-ui.mjs'
          ? text.includes('installTablesUi') && text.includes('ciao-v233-tables-overlay') && text.includes('coppa_italia')
          : undefined,
        hasCoppaBracket: path === '/v23.3/tables-ui.mjs'
          ? text.includes('renderCoppaBracket') && text.includes('buildCoppaBracket')
          : undefined,
        documentOverflowGuard: path === '/v23.3/tables-ui.mjs'
          ? text.includes('overflow-x:hidden') && text.includes('max-width:100%') && text.includes('overflow-x:auto')
          : undefined,
        hasMatchCenterRuntime: path === '/v23.3/match-center.mjs'
          ? text.includes('createMatchCenterController') && text.includes('openCanonicalMatchCenter') && text.includes('15_000')
          : undefined,
        hasMatchCenterLinksRuntime: path === '/v23.3/match-center-links.mjs'
          ? text.includes('resolveCanonicalMatchTarget') && text.includes('installCanonicalMatchLinks')
          : undefined,
      });
    } catch (error) {
      rows.push({ path, status: 0, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return rows;
}

function publicCompetitionSummary(row) {
  const { matches: _matches, ...safe } = row;
  return safe;
}

function publicStandingsSummary(row) {
  const { rows: _rows, ...safe } = row;
  return safe;
}

function publicRegistrySummary(registry) {
  return {
    ok: Boolean(registry?.ok),
    status: registry?.status ?? 0,
    attempt: registry?.attempt ?? 0,
    bytes: registry?.bytes ?? 0,
    currentFeedReady: Boolean(registry?.currentFeedReady),
    error: registry?.error || null,
  };
}

async function probe() {
  const attempts = [];
  let latestHtml = '';
  for (let index = 0; index < 9; index += 1) {
    const startedAt = new Date().toISOString();
    try {
      const url = new URL(ORIGIN);
      url.searchParams.set('probe', `${Date.now()}-${index + 1}`);
      const { response, text: html } = await fetchText(url);
      latestHtml = html;
      const markers = Object.fromEntries(EXPECTED.map(marker => [marker, html.includes(marker)]));
      const homeSeasonLabelAbsent = !html.includes(HOME_SEASON_LABEL);
      const homeResetNoticePresent = html.includes(RESET_NOTICE_TEXT);
      const homeMultiCompetition = html.includes('cw233-home-multicompetition');
      attempts.push({
        attempt: index + 1,
        startedAt,
        status: response.status,
        contentType: response.headers.get('content-type'),
        contentSecurityPolicy: response.headers.get('content-security-policy'),
        cfRay: response.headers.get('cf-ray'),
        age: response.headers.get('age'),
        etag: response.headers.get('etag'),
        markers,
        profileMarker: html.includes('cw232-profile-tournament-enrichment'),
        unifiedV233Marker: html.includes('id="ciao-v233"'),
        homeSeasonLabelAbsent,
        homeResetNoticePresent,
        homeMultiCompetition,
        bytes: Buffer.byteLength(html),
      });
      if (
        response.ok
        && EXPECTED.every(marker => markers[marker])
        && homeSeasonLabelAbsent
      ) break;
    } catch (error) {
      attempts.push({ attempt: index + 1, startedAt, error: error instanceof Error ? error.message : String(error) });
    }
    if (index < 8) await sleep(10_000);
  }

  const [modules, health, deployedRegistry, rawCompetitionRows, rawStandingsRows] = await Promise.all([
    probeModules(),
    probeHealth(),
    probeDeployedTeamRegistry(),
    Promise.all(EXTERNAL_COMPETITIONS.map(probeLiveCompetition)),
    Promise.all(UEFA_COMPETITIONS.map(probeStandings)),
  ]);

  const competitions = rawCompetitionRows.map(row => ({
    ...row,
    unknownTeamNames: unknownTeamNames(row.matches, deployedRegistry),
  }));
  const standings = rawStandingsRows.map(row => ({
    ...row,
    unknownTeamNames: unknownNamesFromTeams(row.rows.map(item => item?.team), deployedRegistry)
      .sort((a, b) => a.localeCompare(b)),
    releaseStatus: standingsReleaseCheck(row).status,
  }));

  const matchesModule = modules.find(item => item.path === '/v23.2/matches-ui.mjs');
  const v232IndexModule = modules.find(item => item.path === '/v23.2/index.mjs');
  const competitionConfigModule = modules.find(item => item.path === '/v23.2/competition-config.mjs');
  const profileModule = modules.find(item => item.path === '/v23.2/profile-integration.mjs');
  const v233IndexModule = modules.find(item => item.path === '/v23.3/index.mjs');
  const homeModule = modules.find(item => item.path === '/v23.3/home-integration.mjs');
  const tablesModule = modules.find(item => item.path === '/v23.3/tables-ui.mjs');
  const matchCenterModule = modules.find(item => item.path === '/v23.3/match-center.mjs');
  const matchCenterLinksModule = modules.find(item => item.path === '/v23.3/match-center-links.mjs');
  const profileFeed = profileFeedCheck(competitions);
  const matchCenterCandidate = competitions.find(row => row.competition === 'ucl')?.matches?.[0]
    || competitions.flatMap(row => row.matches)[0]
    || null;
  const matchCenter = await probeMatchCenter(matchCenterCandidate);
  const allUnknownTeamNames = [...new Set([
    ...competitions.flatMap(row => row.unknownTeamNames),
    ...standings.flatMap(row => row.unknownTeamNames),
  ])].sort((a, b) => a.localeCompare(b));
  const releaseHeldForUnknownTeams = allUnknownTeamNames.length > 0;
  const predictionsBlocked = Boolean(v233IndexModule?.predictionsBlocked);
  const documentOverflowGuard = Boolean(tablesModule?.documentOverflowGuard);

  const report = {
    url: ORIGIN,
    expected: EXPECTED,
    observedAt: new Date().toISOString(),
    attempts,
    latest: attempts.at(-1) || null,
    health,
    deployedRegistry: publicRegistrySummary(deployedRegistry),
    competitions: competitions.map(publicCompetitionSummary),
    standings: standings.map(publicStandingsSummary),
    matchCenter,
    allUnknownTeamNames,
    releaseHeldForUnknownTeams,
    predictionsBlocked,
    documentOverflowGuard,
    profileFeed,
    modules,
    navigation: snippets(latestHtml, NAV_MARKERS),
  };

  await mkdir('artifacts', { recursive: true });
  await writeFile('artifacts/test-deployment-probe.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify({
    latest: report.latest,
    health,
    deployedRegistry: report.deployedRegistry,
    competitions: report.competitions,
    standings: report.standings,
    matchCenter,
    allUnknownTeamNames,
    releaseHeldForUnknownTeams,
    predictionsBlocked,
    documentOverflowGuard,
    profileFeed,
    modules,
    navigation: report.navigation.map(item => ({ marker: item.marker, found: item.found, index: item.index })),
  }));

  const missingExpected = EXPECTED.filter(marker => !report.latest?.markers?.[marker]);
  if (missingExpected.length) {
    throw new Error(`deployed TEST is missing v23.3 runtime markers: ${missingExpected.join(', ')}`);
  }
  if (!report.latest?.homeSeasonLabelAbsent) {
    throw new Error('deployed TEST still contains the Home Serie A season label');
  }
  if (!report.latest?.homeMultiCompetition) {
    throw new Error('deployed TEST is missing the multi-competition Home marker');
  }
  if (!health.ok
      || health.service !== EXPECTED_HEALTH.service
      || health.build !== EXPECTED_HEALTH.build
      || health.matchesProvider !== EXPECTED_HEALTH.matchesProvider) {
    throw new Error(`deployed TEST health contract mismatch: service=${health.service} build=${health.build} provider=${health.matchesProvider}`);
  }
  if (!matchesModule?.hasTournamentCapture) {
    throw new Error('deployed TEST does not contain tournament capture navigation fix');
  }
  if (!matchesModule?.hasCoppaScheduleOnly) {
    throw new Error('deployed TEST Matches still contains the Coppa bracket panel');
  }
  if (!competitionConfigModule?.hasSerieALabel) {
    throw new Error('deployed TEST competition config is missing the Серия А label');
  }
  if (!v233IndexModule?.hasUnifiedRuntime) {
    throw new Error('deployed TEST is missing unified v23.3 browser runtime');
  }
  if (!predictionsBlocked) {
    throw new Error('deployed TEST prediction gate is not explicitly BLOCKED');
  }
  if (!homeModule?.hasHomeRuntime || !homeModule?.homeMultiCompetition) {
    throw new Error('deployed TEST is missing v23.3 multi-competition Home runtime');
  }
  if (!tablesModule?.hasTablesRuntime || !tablesModule?.hasCoppaBracket) {
    throw new Error('deployed TEST Tables is missing the Coppa bracket runtime');
  }
  if (!documentOverflowGuard) {
    throw new Error('deployed TEST is missing the document overflow guard styles');
  }
  if (!matchCenterModule?.hasMatchCenterRuntime) {
    throw new Error('deployed TEST is missing v23.3 Match Center runtime');
  }
  if (!matchCenterLinksModule?.hasMatchCenterLinksRuntime) {
    throw new Error('deployed TEST is missing v23.3 Match Center links runtime');
  }

  if (health.bsdConfigured === true) {
    if (!deployedRegistry?.ok || !deployedRegistry?.currentFeedReady) {
      throw new Error(`deployed TEST team registry is stale or unavailable: status=${deployedRegistry?.status ?? 0}`);
    }
    for (const row of competitions) {
      if (!row.ok) {
        throw new Error(
          `deployed TEST BSD ${row.competition} failed: status=${row.status}`
          + ` stage=${row.upstreamStage || 'unknown'}`
          + ` upstreamStatus=${row.upstreamStatus ?? 'unknown'}`
          + ` code=${row.upstreamCode || 'unknown'}`
          + ` error=${row.error || 'none'}`,
        );
      }
      if (row.matchCount < 1) throw new Error(`deployed TEST ${row.competition} has no matches`);
      if (UEFA_COMPETITIONS.includes(row.competition) && !row.foreignVsForeign) {
        throw new Error(`deployed TEST ${row.competition} does not prove a foreign-vs-foreign fixture`);
      }
    }

    const coppa = competitions.find(row => row.competition === 'coppa_italia');
    if (coppa?.duplicateFingerprints?.length) {
      throw new Error(`deployed TEST Coppa Italia still has ${coppa.duplicateFingerprints.length} duplicate fingerprints`);
    }

    for (const row of standings) {
      const release = standingsReleaseCheck(row);
      if (!release.pass) {
        throw new Error(`deployed TEST ${row.competition} standings failed release check: ${release.status}`);
      }
    }
    if (!matchCenter.ok) {
      throw new Error(`deployed TEST external Match Center failed: status=${matchCenter.status} error=${matchCenter.error || 'none'}`);
    }
    if (!profileFeed.ok) {
      throw new Error(`deployed TEST profile tournament feed unavailable: ${profileFeed.reason || 'no_matches'}`);
    }
  }

  if (releaseHeldForUnknownTeams) {
    throw new Error(`deployed TEST release held for unknown team names: ${allUnknownTeamNames.join(', ')}`);
  }

  if (report.latest?.profileMarker) {
    if (!v232IndexModule?.hasProfileImport || !profileModule?.hasProfileRuntime) {
      throw new Error('deployed TEST profile build is missing profile tournament runtime');
    }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  probe().catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}
