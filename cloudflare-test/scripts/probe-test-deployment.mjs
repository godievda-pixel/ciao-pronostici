import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { matchFingerprint } from '../src/v23.2/match-deduper.mjs';
import { isKnownTeamName } from '../src/v23.2/team-registry.mjs';
import { profileCompetitionMatches } from '../src/v23.2/profile-matches.mjs';

const ORIGIN = 'https://ciao-web-app-test.ciao-web.workers.dev/';
const RANGE = Object.freeze({ from: '2026-07-01', to: '2027-06-30' });
const COMPETITIONS = Object.freeze(['coppa_italia', 'ucl', 'uel', 'uecl']);
const ITALIAN_PROFILE_NAMES = new Set([
  'Интер', 'Милан', 'Наполи', 'Рома', 'Ювентус', 'Фиорентина', 'Аталанта', 'Лацио',
  'Болонья', 'Торино', 'Дженоа', 'Комо', 'Удинезе', 'Кальяри', 'Парма', 'Лечче',
  'Верона', 'Сассуоло', 'Пиза', 'Кремонезе',
]);
const EXPECTED = [
  'id="ciao-v232-core"',
  'id="ciao-v232-matches-ui"',
  'id="ciao-v233-home"',
  'id="ciao-v233-tables"',
  'cw231-favorite-normalized-link',
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

async function probeHealth() {
  try {
    const { response, text } = await fetchText(new globalThis.URL('/healthz', ORIGIN));
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

function duplicateFingerprints(matches) {
  const counts = new Map();
  for (const match of matches) {
    const fingerprint = matchFingerprint(match);
    counts.set(fingerprint, (counts.get(fingerprint) || 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([fingerprint, count]) => ({ fingerprint, count }));
}

function unknownTeamNames(matches) {
  const unknown = new Set();
  for (const match of matches) {
    for (const team of [match?.homeTeam, match?.awayTeam]) {
      const raw = String(team?.rawName || team?.name || '').trim();
      if (raw && !isKnownTeamName(raw)) unknown.add(raw);
    }
  }
  return [...unknown].sort((a, b) => a.localeCompare(b));
}

async function probeLiveCompetition(competition) {
  const url = new globalThis.URL('/api/v23.2/matches', ORIGIN);
  url.searchParams.set('competition', competition);
  url.searchParams.set('from', RANGE.from);
  url.searchParams.set('to', RANGE.to);
  try {
    const response = await fetch(url, {
      headers: {
        accept: 'application/json',
        'cache-control': 'no-cache, no-store, max-age=0',
        'x-telegram-init-data': 'deployment-probe',
      },
    });
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
      duplicateFingerprints: duplicateFingerprints(matches),
      unknownTeamNames: unknownTeamNames(matches),
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
      duplicateFingerprints: [],
      unknownTeamNames: [],
      fiorentina: [],
      error: error instanceof Error ? error.message : String(error),
      upstreamStage: null,
      upstreamStatus: null,
      upstreamCode: null,
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
          && (team?.countryCode === 'ITA' || ITALIAN_PROFILE_NAMES.has(String(team.name).trim()))
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
      const { response, text } = await fetchText(new globalThis.URL(path, ORIGIN));
      rows.push({
        path,
        status: response.status,
        contentType: response.headers.get('content-type'),
        contentSecurityPolicy: response.headers.get('content-security-policy'),
        bytes: Buffer.byteLength(text),
        hasInstallMatchesUi: path.endsWith('/matches-ui.mjs') ? text.includes('installMatchesUi') : undefined,
        hasTournamentCapture: path.endsWith('/matches-ui.mjs')
          ? text.includes('event.stopPropagation?.();') && text.includes('controller.openCompetition(card.dataset.cw232Competition)')
          : undefined,
        hasCoppaScheduleOnly: path.endsWith('/matches-ui.mjs')
          ? !text.includes('${renderCoppaTabs()}') && !text.includes('data-cw232-coppa-panel="bracket"')
          : undefined,
        hasCoreMarker: path.endsWith('/index.mjs') ? text.includes('CiaoV232Core') : undefined,
        hasProfileImport: path.endsWith('/index.mjs') ? text.includes("profile-integration.mjs") : undefined,
        hasProfileRuntime: path.endsWith('/profile-integration.mjs')
          ? text.includes('CiaoV232Profile') && text.includes('cw232-profile-tournament-enrichment')
          : undefined,
        hasHomeRuntime: path.endsWith('/home-integration.mjs')
          ? text.includes('CiaoV233Home') && text.includes('Кальчо сегодня')
          : undefined,
        hasTablesRuntime: path.endsWith('/tables-ui.mjs')
          ? text.includes('installTablesUi') && text.includes('ciao-v233-tables-overlay') && text.includes('coppa_italia')
          : undefined,
        hasMatchCenterRuntime: path.endsWith('/match-center.mjs')
          ? text.includes('createMatchCenterController')
            && text.includes('openCanonicalMatchCenter')
            && text.includes('15_000')
          : undefined,
        hasMatchCenterLinksRuntime: path.endsWith('/match-center-links.mjs')
          ? text.includes('resolveCanonicalMatchTarget') && text.includes('installCanonicalMatchLinks')
          : undefined,
      });
    } catch (error) {
      rows.push({
        path,
        status: 0,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return rows;
}

function publicCompetitionSummary(row) {
  const { matches: _matches, ...safe } = row;
  return safe;
}

async function probe() {
  const attempts = [];
  let latestHtml = '';

  for (let index = 0; index < 9; index += 1) {
    const startedAt = new Date().toISOString();
    try {
      const { response, text: html } = await fetchText(ORIGIN);
      latestHtml = html;
      const markers = Object.fromEntries(EXPECTED.map(marker => [marker, html.includes(marker)]));
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
        homeMarker: html.includes('id="ciao-v233-home"'),
        tablesMarker: html.includes('id="ciao-v233-tables"'),
        bytes: Buffer.byteLength(html),
      });
      if (response.ok && EXPECTED.every(marker => markers[marker])) break;
    } catch (error) {
      attempts.push({
        attempt: index + 1,
        startedAt,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    if (index < 8) await sleep(10_000);
  }

  const [modules, health, ...competitions] = await Promise.all([
    probeModules(),
    probeHealth(),
    ...COMPETITIONS.map(probeLiveCompetition),
  ]);
  const matchesModule = modules.find(item => item.path.endsWith('/matches-ui.mjs'));
  const indexModule = modules.find(item => item.path.endsWith('/index.mjs'));
  const profileModule = modules.find(item => item.path.endsWith('/profile-integration.mjs'));
  const homeModule = modules.find(item => item.path.endsWith('/home-integration.mjs'));
  const tablesModule = modules.find(item => item.path.endsWith('/tables-ui.mjs'));
  const matchCenterModule = modules.find(item => item.path.endsWith('/match-center.mjs'));
  const matchCenterLinksModule = modules.find(item => item.path.endsWith('/match-center-links.mjs'));
  const profileFeed = profileFeedCheck(competitions);
  const allUnknownTeamNames = [...new Set(competitions.flatMap(row => row.unknownTeamNames))]
    .sort((a, b) => a.localeCompare(b));
  const report = {
    url: ORIGIN,
    expected: EXPECTED,
    observedAt: new Date().toISOString(),
    attempts,
    latest: attempts.at(-1) || null,
    health,
    competitions: competitions.map(publicCompetitionSummary),
    allUnknownTeamNames,
    profileFeed,
    modules,
    navigation: snippets(latestHtml, NAV_MARKERS),
  };

  await mkdir('artifacts', { recursive: true });
  await writeFile('artifacts/test-deployment-probe.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify({
    latest: report.latest,
    health,
    competitions: report.competitions,
    allUnknownTeamNames,
    profileFeed,
    modules,
    navigation: report.navigation.map(item => ({ marker: item.marker, found: item.found, index: item.index })),
  }));

  const missingExpected = EXPECTED.filter(marker => !report.latest?.markers?.[marker]);
  if (missingExpected.length) {
    throw new Error(`deployed TEST is missing v23.3 Tables runtime markers: ${missingExpected.join(', ')}`);
  }
  if (!matchesModule?.hasTournamentCapture) {
    throw new Error('deployed TEST does not contain tournament capture navigation fix');
  }
  if (!matchesModule?.hasCoppaScheduleOnly) {
    throw new Error('deployed TEST Matches still contains the Coppa bracket panel');
  }
  if (!homeModule?.hasHomeRuntime) {
    throw new Error('deployed TEST is missing v23.3 Home runtime');
  }
  if (!tablesModule?.hasTablesRuntime) {
    throw new Error('deployed TEST is missing v23.3 Tables runtime');
  }
  if (!matchCenterModule?.hasMatchCenterRuntime) {
    throw new Error('deployed TEST is missing v23.3 Match Center runtime');
  }
  if (!matchCenterLinksModule?.hasMatchCenterLinksRuntime) {
    throw new Error('deployed TEST is missing v23.3 Match Center links runtime');
  }
  if (health.bsdConfigured === true) {
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
    }
    const ucl = competitions.find(row => row.competition === 'ucl');
    const coppa = competitions.find(row => row.competition === 'coppa_italia');
    if (!ucl || ucl.matchCount < 1) throw new Error('deployed TEST UCL has no matches');
    if (!coppa || coppa.matchCount < 1) throw new Error('deployed TEST Coppa Italia has no matches');
    if (coppa.duplicateFingerprints.length) {
      throw new Error(`deployed TEST Coppa Italia still has ${coppa.duplicateFingerprints.length} duplicate fingerprints`);
    }
    if (!profileFeed.ok) throw new Error(`deployed TEST profile tournament feed unavailable: ${profileFeed.reason || 'no_matches'}`);
  }

  if (report.latest?.profileMarker) {
    if (!indexModule?.hasProfileImport || !profileModule?.hasProfileRuntime) {
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
