import test from 'node:test';
import assert from 'node:assert/strict';
import { createPredictionService } from '../../supabase/functions/ciao-v23-api/services/predictions.mjs';

const openMatch = {
  id:'ucl:u1',
  providerMatchId:'u1',
  competition:'ucl',
  competitionNameRu:'Лига чемпионов',
  kickoffAt:'2026-09-12T18:45:00Z',
  status:'scheduled',
  isItalianRelevant:true,
  isQualification:false,
};
const closedMatch = {
  ...openMatch,
  id:'ucl:u2',
  providerMatchId:'u2',
  kickoffAt:'2026-09-12T18:10:00Z',
};
const finishedMatch = {
  ...openMatch,
  id:'ucl:u3',
  providerMatchId:'u3',
  kickoffAt:'2026-09-11T18:45:00Z',
  status:'finished',
};

function fixture({matches=[openMatch,closedMatch,finishedMatch],saved=[]}={}) {
  const calls = [];
  const matchService = {
    async listMatches({competition}) {
      calls.push(['listMatches',competition]);
      return structuredClone(matches);
    },
    async getMatchCenter({competition,matchId,section}) {
      calls.push(['getMatchCenter',competition,matchId,section]);
      const match = matches.find(item => item.id === matchId);
      if (!match || match.isItalianRelevant === false) throw new Error('match_not_eligible');
      return {match:structuredClone(match),data:{}};
    },
  };
  const predictionRepository = {
    async listByUser(userId, competition) {
      calls.push(['listByUser',userId,competition]);
      return structuredClone(saved);
    },
    async save(input) {
      calls.push(['save',structuredClone(input)]);
      return {userId:input.userId,matchId:input.match.id,competition:input.match.competition,predictedHome:input.predictedHome,predictedAway:input.predictedAway,points:null,resultType:null,lockedAt:'2026-09-12T18:30:00.000Z'};
    },
  };
  return {service:createPredictionService({matchService,predictionRepository}),calls};
}

test('available predictions contain only open matches and attach an existing saved prediction', async () => {
  const saved = [{userId:7,matchId:'ucl:u1',competition:'ucl',predictedHome:2,predictedAway:1,points:null,resultType:null,lockedAt:'2026-09-12T18:30:00.000Z'}];
  const {service} = fixture({saved});

  const items = await service.available({userId:7,competition:'ucl',nowMs:Date.parse('2026-09-12T18:00:00Z')});

  assert.deepEqual(items.map(item => item.match.id), ['ucl:u1']);
  assert.equal(items[0].deadlineAt, '2026-09-12T18:30:00.000Z');
  assert.deepEqual(items[0].prediction, saved[0]);
});

test('mine preserves saved history even when the match is no longer in current provider lists', async () => {
  const saved = [{userId:7,matchId:'ucl:historic',competition:'ucl',predictedHome:1,predictedAway:0,points:5,resultType:'exact',lockedAt:'2026-03-01T18:30:00Z'}];
  const {service} = fixture({matches:[],saved});

  const items = await service.mine({userId:7,competition:'ucl'});

  assert.equal(items.length, 1);
  assert.deepEqual(items[0].prediction, saved[0]);
  assert.equal(items[0].match, null);
});

test('save resolves the canonical match through Match Service before repository persistence', async () => {
  const {service,calls} = fixture({matches:[openMatch]});
  const saved = await service.save({
    userId:7,
    competition:'ucl',
    matchId:'ucl:u1',
    home:2,
    away:1,
    nowMs:Date.parse('2026-09-12T18:00:00Z'),
  });

  assert.equal(saved.matchId, 'ucl:u1');
  assert.deepEqual(calls[0], ['getMatchCenter','ucl','ucl:u1','overview']);
  assert.equal(calls.filter(call => call[0] === 'save').length, 1);
  assert.equal(calls.find(call => call[0] === 'save')[1].match.id, 'ucl:u1');
});

test('ineligible European match cannot bypass Match Service and never reaches repository save', async () => {
  const foreign = {...openMatch,id:'ucl:foreign',providerMatchId:'foreign',isItalianRelevant:false};
  const {service,calls} = fixture({matches:[foreign]});

  await assert.rejects(
    () => service.save({userId:7,competition:'ucl',matchId:'ucl:foreign',home:1,away:0,nowMs:Date.parse('2026-09-12T18:00:00Z')}),
    /match_not_eligible/,
  );
  assert.equal(calls.filter(call => call[0] === 'save').length, 0);
});
