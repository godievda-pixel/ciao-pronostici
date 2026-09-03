export { PredictionLeague } from './v23.3/prediction-league-do.mjs';

import { adaptSerieASchedule } from './v23.2/serie-a-adapter.mjs';
import {
  BsdUpstreamError,
  fetchBsdMatchCenterBase,
  fetchBsdMatchCenterSection,
  fetchBsdMatchCenterSnapshot,
  fetchBsdMatches,
  fetchBsdStandings,
} from './v23.2/bsd-provider.mjs';
import { normalizeTeamAlias, russianTeamName } from './v23.2/team-registry.mjs';
import { canonicalMatchCenterSnapshot } from './v23.3/match-center-snapshot.mjs';
import { canonicalCoverage } from './v23.3/match-center-sections.mjs';
import { createPredictionService } from './v23.3/prediction-service.mjs';
import { assertSafeResetTarget } from './v23.3/reset-contract.mjs';
import { predictionObjectName } from './v23.3/prediction-sql.mjs';
import {
  enrichSerieAMatchesWithCrests,
  enrichSerieAStandingsWithCrests,
  fetchSerieACrestRegistry,
} from './v23.3/serie-a-crest-source.mjs';

const TEST_BUILD = 'ciao-web-v23-3-user-feedback-r4-20260902';
const V23_2_MATCHES = '/api/v23.2/matches';
const V23_3_STANDINGS = '/api/v23.3/standings';
const V23_3_MATCH_CENTER = '/api/v23.3/match-center';
const V23_3_PREDICTIONS = '/api/v23.3/predictions';
const V23_3_PREDICTIONS_AVAILABLE = '/api/v23.3/predictions/available';
const V23_3_RANKINGS = '/api/v23.3/rankings';
const V23_3_RANKINGS_ME = '/api/v23.3/rankings/me';
const V23_3_TEST_RESET = '/api/v23.3/test/predictions/reset';
const LEGACY_SERIE_A_SCHEDULE = '/api/ciao-schedule-fast-v1';
const LEGACY_CORE_API = '/api/ciao-core-api-fast-v4';
const EXTERNAL_COMPETITIONS = new Set(['coppa_italia', 'ucl', 'uel', 'uecl']);
const UEFA_STANDINGS_COMPETITIONS = new Set(['ucl', 'uel', 'uecl']);
const MATCH_CENTER_SECTIONS = new Set(['overview', 'stats', 'events', 'lineups', 'players']);

function errorJson(status, payload) {
  return Response.json({ ok: false, ...payload }, { status });
}

function dateText(value) {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString().slice(0, 10);
}

function defaultDateRange(now = new Date()) {
  const from = new Date(now);
  from.setUTCDate(from.getUTCDate() - 45);
  const to = new Date(now);
  to.setUTCDate(to.getUTCDate() + 120);
  return { from: dateText(from), to: dateText(to) };
}

function noStoreStaticResponse(response) {
  const result = new Response(response.body, response);
  result.headers.set('cache-control', 'no-store, no-cache, must-revalidate, max-age=0');
  result.headers.set('pragma', 'no-cache');
  result.headers.set('expires', '0');
  return result;
}

