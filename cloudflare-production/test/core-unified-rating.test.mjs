import test from 'node:test';
import assert from 'node:assert/strict';
import { buildUnifiedStandings } from '../../supabase/functions/ciao-core-api-fast-v4/standings.mjs';

const users=[
  {id:1,display_name:'Alpha',favorite_team_id:null},
  {id:2,display_name:'Beta',favorite_team_id:null},
  {id:3,display_name:'Gamma',favorite_team_id:null},
];

const results=[
  {user_id:1,competition:'serie_a',prediction_key:'serie_a:1',kickoff_at:'2026-09-01T18:00:00Z',serie_a_round_number:1,points:5,base_points:5},
  {user_id:1,competition:'ucl',prediction_key:'ucl:100',kickoff_at:'2026-09-02T19:00:00Z',serie_a_round_number:null,points:3,base_points:3},
  {user_id:2,competition:'serie_a',prediction_key:'serie_a:2',kickoff_at:'2026-09-01T18:00:00Z',serie_a_round_number:1,points:5,base_points:5},
  {user_id:3,competition:'serie_a',prediction_key:'serie_a:3',kickoff_at:'2026-09-01T18:00:00Z',serie_a_round_number:1,points:5,base_points:5},
];

test('overall combines Serie A and external competitions exactly once',()=>{
  const x=buildUnifiedStandings({users,results,exactScore:5,scope:'overall'});
  const alpha=x.rows.find(r=>r.id===1);
  assert.equal(alpha.points,8);
  assert.equal(alpha.exact,1);
  assert.equal(alpha.successful,2);
  assert.equal(alpha.calculated,2);
});

test('month scope includes every competition in that month',()=>{
  const x=buildUnifiedStandings({users,results,exactScore:5,scope:'month',month:'2026-09'});
  assert.equal(x.rows.find(r=>r.id===1).points,8);
});

test('round scope remains Serie A-only',()=>{
  const x=buildUnifiedStandings({users,results,exactScore:5,scope:'round',round:1});
  assert.equal(x.rows.find(r=>r.id===1).points,5);
  assert.equal(x.rows.find(r=>r.id===1).calculated,1);
});

test('tie break remains points desc, exact desc, display name asc',()=>{
  const x=buildUnifiedStandings({users,results,exactScore:5,scope:'round',round:1});
  assert.deepEqual(x.rows.map(r=>r.display_name),['Alpha','Beta','Gamma']);
});

test('helper does not expose or require bonus/x2 fields',()=>{
  const x=buildUnifiedStandings({users,results,exactScore:5});
  for(const row of x.rows){
    assert.equal('bonus' in row,false);
    assert.equal('multiplier' in row,false);
  }
});
