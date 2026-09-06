import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeMatch } from '../src/modular/data/match-normalizer.mjs';
import {
  createSerieAClubIndex,
  involvesSerieAClub,
  selectNearestClubMatch,
  selectCalcioToday,
  selectCompetitionFixtures,
} from '../src/modular/data/selectors.mjs';

const teams={
  inter:{id:1,name:'Inter'}, juventus:{id:2,name:'Juventus'}, arsenal:{id:20,name:'Arsenal'},
  bayern:{id:21,name:'Bayern'}, fiorentina:{id:3,name:'Fiorentina'},
};
const match=(id,competition,kickoffAt,home,away,extra={})=>({
  id,competition,kickoffAt,status:'scheduled',home,away,score:{home:null,away:null},round:null,stage:'',isQualification:false,...extra,
});

test('normalizeMatch produces the canonical match shape', () => {
  assert.deepEqual(normalizeMatch({
    match_id:'UCL-5', kickoff_at:'2026-09-06T18:00:00Z', live_status:'live', live_elapsed:37,
    home_team:teams.inter, away_team:teams.arsenal, home_score:1, away_score:0, stage:'League phase',
  },'ucl'),{
    id:'UCL-5',competition:'ucl',kickoffAt:'2026-09-06T18:00:00Z',status:'live',minute:37,
    home:{id:1,name:'Inter',crestUrl:''},away:{id:20,name:'Arsenal',crestUrl:''},
    score:{home:1,away:0},round:null,stage:'League phase',isQualification:false,
  });
});

test('Serie A club index identifies Italian participants in European matches', () => {
  const index=createSerieAClubIndex([{team_id:1,team_name:'Inter'},{team_id:2,team_name:'Juventus'}]);
  assert.equal(involvesSerieAClub(match('a','ucl','2026-09-06T18:00:00Z',teams.inter,teams.arsenal),index),true);
  assert.equal(involvesSerieAClub(match('b','ucl','2026-09-06T18:00:00Z',teams.arsenal,teams.bayern),index),false);
});

test('favorite club selects the nearest future match across competitions', () => {
  const now=new Date('2026-09-06T10:00:00Z');
  const rows=[
    match('sa','serie_a','2026-09-10T18:00:00Z',teams.juventus,teams.inter),
    match('ucl','ucl','2026-09-08T19:00:00Z',teams.juventus,teams.arsenal),
    match('past','coppa_italia','2026-09-05T19:00:00Z',teams.juventus,teams.fiorentina,{status:'finished'}),
  ];
  assert.equal(selectNearestClubMatch(rows,teams.juventus,now).id,'ucl');
});

test('Calcio Today includes only today matches involving Serie A clubs', () => {
  const now=new Date('2026-09-06T12:00:00Z');
  const index=createSerieAClubIndex([{team_id:1,team_name:'Inter'},{team_id:2,team_name:'Juventus'}]);
  const rows=[
    match('today-sa','serie_a','2026-09-06T14:00:00Z',teams.inter,teams.juventus),
    match('today-ucl','ucl','2026-09-06T18:00:00Z',teams.inter,teams.arsenal),
    match('foreign','ucl','2026-09-06T20:00:00Z',teams.arsenal,teams.bayern),
    match('tomorrow','serie_a','2026-09-07T14:00:00Z',teams.inter,teams.juventus),
  ];
  assert.deepEqual(selectCalcioToday(rows,index,now).map(x=>x.id),['today-sa','today-ucl']);
});

test('European fixture views exclude qualification and foreign-vs-foreign matches', () => {
  const index=createSerieAClubIndex([{team_id:1,team_name:'Inter'}]);
  const rows=[
    match('league','ucl','2026-09-06T18:00:00Z',teams.inter,teams.arsenal,{stage:'League phase'}),
    match('qual','ucl','2026-08-20T18:00:00Z',teams.inter,teams.arsenal,{stage:'Qualification',isQualification:true}),
    match('foreign','ucl','2026-09-07T18:00:00Z',teams.arsenal,teams.bayern,{stage:'League phase'}),
  ];
  assert.deepEqual(selectCompetitionFixtures(rows,'ucl',index).map(x=>x.id),['league']);
});

test('Coppa Italia fixture views begin at Round of 16', () => {
  const rows=[
    match('r32','coppa_italia','2026-08-01T18:00:00Z',teams.inter,teams.fiorentina,{stage:'Round of 32'}),
    match('r16','coppa_italia','2026-12-01T18:00:00Z',teams.inter,teams.fiorentina,{stage:'Round of 16'}),
    match('qf','coppa_italia','2027-02-01T18:00:00Z',teams.inter,teams.fiorentina,{stage:'Quarter-finals'}),
    match('sf','coppa_italia','2027-03-01T18:00:00Z',teams.inter,teams.fiorentina,{stage:'Semi-finals'}),
    match('final','coppa_italia','2027-05-01T18:00:00Z',teams.inter,teams.fiorentina,{stage:'Final'}),
  ];
  assert.deepEqual(selectCompetitionFixtures(rows,'coppa_italia',new Set()).map(x=>x.id),['r16','qf','sf','final']);
});
