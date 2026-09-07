import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseExternalMatchId,
  predictionDeadlineAt,
  isPredictionOpen,
  scorePrediction,
  resultSignature,
  isValidPredictionScore,
  toExternalMatchRow,
} from '../../supabase/functions/ciao-external-predictions/domain.mjs';

const rules={exact_score:5,correct_goal_difference:3,correct_outcome:2,miss:0};

test('stable external match id keeps competition separate from BSD event id',()=>{
  assert.deepEqual(parseExternalMatchId('ucl:600983'),{competition:'ucl',providerEventId:600983});
  assert.equal(parseExternalMatchId('serie_a:12'),null);
  assert.equal(parseExternalMatchId('ucl:not-a-number'),null);
});

test('deadline closes exactly fifteen minutes before kickoff',()=>{
  assert.equal(predictionDeadlineAt('2026-09-15T19:00:00Z'),'2026-09-15T18:45:00.000Z');
  const match={kickoffAt:'2026-09-15T19:00:00Z',status:'scheduled'};
  assert.equal(isPredictionOpen(match,Date.parse('2026-09-15T18:44:59Z')),true);
  assert.equal(isPredictionOpen(match,Date.parse('2026-09-15T18:45:00Z')),false);
});

test('live-like and terminal states are never editable',()=>{
  for(const status of ['live','halftime','extra_time','penalties','finished','postponed','cancelled']){
    assert.equal(isPredictionOpen({kickoffAt:'2026-09-15T19:00:00Z',status},Date.parse('2026-09-15T18:00:00Z')),false,status);
  }
  assert.equal(isPredictionOpen({kickoffAt:'bad-date',status:'scheduled'},Date.now()),false);
});

test('score validator allows only integer values from zero through twenty',()=>{
  assert.equal(isValidPredictionScore(0),true);
  assert.equal(isValidPredictionScore(20),true);
  assert.equal(isValidPredictionScore(-1),false);
  assert.equal(isValidPredictionScore(21),false);
  assert.equal(isValidPredictionScore(1.5),false);
  assert.equal(isValidPredictionScore('2'),false);
});

test('score uses only 5/3/2/0',()=>{
  assert.equal(scorePrediction({homeScore:2,awayScore:1},{homeScore:2,awayScore:1},rules),5);
  assert.equal(scorePrediction({homeScore:2,awayScore:1},{homeScore:3,awayScore:2},rules),3);
  assert.equal(scorePrediction({homeScore:1,awayScore:0},{homeScore:3,awayScore:1},rules),2);
  assert.equal(scorePrediction({homeScore:0,awayScore:1},{homeScore:3,awayScore:1},rules),0);
});

test('result signature changes when final provider score is corrected',()=>{
  assert.equal(resultSignature({status:'live',homeScore:2,awayScore:1}),'');
  assert.equal(resultSignature({status:'finished',homeScore:2,awayScore:1}),'finished:2:1');
  assert.equal(resultSignature({status:'finished',homeScore:2,awayScore:2}),'finished:2:2');
});

test('canonical match maps to external storage identity',()=>{
  const row=toExternalMatchRow({
    competition:'ucl',sourceId:'600983',stageKey:'league-1',stageLabel:'Общий этап · 1 тур',stageOrder:101,round:1,
    kickoffAt:'2026-09-15T19:00:00Z',status:'scheduled',minute:null,
    homeTeam:{id:'77',name:'Интер',countryCode:'ITA',crestUrl:'https://sports.bzzoiro.com/img/team/77/?bg=transparent'},
    awayTeam:{id:'1',name:'Ливерпуль',countryCode:'ENG',crestUrl:'https://sports.bzzoiro.com/img/team/1/?bg=transparent'},
    homeScore:null,awayScore:null,
  },'2026-09-07T15:00:00.000Z');
  assert.equal(row.competition,'ucl');
  assert.equal(row.provider_event_id,600983);
  assert.equal(row.home_bsd_team_id,77);
  assert.equal(row.synced_at,'2026-09-07T15:00:00.000Z');
});
