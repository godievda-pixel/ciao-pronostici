import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.js';

for (const path of ['/', '/v23.2/matches-ui.mjs']) {
  test(`TEST static response ${path} disables browser caching`, async () => {
    const env = {
      ASSETS: {
        async fetch() {
          return new Response(path === '/' ? '<html>test</html>' : 'export const ok = true;', {
            status: 200,
            headers: {
              'content-type': path === '/' ? 'text/html' : 'text/javascript',
              'cache-control': 'public, max-age=14400',
            },
          });
        },
      },
      CIAO_WEB_API: { fetch: async () => new Response('not used') },
    };

    const response = await worker.fetch(new Request(`https://test.local${path}`), env);

    assert.equal(response.headers.get('cache-control'), 'no-store, no-cache, must-revalidate, max-age=0');
    assert.equal(response.headers.get('pragma'), 'no-cache');
    assert.equal(response.headers.get('expires'), '0');
  });
}
