import test from 'node:test';
import assert from 'node:assert/strict';
import { createMatchService } from '../../supabase/functions/ciao-v23-api/services/matches.mjs';

const localizationLookup = new Map([
  ['77',{provider_team_id:'77',name_ru:'Интер',genitive_ru:'Интера',dative_ru:'Интеру',prepositional_ru:'Интере'}],
  ['73',{provider_team_id:'73',name_ru:'Ювентус',genitive_ru:'Ювентуса',dative_ru:'Ювентусу',prepositional_ru:'Ювентусе'}],
  ['63',{provider_team_id:'63',name_ru:'Милан',genitive_ru:'Милана',dative_ru:'Милану',prepositional_ru:'Милане'}],
  ['1',{provider_team_id:'1',name_ru:'Ливерпуль'}],
  ['57',{provider_team_id:'57',name_ru:'Реал Мадрид'}],
]);

const TEAM = {
  inter:{id:77,name:'Inter',country_code:'IT'},
  juventus:{id:73,name:'Juventus',country_code:'IT'},
  milan:{id:63,name:'AC Milan',country_code:'IT'},
  liverpool:{id:1,name:'Liverpool FC',country_code:'GB'},
  real:{id:57,name:'Real Madrid',country_code:'ES'},
};

const UCL = [
  {id:'u1',event_date:'2026-09-10T18:00:00Z',status:'upcoming',round_name:'League phase',home_team:TEAM.inter,away_team:TEAM.liverpool},
  {id:'u2',event_date:'2026-09-10T19:00:00Z',status:'upcoming',round_name:'League phase',home_team:TEAM.real,away_team:TEAM.liverpool},
  {id:'u3',event_date:'2026-09-11T18:00:00Z',status:'upcoming',round_name:'League phase',home_team:TEAM.liverpool,away_team:TEAM.inter},
  {id:'u4',event_date:'2026-09-12T18:00:00Z',status:'upcoming',round_name:'Third qualifying round',home_team:TEAM.juventus,away_team:TEAM.liverpool},
];

const COPPA = [
  {id:'c1',event_date:'2026-10-01T18:00:00Z',status:'upcoming',round_name:'Round of 32',home_team:TEAM.milan,away_team:TEAM.inter},
  {id:'c2',event_date:'2026-12-01T18:00:00Z',status:'upcoming',round_name:'Round of 16',home_team:TEAM.milan,away_team:TEAM.inter},
];

function providerFixture() {
  const calls = [];
  const provider = {
    calls,
    async listItalianTeamIds() { return new Set(['77','73','63']); },
    async listMatches({competition}) {
      calls.push(['listMatches',competition]);
      if (competition === 'ucl') return structuredClone(UCL);
      if (competition === 'coppa_italia') return structuredClone(COPPA);
      return [];
    },
    async getStandings({competition}) {
      calls.push(['getStandings',competition]);
      if (competition !== 'ucl') return {standings:[]};
      return {standings:[
        {position:1,team:TEAM.real,played:2,wins:2,draws:0,losses:0,goals_for:5,goals_against:1,points:6},
        {position:2,team:TEAM.liverpool,played:2,wins:1,draws:1,losses:0,goals_for:4,goals_against:2,points:4},
        {position:3,team:TEAM.inter,played:2,wins:1,draws:0,losses:1,goals_for:3,goals_against:2,points:3},
      ]};
    },
    async getMatchSection({competition,providerMatchId,section}) {
      calls.push(['getMatchSection',competition,providerMatchId,section]);
      const match = [...UCL,...COPPA].find(item => String(item.id) === String(providerMatchId));
      if (section === 'overview') return structuredClone(match);
      return {section,providerMatchId};
    },
  };
  return provider;
}

function service(provider = providerFixture()) {
  return createMatchService({provider, localizationLookup});
}

test('European match lists include only Italian-club non-qualification fixtures and localize user-facing fields', async () => {
  const matches = await service().listMatches({competition:'ucl',from:'2026-09-01',to:'2026-09-30'});
  assert.deepEqual(matches.map(match => match.id), ['ucl:u1','ucl:u3']);
  assert.equal(matches[0].home.nameRu, 'Интер');
  assert.equal(matches[0].away.nameRu, 'Ливерпуль');
  assert.equal(matches[0].stage, 'Общий этап');
  assert.equal('nameProvider' in matches[0].home, false);
});

test('Coppa Italia list begins at Round of 16', async () => {
  const matches = await service().listMatches({competition:'coppa_italia'});
  assert.deepEqual(matches.map(match => match.id), ['coppa_italia:c2']);
  assert.equal(matches[0].stage, '1/8 финала');
});

test('European standings remain complete and every visible team is Russian-localized', async () => {
  const standings = await service().getStandings({competition:'ucl'});
  assert.deepEqual(standings.rows.map(row => row.team.nameRu), ['Реал Мадрид','Ливерпуль','Интер']);
  assert.deepEqual(standings.rows.map(row => row.position), [1,2,3]);
});

test('favorite candidate list contains only Italian provider ids and Russian names', async () => {
  const teams = await service().listFavoriteItalianTeams();
  assert.deepEqual(teams.map(team => team.id), ['77','73','63']);
  assert.deepEqual(teams.map(team => team.nameRu), ['Интер','Ювентус','Милан']);
  assert.ok(teams.every(team => team.countryCode === 'IT'));
});

test('favorite next match is selected across competitions using canonical eligible matches', async () => {
  const match = await service().getFavoriteNextMatch({favoriteTeamProviderId:'77',nowIso:'2026-09-09T00:00:00Z'});
  assert.equal(match.id, 'ucl:u1');
});

test('Calcio today trusts explicit UTC day boundaries and excludes foreign-only/qualification matches', async () => {
  const matches = await service().listCalcioToday({
    localDateStartUtc:'2026-09-10T00:00:00Z',
    localDateEndUtc:'2026-09-11T00:00:00Z',
  });
  assert.deepEqual(matches.map(match => match.id), ['ucl:u1']);
});

test('Match Center rejects an ineligible European id after overview and before requested section', async () => {
  const provider = providerFixture();
  const matchService = service(provider);
  await assert.rejects(
    () => matchService.getMatchCenter({competition:'ucl',matchId:'ucl:u2',section:'stats'}),
    /match_not_eligible/,
  );
  assert.deepEqual(provider.calls.filter(call => call[0] === 'getMatchSection'), [
    ['getMatchSection','ucl','u2','overview'],
  ]);
});

test('eligible Match Center loads overview first and then the requested section', async () => {
  const provider = providerFixture();
  const matchService = service(provider);
  const result = await matchService.getMatchCenter({competition:'ucl',matchId:'ucl:u1',section:'stats'});
  assert.equal(result.match.id, 'ucl:u1');
  assert.equal(result.match.home.nameRu, 'Интер');
  assert.deepEqual(result.data, {section:'stats',providerMatchId:'u1'});
  assert.deepEqual(provider.calls.filter(call => call[0] === 'getMatchSection'), [
    ['getMatchSection','ucl','u1','overview'],
    ['getMatchSection','ucl','u1','stats'],
  ]);
});
