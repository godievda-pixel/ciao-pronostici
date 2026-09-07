import { isExternalCompetition } from './matches/competition-config.mjs';
import { BsdUpstreamError, fetchBsdMatches } from './matches/bsd-provider.mjs';

const API_PATH = '/api/cw22/matches';
const INTERNAL_CACHE_SECONDS = 20;

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...headers,
    },
  });
}

function browserPrivate(response) {
  const headers = new Headers(response.headers);
  headers.set('cache-control', 'private, max-age=0');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function cacheKeyFor(url) {
  return new Request(url.toString(), { method: 'GET' });
}

function externalCompetition(value) {
  try {
    return isExternalCompetition(value);
  } catch {
    return false;
  }
}

export function createWorker({ fetchMatches = fetchBsdMatches, cache = null } = {}) {
  return {
    async fetch(request, env = {}, ctx = {}) {
      const url = new URL(request.url);

      if (url.pathname === '/healthz') {
        return json({
          ok: true,
          service: 'ciao-web-app',
          matches_provider: 'bsd-v2',
          bsd_configured: Boolean(String(env?.BSD_API_KEY || '').trim()),
        });
      }

      if (url.pathname !== API_PATH) {
        if (env?.ASSETS?.fetch) return env.ASSETS.fetch(request);
        return new Response('Not Found', { status: 404 });
      }

      if (request.method !== 'GET') {
        return json({ ok: false, error: 'method_not_allowed' }, 405, { allow: 'GET' });
      }

      const competition = String(url.searchParams.get('competition') || '').trim();
      if (!competition || !externalCompetition(competition)) {
        return json({ ok: false, error: 'invalid_competition' }, 400);
      }

      const initData = String(request.headers.get('x-telegram-init-data') || '').trim();
      if (!initData) return json({ ok: false, error: 'telegram_init_data_required' }, 401);

      const apiKey = String(env?.BSD_API_KEY || '').trim();
      if (!apiKey) return json({ ok: false, error: 'bsd_api_key_missing' }, 503);

      const from = String(url.searchParams.get('from') || '').trim();
      const to = String(url.searchParams.get('to') || '').trim();
      const activeCache = cache || globalThis.caches?.default || null;
      const key = cacheKeyFor(url);

      if (activeCache?.match) {
        const hit = await activeCache.match(key);
        if (hit) return browserPrivate(hit);
      }

      try {
        const matches = await fetchMatches({
          competition,
          from,
          to,
          apiKey,
          fetchImpl: fetch,
        });
        const internal = json({
          ok: true,
          data: {
            competition,
            from,
            to,
            provider: 'bsd-v2',
            matches,
          },
        }, 200, {
          'cache-control': `public, max-age=${INTERNAL_CACHE_SECONDS}`,
        });

        if (activeCache?.put) {
          const write = activeCache.put(key, internal.clone());
          if (typeof ctx?.waitUntil === 'function') ctx.waitUntil(write);
          else await write;
        }
        return browserPrivate(internal);
      } catch (error) {
        if (error instanceof BsdUpstreamError) {
          return json({
            ok: false,
            error: 'competition_upstream_failed',
            upstream_stage: error.stage,
            upstream_status: error.status,
            upstream_code: error.code,
          }, 502);
        }
        return json({ ok: false, error: 'invalid_request' }, 400);
      }
    },
  };
}

const worker = createWorker();
export default worker;
