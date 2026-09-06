import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MATCH_CENTER_TABS,
  createMatchCenterController,
  loadMatchCenterSection,
  renderMatchCenter,
} from '../src/v23/screens/match-center.mjs';

const NOW='2026-09-07T17:00:00.000Z';
const TZ='Europe/Berlin';
const competitions=['serie_a','coppa_italia','ucl','uel','uecl'];

const match={
  id:'ucl:77',providerMatchId:'77',competition:'ucl',competitionNameRu:'Лига чемпионов',season:'2026',
  stage:'Общий этап',round:null,kickoffAt:'2026-09-07T18:45:00.000Z',status:'live',minute:68,
  home:{id:'101',nameRu:'Интер'},away:{id:'202',nameRu:'Арсенал'},score:{home:2,away:1},
  isItalianRelevant:true,isQualification:false,
};

test('all five competitions share exactly one Match Center tab contract',()=>{
  assert.deepEqual(MATCH_CENTER_TABS,[
    ['overview','Обзор'],['stats','Статистика'],['events','События'],['lineups','Составы'],['players','Игроки'],
  ]);
  for(const competition of competitions){
    const html=renderMatchCenter({
      competition,matchId:`${competition}:1`,activeTab:'overview',
      match:{...match,id:`${competition}:1`,competition,competitionNameRu:competition==='serie_a'?'Серия А':'Лига чемпионов'},
      sections:{overview:{}},sectionErrors:{},now:NOW,timeZone:TZ,
    });
    assert.match(html,new RegExp(`data-competition="${competition}"`));
    for(const[,label]of MATCH_CENTER_TABS) assert.match(html,new RegExp(`>${label}<`));
    assert.doesNotMatch(html,/Контекст Серии А/);
  }
});

test('loadMatchCenterSection sends one canonical API action and returns localized UI match',async()=>{
  const calls=[];
  const api={call:async(action,payload)=>{calls.push({action,payload});return {match,data:{venue:{name:'Сан-Сиро'}}};}};
  const result=await loadMatchCenterSection({api,competition:'ucl',matchId:'ucl:77',section:'overview',now:NOW,timeZone:TZ});
  assert.deepEqual(calls,[{action:'match_center',payload:{competition:'ucl',match_id:'ucl:77',section:'overview'}}]);
  assert.equal(result.match.homeTeam.nameRu,'Интер');
  assert.equal(result.match.awayTeam.nameRu,'Арсенал');
  assert.equal(result.match.timeLabel,'Сегодня · 20:45');
  assert.equal(result.data.venue.name,'Сан-Сиро');
});

test('overview header is Russian/local-time and visible Back is a single semantic action',()=>{
  const html=renderMatchCenter({competition:'ucl',matchId:'ucl:77',activeTab:'overview',match:{...match},sections:{overview:{venue:{name:'Сан-Сиро'}}},sectionErrors:{},now:NOW,timeZone:TZ});
  assert.match(html,/data-action="match-back"/);
  assert.equal((html.match(/data-action="match-back"/g)??[]).length,1);
  assert.match(html,/Лига чемпионов/);
  assert.match(html,/Общий этап/);
  assert.match(html,/Интер/);
  assert.match(html,/Арсенал/);
  assert.match(html,/2 — 1/);
  assert.match(html,/Сегодня · 20:45/);
  assert.match(html,/Сан-Сиро/);
  assert.doesNotMatch(html,/>Inter<|>Arsenal</);
});

test('statistics omit unavailable metrics instead of rendering fake zero values',()=>{
  const html=renderMatchCenter({
    competition:'ucl',matchId:'ucl:77',activeTab:'stats',match,
    sections:{stats:{statistics:[
      {name:'Ball possession',home:'55%',away:'45%'},
      {name:'Total shots',home:12,away:7},
      {name:'Shots on target',home:null,away:null},
      {name:'Corner kicks',home:6,away:2},
    ]}},sectionErrors:{},now:NOW,timeZone:TZ,
  });
  assert.match(html,/Владение мячом/);
  assert.match(html,/55%/);
  assert.match(html,/Удары/);
  assert.match(html,/>12</);
  assert.match(html,/Угловые/);
  assert.doesNotMatch(html,/Удары в створ/);
  assert.doesNotMatch(html,/0 — 0/);
});

