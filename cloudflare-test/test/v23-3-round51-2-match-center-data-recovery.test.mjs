import test from 'node:test';
import assert from 'node:assert/strict';

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