function telegramInitData(request) {
  return String(request.headers.get('x-telegram-init-data') || '');
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeLegacyStandingTeam(row = {}) {
  const source = row?.team && typeof row.team === 'object' ? row.team : {};
  const id = String(source?.id ?? row?.team_id ?? '');
  const name = String(source?.name ?? row?.team_name ?? '—');
  return {
    id,
    name,
    rawName: name,
    crestUrl: String(
      source?.crestUrl
      || source?.crest_url
      || source?.logo_url
      || source?.logo
      || row?.team_logo
      || row?.logo_url
      || '',
    ),
  };
}

function normalizeLegacySerieAStandings(payload) {
  const table = payload?.serie_a_table && typeof payload.serie_a_table === 'object'
    ? payload.serie_a_table
    : {};
  const rows = Array.isArray(table?.rows) ? table.rows : [];
  return {
    competition: 'serie_a',
    provider: 'ciao-web-api',
    updatedAt: table?.updated_at || null,
    rows: rows.map(row => ({
      competition: 'serie_a',
      position: numberOrNull(row?.position ?? row?.rank),
      team: normalizeLegacyStandingTeam(row),
      played: numberOrNull(row?.played ?? row?.matches_played ?? row?.played_games),
      wins: numberOrNull(row?.wins ?? row?.won),
      draws: numberOrNull(row?.draws ?? row?.drawn),
      losses: numberOrNull(row?.losses ?? row?.lost),
      goalsFor: numberOrNull(row?.goalsFor ?? row?.goals_for ?? row?.goals_scored ?? row?.gf),
      goalsAgainst: numberOrNull(row?.goalsAgainst ?? row?.goals_against ?? row?.goals_conceded ?? row?.ga),
      goalDifference: numberOrNull(row?.goalDifference ?? row?.goal_difference ?? row?.goal_diff ?? row?.gd),
      points: numberOrNull(row?.points ?? row?.pts),
    })),
  };
}

function normalizedTeamName(value) {
  return normalizeTeamAlias(russianTeamName(String(value ?? '').trim()));
}

function serieACrestLookup(schedule) {
  const byId = new Map();
  const byName = new Map();
  for (const match of Array.isArray(schedule?.matches) ? schedule.matches : []) {
    for (const team of [match?.homeTeam, match?.awayTeam]) {
      const crestUrl = String(team?.crestUrl || '').trim();
      if (!crestUrl) continue;
      const id = String(team?.id || '').trim();
      const names = [team?.name, team?.rawName]
        .map(normalizedTeamName)
        .filter(Boolean);
      if (id) byId.set(id, crestUrl);
      for (const name of names) byName.set(name, crestUrl);
    }
  }
  return { byId, byName };
}

function enrichSerieAStandingsCrests(standings, schedule) {
  const lookup = serieACrestLookup(schedule);
  return {
    ...standings,
    rows:(Array.isArray(standings?.rows) ? standings.rows : []).map(row => {
      if (String(row?.team?.crestUrl || '').trim()) return row;
      const id = String(row?.team?.id || '').trim();
      const names = [row?.team?.name, row?.team?.rawName]
        .map(normalizedTeamName)
        .filter(Boolean);
      const crestUrl = (id && lookup.byId.get(id))
        || names.map(name => lookup.byName.get(name)).find(Boolean)
        || '';
      return crestUrl ? { ...row, team:{ ...row.team, crestUrl } } : row;
    }),
  };
}

function bsdFailure(error, competition, fallbackError) {
  const upstream = error instanceof BsdUpstreamError ? error : null;
  return errorJson(502, {
    error: fallbackError,
    provider: 'bsd-v2',
    competition,
    upstream_stage: upstream?.stage || 'unknown',
    upstream_status: upstream?.status ?? null,
    upstream_code: upstream?.code || 'unknown_error',
  });
}

function bsdMatchCenterSectionFailure(error, competition, section) {
  const upstream = error instanceof BsdUpstreamError ? error : null;
  return errorJson(502, {
    error:'match_center_section_upstream_failed',
    provider:'bsd-v2',
    competition,
    section,
    upstream_stage:upstream?.stage || 'unknown',
    upstream_status:upstream?.status ?? null,
    upstream_code:upstream?.code || 'unknown_error',
  });
}

async function predictionResponse(action) {
  try {
    const data = await action();
    return Response.json({ ok: true, data });
  } catch (error) {
    const status = Number(error?.status) || 500;
    const code = String(error?.code || 'prediction_storage_failed');
    return errorJson(status, { error: code });
  }
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

async function handlePredictions(request, env, url) {
  const service = createPredictionService({ request, env, now: new Date() });
  if (request.method === 'GET') {
    const competition = String(url.searchParams.get('competition') || 'all');
    return predictionResponse(() => service.list(competition));
  }
  if (request.method === 'POST') {
    const body = await readJson(request);
    if (!body) return errorJson(400, { error: 'invalid_prediction_request' });
    return predictionResponse(() => service.save({
      competitionKey: body.competitionKey ?? body.competition_key,
      predictions: body.predictions,
    }));
  }
  return errorJson(405, { error: 'method_not_allowed' });
}

async function handlePredictionsAvailable(request, env, url) {
  if (request.method !== 'GET') return errorJson(405, { error: 'method_not_allowed' });
  const competition = String(url.searchParams.get('competition') || 'all');
  const service = createPredictionService({ request, env, now: new Date() });
  return predictionResponse(() => service.available(competition));
}

function rankingService(request, env, ctx) {
  return createPredictionService({
    request,
    env,
    now:new Date(),
    scheduleBackground:promise => ctx?.waitUntil?.(promise),
  });
}

async function handleRankings(request, env, url, ctx) {
  if (request.method !== 'GET') return errorJson(405, { error: 'method_not_allowed' });
  const scope = String(url.searchParams.get('scope') || 'overall');
  const competition = String(url.searchParams.get('competition') || '');
  const service = rankingService(request, env, ctx);
  return predictionResponse(() => service.rankings({
    scope,
    competition: scope === 'competition' ? competition : undefined,
  }));
}

async function handleRankingMe(request, env, ctx) {
  if (request.method !== 'GET') return errorJson(405, { error: 'method_not_allowed' });
  const service = rankingService(request, env, ctx);
  return predictionResponse(() => service.rankingMe());
}

function resetForbidden() {
  const error = new Error('reset_forbidden');
  error.code = 'reset_forbidden';
  error.status = 403;
  return error;
}

function assertTestPredictionReset(request, env) {
  const url = new URL(request.url);
  try {
    assertSafeResetTarget({ origin: url.origin, environment: env.CIAO_ENV });
  } catch {
    throw resetForbidden();
  }
  if (!env.TEST_RESET_TOKEN) throw resetForbidden();
  if (request.headers.get('x-ciao-test-reset-token') !== env.TEST_RESET_TOKEN) throw resetForbidden();
  let name;
  try {
    name = predictionObjectName({ environment: env.CIAO_ENV, season: env.PREDICTION_SEASON });
  } catch {
    throw resetForbidden();
  }
  if (!name.startsWith('prediction-league:test:')) throw resetForbidden();
  return name;
}

async function handleTestPredictionReset(request, env) {
  if (request.method !== 'POST') return errorJson(405, { error: 'method_not_allowed' });
  return predictionResponse(async () => {
    const name = assertTestPredictionReset(request, env);
    if (!env.PREDICTION_LEAGUE) throw resetForbidden();
    const id = env.PREDICTION_LEAGUE.idFromName(name);
    const stub = env.PREDICTION_LEAGUE.get(id);
    const response = await stub.fetch(new Request('https://prediction-league.internal/reset', {
      method: 'POST',
      headers: { 'content-type':'application/json' },
      body: JSON.stringify({ environment:'test', season:env.PREDICTION_SEASON }),
    }));
    let payload;
    try { payload = await response.json(); } catch { payload = null; }
    if (!response.ok || !payload?.ok || !payload?.stages) {
      const error = new Error('prediction_backend_unavailable');
      error.code = 'prediction_backend_unavailable';
      error.status = 503;
      throw error;
    }
    return { stages: payload.stages };
  });
}

async function serieACrestRegistry(env) {
  try {
    return await fetchSerieACrestRegistry({ apiKey:String(env?.BSD_API_KEY || '') });
  } catch {
    return new Map();
  }
}

async function handleSerieAMatches(request, env, initData) {
  const upstreamRequest = new Request(
    new URL(LEGACY_SERIE_A_SCHEDULE, request.url),
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-telegram-init-data': initData,
      },
      body: '{}',
    },
  );

  const crestPromise = serieACrestRegistry(env);
  const upstream = await env.CIAO_WEB_API.fetch(upstreamRequest);
  let payload;
  try {
    payload = await upstream.json();
  } catch {
    return errorJson(502, { error: 'invalid_upstream_json' });
  }

  if (!upstream.ok || !payload?.ok) {
    return errorJson(upstream.ok ? 502 : upstream.status, {
      error: payload?.error || 'schedule_upstream_failed',
    });
  }

  const schedule = adaptSerieASchedule(payload);
  const registry = await crestPromise;
  return Response.json({
    ok: true,
    data: {
      ...schedule,
      matches:Object.freeze(enrichSerieAMatchesWithCrests(schedule.matches, registry)),
      rounds:Object.freeze(schedule.rounds.map(round => Object.freeze({
        ...round,
        matches:Object.freeze(enrichSerieAMatchesWithCrests(round.matches, registry)),
      }))),
    },
  });
}

