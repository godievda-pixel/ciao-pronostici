import assert from 'node:assert/strict';
import test from 'node:test';
import { createV22CompatSpecialized } from '../services/compat-v22-5-specialized.mjs';

function thenable(data){
  return {then(resolve,reject){return Promise.resolve({data,error:null}).then(resolve,reject)}};
}

function dbFixture(){
  const rounds=[
    {id:1,number:1,nominal_date:'2026-09-01'},
    {id:2,number:2,nominal_date:'2026-09-08'},
  ];
  const matches=[
    {id:10,round_id:1,kickoff_at:'2026-09-07T09:00:00.000Z',home_score:2,away_score:1,is_finished:true,live_status:'finished',live_phase:null,live_elapsed:90,live_updated_at:'2026-09-07T10:50:00.000Z',home:{id:1,name:'Интер',short_name:'Интер',custom_emoji_id:'11'},away:{id:2,name:'Ювентус',short_name:'Юве',custom_emoji_id:'22'}},
    {id:11,round_id:2,kickoff_at:'2026-09-07T12:00:00.000Z',home_score:1,away_score:0,is_finished:false,live_status:'live',live_phase:'second_half',live_elapsed:63,live_updated_at:'2026-09-07T13:03:00.000Z',home:{id:3,name:'Милан',short_name:'Милан',custom_emoji_id:'33'},away:{id:4,name:'Рома',short_name:'Рома',custom_emoji_id:'44'}},
  ];
  const calls=[];
  const db={
    from(table){
      calls.push(table);
      if(table==='cp_rounds')return {select(){return this},order(){return thenable(rounds)}};
      if(table==='cp_matches'){
        const q={
          select(){return this},
          order(){return this},
          gte(){return this},
          lte(){return thenable(matches)},
          then(resolve,reject){return Promise.resolve({data:matches,error:null}).then(resolve,reject)},
        };
        return q;
      }
      throw new Error(`unexpected_table:${table}`);
    },
  };
  return {db,calls};
}

test('schedule preserves frozen v22.5 rounds/current_round shape from TEST tables',async()=>{
  const fx=dbFixture();
  const service=createV22CompatSpecialized({db:fx.db,now:()=>Date.parse('2026-09-07T12:30:00.000Z')});
  const out=await service.dispatch({kind:'schedule',action:'load'},{},{userId:7});
  assert.equal(out.ok,true);
  assert.equal(out.current_round,2);
  assert.equal(out.rounds.length,2);
  assert.deepEqual(out.rounds[0],{
    number:1,nominal_date:'2026-09-01',total:1,finished:1,is_complete:true,
    matches:[{
      id:10,round_number:1,kickoff_at:'2026-09-07T09:00:00.000Z',home_score:2,away_score:1,is_finished:true,live_status:'finished',live_elapsed:90,
      home:{id:1,name:'Интер',short_name:'Интер',custom_emoji_id:'11'},away:{id:2,name:'Ювентус',short_name:'Юве',custom_emoji_id:'22'},
    }],
  });
  assert.equal(fx.calls.every(t=>['cp_rounds','cp_matches'].includes(t)),true);
});

test('live_updates keeps old open flag and live polling contract',async()=>{
  const fx=dbFixture();
  const service=createV22CompatSpecialized({db:fx.db,now:()=>Date.parse('2026-09-07T12:30:00.000Z')});
  const out=await service.dispatch({kind:'live_updates',action:'live_updates'},{action:'live_updates'},{userId:7});
  assert.equal(out.ok,true);
  assert.equal(out.has_live,true);
  assert.equal(out.recommended_poll_ms,30000);
  assert.equal(out.cache_ttl_ms,5000);
  const live=out.matches.find(x=>x.id===11);
  assert.equal(live.open,false);
  assert.equal(live.live_elapsed,63);
});

test('live_snapshot keeps phase and deterministic scheduler contract',async()=>{
  const fx=dbFixture();
  const service=createV22CompatSpecialized({db:fx.db,now:()=>Date.parse('2026-09-07T12:30:00.000Z')});
  const out=await service.dispatch({kind:'live_snapshot',action:'load'},{},{userId:7});
  assert.equal(out.ok,true);
  assert.equal(out.has_live,true);
  assert.equal(out.recommended_poll_ms,10000);
  const live=out.matches.find(x=>x.id===11);
  assert.equal(live.live_phase,'second_half');
  assert.equal(Object.hasOwn(live,'home'),false);
});
