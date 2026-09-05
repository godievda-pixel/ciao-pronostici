import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SERIE_A_SECTION_REQUESTS,
  loadSerieAMatchCenterSection,
} from '../src/v23.3/serie-a-match-center-provider.mjs';

function json(payload, status = 200) {
  return Response.json(payload, { status });
}

test('Round 51.1 Lineups requests player stats together with the lineup payload', () => {
  assert.deepEqual([...SERIE_A_SECTION_REQUESTS.lineups], ['lineups','player_stats']);
});

test('Round 51.1 Serie A lineups preserve bench aliases and merge provider ratings by player id', async () => {
  const calls = [];
  const env = {
    CIAO_WEB_API:{
      fetch:async request => {
        const body = await request.clone().json();
        calls.push(body);
        return json({
          ok:true,
          match:{
            id:900,
            status:'finished',
            home:{ id:10, name:'Рома' },
            away:{ id:20, name:'Аталанта' },
          },
          lineups:{
            lineups:{
              home:{
                formation:'3-4-2-1',
                players:[
                  { id:1, short_name:'Starter Home', number:1, position:'GK' },
                ],
                subs:[
                  { id:12, short_name:'Bench Home', number:12, position:'MF' },
                ],
              },
              away:{
                formation:'3-4-1-2',
                players:[
                  { id:21, short_name:'Starter Away', number:21, position:'FW' },
                ],
                substitute_players:[
                  { id:29, short_name:'Bench Away', number:29, position:'MF' },
                ],
              },
            },
          },
          player_stats:{
            player_stats:[
              { player_id:1, name:'Starter Home', rating:7.8 },
              { player_id:12, name:'Bench Home', rating:6.9 },
              { player_id:21, name:'Starter Away', rating:8.2 },
              { player_id:29, name:'Bench Away', rating:7.1 },
            ],
          },
        });
      },
    },
  };

  const result = await loadSerieAMatchCenterSection({
    request:new Request('https://test.local/api/v23.3/match-center'),
    env,
    initData:'signed-user',
    matchId:'serie_a:900',
    section:'lineups',
  });

  assert.deepEqual(calls[0].sections, ['lineups','player_stats']);
  assert.equal(result.available, true);
  assert.equal(result.data.home.starters[0].rating, 7.8);
  assert.equal(result.data.home.substitutes.length, 1);
  assert.equal(result.data.home.substitutes[0].name, 'Bench Home');
  assert.equal(result.data.home.substitutes[0].rating, 6.9);
  assert.equal(result.data.away.starters[0].rating, 8.2);
  assert.equal(result.data.away.substitutes.length, 1);
  assert.equal(result.data.away.substitutes[0].name, 'Bench Away');
  assert.equal(result.data.away.substitutes[0].rating, 7.1);
});
