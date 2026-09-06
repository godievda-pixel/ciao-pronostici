import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createUserRepository } from '../../supabase/functions/ciao-v23-api/repositories/users.mjs';
import { createProfileService } from '../../supabase/functions/ciao-v23-api/services/profile.mjs';

function makeUserDb(seed = {}) {
  const tables = {
    cp_users:structuredClone(seed.cp_users ?? []),
    cp_teams:structuredClone(seed.cp_teams ?? []),
  };
  const calls = [];

  class Query {
    constructor(table) {
      this.table = table;
      this.filters = [];
      this.operation = 'select';
      this.payload = null;
    }
    select() { return this; }
    eq(column,value) { this.filters.push(row => row?.[column] === value); return this; }
    in(column,values) { const set = new Set(values); this.filters.push(row => set.has(row?.[column])); return this; }
    insert(payload) { this.operation = 'insert'; this.payload = structuredClone(payload); return this; }
    update(payload) { this.operation = 'update'; this.payload = structuredClone(payload); return this; }
    async maybeSingle() { const result = await this.execute(); return {data:result.data?.[0] ?? null,error:result.error}; }
    async single() { const result = await this.execute(); return {data:result.data?.[0] ?? null,error:result.error}; }
    async execute() {
      if (!(this.table in tables)) throw new Error(`unexpected_table:${this.table}`);
      if (this.operation === 'select') {
        const rows = tables[this.table].filter(row => this.filters.every(filter => filter(row)));
        const withFavorite = rows.map(row => {
          if (this.table !== 'cp_users') return row;
          const team = tables.cp_teams.find(teamRow => teamRow.id === row.favorite_team_id) ?? null;
          return {...row,favorite_team:team ? {id:team.id,bsd_team_id:team.bsd_team_id} : null};
        });
        calls.push({table:this.table,operation:'select',rows:structuredClone(withFavorite)});
        return {data:structuredClone(withFavorite),error:null};
      }
      if (this.operation === 'insert') {
        const row = {...this.payload,id:this.payload.id ?? 7};
        tables[this.table].push(row);
        calls.push({table:this.table,operation:'insert',payload:structuredClone(this.payload)});
        return {data:[structuredClone(row)],error:null};
      }
      const matched = tables[this.table].filter(row => this.filters.every(filter => filter(row)));
      for (const row of matched) Object.assign(row,structuredClone(this.payload));
      calls.push({table:this.table,operation:'update',payload:structuredClone(this.payload)});
      return {data:structuredClone(matched),error:null};
    }
    then(resolve,reject) { return this.execute().then(resolve,reject); }
  }

  return {db:{from(table){return new Query(table);}},tables,calls};
}

const baseUser = {
  id:7,
  telegram_id:446763142,
  username:'old_name',
  display_name:'Старое имя',
  is_active:true,
  favorite_team_id:11,
  deadline_reminders_enabled:true,
  lineup_notifications_enabled:false,
  kickoff_notifications_enabled:false,
  result_notifications_enabled:false,
};
const teams = [
  {id:11,name:'Inter',short_name:'Inter',bsd_team_id:77},
  {id:12,name:'Juventus',short_name:'Juve',bsd_team_id:73},
  {id:99,name:'Real Madrid',short_name:'Real',bsd_team_id:57},
];

test('Telegram sync updates mutable identity fields but never writes telegram_id', async () => {
  const fixture = makeUserDb({cp_users:[baseUser],cp_teams:teams});
  const repository = createUserRepository({db:fixture.db});

  const profile = await repository.syncTelegramProfile({
    id:446763142,
    first_name:'Даниил',
    last_name:'Иванов',
    username:'new_name',
  });

  assert.equal(profile.id, 7);
  assert.equal(profile.telegramId, 446763142);
  assert.equal(profile.displayName, 'Даниил Иванов');
  assert.equal(profile.username, 'new_name');
  const update = fixture.calls.find(call => call.operation === 'update');
  assert.equal('telegram_id' in update.payload, false);
  assert.equal(fixture.tables.cp_users[0].telegram_id, 446763142);
});

