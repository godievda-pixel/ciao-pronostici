import test from 'node:test';
import assert from 'node:assert/strict';

import worker from '../src/worker.js';
import {
  recoverRound512SerieASection,
  round512NeedsCanonicalSectionRecovery,
} from '../src/v23.3/round51-2-serie-a-provider-recovery.mjs';

function player(id, name, starter = true, rating = undefined) {
  return {
    id,
    short_name:name,
    number:id,
    position:'MF',
    starter,
    ...(rating === undefined ? {} : { rating }),
  };
}

function lineupSide(prefix, startId) {
  return {
    starters:Array.from({ length:11 }, (_, index) => player(startId + index, `${prefix} ${index + 1}`)),
    substitutes:[],
  };
}

test('Round 51.2 recovery gate detects exactly 11+11 starters with no substitutes', () => {
  const sectionPayload = {
    section:'lineups',
    available:true,
    data:{
      home:lineupSide('Home', 1),
      away:lineupSide('Away', 101),
    },
  };

  assert.equal(round512NeedsCanonicalSectionRecovery(sectionPayload, 'lineups'), true);
  assert.equal(round512NeedsCanonicalSectionRecovery(sectionPayload, 'players'), false);
});

test('Round 51.2 recovery maps the second Serie A payload to substitutes with ratings', async () => {
  const calls = [];
  const env = {
    CIAO_WEB_API:{
      fetch:async request => {
        const url = new URL(request.url);
        const body = await request.clone().json();
        calls.push({ path:url.pathname, body });
        return Response.json({
          ok:true,
          match:{ id:900, status:'finished', home:{ id:10, name:'Рома' }, away:{ id:20, name:'Аталанта' } },
          lineups:{ lineups:{
            home:{ ...lineupSide('Home', 1), substitutes:[player(30, 'Home Bench', false)] },
            away:{ ...lineupSide('Away', 101), substitutes:[player(130, 'Away Bench', false)] },
          } },
          player_stats:{ player_stats:[
            { player_id:30, name:'Home Bench', rating:6.9 },
            { player_id:130, name:'Away Bench', rating:7.2 },
          ] },
        });
      },
    },
  };

  const result = await recoverRound512SerieASection({
    request:new Request('https://test.local/api/v23.3/match-center'),
    env,
    initData:'signed-user',
    matchId:'serie_a:900',
    section:'lineups',
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].path, '/api/ciao-match-center-fast-v3');
  assert.deepEqual(calls[0].body.sections, ['lineups','player_stats']);
  assert.equal(result.data.home.substitutes[0].name, 'Home Bench');
  assert.equal(result.data.home.substitutes[0].rating, 6.9);
  assert.equal(result.data.away.substitutes[0].name, 'Away Bench');
  assert.equal(result.data.away.substitutes[0].rating, 7.2);
});

test('Round 51.2 Worker recovers substitutes and ratings when the lazy Serie A payload contains only 11+11 starters', async () => {
  const calls = [];
  const env = {
    CIAO_WEB_API:{
      fetch:async request => {
        const url = new URL(request.url);
        const body = await request.clone().json();
        calls.push({ path:url.pathname, body });
        if (calls.length === 1) {
          return Response.json({
            ok:true,
            match:{ id:900, status:'finished', home:{ id:10, name:'Рома' }, away:{ id:20, name:'Аталанта' } },
            lineups:{ lineups:{
              home:lineupSide('Home', 1),
              away:lineupSide('Away', 101),
            } },
            player_stats:{ player_stats:[] },
          });
        }
        return Response.json({
          ok:true,
          match:{ id:900, status:'finished', home:{ id:10, name:'Рома' }, away:{ id:20, name:'Аталанта' } },
          lineups:{ lineups:{
            home:{ ...lineupSide('Home', 1), substitutes:[player(30, 'Home Bench', false)] },
            away:{ ...lineupSide('Away', 101), substitutes:[player(130, 'Away Bench', false)] },
          } },
          player_stats:{ player_stats:[
            { player_id:30, name:'Home Bench', rating:6.9 },
            { player_id:130, name:'Away Bench', rating:7.2 },
          ] },
        });
      },
    },
  };

  const response = await worker.fetch(new Request(
    'https://test.local/api/v23.3/match-center?competition=serie_a&match_id=serie_a%3A900&section=lineups',
    { headers:{ 'x-telegram-init-data':'signed-user' } },
  ), env, {});

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0].body.sections, ['lineups','player_stats']);
  assert.deepEqual(calls[1].body.sections, ['lineups','player_stats']);
  assert.equal(payload.data.data.home.substitutes[0].name, 'Home Bench');
  assert.equal(payload.data.data.home.substitutes[0].rating, 6.9);
  assert.equal(payload.data.data.away.substitutes[0].name, 'Away Bench');
  assert.equal(payload.data.data.away.substitutes[0].rating, 7.2);
});

test('Round 51.2 Worker restores a shot author from player_id and player_stats', async () => {
  const calls = [];
  const shot = { pos:{ x:74, y:38 }, home:true, xg:0.31, minute:64, player_id:77, result:'saved' };
  const env = {
    CIAO_WEB_API:{
      fetch:async request => {
        const body = await request.clone().json();
        calls.push(body);
        if (calls.length === 1) {
          return Response.json({
            ok:true,
            match:{ id:901, status:'finished', home:{ id:10, name:'Рома' }, away:{ id:20, name:'Аталанта' } },
            stats:{
              stats:{ home:{ total_shots:1 }, away:{ total_shots:0 } },
              shotmap:[shot],
            },
          });
        }
        return Response.json({
          ok:true,
          match:{ id:901, status:'finished', home:{ id:10, name:'Рома' }, away:{ id:20, name:'Аталанта' } },
          stats:{
            stats:{ home:{ total_shots:1 }, away:{ total_shots:0 } },
            shotmap:[shot],
          },
          player_stats:{ player_stats:[
            { player_id:77, short_name:'Paulo Dybala', team_id:10, rating:7.6 },
          ] },
        });
      },
    },
  };

  const response = await worker.fetch(new Request(
    'https://test.local/api/v23.3/match-center?competition=serie_a&match_id=serie_a%3A901&section=stats',
    { headers:{ 'x-telegram-init-data':'signed-user' } },
  ), env, {});

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0].sections, ['stats','overview_meta']);
  assert.deepEqual(calls[1].sections, ['stats','overview_meta','player_stats']);
  assert.equal(payload.data.data.shots[0].player, 'Paulo Dybala');
});
