import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getMatchBootstrap,
  rememberMatchBootstrap,
} from '../src/v23.3/match-bootstrap-cache.mjs';
import { loadMatchCenterSnapshot } from '../src/v23.3/data-client.mjs';

test('Round 17 remembers canonical match bootstrap by competition and match id', () => {
  rememberMatchBootstrap({
    competition:'ucl',
    matchId:'ucl:8001',
    kickoffAt:'2026-09-10T19:00:00Z',
    homeTeam:{ name:'Интер' },
    awayTeam:{ name:'Арсенал' },
  });
  assert.equal(getMatchBootstrap('ucl', 'ucl:8001')?.homeTeam?.name, 'Интер');
  assert.equal(getMatchBootstrap('uel', 'ucl:8001'), null);
});

function jsonResponse(data) {
  return new Response(JSON.stringify({ ok:true, data }), {
    status:200,
    headers:{ 'content-type':'application/json' },
  });
}

test('Round 17 Match Center client deduplicates simultaneous identical requests', async () => {
  let calls = 0;
  let release;
  const wait = new Promise(resolve => { release = resolve; });
  const fetchImpl = async () => {
    calls += 1;
    await wait;
    return jsonResponse({
      competition:'ucl',
      provider:'bsd-v2',
      match:{ competition:'ucl', matchId:'ucl:8002', status:'scheduled' },
    });
  };

  const first = loadMatchCenterSnapshot('ucl', 'ucl:8002', { initData:'user-a', fetchImpl });
  const second = loadMatchCenterSnapshot('ucl', 'ucl:8002', { initData:'user-a', fetchImpl });
  assert.equal(calls, 1);
  release();
  const [a, b] = await Promise.all([first, second]);
  assert.equal(a.match.matchId, 'ucl:8002');
  assert.equal(b.match.matchId, 'ucl:8002');
  assert.equal(calls, 1);
});

test('Round 17 Match Center scheduled snapshot is cached while force refresh bypasses cache', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return jsonResponse({
      competition:'uel',
      provider:'bsd-v2',
      match:{ competition:'uel', matchId:'uel:8003', status:'scheduled', minute:null },
    });
  };

  await loadMatchCenterSnapshot('uel', 'uel:8003', { initData:'user-b', fetchImpl });
  await loadMatchCenterSnapshot('uel', 'uel:8003', { initData:'user-b', fetchImpl });
  assert.equal(calls, 1);

  await loadMatchCenterSnapshot('uel', 'uel:8003', { initData:'user-b', fetchImpl, force:true });
  assert.equal(calls, 2);
});