test('bootstrap combines current Telegram profile, prediction stats, all-scope rank and localized favorite choices', async () => {
  const calls = [];
  const userRepository = {
    async syncTelegramProfile() { calls.push('sync'); return null; },
    async getProfile() {
      calls.push('profile');
      return {
        id:7,telegramId:446763142,displayName:'Даниил',username:'dan',
        favoriteTeam:{id:11,providerTeamId:'77'},
        settings:{deadlineReminders:true,lineupNotifications:false,kickoffNotifications:false,resultNotifications:false},
      };
    },
    async listTeamsByProviderIds(ids) {
      calls.push(['teams',...ids]);
      return [{id:11,providerTeamId:'77'},{id:12,providerTeamId:'73'}];
    },
  };
  const matchService = {
    async listFavoriteItalianTeams() {
      return [
        {id:'77',nameRu:'Интер',crestUrl:'inter.png',countryCode:'IT'},
        {id:'73',nameRu:'Ювентус',crestUrl:'juve.png',countryCode:'IT'},
      ];
    },
  };
  const predictionRepository = {async statsForUser(){return{points:10,exact:1,successful:3,calculated:4};}};
  const rankingService = {async rankForUser(){return{rank:2,points:10};}};
  const service = createProfileService({userRepository,matchService,predictionRepository,rankingService});

  const result = await service.getBootstrap({
    userId:7,
    tgUser:{id:446763142,first_name:'Даниил',username:'dan',photo_url:'https://t.me/i/userpic/320/example.jpg'},
  });

  assert.deepEqual(result.user, {
    id:7,telegramId:446763142,displayName:'Даниил',username:'dan',photoUrl:'https://t.me/i/userpic/320/example.jpg',
  });
  assert.deepEqual(result.stats, {points:10,rank:2,exact:1,successful:3,calculated:4});
  assert.deepEqual(result.favoriteTeam, {id:11,providerTeamId:'77',nameRu:'Интер',crestUrl:'inter.png',countryCode:'IT'});
  assert.deepEqual(result.favoriteChoices.map(team => [team.id,team.providerTeamId,team.nameRu]), [
    [11,'77','Интер'],[12,'73','Ювентус'],
  ]);
  assert.deepEqual(result.settings, {deadlineReminders:true,lineupNotifications:false,kickoffNotifications:false,resultNotifications:false});
  assert.deepEqual(calls.slice(0,2), ['sync','profile']);
});

test('favorite team accepts only a local cp_teams id backed by an eligible Italian provider id', async () => {
  const calls = [];
  const userRepository = {
    async getTeam(teamId) {
      return teamId === 12 ? {id:12,providerTeamId:'73'} : {id:99,providerTeamId:'57'};
    },
    async setFavoriteTeam(userId,teamId) { calls.push([userId,teamId]); return {favoriteTeamId:teamId}; },
  };
  const matchService = {async listFavoriteItalianTeams(){return[{id:'77'},{id:'73'}];}};
  const service = createProfileService({
    userRepository,matchService,
    predictionRepository:{statsForUser:async()=>({})},
    rankingService:{rankForUser:async()=>null},
  });

  await service.setFavoriteTeam(7,12);
  assert.deepEqual(calls, [[7,12]]);
  await assert.rejects(() => service.setFavoriteTeam(7,99), /favorite_team_not_eligible/);
  assert.deepEqual(calls, [[7,12]]);
});

test('partial notification patch updates only supplied settings flag', async () => {
  const patches = [];
  const userRepository = {
    async updateNotificationSettings(userId,patch) {
      patches.push([userId,structuredClone(patch)]);
      return {deadlineReminders:true,lineupNotifications:true,kickoffNotifications:false,resultNotifications:false};
    },
  };
  const service = createProfileService({
    userRepository,
    matchService:{listFavoriteItalianTeams:async()=>[]},
    predictionRepository:{statsForUser:async()=>({})},
    rankingService:{rankForUser:async()=>null},
  });

  const settings = await service.updateNotificationSettings(7,{lineupNotifications:true});
  assert.deepEqual(patches, [[7,{lineupNotifications:true}]]);
  assert.equal(settings.lineupNotifications, true);
});

test('profile settings migration is additive and idempotent', async () => {
  const source = await readFile(new URL('../../supabase/migrations/20260906221000_v23_profile_settings.sql', import.meta.url), 'utf8');
  for (const column of ['deadline_reminders_enabled','lineup_notifications_enabled','kickoff_notifications_enabled','result_notifications_enabled']) {
    assert.match(source,new RegExp(`add column if not exists\\s+${column}`,'i'));
  }
  assert.doesNotMatch(source,/\bdrop\s+(table|column)\b/i);
});