async function handleExternalMatches(competition, url, env) {
  const fallback = defaultDateRange();
  const from = String(url.searchParams.get('from') || fallback.from);
  const to = String(url.searchParams.get('to') || fallback.to);
  const apiKey = String(env.BSD_API_KEY || '');

  if (!apiKey) {
    return errorJson(503, { error: 'bsd_api_key_missing', competition });
  }

  try {
    const matches = await fetchBsdMatches({ competition, from, to, apiKey });
    return Response.json({
      ok: true,
      data: {
        competition,
        from,
        to,
        provider: 'bsd-v2',
        matches,
      },
    });
  } catch (error) {
    const message = String(error?.message || error || '');
    if (/invalid date|date range|range exceeds/i.test(message)) {
      return errorJson(400, { error: 'invalid_date_range' });
    }
    return bsdFailure(error, competition, 'competition_upstream_failed');
  }
}

async function handleV23_2Matches(request, env, url) {
  if (request.method !== 'GET') {
    return errorJson(405, { error: 'method_not_allowed' });
  }

  const initData = telegramInitData(request);
  if (!initData) {
    return errorJson(401, { error: 'telegram_auth_required' });
  }

  const competition = String(url.searchParams.get('competition') || '');
  if (competition === 'serie_a') {
    return handleSerieAMatches(request, env, initData);
  }
  if (EXTERNAL_COMPETITIONS.has(competition)) {
    return handleExternalMatches(competition, url, env);
  }

  return errorJson(501, {
    error: 'competition_not_wired',
    competition,
  });
}

