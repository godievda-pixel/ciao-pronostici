import test from 'node:test';
import assert from 'node:assert/strict';
import {
  API_VERSION,
  createV23Router,
  successEnvelope,
  errorEnvelope,
  serviceMetadata,
  corsHeaders,
} from '../../supabase/functions/ciao-v23-api/router.mjs';

function fixture() {
  const calls = [];
  const matchService = {
    async listMatches(payload){calls.push(['matches',payload]);return[{id:'ucl:u1'}];},
    async listCalcioToday(payload){calls.push(['calcio_today',payload]);return[];},
    async getFavoriteNextMatch(payload){calls.push(['favorite_next_match',payload]);return null;},
    async getStandings(payload){calls.push(['standings',payload]);return{rows:[]};},
    async getMatchCenter(payload){calls.push(['match_center',payload]);return{match:{id:payload.matchId},section:payload.section,data:{}};},
  };
  const predictionService = {
    async available(payload){calls.push(['predictions_available',payload]);return[];},
    async mine(payload){calls.push(['predictions_mine',payload]);return[];},
    async save(payload){calls.push(['prediction_save',payload]);return{matchId:payload.matchId};},
  };
  const rankingService = {
    async load(payload){calls.push(['ranking',payload]);return{rows:[]};},
  };
  const profileService = {
    async getBootstrap(payload){calls.push(['bootstrap',payload]);return{user:{id:payload.userId}};},
    async getProfile(userId){calls.push(['profile',userId]);return{id:userId};},
    async setFavoriteTeam(userId,teamId){calls.push(['favorite_set',userId,teamId]);return{favoriteTeamId:teamId};},
    async updateNotificationSettings(userId,patch){calls.push(['settings_update',userId,patch]);return patch;},
  };
  const router = createV23Router({matchService,predictionService,rankingService,profileService});
  return {router,calls};
}

const context = {userId:7,tgUser:{id:446763142,first_name:'Даниил'}};

test('standalone router exposes the approved action set and routes validated payloads', async () => {
  const {router,calls} = fixture();
  assert.deepEqual(router.actions, [
    'bootstrap','matches','calcio_today','favorite_next_match','standings','match_center',
    'predictions_available','predictions_mine','prediction_save','ranking','profile','favorite_set','settings_update',
  ]);

  await router.dispatch('bootstrap',{},context);
  await router.dispatch('matches',{competition:'ucl',from:'2026-09-01',to:'2026-10-01'},context);
  await router.dispatch('match_center',{competition:'ucl',match_id:'ucl:u1',section:'stats'},context);
  await router.dispatch('prediction_save',{competition:'ucl',match_id:'ucl:u1',home:2,away:1},context);
  await router.dispatch('ranking',{scope:'europe'},context);
  await router.dispatch('favorite_set',{team_id:12},context);
  await router.dispatch('settings_update',{lineupNotifications:true},context);

  assert.deepEqual(calls[0], ['bootstrap',{userId:7,tgUser:context.tgUser}]);
  assert.deepEqual(calls[1], ['matches',{competition:'ucl',from:'2026-09-01',to:'2026-10-01'}]);
  assert.deepEqual(calls[2], ['match_center',{competition:'ucl',matchId:'ucl:u1',section:'stats'}]);
  assert.deepEqual(calls[3], ['prediction_save',{userId:7,competition:'ucl',matchId:'ucl:u1',home:2,away:1,nowMs:undefined}]);
  assert.deepEqual(calls[4], ['ranking',{scope:'europe',currentUserId:7}]);
  assert.deepEqual(calls[5], ['favorite_set',7,12]);
  assert.deepEqual(calls[6], ['settings_update',7,{lineupNotifications:true}]);
});

test('router rejects unknown actions and invalid required values with HTTP 400 semantics', async () => {
  const {router} = fixture();
  const bad = [
    ['unknown',{}],
    ['matches',{}],
    ['matches',{competition:'premier_league'}],
    ['match_center',{competition:'ucl',match_id:'ucl:u1',section:'context'}],
    ['match_center',{competition:'ucl',section:'overview'}],
    ['ranking',{scope:'world'}],
    ['prediction_save',{competition:'ucl',match_id:'ucl:u1',home:-1,away:0}],
    ['prediction_save',{competition:'ucl',match_id:'ucl:u1',home:1.5,away:0}],
    ['favorite_set',{}],
    ['settings_update',{}],
    ['calcio_today',{local_date_start_utc:'not-a-date',local_date_end_utc:'2026-09-07T00:00:00Z'}],
  ];
  for (const [action,payload] of bad) {
    await assert.rejects(
      () => router.dispatch(action,payload,context),
      error => Number(error?.status) === 400 && typeof error?.message === 'string',
      `${action} should fail with 400`,
    );
  }
});

test('Match Center accepts exactly the five approved section names', async () => {
  const {router,calls} = fixture();
  for (const section of ['overview','stats','events','lineups','players']) {
    await router.dispatch('match_center',{competition:'serie_a',match_id:'serie_a:1',section},context);
  }
  assert.deepEqual(calls.map(call => call[1]?.section), ['overview','stats','events','lineups','players']);
});

test('canonical success/error envelopes use API v23 metadata and Russian known-error messages', () => {
  assert.equal(API_VERSION, 23);
  assert.deepEqual(successEnvelope({value:true}, Date.parse('2026-09-06T18:00:00Z')), {
    ok:true,
    data:{value:true},
    meta:{serverTime:'2026-09-06T18:00:00.000Z',apiVersion:23},
  });
  assert.deepEqual(errorEnvelope(Object.assign(new Error('prediction_closed'),{status:409})), {
    ok:false,
    error:{code:'prediction_closed',message:'Прогноз уже закрыт'},
  });
});

test('runtime metadata comes from CIAO_ENVIRONMENT instead of a hardcoded TEST label', () => {
  assert.deepEqual(serviceMetadata({CIAO_ENVIRONMENT:'v23-test'}), {
    ok:true,service:'Ciao v23 API',version:23,environment:'v23-test',
  });
  assert.equal(serviceMetadata({CIAO_ENVIRONMENT:'production'}).environment, 'production');
});

test('CORS reflects only configured allowed origins and an empty allowlist fails closed', () => {
  const value = 'https://ciao-web-v23-test.ciao-web.workers.dev, https://godievda-pixel.github.io';
  const allowed = corsHeaders('https://ciao-web-v23-test.ciao-web.workers.dev',value);
  assert.equal(allowed.get('access-control-allow-origin'),'https://ciao-web-v23-test.ciao-web.workers.dev');
  assert.equal(allowed.get('vary'),'Origin');

  const denied = corsHeaders('https://evil.example',value);
  assert.equal(denied.has('access-control-allow-origin'),false);

  const empty = corsHeaders('https://ciao-web-v23-test.ciao-web.workers.dev','');
  assert.equal(empty.has('access-control-allow-origin'),false);
});
