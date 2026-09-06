import test from 'node:test';
import assert from 'node:assert/strict';
import {
  stableTelegramIdentity,
  resolveTelegramDisplayName,
  createProfileSnapshot,
  createServerProfilePatch,
  reconcileProfileMetadata,
} from '../src/modular/profile/profile-identity.mjs';

test('profile identity is stable across Telegram name changes', () => {
  const before={id:123456789,first_name:'Старое',username:'old_name'};
  const after={id:123456789,first_name:'Новое',last_name:'Имя',username:'new_name'};
  assert.equal(stableTelegramIdentity(before),'telegram:123456789');
  assert.equal(stableTelegramIdentity(after),'telegram:123456789');
  assert.equal(stableTelegramIdentity(before),stableTelegramIdentity(after));
});

test('display name always prefers fresh Telegram fields with safe fallbacks', () => {
  assert.equal(resolveTelegramDisplayName({first_name:'Новое',last_name:'Имя',username:'new_name'}),'Новое Имя');
  assert.equal(resolveTelegramDisplayName({first_name:'Новое'}),'Новое');
  assert.equal(resolveTelegramDisplayName({last_name:'Имя'}),'Имя');
  assert.equal(resolveTelegramDisplayName({username:'new_name'}),'@new_name');
  assert.equal(resolveTelegramDisplayName({}, {display_name:'Серверное Имя'}),'Серверное Имя');
  assert.equal(resolveTelegramDisplayName({}),'Пользователь');
});

test('server profile patch maps displayName to display_name without a free identifier', () => {
  const snapshot=createProfileSnapshot({id:123456789,first_name:'Новое',last_name:'Имя',username:'new_name'});
  assert.deepEqual(createServerProfilePatch(snapshot),{
    telegram_id:123456789,
    username:'new_name',
    display_name:'Новое Имя',
  });
});

test('invalid Telegram ids fail explicitly instead of deriving identity from a name', () => {
  for(const user of [{},{id:0},{id:'abc'},{id:-2}]) {
    assert.throws(()=>stableTelegramIdentity(user),/telegram_user_id_required/);
  }
});

test('metadata reconciliation never blocks boot when sync fails', async () => {
  const snapshot=createProfileSnapshot({id:123456789,first_name:'Новое',last_name:'Имя'});
  const client={updateProfileMetadata:async()=>{throw new Error('network_down')}};
  const result=await reconcileProfileMetadata(snapshot,client);
  assert.equal(snapshot.displayName,'Новое Имя');
  assert.equal(result.ok,false);
  assert.match(result.error,/network_down/);
});

test('metadata reconciliation is intentionally skipped without an existing update API', async () => {
  const snapshot=createProfileSnapshot({id:123456789,first_name:'Новое'});
  assert.deepEqual(await reconcileProfileMetadata(snapshot,{}),{ok:true,skipped:true});
});
