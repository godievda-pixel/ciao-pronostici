import { adaptSerieASchedule } from './v23.2/serie-a-adapter.mjs';

const TEST_BUILD = 'ciao-web-v23-1-github-test-20260901';
const V23_2_MATCHES = '/api/v23.2/matches';
const LEGACY_SERIE_A_SCHEDULE = '/api/ciao-schedule-fast-v1';

function errorJson(status, payload) {
  return Response.json({ ok: false, ...payload }, { status });
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
  if (competition !== 'serie_a') {
    return errorJson(501, {
      error: 'competition_not_wired',
      competition,
    });
  }

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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/healthz') {
      return Response.json({
        ok: true,
        service: 'ciao-web-app-test',
        build: TEST_BUILD,
        api: 'ciao-web-api',
      });
    }

    if (url.pathname === V23_2_MATCHES) {
      return handleV23_2Matches(request, env, url);
    }

    if (url.pathname.startsWith('/api/')) {
      return env.CIAO_WEB_API.fetch(request);
    }

    return env.ASSETS.fetch(request);
  },
};
