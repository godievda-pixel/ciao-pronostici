import test from 'node:test';
import assert from 'node:assert/strict';

const API = 'https://lcnwccnkkxaosxnfvjvr.supabase.co/functions/v1/ciao-v23-api';
const ORIGIN = 'https://ciao-web-v23-test.ciao-web.workers.dev';

test('live standalone v23 API exposes TEST metadata', async () => {
  const response = await fetch(API, {
    method:'GET',
    headers:{ origin:ORIGIN, 'cache-control':'no-cache' },
  });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body?.service, 'Ciao v23 API');
  assert.equal(body?.version, 23);
  assert.equal(body?.environment, 'test');
});

test('live standalone v23 API CORS allows the deployed TEST Worker origin', async () => {
  const response = await fetch(API, {
    method:'OPTIONS',
    headers:{
      origin:ORIGIN,
      'access-control-request-method':'POST',
      'access-control-request-headers':'content-type,x-telegram-init-data',
    },
  });
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('access-control-allow-origin'), ORIGIN);
  assert.match(response.headers.get('access-control-allow-headers') ?? '', /x-telegram-init-data/i);
});