async function fetchSerieAScheduleForCrests(request, env, initData) {
  try {
    const response = await env.CIAO_WEB_API.fetch(new Request(
      new URL(LEGACY_SERIE_A_SCHEDULE, request.url),
      {
        method:'POST',
        headers:{
          'content-type':'application/json',
          'x-telegram-init-data':initData,
        },
        body:'{}',
      },
    ));
    if (!response.ok) return null;
    const payload = await response.json();
    if (!payload?.ok) return null;
    return adaptSerieASchedule(payload);
  } catch {
    return null;
  }
}

async function handleSerieAStandings(request, env, initData) {
  const upstreamRequest = new Request(
    new URL(LEGACY_CORE_API, request.url),
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-telegram-init-data': initData,
      },
      body: JSON.stringify({ action: 'serie_a_table' }),
    },
  );

  const legacySchedulePromise = fetchSerieAScheduleForCrests(request, env, initData);
  const bsdCrestPromise = serieACrestRegistry(env);
  const upstream = await env.CIAO_WEB_API.fetch(upstreamRequest);
  let payload;
  try {
    payload = await upstream.json();
  } catch {
    return errorJson(502, { error: 'invalid_upstream_json' });
  }

  if (!upstream.ok || !payload?.ok) {
    return errorJson(upstream.ok ? 502 : upstream.status, {
      error: payload?.error || 'serie_a_table_upstream_failed',
    });
  }

  let standings = normalizeLegacySerieAStandings(payload);
  const [legacySchedule, bsdRegistry] = await Promise.all([
    legacySchedulePromise,
    bsdCrestPromise,
  ]);
  if (legacySchedule) standings = enrichSerieAStandingsCrests(standings, legacySchedule);
  standings = enrichSerieAStandingsWithCrests(standings, bsdRegistry);
  return Response.json({ ok: true, data: standings });
}

async function handleV23_3Standings(request, env, url) {
  if (request.method !== 'GET') {
    return errorJson(405, { error: 'method_not_allowed' });
  }

  const initData = telegramInitData(request);
  if (!initData) {
    return errorJson(401, { error: 'telegram_auth_required' });
  }

  const competition = String(url.searchParams.get('competition') || '');
  if (competition === 'serie_a') {
    return handleSerieAStandings(request, env, initData);
  }
  if (competition === 'coppa_italia') {
    return errorJson(400, { error: 'competition_has_no_standings', competition });
  }
  if (!UEFA_STANDINGS_COMPETITIONS.has(competition)) {
    return errorJson(400, { error: 'competition_not_supported', competition });
  }

  const apiKey = String(env.BSD_API_KEY || '');
  if (!apiKey) {
    return errorJson(503, { error: 'bsd_api_key_missing', competition });
  }

  try {
    const rows = await fetchBsdStandings({ competition, apiKey });
    return Response.json({
      ok: true,
      data: {
        competition,
        provider: 'bsd-v2',
        rows,
      },
    });
  } catch (error) {
    return bsdFailure(error, competition, 'standings_upstream_failed');
  }
}

