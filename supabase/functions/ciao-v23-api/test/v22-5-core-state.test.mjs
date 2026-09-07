import assert from 'node:assert/strict';
import test from 'node:test';
import { createV22CompatCore } from '../services/compat-v22-5-core.mjs';

test('legacy state keeps the stable v22.5 response shape', async () => {
  const core = createV22CompatCore({
    loaders:{
      user:async () => ({id:7,telegramId:1001,displayName:'Новое Имя',username:'new_name',favoriteTeamId:2,settings:{deadlineReminders:true}}),
      teams:async () => [{id:2,name:'Интер',short_name:'Интер',custom_emoji_id:'123'}],
      rounds:async () => [{id:1,number:1,nominal_date:'2026-08-22',unlocked:true,complete:false,total:10,finished:0}],
      round:async () => ({round:{id:1,number:1,nominal_date:'2026-08-22'},matches:[]}),
      standings:async () => [{id:7,display_name:'Новое Имя',points:0,favorite_team:null}],
      serieATable:async () => ({rows:[],zones:[],updated_at:null,stale:false}),
      stats:async () => ({points:0,exact:0,successful:0,calculated:0,rank:1}),
      notifications:async () => ({deadline:true,lineup:false,kickoff:false,result:false}),
      hasLive:async () => false,
    },
  });
  const result = await core.state({userId:7,tgUser:{id:1001,photo_url:'https://example.test/a.jpg'},round:1});
  assert.equal(result.ok,true);
  assert.equal(result.user.telegram_id,1001);
  assert.equal(result.user.display_name,'Новое Имя');
  assert.equal(result.user.username,'new_name');
  assert.equal(result.user.photo_url,'https://example.test/a.jpg');
  assert.equal(result.user.favorite_team?.name,'Интер');
  assert.equal(result.selected_round,1);
  assert.equal(result.deadline_minutes,15);
  assert.equal(result.user.notifications.deadline,true);
  assert.deepEqual(result.round.matches,[]);
});

test('legacy state uses userId/Telegram ID identity and does not key by mutable username', async () => {
  let seenUserId = null;
  const core = createV22CompatCore({
    loaders:{
      user:async id => { seenUserId=id; return {id,telegramId:555,displayName:'Совсем другое имя',username:null,favoriteTeamId:null,settings:{deadlineReminders:true}}; },
      teams:async()=>[], rounds:async()=>[{id:1,number:1,unlocked:true,complete:false,total:1,finished:0}],
      round:async()=>({round:{id:1,number:1},matches:[]}), standings:async()=>[], serieATable:async()=>({rows:[]}),
      stats:async()=>({points:0,exact:0,successful:0,calculated:0,rank:1}), notifications:async()=>({deadline:true,lineup:false,kickoff:false,result:false}), hasLive:async()=>false,
    },
  });
  const result = await core.state({userId:42,tgUser:{id:555,first_name:'Новое'}});
  assert.equal(seenUserId,42);
  assert.equal(result.user.telegram_id,555);
});
