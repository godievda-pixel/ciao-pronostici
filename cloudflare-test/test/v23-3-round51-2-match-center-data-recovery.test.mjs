import test from 'node:test';
import assert from 'node:assert/strict';

import worker from '../src/worker.js';

function json(payload, status = 200) {
  return Response.json(payload, { status });
}

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

function eleven(prefix, startId) {
  return Array.from({ length:11 }, (_, index) => player(startId + index, `${prefix} ${index + 1}`));
}

test('Round 51.2 Worker recovers substitutes and ratings when the lazy Serie A lineups payload contains only 11+11 starters', async () => {
  const homeStarters = eleven('Home', 1);
  const awayStarters = eleven('Away', 101);
  const calls = [];
  const env = {
    CIAO_WEB_API:{
      fetch:async request => {
        const url = new URL(request.url);
        const body = await request.clone().json();
        calls.push({ path:url.pathname, body });
        assert.equal(url.pathname, '/api/ciao-match-center-fast-v3');
        if (calls.length === 1) {
          return json({
            ok:true,
            match:{ id:900, status:'finished', home:{ id:10, name:'Рома' }, away:{ id:20, name:'Аталанта' } },
            lineups:{ lineups:{
              home:{ formation:'3-4-2-1', starters:homeStarters, substitutes:[] },
              away:{ formation:'3-4-1-2', starters:awayStarters, substitutes:[] },
            } },
            player_stats:{ player_stats:[] },
          });
        }
        return json({
          ok:true,
          match:{ id:900, status:'finished', home:{ id:10, name:'Рома' }, away:{ id:20, name:'Аталанта' } },
          lineups:{ lineups:{
            home:{ formation:'3-4-2-1', starters:homeStarters, substitutes:[player(30, 'Home Bench', false)] },
            away:{ formation:'3-4-1-2', starters:awayStarters, substitutes:[player(130, 'Away Bench', false)] },
          } },
          player_stats:{ player_stats:[
            { player_id:1, name:'Home 1', rating:7.8 },
            { player_id:30, name:'Home Bench', rating:6.9 },
            { player_id:101, name:'Away 1', rating:8.1 },
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
  assert.equal(payload.data.data.home.substitutes[0].name, 'Home Bench');
  assert.equal(payload.data.data.home.substitutes[0].rating, 6.9);
  assert.equal(payload.data.data.away.substitutes[0].name, 'Away Bench');
  assert.equal(payload.data.data.away.substitutes[0].rating, 7.2);
});
