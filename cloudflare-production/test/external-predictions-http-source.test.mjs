import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const path=new URL('../../supabase/functions/ciao-external-predictions/index.ts',import.meta.url);

test('edge function exposes health, state, save and secured sync_due without browser secrets',async()=>{
  const src=await readFile(path,'utf8');
  for(const fragment of [
    "service:'ciao-external-predictions'",
    "action==='state'",
    "action==='save_predictions'",
    "action==='sync_due'",
    "x-ciao-cron-token",
    "x-telegram-init-data",
    "external_predictions_v1",
    "https://ciao-web-app.ciao-web.workers.dev/api/cw22/matches",
  ]) assert.ok(src.includes(fragment),fragment);
  assert.ok(!/BSD_API_KEY\s*[:=]\s*['\"][^'\"]+/.test(src));
  assert.ok(!/TELEGRAM_BOT_TOKEN\s*[:=]\s*['\"][^'\"]+/.test(src));
});
