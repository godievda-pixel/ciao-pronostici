import assert from 'node:assert/strict';
import test from 'node:test';
import { createV22CompatSpecialized } from '../services/compat-v22-5-specialized.mjs';

function calendarDb(){
  const rounds=[{id:1,number:1,nominal_date:'2026-09-01'},{id:2,number:2,nominal_date:'2026-09-08'}];
  const countMatches=[{id:10,round_id:1,is_finished:true},{id:11,round_id:2,is_finished:false}];
  const clubMatches=[
    {id:10,kickoff_at:'2026-09-01T18:00:00Z',home_score:2,away_score:0,is_finished:true,live_status:'finished',live_elapsed:90,round:{number:1},home:{id:1,name:'Интер',short_name:'Интер',custom_emoji_id:'11'},away:{id:2,name:'Ювентус',short_name:'Юве',custom_emoji_id:'22'}},
    {id:11,kickoff_at:'2026-09-08T18:00:00Z',home_score:null,away_score:null,is_finished:false,live_status:null,live_elapsed:null,round:{number:2},home:{id:3,name:'Милан',short_name:'Милан',custom_emoji_id:'33'},away:{id:1,name:'Интер',short_name:'Интер',custom_emoji_id:'11'}},
  ];
  let matchSelects=0;
  return {
    from(table){
      if(table==='cp_rounds')return {select(){return this},order(){return Promise.resolve({data:rounds,error:null})}};
      if(table==='cp_matches'){
        matchSelects++;
        const rich=matchSelects===2;
        const data=rich?clubMatches:countMatches;
        return {
          select(){return this},or(){return this},order(){return this},
          then(resolve,reject){return Promise.resolve({data,error:null}).then(resolve,reject)},
        };
      }
      throw new Error(`unexpected_table:${table}`);
    },
  };
}

function insightsDb({kickoff='2026-09-07T12:00:00Z',finished=false,liveStatus=null}={}){
  const predictions=[
    {user_id:7,home_score:2,away_score:1},
    {user_id:8,home_score:2,away_score:1},
    {user_id:9,home_score:1,away_score:1},
  ];
  return {
    from(table){
      if(table==='cp_matches')return {select(){return this},eq(){return this},maybeSingle:async()=>({data:{id:10,kickoff_at:kickoff,is_finished:finished,live_status:liveStatus},error:null})};
      if(table==='cp_predictions')return {select(){return this},eq(){return this},then(resolve,reject){return Promise.resolve({data:predictions,error:null}).then(resolve,reject)}};
      throw new Error(`unexpected_table:${table}`);
    },
  };
}

test('club calendar preserves all/recent/upcoming/rounds frozen shape',async()=>{
  const service=createV22CompatSpecialized({db:calendarDb()});
  const out=await service.dispatch({kind:'club_calendar',action:'load'},{team_id:1},{userId:7});
  assert.equal(out.ok,true);
  assert.equal(out.matches.all.length,2);
  assert.equal(out.matches.recent[0].match_id,10);
  assert.equal(out.matches.upcoming[0].match_id,11);
  assert.equal(out.matches.current_round,2);
  assert.deepEqual(out.matches.rounds[0],{number:1,nominal_date:'2026-09-01',total:1,finished:1,is_complete:true});
});

test('prediction insights stay hidden before the minus-15-minute deadline',async()=>{
  const service=createV22CompatSpecialized({db:insightsDb(),now:()=>Date.parse('2026-09-07T11:30:00Z')});
  const out=await service.dispatch({kind:'prediction_insights',action:'load'},{match_id:10},{userId:7});
  assert.deepEqual(out,{ok:true,revealed:false,total:0,top_scores:[],same_count:0,same_pct:0});
});

test('prediction insights reveal only aggregate scores at deadline and identify same prediction count',async()=>{
  const service=createV22CompatSpecialized({db:insightsDb(),now:()=>Date.parse('2026-09-07T11:45:00Z')});
  const out=await service.dispatch({kind:'prediction_insights',action:'load'},{match_id:10},{userId:7});
  assert.equal(out.ok,true);
  assert.equal(out.revealed,true);
  assert.equal(out.total,3);
  assert.deepEqual(out.top_scores[0],{score:'2:1',count:2,pct:67});
  assert.equal(out.same_count,2);
  assert.equal(out.same_pct,67);
  assert.equal(JSON.stringify(out).includes('user_id'),false);
});
