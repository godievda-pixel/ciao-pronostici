import test from 'node:test';
import assert from 'node:assert/strict';
import { RANKING_SCOPES, loadRanking, renderRanking } from '../src/v23/screens/ranking.mjs';
import { MATCH_COMPETITIONS, loadMatches, renderMatches } from '../src/v23/screens/matches.mjs';
import { TABLE_COMPETITIONS, loadTable, renderTables } from '../src/v23/screens/tables.mjs';

const NOW = '2026-09-07T17:00:00.000Z';
const TZ = 'Europe/Berlin';

function matchFixture(overrides = {}) {
  return {
    id:'serie_a:1', providerMatchId:'1', competition:'serie_a', competitionNameRu:'Серия А',
    season:'2026', stage:'3 тур', round:3, kickoffAt:'2026-09-07T18:45:00.000Z', status:'scheduled', minute:null,
    home:{id:'101',nameRu:'Интер'}, away:{id:'202',nameRu:'Ювентус'}, score:{home:null,away:null},
    isItalianRelevant:true, isQualification:false,
    ...overrides,
  };
}

test('Ranking scopes are exactly Все / Италия / Еврокубки and use backend scope ids', async () => {
  assert.deepEqual(RANKING_SCOPES, [
    {id:'all',label:'Все'}, {id:'italy',label:'Италия'}, {id:'europe',label:'Еврокубки'},
  ]);
  const calls = [];
  const api = { call: async (action,payload) => { calls.push({action,payload}); return {rows:[
    {userId:1,displayName:'Анна',username:'anna',points:21,isCurrent:false,rank:1},
    {userId:2,displayName:'Даниил',username:'godievda',points:12,isCurrent:true,rank:2},
  ]}; }};
  const model = await loadRanking({api,scope:'europe'});
  assert.deepEqual(calls, [{action:'ranking',payload:{scope:'europe'}}]);
  const html = renderRanking(model);
  assert.match(html, /data-scope="all"/);
  assert.match(html, /data-scope="italy"/);
  assert.match(html, /data-scope="europe"/);
  assert.match(html, /data-current-user="true"/);
  assert.match(html, /21 очко/);
  assert.match(html, /12 очков/);
});

test('Matches landing contains exactly five Russian tournament cards', () => {
  assert.deepEqual(MATCH_COMPETITIONS.map(item => item.label), [
    'Серия А','Кубок Италии','Лига чемпионов','Лига Европы','Лига конференций',
  ]);
  const html = renderMatches({competition:null,items:[],groups:[]});
  assert.equal((html.match(/data-action="open-tournament"/g) ?? []).length, 5);
  for (const label of MATCH_COMPETITIONS.map(item => item.label)) assert.match(html, new RegExp(label));
});

test('Serie A matches load from backend, localize time and group by round', async () => {
  const calls = [];
  const api = {call:async (action,payload) => {calls.push({action,payload}); return [
    matchFixture(),
    matchFixture({id:'serie_a:2',round:4,stage:'4 тур',kickoffAt:'2026-09-14T18:45:00.000Z'}),
  ];}};
  const model = await loadMatches({api,competition:'serie_a',now:NOW,timeZone:TZ});
  assert.deepEqual(calls,[{action:'matches',payload:{competition:'serie_a'}}]);
  assert.deepEqual(model.groups.map(group => group.label), ['3 тур','4 тур']);
  assert.equal(model.groups[0].items[0].timeLabel,'Сегодня · 20:45');
  const html = renderMatches(model);
  assert.match(html,/3 тур/);
  assert.match(html,/4 тур/);
  assert.match(html,/Интер/);
  assert.match(html,/Ювентус/);
});

