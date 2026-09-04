import test from 'node:test';
import assert from 'node:assert/strict';
import {
  loadMatchCenterBase,
  loadMatchCenterSection,
} from '../src/v23.3/data-client.mjs';
import {
  createMatchCenterSectionCache,
  matchCenterSectionTtl,
} from '../src/v23.3/match-center-section-cache.mjs';

function jsonResponse(data) {
  return new Response(JSON.stringify({ ok:true, data }), {
    status:200,
    headers:{ 'content-type':'application/json' },
  });
}

function sectionFromUrl(url) {
  return new URL(String(url), 'https://ciao.test').searchParams.get('section');
}

test('Round 18 keeps Match Center section cache keys isolated', async () => {
  let calls = 0;
  const fetchImpl = async url => {
    calls += 1;
    const section = sectionFromUrl(url);
    return jsonResponse({
      competition:'ucl',
      matchId:'ucl:77',
      section,
      data:{ marker:section },
    });
  };

  const options = { initData:'signed-user', fetchImpl };
  const stats = await loadMatchCenterSection('ucl', 'ucl:77', 'stats', options);
  const events = await loadMatchCenterSection('ucl', 'ucl:77', 'events', options);
  const statsAgain = await loadMatchCenterSection('ucl', 'ucl:77', 'stats', options);

  assert.equal(stats.data.marker, 'stats');
  assert.equal(events.data.marker, 'events');
  assert.equal(statsAgain.data.marker, 'stats');
  assert.equal(calls, 2);
});

test('Round 18 dedupes simultaneous requests for the same Match Center section', async () => {
  let calls = 0;
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const fetchImpl = async url => {
    calls += 1;
    await gate;
    const section = sectionFromUrl(url);
    return jsonResponse({
      competition:'ucl',
      matchId:'ucl:88',
      section,
      data:{ marker:'shared' },
    });
  };

  const options = { initData:'signed-user', fetchImpl };
  const first = loadMatchCenterSection('ucl', 'ucl:88', 'stats', options);
  const second = loadMatchCenterSection('ucl', 'ucl:88', 'stats', options);
  await Promise.resolve();
  assert.equal(calls, 1);
  release();

  const [a, b] = await Promise.all([first, second]);
  assert.deepEqual(a, b);
  assert.equal(calls, 1);
});

test('Round 18 uses a shorter section TTL for LIVE than finished matches', () => {
  assert.ok(matchCenterSectionTtl('live') < matchCenterSectionTtl('finished'));
  assert.equal(matchCenterSectionTtl('live'), 10_000);
  assert.equal(matchCenterSectionTtl('finished'), 5 * 60_000);
});

test('Round 18 section cache is bounded and evicts the oldest entry', () => {
  let now = 1_000;
  const cache = createMatchCenterSectionCache({
    maxEntries:2,
    now:() => now,
  });

  cache.set('ucl\nucl:1\nstats', { marker:1 }, { status:'finished' });
  now += 1;
  cache.set('ucl\nucl:1\nevents', { marker:2 }, { status:'finished' });
  now += 1;
  cache.set('ucl\nucl:1\nplayers', { marker:3 }, { status:'finished' });

  assert.equal(cache.size, 2);
  assert.equal(cache.get('ucl\nucl:1\nstats'), null);
  assert.deepEqual(cache.get('ucl\nucl:1\nevents'), { marker:2 });
  assert.deepEqual(cache.get('ucl\nucl:1\nplayers'), { marker:3 });
});

test('Round 18 exposes a base loader while preserving the legacy snapshot loader migration path', async () => {
  let calls = 0;
  const fetchImpl = async url => {
    calls += 1;
    assert.equal(sectionFromUrl(url), null);
    return jsonResponse({
      competition:'ucl',
      match:{ matchId:'ucl:99', status:'scheduled' },
    });
  };

  const value = await loadMatchCenterBase('ucl', 'ucl:99', {
    initData:'signed-user',
    fetchImpl,
  });

  assert.equal(value.match.matchId, 'ucl:99');
  assert.equal(calls, 1);
});
