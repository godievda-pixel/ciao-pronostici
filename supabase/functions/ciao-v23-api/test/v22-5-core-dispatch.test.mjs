import assert from 'node:assert/strict';
import test from 'node:test';
import { createV22CompatDispatcher } from '../compat-v22-5-dispatcher.mjs';

function fixture() {
  const calls=[];
  const dispatcher=createV22CompatDispatcher({
    core:{
      state:async input => { calls.push(['state',input]); return {ok:true,kind:'state'}; },
      serieATable:async input => { calls.push(['serie_a_table',input]); return {ok:true,kind:'table'}; },
      savePredictions:async input => { calls.push(['save_predictions',input]); return {ok:true,saved:1}; },
      toggleReminders:async input => { calls.push(['toggle_reminders',input]); return {ok:true,enabled:true}; },
      setFavoriteTeam:async input => { calls.push(['set_favorite_team',input]); return {ok:true,favorite_team_id:2}; },
      standingsScope:async input => { calls.push(['standings_scope',input]); return {ok:true,standings:[]}; },
      publicPredictor:async input => { calls.push(['public_predictor',input]); return {ok:true,predictor:{}}; },
      setNotificationPreferences:async input => { calls.push(['set_notification_preferences',input]); return {ok:true,notifications:{}}; },
      predictionRules:async input => { calls.push(['prediction_rules',input]); return {ok:true,rules:{}}; },
      clientEvent:async input => { calls.push(['client_event',input]); return {ok:true}; },
    },
    specialized:{dispatch:async () => ({ok:true})},
  });
  return {dispatcher,calls};
}

test('legacy core actions dispatch to one compatibility core service', async () => {
  const {dispatcher,calls}=fixture();
  const context={userId:7,tgUser:{id:1001}};
  await dispatcher.dispatch('ciao-core-api-fast-v6',{action:'state',round:3},context);
  await dispatcher.dispatch('ciao-core-api-fast-v4',{action:'save_predictions',round:3,predictions:[]},context);
  await dispatcher.dispatch('ciao-core-api-fast',{action:'toggle_reminders',enabled:true},context);
  await dispatcher.dispatch('ciao-core-api-fast-v5',{action:'set_favorite_team',team_id:2},context);
  assert.deepEqual(calls.map(x=>x[0]),['state','save_predictions','toggle_reminders','set_favorite_team']);
  assert.equal(calls[0][1].userId,7);
  assert.equal(calls[0][1].tgUser.id,1001);
});

test('removed x2 action fails deterministically without touching a backend proxy', async () => {
  const {dispatcher}=fixture();
  await assert.rejects(
    dispatcher.dispatch('ciao-core-api-fast-v6',{action:'set_round_bonus'}, {userId:7,tgUser:{id:1001}}),
    error => error?.message==='bonus_removed' && error?.status===410,
  );
});

test('unknown legacy core action fails closed', async () => {
  const {dispatcher}=fixture();
  await assert.rejects(
    dispatcher.dispatch('ciao-core-api-fast-v6',{action:'definitely_unknown'}, {userId:7,tgUser:{id:1001}}),
    /unknown_legacy_action:definitely_unknown/,
  );
});
