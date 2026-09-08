import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  isReleaseRevision,
  contentRevision,
  telegramAppUrl,
} from '../../supabase/functions/ciao-pronostici-router/release-revision.mjs';
import { synchronizeRelease } from '../../supabase/functions/ciao-pronostici-router/release-sync.mjs';

const routerSource=readFileSync(
  new URL('../../supabase/functions/ciao-pronostici-router/index.ts',import.meta.url),
  'utf8',
);

test('router revision helper hashes content and builds only the fixed launcher URL', async () => {
  const revision = await contentRevision('hello', webcrypto);
  assert.equal(revision, '2cf24dba5fb0');
  assert.equal(isReleaseRevision(revision), true);
  assert.equal(
    telegramAppUrl(revision),
    'https://dkefzepiiudehhzbbrjn.supabase.co/functions/v1/ciao-web-app?tg_rev=2cf24dba5fb0',
  );
  assert.throws(() => telegramAppUrl('https://evil.example/'), /invalid release revision/);
});

test('release sync refuses a live hash mismatch without touching Telegram', async () => {
  let menuCalls = 0;
  const result = await synchronizeRelease({
    requestedRevision: '2cf24dba5fb0',
    fetchWorkerHtml: async () => 'different',
    setMenuButton: async () => { menuCalls += 1; return { ok: true }; },
    cryptoImpl: webcrypto,
  });
  assert.equal(result.status, 409);
  assert.equal(menuCalls, 0);
});

test('release sync updates Telegram only when the fixed Worker bytes match', async () => {
  let receivedUrl = '';
  const result = await synchronizeRelease({
    requestedRevision: '2cf24dba5fb0',
    fetchWorkerHtml: async () => 'hello',
    setMenuButton: async (url) => { receivedUrl = url; return { ok: true, result: true }; },
    cryptoImpl: webcrypto,
  });
  assert.equal(result.status, 200);
  assert.equal(receivedUrl, 'https://dkefzepiiudehhzbbrjn.supabase.co/functions/v1/ciao-web-app?tg_rev=2cf24dba5fb0');
  assert.equal(result.body.live_revision, '2cf24dba5fb0');
});

test('router exposes only revision-driven production synchronization',()=>{
  assert.match(routerSource,/\/release-sync/);
  assert.match(routerSource,/PRODUCTION_WORKER_URL/);
  assert.match(routerSource,/currentLiveRevision/);
  assert.match(routerSource,/telegramAppUrl/);
  assert.doesNotMatch(routerSource,/release-sync[^\n]*url=/);
  assert.doesNotMatch(routerSource,/tg_rev=20260908-0525/);
  assert.match(routerSource,/x-telegram-bot-api-secret-token/);
});
