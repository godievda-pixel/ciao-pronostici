import assert from 'node:assert/strict';
import test from 'node:test';
import { createV22CompatCore } from '../services/compat-v22-5-core.mjs';

function baseLoaders(overrides={}){
  return {
    user:async id=>({id,telegramId:1001,displayName:'Daniil',username:'dan',favoriteTeamId:null}),
    teams:async()=>[],rounds:async()=>[{id:1,number:1,unlocked:true}],
    round:async()=>({round:{id:1,number:1},matches:[]}),standings:async()=>[],serieATable:async()=>({rows:[]}),
    stats:async()=>({points:0,exact:0,successful:0,calculated:0,rank:1}),
    notifications:async()=>({deadline:true,lineup:false,kickoff:false,result:false}),hasLive:async()=>false,
    ...overrides,
  };
}

test('core legacy actions delegate writes by stable user id and preserve old response shapes', async()=>{
  const calls=[];
  const core=createV22CompatCore({
    loaders:baseLoaders({
      standingsScope:async input=>({rows:[{id:7,display_name:'Daniil',points:9}],meta:{scope:input.scope}}),
      publicPredictor:async input=>({id:input.predictorId,display_name:'Другой',overall:{points:4}}),
    }),
    writers:{
      savePredictions:async input=>{calls.push(['save',input]);return {saved:2,closed:[12]};},
      toggleReminders:async input=>{calls.push(['reminders',input]);return input.enabled;},
      setFavoriteTeam:async input=>{calls.push(['favorite',input]);return {id:2,name:'Интер',short_name:'Интер',custom_emoji_id:'123'};},
      setNotificationPreferences:async input=>{calls.push(['notifications',input]);return {deadline:false,lineup:true,kickoff:false,result:true};},
      clientEvent:async input=>{calls.push(['event',input]);},
    },
  });
  assert.deepEqual(await core.savePredictions({userId:7,round:1,predictions:[{match_id:10,home_score:1,away_score:0}]}),{ok:true,saved:2,closed:[12],deadline_minutes:15});
  assert.deepEqual(await core.toggleReminders({userId:7,enabled:false}),{ok:true,enabled:false});
  assert.deepEqual(await core.setFavoriteTeam({userId:7,team_id:2}),{ok:true,favorite_team_id:2,favorite_team:{id:2,name:'Интер',short_name:'Интер',custom_emoji_id:'123'}});
  const scope=await core.standingsScope({userId:7,scope:'overall',current_round:1});
  assert.equal(scope.ok,true); assert.equal(scope.standings[0].points,9); assert.equal(scope.standings_meta.scope,'overall');
  const predictor=await core.publicPredictor({userId:7,user_id:9});
  assert.equal(predictor.ok,true); assert.equal(predictor.predictor.id,9);
  const prefs=await core.setNotificationPreferences({userId:7,preferences:{deadline:false,lineup:true,result:true}});
  assert.deepEqual(prefs,{ok:true,notifications:{deadline:false,lineup:true,kickoff:false,result:true}});
  assert.deepEqual(await core.predictionRules({userId:7}),{ok:true,rules:{exact_score:5,correct_goal_difference:3,correct_outcome:2,miss:0,deadline_minutes:15,bonus_multiplier:1,bonus_per_round:0,bonus_enabled:false}});
  assert.deepEqual(await core.clientEvent({userId:7,event_type:'api_error',screen:'predict',build:'22.5',meta:{endpoint:'state'}}),{ok:true});
  assert.deepEqual(calls.map(x=>x[0]),['save','reminders','favorite','notifications','event']);
  assert.equal(calls[0][1].userId,7);
});

test('favorite team can be cleared and mutable username is never a write key', async()=>{
  let input=null;
  const core=createV22CompatCore({loaders:baseLoaders(),writers:{setFavoriteTeam:async value=>{input=value;return null;}}});
  const result=await core.setFavoriteTeam({userId:42,team_id:null,username:'changed-name'});
  assert.deepEqual(result,{ok:true,favorite_team_id:null,favorite_team:null});
  assert.equal(input.userId,42);
  assert.equal(Object.hasOwn(input,'username'),false);
});
