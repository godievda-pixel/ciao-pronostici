export { PredictionLeague } from './v23.3/prediction-league-do.mjs';

import { adaptSerieASchedule } from './v23.2/serie-a-adapter.mjs';
import {
  BsdUpstreamError,
  fetchBsdMatchSnapshot,
  fetchBsdMatches,
  fetchBsdStandings,
} from './v23.2/bsd-provider.mjs';

const TEST_BUILD = 'ciao-web-v23-2-bsd-test-20260902';
const V23_2_MATCHES = '/api/v23.2/matches';
const V23_3_STANDINGS = '/api/v23.3/standings';
const V23_3_MATCH_CENTER = '/api/v23.3/match-center';
const LEGACY_SERIE_A_SCHEDULE = '/api/ciao-schedule-fast-v1';
const LEGACY_CORE_API = '/api/ciao-core-api-fast-v4';
const EXTERNAL_COMPETITIONS = new Set(['coppa_italia', 'ucl', 'uel', 'uecl']);
const UEFA_STANDINGS_COMPETITIONS = new Set(['ucl', 'uel', 'uecl']);

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
      || source?.logo
      || row?.team_logo
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

  return Response.json({
    ok: true,
    data: adaptSerieASchedule(payload),
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

  return Response.json({
    ok: true,
    data: normalizeLegacySerieAStandings(payload),
  });
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

  if (!EXTERNAL_COMPETITIONS.has(competition)) {
    return errorJson(400, { error: 'competition_not_supported', competition });
  }
  if (!matchId) {
    return errorJson(400, { error: 'match_id_required', competition });
  }
  if (!matchId.startsWith(`${competition}:`) || !matchId.slice(competition.length + 1).trim()) {
    return errorJson(400, { error: 'competition_match_mismatch', competition });
  }

  const apiKey = String(env.BSD_API_KEY || '');
  if (!apiKey) {
    return errorJson(503, { error: 'bsd_api_key_missing', competition });
  }

  try {
    const match = await fetchBsdMatchSnapshot({ competition, matchId, apiKey });
    return Response.json({
      ok: true,
      data: {
        competition,
        provider: 'bsd-v2',
        match,
      },
    });
  } catch (error) {
    return bsdFailure(error, competition, 'match_center_upstream_failed');
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/healthz') {
      return Response.json({
        ok: true,
        service: 'ciao-web-app-test',
        build: TEST_BUILD,
        api: 'ciao-web-api',
        matches_provider: 'bsd-v2',
        bsd_configured: Boolean(env.BSD_API_KEY),
      });
    }

    if (url.pathname === V23_2_MATCHES) {
      return handleV23_2Matches(request, env, url);
    }
    if (url.pathname === V23_3_STANDINGS) {
      return handleV23_3Standings(request, env, url);
    }
    if (url.pathname === V23_3_MATCH_CENTER) {
      return handleV23_3MatchCenter(request, env, url);
    }

    if (url.pathname.startsWith('/api/')) {
      return env.CIAO_WEB_API.fetch(request);
    }

    return noStoreStaticResponse(await env.ASSETS.fetch(request));
  },
};
