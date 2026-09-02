import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveAuthenticatedUser } from '../src/v23.3/prediction-auth.mjs';
import { createPredictionService } from '../src/v23.3/prediction-service.mjs';
import { PredictionLeague } from '../src/v23.3/prediction-league-do.mjs';
import { createMatchesUiController } from '../src/v23.2/matches-ui.mjs';
import worker from '../src/worker.js';

function authRequest(path = '/api/v23.3/rankings') {
  return new Request(`https://ciao-web-app-test.example${path}`, {
    headers: { 'x-telegram-init-data':'signed-telegram-data' },
  });
}

function predictionNamespace(handler) {
  const requests = [];
  return {
    requests,
    idFromName() { return 'prediction-object'; },
    get() {
      return {
        async fetch(request) {
          requests.push(request);
          return handler(request);
        },
      };
    },
  };
}

test('prediction auth carries the existing legacy participant roster into the new rating domain', async () => {
  const user = await resolveAuthenticatedUser({
    request: authRequest(),
    env: {
      CIAO_WEB_API: {
        async fetch() {
          return Response.json({
            ok:true,
            data:{
              state:{
                user:{ id:42, first_name:'Daniil', username:'danx95' },
                standings:[
                  { id:42, display_name:'Daniil', username:'danx95' },
                  { id:77, display_name:'Anna', username:'anna77' },
                  { id:99, display_name:'Marco', username:null },
                ],
              },
            },
          });
        },
      },
    },
  });

  assert.equal(user.userId, 'telegram:42');
  assert.deepEqual(user.participants, [
    { userId:'telegram:42', displayName:'Daniil', username:'danx95' },
    { userId:'telegram:77', displayName:'Anna', username:'anna77' },
    { userId:'telegram:99', displayName:'Marco', username:null },
  ]);
});

test('ranking registers the full existing participant roster in one Durable Object call', async () => {
  const paths = [];
  const ns = predictionNamespace(async request => {
    const path = new URL(request.url).pathname;
    paths.push(path);
    if (path === '/participants') {
      const body = JSON.parse(await request.text());
      assert.deepEqual(body.participants, [
        { user_id:'telegram:42', display_name:'Daniil', username:'danx95' },
        { user_id:'telegram:77', display_name:'Anna', username:'anna77' },
      ]);
      return Response.json({ ok:true, participants:body.participants });
    }
    if (path === '/rankings') {
      return Response.json({ ok:true, ranking:[
        { user_id:'telegram:42', display_name:'Daniil', username:'danx95', points:0 },
        { user_id:'telegram:77', display_name:'Anna', username:'anna77', points:0 },
      ] });
    }
    throw new Error(`unexpected path ${path}`);
  });

  const service = createPredictionService({
    request:authRequest(),
    env:{ CIAO_ENV:'test', PREDICTION_SEASON:'2026-27', PREDICTION_LEAGUE:ns },
    deps:{
      resolveAuthenticatedUser:async () => ({
        userId:'telegram:42', displayName:'Daniil', username:'danx95',
        participants:[
          { userId:'telegram:42', displayName:'Daniil', username:'danx95' },
          { userId:'telegram:77', displayName:'Anna', username:'anna77' },
        ],
      }),
      listCanonicalPredictionMatches:async () => ({ matches:[], errors:{} }),
    },
  });

  const ranking = await service.rankings({ scope:'overall' });
  assert.deepEqual(paths, ['/participants', '/rankings']);
  assert.equal(ranking.length, 2);
});

class TinySql {
  constructor() { this.participants = new Map(); }
  exec(query, ...params) {
    const q = String(query).replace(/\s+/g, ' ').trim();
    if (/INSERT INTO participants/i.test(q)) {
      this.participants.set(params[0], {
        user_id:params[0], display_name:params[1], username:params[2],
      });
      return { toArray:() => [], rowsWritten:1 };
    }
    return { toArray:() => [], rowsWritten:0 };
  }
}

test('PredictionLeague batch-registers participant roster atomically', async () => {
  const sql = new TinySql();
  const state = {
    storage:{
      sql,
      transactionSync(fn) { return fn(); },
    },
    blockConcurrencyWhile(fn) { return fn(); },
  };
  const league = new PredictionLeague(state, { CIAO_ENV:'test', PREDICTION_SEASON:'2026-27' });
  const response = await league.fetch(new Request('https://prediction-league.internal/participants', {
    method:'POST',
    headers:{ 'content-type':'application/json' },
    body:JSON.stringify({
      season:'2026-27',
      participants:[
        { user_id:'telegram:42', display_name:'Daniil', username:'danx95' },
        { user_id:'telegram:77', display_name:'Anna', username:'anna77' },
      ],
    }),
  }));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.participants.length, 2);
  assert.deepEqual([...sql.participants.keys()], ['telegram:42', 'telegram:77']);
});

test('Serie A standings preserve the stable logo_url supplied by ciao-web-api', async () => {
  const response = await worker.fetch(
    authRequest('/api/v23.3/standings?competition=serie_a'),
    {
      CIAO_WEB_API:{
        async fetch() {
          return Response.json({
            ok:true,
            serie_a_table:{
              rows:[{
                position:1,
                team:{ id:65, name:'Рома', logo_url:'https://img.test/roma.svg' },
                played:2,
                points:6,
              }],
            },
          });
        },
      },
      ASSETS:{ fetch:async () => new Response('asset') },
    },
  );
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.data.rows[0].team.crestUrl, 'https://img.test/roma.svg');
});

test('Serie A Matches restores the previous stable legacy calendar instead of the generic tournament screen', async () => {
  const shown = [];
  let hidden = 0;
  const loaded = [];
  const controller = createMatchesUiController({
    show(html) { shown.push(html); },
    hide() { hidden += 1; },
    async loadScreen(competition) {
      loaded.push(competition);
      return `<section>${competition}</section>`;
    },
  });

  controller.openHub();
  const result = await controller.openCompetition('serie_a');

  assert.equal(result, 'legacy');
  assert.equal(hidden, 1);
  assert.deepEqual(loaded, []);
});

// CI-only delayed live probe trigger; no runtime behavior changes.
