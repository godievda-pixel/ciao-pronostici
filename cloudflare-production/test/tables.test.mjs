import test from 'node:test';
import assert from 'node:assert/strict';
import * as tables from '../src/modular/screens/tables.mjs';

test('Tables screen supports Serie A/UCL/UEL/UECL and excludes Coppa Italia', () => {
  assert.deepEqual(tables.TABLE_TOURNAMENTS, ['serie_a','ucl','uel','uecl']);
  const html=tables.renderTablesScreen({tournament:'serie_a',rows:[]});
  assert.match(html, /<h2>Таблицы<\/h2>/);
  for(const id of ['serie_a','ucl','uel','uecl']) assert.match(html,new RegExp(`data-ciao-table-tournament="${id}"`));
  assert.doesNotMatch(html,/data-ciao-table-tournament="coppa_italia"|>Кубок Италии</);
});

test('standing rows normalize provider aliases into one table contract', () => {
  assert.equal(typeof tables.normalizeStandingRows,'function');
  const rows=tables.normalizeStandingRows([
    {rank:1,team:{id:10,name:'Inter',crest_url:'inter.png'},matches_played:8,wins:6,draws:1,losses:1,goals_for:18,goals_against:7,goal_difference:11,points:19},
    {position:2,team_id:11,team_name:'Juventus',played:8,w:5,d:2,l:1,gf:14,ga:6,gd:8,pts:17},
  ]);
  assert.deepEqual(rows[0],{position:1,team:{id:10,name:'Inter',crestUrl:'inter.png'},played:8,wins:6,draws:1,losses:1,goalsFor:18,goalsAgainst:7,goalDifference:11,points:19});
  assert.deepEqual(rows[1],{position:2,team:{id:11,name:'Juventus',crestUrl:''},played:8,wins:5,draws:2,losses:1,goalsFor:14,goalsAgainst:6,goalDifference:8,points:17});
});

test('Tables screen applies tournament theme and renders normalized standing data', () => {
  const html=tables.renderTablesScreen({tournament:'ucl',rows:[{position:1,team:{id:1,name:'Inter'},played:8,wins:6,draws:1,losses:1,goalsFor:15,goalsAgainst:5,goalDifference:10,points:19}]});
  assert.match(html,/theme-champions/);
  assert.match(html,/Inter/);
  assert.match(html,/data-standing-position="1"/);
  assert.match(html,/>19<\/strong>/);
});

test('Tables tournament switch delegates to shared router state', () => {
  assert.equal(typeof tables.handleTablesClick,'function');
  const calls=[];
  const target={closest:sel=>sel==='[data-ciao-table-tournament]'?{dataset:{ciaoTableTournament:'uecl'}}:null};
  assert.equal(tables.handleTablesClick({target},{router:{navigate:r=>calls.push(r)}}),true);
  assert.deepEqual(calls,[{screen:'tables',tournament:'uecl'}]);
});
