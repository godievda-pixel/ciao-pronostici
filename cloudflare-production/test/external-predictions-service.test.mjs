import test from 'node:test';
import assert from 'node:assert/strict';
import { createExternalPredictionService } from '../../supabase/functions/ciao-external-predictions/service.mjs';
import { scorePrediction, toExternalMatchRow } from '../../supabase/functions/ciao-external-predictions/domain.mjs';

const RULES={exact_score:5,correct_goal_difference:3,correct_outcome:2,miss:0};
const at='2026-09-15T18:00:00Z';
const canonical=(id,patch={})=>({
  competition:'ucl',sourceId:String(id),matchId:`ucl:${id}`,stageKey:'league-1',stageLabel:'Общий этап · 1 тур',stageOrder:101,round:1,
  kickoffAt:'2026-09-15T19:00:00Z',status:'scheduled',minute:null,
  homeTeam:{id:'77',name:'Интер',countryCode:'ITA',crestUrl:'h'},awayTeam:{id:'1',name:'Ливерпуль',countryCode:'ENG',crestUrl:'a'},
  homeScore:null,awayScore:null,...patch,
});

class Repo{
  constructor(){this.enabled=true;this.matches=[];this.predictions=[];this.nextId=1;this.changedSettlements=0}
  async featureEnabled(){return this.enabled}
  async upsertMatches(ms){for(const m of ms){const row=toExternalMatchRow(m,'2026-09-15T18:00:00.000Z');let old=this.matches.find(x=>x.competition===row.competition&&x.provider_event_id===row.provider_event_id);if(old)Object.assign(old,row);else this.matches.push({...row,id:this.nextId++,result_signature:null,finalized_at:null})}return this.matches}
  async listMatches(c){return this.matches.filter(x=>x.competition===c).map(x=>({...x}))}
  async findMatchesByCanonicalIds(ids){const set=new Set(ids);return this.matches.filter(x=>set.has(`${x.competition}:${x.provider_event_id}`)).map(x=>({...x}))}
  async listUserPredictions(uid,ids){const set=new Set(ids);return this.predictions.filter(x=>x.user_id===uid&&set.has(x.external_match_id)).map(x=>({...x}))}
  async upsertUserPredictions(rows){for(const r of rows){let old=this.predictions.find(x=>x.user_id===r.user_id&&x.external_match_id===r.external_match_id);if(old)Object.assign(old,r);else this.predictions.push({...r,id:this.predictions.length+1,points:null,base_points:null})}return rows.length}
  async scoringRules(){return RULES}
  async settleFinishedMatch(id,sig,result,rules){const m=this.matches.find(x=>x.id===id);if(!m||m.result_signature===sig)return {changed:false};for(const p of this.predictions.filter(x=>x.external_match_id===id)){const pts=scorePrediction({homeScore:p.home_score,awayScore:p.away_score},result,rules);p.base_points=pts;p.points=pts;p.calculated_at='now'}m.result_signature=sig;m.finalized_at='now';this.changedSettlements++;return {changed:true}}
  async cronToken(){return 'token'}
}

test('state syncs, settles finished match, attaches current user prediction and server open state',async()=>{
  const repo=new Repo();repo.predictions.push({id:1,user_id:7,external_match_id:1,home_score:2,away_score:1,points:null,base_points:null});
  const provider=async()=>[canonical(10,{status:'finished',homeScore:2,awayScore:1})];
  const service=createExternalPredictionService({repository:repo,fetchMatches:provider,now:()=>Date.parse(at)});
  const s=await service.state({userId:7,competition:'ucl',initData:'x'});
  assert.equal(s.stale,false);assert.equal(s.matches.length,1);assert.equal(s.matches[0].open,false);assert.equal(s.matches[0].prediction.home_score,2);assert.equal(s.matches[0].prediction.points,5);
});

test('state falls back to last good snapshot when provider refresh fails',async()=>{
  const repo=new Repo();await repo.upsertMatches([canonical(11)]);
  const service=createExternalPredictionService({repository:repo,fetchMatches:async()=>{throw new Error('down')},now:()=>Date.parse(at)});
  const s=await service.state({userId:7,competition:'ucl',initData:'x'});
  assert.equal(s.stale,true);assert.equal(s.matches[0].matchId,'ucl:11');
});

test('save accepts open rows and closes only rows past deadline',async()=>{
  const repo=new Repo();const provider=async()=>[canonical(1),canonical(2),canonical(3,{kickoffAt:'2026-09-15T18:10:00Z'})];
  const service=createExternalPredictionService({repository:repo,fetchMatches:provider,now:()=>Date.parse(at)});
  const r=await service.savePredictions({userId:7,competition:'ucl',initData:'x',predictions:[{match_id:'ucl:1',home_score:1,away_score:0},{match_id:'ucl:2',home_score:2,away_score:2},{match_id:'ucl:3',home_score:0,away_score:1}]});
  assert.equal(r.saved,2);assert.deepEqual(r.closed,['ucl:3']);assert.equal(repo.predictions.length,2);
});

test('unknown and cross-competition IDs cannot be inserted',async()=>{
  const repo=new Repo();const service=createExternalPredictionService({repository:repo,fetchMatches:async()=>[canonical(1)],now:()=>Date.parse(at)});
  const r=await service.savePredictions({userId:7,competition:'ucl',initData:'x',predictions:[{match_id:'ucl:999',home_score:1,away_score:0},{match_id:'coppa_italia:1',home_score:1,away_score:0}]});
  assert.equal(r.saved,0);assert.deepEqual(r.invalid.sort(),['coppa_italia:1','ucl:999'].sort());assert.equal(repo.predictions.length,0);
});

test('fresh rescheduled kickoff is authoritative before save validation',async()=>{
  const repo=new Repo();await repo.upsertMatches([canonical(4,{kickoffAt:'2026-09-15T18:10:00Z'})]);
  const service=createExternalPredictionService({repository:repo,fetchMatches:async()=>[canonical(4,{kickoffAt:'2026-09-15T20:00:00Z'})],now:()=>Date.parse(at)});
  const r=await service.savePredictions({userId:7,competition:'ucl',initData:'x',predictions:[{match_id:'ucl:4',home_score:1,away_score:0}]});
  assert.equal(r.saved,1);assert.deepEqual(r.closed,[]);
});

test('same result signature is idempotent and corrected final recalculates points',async()=>{
  const repo=new Repo();let score=[2,1];const provider=async()=>[canonical(5,{status:'finished',homeScore:score[0],awayScore:score[1]})];
  await repo.upsertMatches([canonical(5)]);const id=repo.matches[0].id;repo.predictions.push({id:1,user_id:7,external_match_id:id,home_score:2,away_score:1,points:null,base_points:null});
  const service=createExternalPredictionService({repository:repo,fetchMatches:provider,now:()=>Date.parse(at)});
  await service.syncDue({initData:'internal'});await service.syncDue({initData:'internal'});
  assert.equal(repo.changedSettlements,1);assert.equal(repo.predictions[0].points,5);
  score=[2,2];await service.syncDue({initData:'internal'});
  assert.equal(repo.changedSettlements,2);assert.equal(repo.predictions[0].points,0);
});
