import test from 'node:test';
import assert from 'node:assert/strict';
import { createPredictionService } from '../src/v23.3/prediction-service.mjs';

function namespace(handler) {
  const names=[]; const requests=[];
  return {
    names, requests,
    idFromName(name){names.push(name); return `id:${name}`;},
    get(){return {fetch:async req=>{requests.push(req); return handler(req);}};},
  };
}
function baseEnv(ns){return {CIAO_ENV:'test',PREDICTION_SEASON:'2026-27',PREDICTION_LEAGUE:ns};}
function authUser(){return {userId:'telegram:42',displayName:'Daniil',username:'ciao42'};}
function match(id='ucl:1', extra={}){return {matchId:id,competition:id.split(':')[0],season:'2026/27',kickoffAt:'2026-09-16T19:00:00Z',status:'scheduled',homeScore:null,awayScore:null,rawVersion:'v1',...extra};}

const request=new Request('https://ciao-web-app-test.example/api/v23.3/predictions',{headers:{'x-telegram-init-data':'tg'}});

test('save validates canonical rows and writes active season object once', async()=>{
  const ns=namespace(async()=>Response.json({ok:true,predictions:[{prediction_id:'p1',match_id:'ucl:1'}]}));
  const service=createPredictionService({request,env:baseEnv(ns),now:new Date('2026-09-16T18:00:00Z'),deps:{
    resolveAuthenticatedUser:async()=>authUser(),
    resolveCanonicalPredictionMatch:async({matchId})=>match(matchId),
  }});
  const rows=await service.save({competitionKey:'ucl',predictions:[{match_id:'ucl:1',home_score:2,away_score:1}]});
  assert.equal(ns.names[0],'prediction-league:test:2026-27');
  assert.equal(ns.names.length,1);
  assert.equal(rows[0].prediction_id,'p1');
  const write=ns.requests[0];
  assert.equal(new URL(write.url).pathname,'/write');
  const body=JSON.parse(await write.text());
  assert.deepEqual(body.participant,{user_id:'telegram:42',display_name:'Daniil',username:'ciao42'});
  assert.equal(body.predictions[0].locked_at,'2026-09-16T18:45:00.000Z');
});

test('batch validation is atomic: locked row causes zero Durable Object calls', async()=>{
  const ns=namespace(async()=>Response.json({ok:true}));
  const service=createPredictionService({request,env:baseEnv(ns),now:new Date('2026-09-16T18:50:00Z'),deps:{
    resolveAuthenticatedUser:async()=>authUser(),
    resolveCanonicalPredictionMatch:async({matchId})=>match(matchId),
  }});
  await assert.rejects(
    service.save({competitionKey:'ucl',predictions:[{match_id:'ucl:1',home_score:1,away_score:0}]}),
    e=>e.code==='prediction_locked'&&e.status===409,
  );
  assert.equal(ns.requests.length,0);
});

test('list requests only authenticated user rows from active object', async()=>{
  const ns=namespace(async()=>Response.json({ok:true,predictions:[{prediction_id:'p1',user_id:'telegram:42'}]}));
  const service=createPredictionService({request,env:baseEnv(ns),deps:{resolveAuthenticatedUser:async()=>authUser()}});
  const rows=await service.list('ucl');
  assert.equal(rows.length,1);
  const url=new URL(ns.requests[0].url);
  assert.equal(url.pathname,'/user');
  assert.equal(url.searchParams.get('user_id'),'telegram:42');
  assert.equal(url.searchParams.get('competition'),'ucl');
});

test('available all joins canonical matches with authenticated stored prediction and server state', async()=>{
  const ns=namespace(async req=>{
    if(new URL(req.url).pathname==='/user') return Response.json({ok:true,predictions:[{prediction_id:'p1',match_id:'ucl:1',predicted_home:2,predicted_away:1}]});
    throw new Error('unexpected');
  });
  const service=createPredictionService({request,env:baseEnv(ns),now:new Date('2026-09-16T18:00:00Z'),deps:{
    resolveAuthenticatedUser:async()=>authUser(),
    listCanonicalPredictionMatches:async()=>({matches:[match('ucl:1'),match('uel:2',{kickoffAt:'2026-09-16T20:00:00Z'})],errors:{}}),
  }});
  const result=await service.available('all');
  assert.equal(result.matches.length,2);
  assert.equal(result.matches[0].state,'open');
  assert.equal(result.matches[0].prediction.prediction_id,'p1');
  assert.equal(result.matches[1].prediction,null);
});

test('rankings register the authenticated participant before reconciliation and ranking read', async()=>{
  const order=[];
  const ns=namespace(async req=>{
    const path=new URL(req.url).pathname; order.push(path);
    if(path==='/participants') {
      const body=JSON.parse(await req.text());
      assert.deepEqual(body,{season:'2026-27',participants:[{user_id:'telegram:42',display_name:'Daniil',username:'ciao42'}]});
      return Response.json({ok:true,participants:body.participants});
    }
    if(path==='/reconcile') return Response.json({ok:true,affected:1,skipped:0});
    if(path==='/rankings') return Response.json({ok:true,ranking:[{user_id:'telegram:42',display_name:'Daniil',points:5}]});
    throw new Error(path);
  });
  const service=createPredictionService({request,env:baseEnv(ns),deps:{
    resolveAuthenticatedUser:async()=>authUser(),
    listCanonicalPredictionMatches:async()=>({matches:[match('ucl:1',{status:'finished',homeScore:2,awayScore:1})],errors:{}}),
  }});
  const rows=await service.rankings({scope:'overall'});
  assert.deepEqual(order,['/participants','/reconcile','/rankings']);
  assert.equal(rows[0].display_name,'Daniil');
  assert.equal(rows[0].points,5);
});

test('rankingMe registers the current user so a zero-point participant still has a ranking card', async()=>{
  const order=[];
  const ns=namespace(async req=>{
    const path=new URL(req.url).pathname; order.push(path);
    if(path==='/participants') return Response.json({ok:true,participants:[{user_id:'telegram:42',display_name:'Daniil',username:'ciao42'}]});
    if(path==='/rankings/me') return Response.json({ok:true,ranking:{position:1,user_id:'telegram:42',display_name:'Daniil',points:0}});
    throw new Error(path);
  });
  const service=createPredictionService({request,env:baseEnv(ns),deps:{
    resolveAuthenticatedUser:async()=>authUser(),
    listCanonicalPredictionMatches:async()=>({matches:[],errors:{}}),
  }});
  assert.deepEqual(await service.rankingMe(), {position:1,user_id:'telegram:42',display_name:'Daniil',points:0});
  assert.deepEqual(order,['/participants','/rankings/me']);
});

test('Durable Object failures map to prediction_backend_unavailable', async()=>{
  const ns=namespace(async()=>new Response('nope',{status:500}));
  const service=createPredictionService({request,env:baseEnv(ns),deps:{resolveAuthenticatedUser:async()=>authUser()}});
  await assert.rejects(service.list('all'),e=>e.code==='prediction_backend_unavailable'&&e.status===503);
});
