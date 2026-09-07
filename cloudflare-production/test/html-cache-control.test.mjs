import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createWorker } from '../src/worker.js';

test('HTML documents are always served no-store to avoid stale Telegram WebView builds', async () => {
  const worker = createWorker();
  const env = {
    ASSETS: {
      fetch: async () => new Response('<!doctype html><html></html>', {
        status: 200,
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'cache-control': 'public, max-age=0, must-revalidate',
        },
      }),
    },
  };

  const response = await worker.fetch(new Request('https://ciao-web-app.ciao-web.workers.dev/'), env, {});

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store, no-cache, must-revalidate, max-age=0');
  assert.equal(response.headers.get('pragma'), 'no-cache');
  assert.equal(response.headers.get('expires'), '0');
});

test('non-HTML static assets keep their asset cache headers', async () => {
  const worker = createWorker();
  const env = {
    ASSETS: {
      fetch: async () => new Response('body{}', {
        status: 200,
        headers: {
          'content-type': 'text/css; charset=utf-8',
          'cache-control': 'public, max-age=31536000, immutable',
        },
      }),
    },
  };

  const response = await worker.fetch(new Request('https://ciao-web-app.ciao-web.workers.dev/app.css'), env, {});
  assert.equal(response.headers.get('cache-control'), 'public, max-age=31536000, immutable');
});

test('Static Assets route through Worker so HTML cache policy is actually applied in production', async () => {
  const raw = await readFile(new URL('../wrangler.jsonc', import.meta.url), 'utf8');
  const config = JSON.parse(raw);
  assert.equal(config.assets?.run_worker_first, true);
});