test('Coppa renderer begins at 1/8 финала and never creates an earlier-stage fallback', async () => {
  const api = {call:async () => [
    matchFixture({id:'coppa_italia:1',competition:'coppa_italia',competitionNameRu:'Кубок Италии',stage:'1/8 финала',round:null}),
    matchFixture({id:'coppa_italia:2',competition:'coppa_italia',competitionNameRu:'Кубок Италии',stage:'1/4 финала',round:null,kickoffAt:'2026-10-07T18:45:00.000Z'}),
  ]};
  const model = await loadMatches({api,competition:'coppa_italia',now:NOW,timeZone:TZ});
  assert.deepEqual(model.groups.map(group => group.label), ['1/8 финала','1/4 финала']);
  const html = renderMatches(model);
  assert.match(html,/1\/8 финала/);
  assert.doesNotMatch(html,/1\/16|Квалификац/);
});

test('European Matches fail closed for non-Italian-relevant or qualification rows', async () => {
  const api = {call:async () => [
    matchFixture({id:'ucl:1',competition:'ucl',competitionNameRu:'Лига чемпионов',stage:'Общий этап',home:{id:'101',nameRu:'Интер'},away:{id:'303',nameRu:'Арсенал'},isItalianRelevant:true}),
    matchFixture({id:'ucl:2',competition:'ucl',competitionNameRu:'Лига чемпионов',stage:'Общий этап',home:{id:'303',nameRu:'Арсенал'},away:{id:'404',nameRu:'Ливерпуль'},isItalianRelevant:false}),
    matchFixture({id:'ucl:3',competition:'ucl',competitionNameRu:'Лига чемпионов',stage:'Квалификация',isItalianRelevant:true,isQualification:true}),
  ]};
  const model = await loadMatches({api,competition:'ucl',now:NOW,timeZone:TZ});
  assert.deepEqual(model.items.map(item => item.id), ['ucl:1']);
  const html = renderMatches(model);
  assert.match(html,/Интер/);
  assert.match(html,/Арсенал/);
  assert.doesNotMatch(html,/Ливерпуль|Квалификация/);
});

test('Tables support exactly Serie A/UCL/UEL/UECL and never Coppa Italia', () => {
  assert.deepEqual(TABLE_COMPETITIONS.map(item => item.id), ['serie_a','ucl','uel','uecl']);
  assert.deepEqual(TABLE_COMPETITIONS.map(item => item.label), ['Серия А','Лига чемпионов','Лига Европы','Лига конференций']);
  const html = renderTables({competition:'serie_a',competitionNameRu:'Серия А',rows:[]});
  assert.equal((html.match(/data-action="table-competition"/g) ?? []).length,4);
  assert.doesNotMatch(html,/Кубок Италии/);
});

test('European standings remain complete, including non-Italian clubs, but all names are Russian', async () => {
  const calls=[];
  const api={call:async(action,payload)=>{calls.push({action,payload});return {
    competition:'ucl',competitionNameRu:'Лига чемпионов',rows:[
      {position:1,team:{id:'1',nameRu:'Интер'},played:6,wins:5,draws:1,losses:0,goalsFor:14,goalsAgainst:4,goalDifference:10,points:16},
      {position:2,team:{id:'2',nameRu:'Манчестер Сити'},played:6,wins:4,draws:1,losses:1,goalsFor:12,goalsAgainst:6,goalDifference:6,points:13},
      {position:3,team:{id:'3',nameRu:'Бавария'},played:6,wins:4,draws:0,losses:2,goalsFor:11,goalsAgainst:7,goalDifference:4,points:12},
    ],
  };}};
  const model=await loadTable({api,competition:'ucl'});
  assert.deepEqual(calls,[{action:'standings',payload:{competition:'ucl'}}]);
  assert.equal(model.rows.length,3);
  const html=renderTables(model);
  assert.match(html,/Интер/);
  assert.match(html,/Манчестер Сити/);
  assert.match(html,/Бавария/);
  assert.doesNotMatch(html,/Manchester City|Bayern/);
  assert.match(html,/>16</);
});

test('table renderer fails closed rather than leaking a provider-only English team name', () => {
  assert.throws(() => renderTables({competition:'ucl',competitionNameRu:'Лига чемпионов',rows:[
    {position:1,team:{name:'Manchester City'},played:1,wins:1,draws:0,losses:0,goalsFor:2,goalsAgainst:0,goalDifference:2,points:3},
  ]}), /team_name_ru_missing/);
});
