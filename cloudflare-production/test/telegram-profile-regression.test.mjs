import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectTelegramProfileFlow } from '../scripts/inspect-telegram-profile-flow.mjs';
import {
  telegramUserId,
  resolveTelegramDisplayName,
  profilePatchFromTelegram,
} from '../src/modular/identity/telegram-profile.mjs';
import { synchronizeTelegramProfile } from '../src/modular/identity/profile-sync.mjs';

test('Telegram profile regression detects the deployed free display_name shorthand', () => {
  const broken = `async function dbUserFor(tgu){ const display='Новое имя'; return db.from('cp_users').update({username,display_name}); }`;
  const result = inspectTelegramProfileFlow(broken);
  assert.equal(result.unsafeDisplayNameReferences.length, 1);
  assert.match(result.unsafeDisplayNameReferences[0].excerpt, /username,display_name/);
});

test('Telegram profile regression allows property access and explicit object keys', () => {
  const safe = `user.display_name; user?.display_name; row.display_name; update({display_name: display});`;
  assert.equal(inspectTelegramProfileFlow(safe).unsafeDisplayNameReferences.length, 0);
});

test('Telegram identity is stable when mutable Telegram fields change', () => {
  assert.equal(telegramUserId({ id:777, username:'old_name' }), '777');
  assert.equal(telegramUserId({ id:777, username:'new_name', first_name:'Новое' }), '777');
});

test('Telegram profile resolver prefers current Telegram name over stored name', () => {
  assert.equal(resolveTelegramDisplayName({
    telegramUser:{ id:777, first_name:'Новое', last_name:'Имя', username:'new_name' },
    storedUser:{ telegram_id:777, display_name:'Старое имя', username:'old_name' },
  }), 'Новое Имя');
});

test('Telegram profile resolver handles missing optional fields safely', () => {
  assert.equal(resolveTelegramDisplayName({ telegramUser:{ id:1, first_name:'Даня' }, storedUser:{} }), 'Даня');
  assert.equal(resolveTelegramDisplayName({ telegramUser:{ id:2, username:'user2' }, storedUser:{} }), 'user2');
  assert.equal(resolveTelegramDisplayName({ telegramUser:{ id:3 }, storedUser:{ display_name:'Сохранённое имя' } }), 'Сохранённое имя');
  assert.equal(resolveTelegramDisplayName({ telegramUser:{ id:4 }, storedUser:{} }), 'Игрок Ciao, Web!');
});

test('Telegram profile patch updates only mutable columns present in cp_users', () => {
  assert.deepEqual(profilePatchFromTelegram({
    telegramUser:{ id:777, first_name:'Новое', last_name:'Имя', username:'new_name' },
    storedUser:{ telegram_id:777, display_name:'Старое имя', username:'old_name', favorite_team_id:109 },
  }), {
    telegramUserId:'777',
    patch:{ username:'new_name', display_name:'Новое Имя' },
    changed:true,
  });
});

test('profile sync lets render proceed and preserves the same account when persistence fails', async () => {
  const storedUser={ telegram_id:777, display_name:'Старое имя', username:'old_name', predictions_count:42, ranking_points:118, favorite_team_id:109 };
  let localProfile=null;
  const result=await synchronizeTelegramProfile({
    telegramUser:{ id:777, first_name:'Новое', last_name:'Имя', username:'new_name' },
    storedUser,
    updateProfile:async()=>{ throw Object.assign(new Error('temporary sync failure'), { status:503 }); },
    onLocalProfile:user=>{ localProfile=user; },
  });
  assert.equal(localProfile.display_name,'Новое Имя');
  assert.equal(localProfile.telegram_id,777);
  assert.equal(localProfile.predictions_count,42);
  assert.equal(localProfile.ranking_points,118);
  assert.equal(localProfile.favorite_team_id,109);
  assert.equal(result.userId,'777');
  assert.equal(result.displayName,'Новое Имя');
  assert.equal(result.synchronized,false);
  assert.ok(result.syncError);
  assert.deepEqual(storedUser,{ telegram_id:777, display_name:'Старое имя', username:'old_name', predictions_count:42, ranking_points:118, favorite_team_id:109 });
});
