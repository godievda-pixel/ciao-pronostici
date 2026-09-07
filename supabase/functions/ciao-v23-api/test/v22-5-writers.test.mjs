import assert from 'node:assert/strict';
import test from 'node:test';
import { createV22CompatWriters } from '../services/compat-v22-5-writers.mjs';

function dbFixture({round={id:3,number:1},matches=[],team=null}={}){
  const writes=[];
  return {
    writes,
    db:{
      from(table){
        if(table==='cp_rounds')return {select(){return this},eq(){return this},maybeSingle:async()=>({data:round,error:null})};
        if(table==='cp_matches')return {select(){return this},eq(){return Promise.resolve({data:matches,error:null})}};
        if(table==='cp_predictions')return {upsert:async(rows,options)=>{writes.push({table,rows,options});return {data:null,error:null}}};
        if(table==='cp_teams')return {select(){return this},eq(){return this},maybeSingle:async()=>({data:team,error:null})};
        if(table==='cp_users')return {
          update(patch){writes.push({table,patch});return this},
          eq(column,value){writes.at(-1).where=[column,value];return this},
          select(){return this},
          single:async()=>({data:{id:7,...writes.at(-1)?.patch},error:null}),
        };
        throw new Error(`unexpected_table:${table}`);
      },
    },
  };
}

test('save predictions writes only cp_predictions and rejects closed matches',async()=>{
  const kickoffOpen='2026-09-08T12:00:00.000Z';
  const kickoffClosed='2026-09-07T10:10:00.000Z';
  const fx=dbFixture({matches:[
    {id:10,kickoff_at:kickoffOpen,is_finished:false},
    {id:11,kickoff_at:kickoffClosed,is_finished:false},
  ]});
  const writers=createV22CompatWriters({db:fx.db,now:()=>Date.parse('2026-09-07T10:00:00.000Z')});
  const result=await writers.savePredictions({userId:7,round:1,predictions:[
    {match_id:10,home_score:2,away_score:1},
    {match_id:11,home_score:1,away_score:0},
  ]});
  assert.deepEqual(result,{saved:1,closed:[11]});
  assert.equal(fx.writes.length,1);
  assert.equal(fx.writes[0].table,'cp_predictions');
  assert.equal(fx.writes[0].rows[0].user_id,7);
  assert.equal(fx.writes[0].rows[0].match_id,10);
  assert.equal(fx.writes[0].rows[0].home_score,2);
  assert.equal(fx.writes[0].options.onConflict,'user_id,match_id');
});

test('settings and favorite updates use internal user id, never username',async()=>{
  const fx=dbFixture({team:{id:2,name:'Интер',short_name:'Интер',custom_emoji_id:'123',bsd_team_id:10}});
  const writers=createV22CompatWriters({db:fx.db});
  const favorite=await writers.setFavoriteTeam({userId:7,teamId:2});
  assert.equal(favorite.name,'Интер');
  await writers.toggleReminders({userId:7,enabled:false});
  await writers.setNotificationPreferences({userId:7,preferences:{deadline:true,lineup:true,kickoff:false,result:true}});
  const userWrites=fx.writes.filter(x=>x.table==='cp_users');
  assert.deepEqual(userWrites.map(x=>x.where),[['id',7],['id',7],['id',7]]);
  assert.equal(userWrites.some(x=>Object.hasOwn(x.patch,'username')),false);
});

test('favorite can be cleared without a team lookup',async()=>{
  const fx=dbFixture();
  const writers=createV22CompatWriters({db:fx.db});
  assert.equal(await writers.setFavoriteTeam({userId:7,teamId:null}),null);
  assert.deepEqual(fx.writes[0].patch.favorite_team_id,null);
});
