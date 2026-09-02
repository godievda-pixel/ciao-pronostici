import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { listCanonicalPredictionMatches } from '../src/v23.3/prediction-match-resolver.mjs';
import worker from '../src/worker.js';

function legacyStatePayload() {
  return {
    ok:true,
    selected_round:3,
    round:{
      number:3,
      matches:[{
        id:101,
        kickoff_at:'2026-09-10T19:00:00Z',
        status:'SCHEDULED',
        home:{ id:65, name:'Рома', logo:'https://img.test/roma.png' },
        away:{ id:77, name:'Интер', logo:'https://img.test/inter.png' },
      }],
    },
  };
}

test('ranking rows are isolated from legacy pos/person/pts/list-row classes so typography stays aligned', async () => {
  const source = await readFile(new URL('../src/v23.3/ranking-ui.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /class="list-row cw233-ranking-row/);
  assert.doesNotMatch(source, /class="pos"/);
  assert.doesNotMatch(source, /class="person"/);
  assert.doesNotMatch(source, /class="pts"/);
  assert.match(source, /cw233-ranking-position-value/);
  assert.match(source, /cw233-ranking-name/);
  assert.match(source, /cw233-ranking-points-value/);
  assert.match(source, /cw233-ranking-points-unit/);
});

test('Serie A standings use the same legacy state team logos as stable v22.5 when table rows omit crests', async () => {
  const upstreamCalls = [];
  const response = await worker.fetch(
    new Request('https://ciao-web-app-test.example/api/v23.3/standings?competition=serie_a', {
      headers:{ 'x-telegram-init-data':'tg' },
    }),
    {
      CIAO_WEB_API:{
        async fetch(request) {
          const url = new URL(request.url);
          let body = {};
          try { body = await request.clone().json(); } catch {}
          upstreamCalls.push(`${url.pathname}:${body.action || ''}`);
          if (url.pathname === '/api/ciao-core-api-fast-v4' && body.action === 'serie_a_table') {
            return Response.json({
              ok:true,
              serie_a_table:{ rows:[{
                position:1,
                team:{ id:65, name:'Рома' },
                played:2,
                goal_difference:4,
                points:6,
              }] },
            });
          }
          if (url.pathname === '/api/ciao-core-api-fast-v4' && body.action === 'state') {
            return Response.json(legacyStatePayload());
          }
          if (url.pathname === '/api/ciao-schedule-fast-v1') {
            return new Response('schedule unavailable', { status:503 });
          }
          throw new Error(`unexpected upstream ${url.pathname}`);
        },
      },
      ASSETS:{ fetch:async () => new Response('asset') },
    },
  );

  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.data.rows[0].team.crestUrl, 'https://img.test/roma.png');
  assert.ok(upstreamCalls.includes('/api/ciao-core-api-fast-v4:state'));
});

test('Serie A prediction feed falls back to the proven v22.5 state round instead of depending on schedule-fast', async () => {
  const calls = [];
  const result = await listCanonicalPredictionMatches({
    request:new Request('https://ciao-web-app-test.example/api/v23.3/predictions/available?competition=serie_a', {
      headers:{ 'x-telegram-init-data':'tg' },
    }),
    env:{
      PREDICTION_SEASON:'2026-27',
      CIAO_WEB_API:{
        async fetch(request) {
          const url = new URL(request.url);
          let body = {};
          try { body = await request.clone().json(); } catch {}
          calls.push(`${url.pathname}:${body.action || ''}`);
          if (url.pathname === '/api/ciao-core-api-fast-v4' && body.action === 'state') {
            return Response.json(legacyStatePayload());
          }
          if (url.pathname === '/api/ciao-schedule-fast-v1') {
            return new Response('schedule unavailable', { status:503 });
          }
          throw new Error(`unexpected upstream ${url.pathname}`);
        },
      },
    },
    competition:'serie_a',
    now:new Date('2026-09-02T18:00:00Z'),
  });

  assert.equal(result.matches.length, 1);
  assert.equal(result.matches[0].competition, 'serie_a');
  assert.equal(result.matches[0].matchId, 'serie_a:101');
  assert.equal(result.matches[0].season, '2026-27');
  assert.equal(result.matches[0].homeTeam.crestUrl, 'https://img.test/roma.png');
  assert.ok(calls.includes('/api/ciao-core-api-fast-v4:state'));
});
