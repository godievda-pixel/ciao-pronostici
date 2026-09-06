import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../src/v23/core/store.mjs';
import { createLastGoodCache } from '../src/v23/core/cache.mjs';
import { readApiUrl, createApiClient } from '../src/v23/data/api-client.mjs';

function documentWithMeta(content) {
  return {
    querySelector(selector) {
      assert.equal(selector, 'meta[name="ciao-api-url"]');
      if (content === null) return null;
      return { getAttribute(name) { return name === 'content' ? content : null; } };
    },
  };
}

test('store has one state owner, updater semantics and unsubscribe', () => {
  const store = createStore({ count:1 });
  const seen = [];
  const unsubscribe = store.subscribe((next, previous) => seen.push([next.count, previous.count]));
  assert.equal(store.get().count, 1);
  store.set(current => ({ ...current, count:current.count + 1 }));
  assert.equal(store.get().count, 2);
  assert.deepEqual(seen, [[2,1]]);
  unsubscribe();
  store.set({ count:3 });
  assert.equal(store.get().count, 3);
  assert.deepEqual(seen, [[2,1]]);
});

test('last-good cache preserves successful data when refresh fails', () => {
  const cache = createLastGoodCache();
  cache.put('home', { value:'A' }, 1000);
  assert.deepEqual(cache.get('home'), {
    data:{ value:'A' },
    updatedAt:1000,
    error:null,
  });
  cache.markError('home', { code:'network', message:'Не удалось обновить', status:0 });
  assert.deepEqual(cache.get('home'), {
    data:{ value:'A' },
    updatedAt:1000,
    error:{ code:'network', message:'Не удалось обновить', status:0 },
  });
  cache.put('home', { value:'B' }, 2000);
  assert.equal(cache.get('home').data.value, 'B');
  assert.equal(cache.get('home').error, null);
});

test('readApiUrl accepts only an absolute HTTPS endpoint from the HTML meta tag', () => {
  const endpoint = 'https://example.test/functions/v1/ciao-v23-api';
  assert.equal(readApiUrl(documentWithMeta(endpoint)), endpoint);
  assert.throws(() => readApiUrl(documentWithMeta(null)), /ciao_api_url_missing/);
  assert.throws(() => readApiUrl(documentWithMeta('')), /ciao_api_url_missing/);
  assert.throws(() => readApiUrl(documentWithMeta('http://example.test/api')), /ciao_api_url_https_required/);
  assert.throws(() => readApiUrl(documentWithMeta('not a url')), /ciao_api_url_invalid/);
  assert.throws(() => readApiUrl(documentWithMeta('/relative')), /ciao_api_url_invalid/);
});

test('API client posts canonical JSON with Telegram initData and returns only validated data', async () => {
  const calls = [];
  const signal = new AbortController().signal;
  const api = createApiClient({
    endpoint:'https://example.test/functions/v1/ciao-v23-api',
    getInitData:() => 'signed-init-data',
    fetchImpl:async (url, options) => {
      calls.push({url,options});
      return {
        ok:true,
        status:200,
        async json(){ return { ok:true, data:{ hello:'ciao' }, meta:{ apiVersion:23, serverTime:'2026-09-06T20:00:00.000Z' } }; },
      };
    },
  });

  const result = await api.call('matches', { competition:'ucl' }, { signal });
  assert.deepEqual(result, { hello:'ciao' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://example.test/functions/v1/ciao-v23-api');
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.signal, signal);
  assert.equal(calls[0].options.headers['content-type'], 'application/json');
  assert.equal(calls[0].options.headers['x-telegram-init-data'], 'signed-init-data');
  assert.deepEqual(JSON.parse(calls[0].options.body), { action:'matches', competition:'ucl' });
});

test('API client normalizes server errors and never leaks raw response bodies', async () => {
  const api = createApiClient({
    endpoint:'https://example.test/api',
    getInitData:() => 'signed',
    fetchImpl:async () => ({
      ok:false,
      status:403,
      async json(){ return { ok:false, error:{ code:'test_access_required', message:'Нет доступа к тестовой версии' }, debug:'SECRET RAW BODY' }; },
    }),
  });

  await assert.rejects(
    () => api.call('profile'),
    error => {
      assert.deepEqual(error, { code:'test_access_required', message:'Нет доступа к тестовой версии', status:403 });
      assert.equal(JSON.stringify(error).includes('SECRET RAW BODY'), false);
      return true;
    },
  );
});

test('malformed/HTML/network responses become safe normalized errors without body dumps', async () => {
  const malformed = createApiClient({
    endpoint:'https://example.test/api',
    getInitData:() => 'signed',
    fetchImpl:async () => ({ ok:false, status:502, async json(){ throw new Error('<html>proxy secret</html>'); } }),
  });
  await assert.rejects(
    () => malformed.call('profile'),
    error => error.code === 'api_invalid_response' && error.status === 502 && !JSON.stringify(error).includes('proxy secret'),
  );

  const network = createApiClient({
    endpoint:'https://example.test/api',
    getInitData:() => 'signed',
    fetchImpl:async () => { throw new Error('socket with private diagnostics'); },
  });
  await assert.rejects(
    () => network.call('profile'),
    error => error.code === 'network_error' && error.status === 0 && !JSON.stringify(error).includes('private diagnostics'),
  );
});

test('API client refuses authenticated calls without Telegram initData before fetch', async () => {
  let fetched = false;
  const api = createApiClient({
    endpoint:'https://example.test/api',
    getInitData:() => '',
    fetchImpl:async () => { fetched = true; return {}; },
  });
  await assert.rejects(
    () => api.call('bootstrap'),
    error => error.code === 'telegram_auth_required' && error.status === 401,
  );
  assert.equal(fetched, false);
});
