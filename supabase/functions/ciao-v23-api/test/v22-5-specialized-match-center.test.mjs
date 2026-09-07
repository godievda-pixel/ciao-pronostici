import assert from 'node:assert/strict';
import test from 'node:test';
import { createV22CompatSpecialized } from '../services/compat-v22-5-specialized.mjs';

function dbFixture(){
  const match={
    id:10,bsd_event_id:901,kickoff_at:'2026-09-07T12:00:00.000Z',schedule_status:'scheduled',home_score:1,away_score:0,is_finished:false,
    live_status:'live',live_elapsed:63,live_updated_at:'2026-09-07T13:03:00.000Z',result_source:null,
    round:{number:2},
    home:{id:1,name:'Интер',short_name:'Интер',custom_emoji_id:'11',bsd_team_id:101},
    away:{id:2,name:'Ювентус',short_name:'Юве',custom_emoji_id:'22',bsd_team_id:102},
  };
  const predictions=[
    {user_id:7,home_score:2,away_score:1,points:null,updated_at:'2026-09-07T10:00:00.000Z'},
    {user_id:8,home_score:2,away_score:1,points:null,updated_at:'2026-09-07T10:01:00.000Z'},
    {user_id:9,home_score:0,away_score:0,points:null,updated_at:'2026-09-07T10:02:00.000Z'},
  ];
  return {
    db:{
      from(table){
        const filters=[];
        const q={
          select(){return this},
          eq(column,value){filters.push([column,value]);return this},
          maybeSingle:async()=>{
            if(table==='cp_matches')return {data:match,error:null};
            if(table==='cp_predictions'){
              const uid=filters.find(([key])=>key==='user_id')?.[1];
              return {data:predictions.find(row=>row.user_id===Number(uid))??null,error:null};
            }
            throw new Error(`unexpected_single:${table}`);
          },
          then(resolve,reject){
            if(table==='cp_predictions')return Promise.resolve({data:predictions,error:null}).then(resolve,reject);
            throw new Error(`unexpected_await:${table}`);
          },
        };
        return q;
      },
    },
  };
}

function matchServiceFixture(){
  const calls=[];
  return {
    calls,
    service:{
      async getMatchCenter(args){
        calls.push(args);
        return {match:{id:'serie_a:901'},data:{section:args.section,provider_event_id:901}};
      },
    },
  };
}

test('match summary preserves local match id, user prediction and aggregate split',async()=>{
  const fx=dbFixture();
  const service=createV22CompatSpecialized({db:fx.db});
  const out=await service.dispatch({kind:'match_summary',action:'load'},{match_id:10},{userId:7});
  assert.equal(out.ok,true);
  assert.equal(out.match.id,10);
  assert.deepEqual(out.match.prediction,{home_score:2,away_score:1,points:null,updated_at:'2026-09-07T10:00:00.000Z'});
  assert.equal(out.status,'live');
  assert.equal(out.summary_only,true);
  assert.equal(out.recommended_poll_ms,30000);
  assert.deepEqual(out.prediction_split,{total:3,home:{count:2,pct:67},draw:{count:1,pct:33},away:{count:0,pct:0}});
});

test('match center maps frozen section names to one shared Match Service using bsd_event_id',async()=>{
  const fx=dbFixture(),ms=matchServiceFixture();
  const service=createV22CompatSpecialized({db:fx.db,matchService:ms.service});
  const out=await service.dispatch({kind:'match_center',action:'load'},{match_id:10,sections:['detail','stats','incidents','lineups','player_stats','overview_meta'],include_split:false},{userId:7});
  assert.equal(out.ok,true);
  assert.equal(out.match.id,10);
  assert.equal(out.prediction_split,null);
  assert.deepEqual(ms.calls.map(x=>x.section),['overview','stats','events','lineups','players']);
  assert.equal(ms.calls.every(x=>x.competition==='serie_a'&&x.matchId==='901'),true);
  assert.deepEqual(out.detail,{section:'overview',provider_event_id:901});
  assert.deepEqual(out.stats,{section:'stats',provider_event_id:901});
  assert.deepEqual(out.incidents,{section:'events',provider_event_id:901});
  assert.deepEqual(out.lineups,{section:'lineups',provider_event_id:901});
  assert.deepEqual(out.player_stats,{section:'players',provider_event_id:901});
  assert.deepEqual(out.overview_meta,{venue:null,referee:null,form:{home:[],away:[]}});
  assert.equal(out.coverage.overview_meta,true);
  assert.equal(out.status,'live');
  assert.equal(out.recommended_poll_ms,30000);
});

test('match center can include prediction split without another backend endpoint',async()=>{
  const fx=dbFixture(),ms=matchServiceFixture();
  const service=createV22CompatSpecialized({db:fx.db,matchService:ms.service});
  const out=await service.dispatch({kind:'match_center',action:'load'},{match_id:10,sections:['detail'],include_split:true},{userId:7});
  assert.equal(out.prediction_split.total,3);
  assert.equal(out.coverage.detail,true);
});
