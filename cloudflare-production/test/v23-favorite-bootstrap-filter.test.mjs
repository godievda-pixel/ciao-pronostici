import test from 'node:test';
import assert from 'node:assert/strict';
import { createMatchService } from '../../supabase/functions/ciao-v23-api/services/matches.mjs';
import { createProfileService } from '../../supabase/functions/ciao-v23-api/services/profile.mjs';

const lookup = new Map([
  ['77',{provider_team_id:'77',name_ru:'Интер'}],
]);

function rawProviderWithUnknownItalianTeam(){
  return {
    async listItalianTeamIds(){ return new Set(['77','4708']); },
    async listMatches(){ return []; },
    async getStandings(){ return {standings:[]}; },
    async getMatchSection(){ return {}; },
  };
}

test('favorite-team localization only touches explicitly allowed provider ids', async () => {
  const matchService=createMatchService({provider:rawProviderWithUnknownItalianTeam(),localizationLookup:lookup});
  const teams=await matchService.listFavoriteItalianTeams({providerTeamIds:['77']});
  assert.deepEqual(teams.map(team=>[team.id,team.nameRu]),[['77','Интер']]);
});

test('bootstrap filters configured local teams before asking Match Service to localize favorites', async () => {
  const matchService={
    async listFavoriteItalianTeams({providerTeamIds}={}){
      assert.deepEqual(providerTeamIds,['77']);
      return [{id:'77',nameRu:'Интер',crestUrl:'',countryCode:'IT'}];
    },
  };
  const userRepository={
    async syncTelegramProfile(){ return null; },
    async getProfile(){
      return {
        id:7,telegramId:446763142,displayName:'Даниил',username:'dan',favoriteTeam:null,
        settings:{deadlineReminders:true,lineupNotifications:false,kickoffNotifications:false,resultNotifications:false},
      };
    },
    async listTeams(){ return [{id:11,providerTeamId:'77'}]; },
    async listTeamsByProviderIds(){ throw new Error('provider_localization_happened_before_local_filter'); },
  };
  const service=createProfileService({
    userRepository,
    matchService,
    predictionRepository:{async statsForUser(){return{};}},
    rankingService:{async rankForUser(){return null;}},
  });

  const result=await service.getBootstrap({userId:7,tgUser:{id:446763142,first_name:'Даниил'}});
  assert.deepEqual(result.favoriteChoices.map(team=>[team.id,team.providerTeamId,team.nameRu]),[
    [11,'77','Интер'],
  ]);
});