async function loadSerieAMatchCenterSnapshot(request, env, initData, matchId) {
  const schedule = await fetchSerieAScheduleForCrests(request, env, initData);
  const match = schedule?.matches?.find(item => item?.matchId === matchId) || null;
  if (!match) return null;
  return canonicalMatchCenterSnapshot(match, { venue:match.venue });
}

async function handleV23_3MatchCenter(request, env, url) {
  if (request.method !== 'GET') {
    return errorJson(405, { error: 'method_not_allowed' });
  }

  const initData = telegramInitData(request);
  if (!initData) {
    return errorJson(401, { error: 'telegram_auth_required' });
  }

  const competition = String(url.searchParams.get('competition') || '');
  const matchId = String(url.searchParams.get('match_id') || '');
  const section = String(url.searchParams.get('section') || '').trim().toLowerCase();
  const supported = competition === 'serie_a' || EXTERNAL_COMPETITIONS.has(competition);

  if (!supported) {
    return errorJson(400, { error: 'competition_not_supported', competition });
  }
  if (!matchId) {
    return errorJson(400, { error: 'match_id_required', competition });
  }
  if (!matchId.startsWith(`${competition}:`) || !matchId.slice(competition.length + 1).trim()) {
    return errorJson(400, { error: 'competition_match_mismatch', competition });
  }
  if (section && !MATCH_CENTER_SECTIONS.has(section)) {
    return errorJson(400, { error:'invalid_match_center_section', section, competition });
  }

  if (competition === 'serie_a') {
    if (section) {
      return errorJson(400, { error:'match_center_section_not_available', section, competition });
    }
    const match = await loadSerieAMatchCenterSnapshot(request, env, initData, matchId);
    if (!match) return errorJson(404, { error:'match_not_found', competition });
    return Response.json({
      ok:true,
      data:{ competition, provider:'ciao-web-api', match },
    });
  }

  const apiKey = String(env.BSD_API_KEY || '');
  if (!apiKey) {
    return errorJson(503, { error: 'bsd_api_key_missing', competition });
  }

  try {
    if (section) {
      const result = await fetchBsdMatchCenterSection({ competition, matchId, section, apiKey });
      return Response.json({
        ok:true,
        data:{
          competition,
          provider:'bsd-v2',
          matchId,
          section,
          coverage:canonicalCoverage({ [section]:result.available }),
          available:result.available,
          data:result.data,
        },
      });
    }

    const match = await fetchBsdMatchCenterBase({ competition, matchId, apiKey });
    return Response.json({
      ok: true,
      data: {
        competition,
        provider: 'bsd-v2',
        match,
      },
    });
  } catch (error) {
    if (error instanceof BsdUpstreamError && error.code === 'match_not_eligible') {
      return errorJson(404, { error:'match_not_eligible', competition });
    }
    if (section) return bsdMatchCenterSectionFailure(error, competition, section);
    return bsdFailure(error, competition, 'match_center_upstream_failed');
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/healthz') {
      return Response.json({
        ok: true,
        service: 'ciao-web-app-test',
        build: TEST_BUILD,
        api: 'ciao-web-api',
        matches_provider: 'bsd-v2',
        bsd_configured: Boolean(env.BSD_API_KEY),
        prediction_backend: 'durable-object-sqlite',
        prediction_environment: env.CIAO_ENV || null,
        prediction_season: env.PREDICTION_SEASON || null,
        prediction_do_configured: Boolean(env.PREDICTION_LEAGUE),
      });
    }

    if (url.pathname === V23_2_MATCHES) return handleV23_2Matches(request, env, url);
    if (url.pathname === V23_3_STANDINGS) return handleV23_3Standings(request, env, url);
    if (url.pathname === V23_3_MATCH_CENTER) return handleV23_3MatchCenter(request, env, url);
    if (url.pathname === V23_3_PREDICTIONS_AVAILABLE) return handlePredictionsAvailable(request, env, url);
    if (url.pathname === V23_3_PREDICTIONS) return handlePredictions(request, env, url);
    if (url.pathname === V23_3_RANKINGS_ME) return handleRankingMe(request, env, ctx);
    if (url.pathname === V23_3_RANKINGS) return handleRankings(request, env, url, ctx);
    if (url.pathname === V23_3_TEST_RESET) return handleTestPredictionReset(request, env);

    if (url.pathname.startsWith('/api/')) {
      return env.CIAO_WEB_API.fetch(request);
    }

    return noStoreStaticResponse(await env.ASSETS.fetch(request));
  },
};