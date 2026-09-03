import test from 'node:test';
import assert from 'node:assert/strict';

const PROD_ORIGIN = 'https://ciao-web-app.ciao-web.workers.dev';
const CORE_V4 = 'https://dkefzepiiudehhzbbrjn.supabase.co/functions/v1/ciao-core-api-fast-v4';

test('production origin passes the boot API CORS preflight', async () => {
  const response = await fetch(CORE_V4, {
    method: 'OPTIONS',
    headers: {
      Origin: PROD_ORIGIN,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type,x-telegram-init-data',
    },
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('access-control-allow-origin'), PROD_ORIGIN);
  assert.match(response.headers.get('access-control-allow-methods') || '', /POST/);
  assert.match(response.headers.get('access-control-allow-headers') || '', /x-telegram-init-data/i);
});
