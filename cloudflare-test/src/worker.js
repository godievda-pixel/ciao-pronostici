import { adaptSerieASchedule } from './v23.2/serie-a-adapter.mjs';
import { BsdUpstreamError, fetchBsdMatches } from './v23.2/bsd-provider.mjs';

const TEST_BUILD = 'ciao-web-v23-2-bsd-test-20260902';
const V23_2_MATCHES = '/api/v23.2/matches';
const LEGACY_SERIE_A_SCHEDULE = '/api/ciao-schedule-fast-v1';
const EXTERNAL_COMPETITIONS = new Set(['coppa_italia', 'ucl', 'uel', 'uecl']);

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

    const upstream = error instanceof BsdUpstreamError ? error : null;
    return errorJson(502, {
      error: 'competition_upstream_failed',
      provider: 'bsd-v2',
      competition,
      upstream_stage: upstream?.stage || 'unknown',
      upstream_status: upstream?.status ?? null,
      upstream_code: upstream?.code || 'unknown_error',
    });
  }
}

async function handleV23_2Matches(request, env, url) {
  if (request.method !== 'GET') {
    return errorJson(405, { error: 'method_not_allowed' });
  }

  const initData = request.headers.get('x-telegram-init-data') || '';
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

    if (url.pathname.startsWith('/api/')) {
      return env.CIAO_WEB_API.fetch(request);
    }

    return noStoreStaticResponse(await env.ASSETS.fetch(request));
  },
};
