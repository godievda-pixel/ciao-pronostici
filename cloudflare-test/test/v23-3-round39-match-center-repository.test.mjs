import test from 'node:test';
import assert from 'node:assert/strict';
import { createMatchCenterRepository } from '../src/v23.3/match-center-repository.mjs';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

test('repository deduplicates simultaneous base requests for the same canonical match', async () => {
  const pending = deferred();
  let calls = 0;
  const repository = createMatchCenterRepository({
    loadBase:(competition, matchId, options) => {
      calls += 1;
      assert.equal(competition, 'ucl');
      assert.equal(matchId, 'ucl:77');
      assert.equal(options.force, false);
      return pending.promise;
    },
    loadSection:async () => null,
  });

  const first = repository.base('ucl', 'ucl:77');
  const second = repository.base('ucl', 'ucl:77');
  assert.equal(first, second);
  assert.equal(calls, 1);

  pending.resolve({ competition:'ucl', matchId:'ucl:77' });
  assert.deepEqual(await first, { competition:'ucl', matchId:'ucl:77' });
});

test('repository force refresh issues a new request after an earlier result', async () => {
  let calls = 0;
  const repository = createMatchCenterRepository({
    loadBase:async (_competition, _matchId, options) => ({ call:++calls, force:options.force }),
    loadSection:async () => null,
  });

  assert.deepEqual(await repository.base('serie_a', 'serie_a:10'), { call:1, force:false });
  assert.deepEqual(await repository.base('serie_a', 'serie_a:10', { force:true }), { call:2, force:true });
  assert.equal(calls, 2);
});

test('repository validates section before I/O and forwards live status/force to the client', async () => {
  let calls = 0;
  const repository = createMatchCenterRepository({
    loadBase:async () => null,
    loadSection:async (competition, matchId, section, options) => {
      calls += 1;
      return { competition, matchId, section, options };
    },
  });

  await assert.rejects(
    () => repository.section('ucl', 'ucl:77', 'weather'),
    /invalid_match_center_section/,
  );
  assert.equal(calls, 0);

  const result = await repository.section('ucl', 'ucl:77', 'stats', { force:true, status:'live' });
  assert.equal(result.competition, 'ucl');
  assert.equal(result.matchId, 'ucl:77');
  assert.equal(result.section, 'stats');
  assert.deepEqual(result.options, { force:true, status:'live' });
  assert.equal(calls, 1);
});

test('repository keeps different matches and sections in separate inflight slots', async () => {
  const calls = [];
  const repository = createMatchCenterRepository({
    loadBase:(competition, matchId) => {
      calls.push(`base:${competition}:${matchId}`);
      return Promise.resolve(matchId);
    },
    loadSection:(competition, matchId, section) => {
      calls.push(`section:${competition}:${matchId}:${section}`);
      return Promise.resolve(section);
    },
  });

  await Promise.all([
    repository.base('ucl', 'ucl:1'),
    repository.base('ucl', 'ucl:2'),
    repository.section('ucl', 'ucl:1', 'overview'),
    repository.section('ucl', 'ucl:1', 'stats'),
  ]);

  assert.deepEqual(calls.sort(), [
    'base:ucl:ucl:1',
    'base:ucl:ucl:2',
    'section:ucl:ucl:1:overview',
    'section:ucl:ucl:1:stats',
  ]);
});
