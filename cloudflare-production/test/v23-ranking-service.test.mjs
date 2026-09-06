import test from 'node:test';
import assert from 'node:assert/strict';
import { createRankingService } from '../../supabase/functions/ciao-v23-api/services/ranking.mjs';

function makeDb(users) {
  class Query {
    constructor() { this.filters = []; }
    select() { return this; }
    eq(column,value) { this.filters.push(row => row?.[column] === value); return this; }
    async execute() { return {data:structuredClone(users.filter(row => this.filters.every(filter => filter(row)))),error:null}; }
    then(resolve,reject) { return this.execute().then(resolve,reject); }
  }
  return {from(table) { if (table !== 'cp_users') throw new Error(`unexpected_table:${table}`); return new Query(); }};
}

const USERS = [
  {id:1,display_name:'Антон',username:'anton',is_active:true,favorite_team:{id:11,bsd_team_id:77}},
  {id:2,display_name:'Борис',username:'boris',is_active:true,favorite_team:null},
];
const POINTS = [
  {userId:1,competition:'serie_a',points:5},
  {userId:1,competition:'coppa_italia',points:2},
  {userId:1,competition:'ucl',points:3},
  {userId:2,competition:'serie_a',points:2},
  {userId:2,competition:'uel',points:5},
];

function fixture(users = USERS, points = POINTS) {
  const calls = [];
  const predictionRepository = {
    async pointsForCompetitions(ids) {
      calls.push([...ids]);
      const allowed = new Set(ids);
      return structuredClone(points.filter(row => allowed.has(row.competition)));
    },
  };
  return {service:createRankingService({db:makeDb(users),predictionRepository}),calls};
}

test('ranking scopes sum only their approved competition groups', async () => {
  const {service,calls} = fixture();
  const all = await service.load({scope:'all',currentUserId:1});
  const italy = await service.load({scope:'italy',currentUserId:1});
  const europe = await service.load({scope:'europe',currentUserId:1});

  assert.equal(all.rows.find(row => row.userId === 1).points, 10);
  assert.equal(all.rows.find(row => row.userId === 2).points, 7);
  assert.equal(italy.rows.find(row => row.userId === 1).points, 7);
  assert.equal(italy.rows.find(row => row.userId === 2).points, 2);
  assert.equal(europe.rows.find(row => row.userId === 1).points, 3);
  assert.equal(europe.rows.find(row => row.userId === 2).points, 5);
  assert.deepEqual(calls, [
    ['serie_a','coppa_italia','ucl','uel','uecl'],
    ['serie_a','coppa_italia'],
    ['ucl','uel','uecl'],
  ]);
});

test('ranking sorts by points descending and then Russian display name for stable ties', async () => {
  const users = [
    {id:1,display_name:'Борис',username:'b',is_active:true,favorite_team:null},
    {id:2,display_name:'Алексей',username:'a',is_active:true,favorite_team:null},
  ];
  const points = [
    {userId:1,competition:'serie_a',points:5},
    {userId:2,competition:'serie_a',points:5},
  ];
  const {service} = fixture(users,points);
  const result = await service.load({scope:'all',currentUserId:2});

  assert.deepEqual(result.rows.map(row => [row.rank,row.userId,row.displayName,row.isCurrent]), [
    [1,2,'Алексей',true],
    [2,1,'Борис',false],
  ]);
});

test('rankForUser returns the same scoped rank and points as load', async () => {
  const {service} = fixture();
  const row = await service.rankForUser({scope:'europe',userId:2});
  assert.equal(row.rank, 1);
  assert.equal(row.points, 5);
  assert.equal(row.userId, 2);
});

test('ranking keeps user identity/favorite shape and ignores inactive users', async () => {
  const users = [...USERS,{id:3,display_name:'Виктор',username:'v',is_active:false,favorite_team:null}];
  const points = [...POINTS,{userId:3,competition:'serie_a',points:100}];
  const {service} = fixture(users,points);
  const result = await service.load({scope:'all',currentUserId:1});
  const current = result.rows.find(row => row.userId === 1);

  assert.equal(result.rows.some(row => row.userId === 3), false);
  assert.equal(current.username, 'anton');
  assert.deepEqual(current.favoriteTeam, {id:11,bsd_team_id:77});
});
