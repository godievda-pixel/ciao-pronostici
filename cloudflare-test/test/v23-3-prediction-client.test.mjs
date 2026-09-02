import test from 'node:test';
import assert from 'node:assert/strict';
import { createPredictionClient } from '../src/v23.3/prediction-client.mjs';

test('prediction client always sends Telegram init data and uses v23.3 routes', async () => {
  const requests = [];
  const client = createPredictionClient({
    initData: 'signed-init',
    origin: 'https://ciao-web-app-test.ciao-web.workers.dev',
    fetchImpl: async request => {
      requests.push(request);
      return Response.json({ ok:true, data:[] });
    },
  });
  await client.available('all');
  await client.save({ competition_key:'ucl', predictions:[{ match_id:'ucl:1', home_score:1, away_score:0 }] });
  assert.equal(requests.every(req => req.headers.get('x-telegram-init-data') === 'signed-init'), true);
  assert.equal(new URL(requests[0].url).pathname, '/api/v23.3/predictions/available');
  assert.equal(new URL(requests[1].url).pathname, '/api/v23.3/predictions');
});

test('prediction client exposes server error code and status', async () => {
  const client = createPredictionClient({
    initData:'signed',
    origin:'https://ciao-web-app-test.ciao-web.workers.dev',
    fetchImpl: async () => Response.json({ ok:false, error:'prediction_locked' }, { status:409 }),
  });
  await assert.rejects(
    client.save({ competition_key:'ucl', predictions:[{ match_id:'ucl:1', home_score:1, away_score:0 }] }),
    error => error.code === 'prediction_locked' && error.status === 409,
  );
});

test('ranking client uses canonical overall and competition queries', async () => {
  const requests=[];
  const client=createPredictionClient({
    initData:'signed',origin:'https://ciao-web-app-test.ciao-web.workers.dev',
    fetchImpl:async request=>{requests.push(request);return Response.json({ok:true,data:[]});},
  });
  await client.rankings({scope:'overall'});
  await client.rankings({scope:'competition',competition:'ucl'});
  assert.equal(new URL(requests[0].url).searchParams.get('scope'),'overall');
  assert.equal(new URL(requests[1].url).searchParams.get('competition'),'ucl');
});