test('events translate event type while preserving player proper names',()=>{
  const html=renderMatchCenter({
    competition:'ucl',matchId:'ucl:77',activeTab:'events',match,
    sections:{events:{incidents:[
      {incidentType:'goal',time:24,player:{name:'Lautaro Martínez'}},
      {incidentType:'yellowCard',time:51,player:{name:'Nicolò Barella'}},
      {incidentType:'substitution',time:70,playerIn:{name:'Davide Frattesi'},playerOut:{name:'Nicolò Barella'}},
    ]}},sectionErrors:{},now:NOW,timeZone:TZ,
  });
  assert.match(html,/Гол/);
  assert.match(html,/Жёлтая карточка/);
  assert.match(html,/Замена/);
  assert.match(html,/Lautaro Martínez/);
  assert.match(html,/24'/);
  assert.doesNotMatch(html,/>goal<|yellowCard|substitution/);
});

test('lineups and players have neutral Russian section copy and never dump raw provider objects',()=>{
  const lineups=renderMatchCenter({competition:'ucl',matchId:'ucl:77',activeTab:'lineups',match,sections:{lineups:{home:{formation:'3-5-2',players:[{player:{name:'Янн Зоммер'},starter:true}]},away:{formation:'4-3-3',players:[{player:{name:'Давид Райя'},starter:true}]}}},sectionErrors:{},now:NOW,timeZone:TZ});
  assert.match(lineups,/Стартовый состав/);
  assert.match(lineups,/3-5-2/);
  assert.match(lineups,/Янн Зоммер/);
  assert.doesNotMatch(lineups,/\[object Object\]|"starter"/);

  const players=renderMatchCenter({competition:'ucl',matchId:'ucl:77',activeTab:'players',match,sections:{players:{players:[{player:{name:'Лаутаро Мартинес'},rating:8.2,goals:1},{player:{name:'Николо Барелла'},rating:null,goals:null}]}},sectionErrors:{},now:NOW,timeZone:TZ});
  assert.match(players,/Лаутаро Мартинес/);
  assert.match(players,/8.2/);
  assert.match(players,/1 гол/);
  assert.doesNotMatch(players,/Николо Барелла[^]*0 гол/);
});

test('controller loads overview first, keeps it after one tab failure, and Back delegates only to shared router',async()=>{
  const renders=[];let backCalls=0;
  const api={call:async(action,payload)=>{
    if(payload.section==='stats') throw Object.assign(new Error('stats unavailable'),{code:'provider_error'});
    return {match,data:payload.section==='overview'?{venue:{name:'Сан-Сиро'}}:{}};
  }};
  const controller=createMatchCenterController({api,router:{back(){backCalls+=1;}},render:view=>renders.push(view),clock:()=>new Date(NOW),timeZone:TZ});
  await controller.open({competition:'ucl',matchId:'ucl:77',section:'overview'});
  await controller.selectTab('stats');
  const state=controller.state();
  assert.equal(state.match.homeTeam.nameRu,'Интер');
  assert.equal(state.sections.overview.venue.name,'Сан-Сиро');
  assert.equal(state.sectionErrors.stats.message,'Не удалось загрузить раздел');
  assert.equal(state.activeTab,'stats');
  assert.ok(renders.length>=2);
  controller.back();
  assert.equal(backCalls,1);
  assert.equal('handlePopState' in controller,false);
});

test('unknown Match Center section is rejected before fetch',async()=>{
  let calls=0;const api={call:async()=>{calls+=1;return {};}};
  await assert.rejects(()=>loadMatchCenterSection({api,competition:'ucl',matchId:'ucl:77',section:'video',now:NOW,timeZone:TZ}),/match_center_section_invalid/);
  assert.equal(calls,0);
});
