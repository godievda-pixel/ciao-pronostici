import test from 'node:test';
import assert from 'node:assert/strict';
import { PredictionLeague } from '../src/v23.3/prediction-league-do.mjs';

function cursor(values = [], rowsWritten = 0) {
  return { toArray: () => values, rowsWritten };
}

class FakeSql {
  constructor({ rankingRows = [] } = {}) {
    this.calls = [];
    this.predictions = new Map();
    this.participants = new Map();
    this.rankingRows = rankingRows;
    this.cacheGeneration = 0;
  }

  exec(query, ...params) {
    this.calls.push({ query, params });
    const q = String(query).replace(/\s+/g, ' ').trim();
    if (/^(BEGIN|COMMIT|ROLLBACK)/i.test(q)) return cursor();
    if (/CREATE TABLE|CREATE INDEX/i.test(q) || /INSERT OR (?:REPLACE|IGNORE) INTO schema_meta/i.test(q)) {
      return cursor();
    }
    if (/INSERT INTO participants/i.test(q)) {
      this.participants.set(params[0], { user_id: params[0], display_name: params[1], username: params[2] });
      return cursor([], 1);
    }
    if (/SELECT .* FROM predictions .*user_id.*match_id/i.test(q)) {
      const [userId, matchId] = params;
      const row = [...this.predictions.values()].find(item => item.user_id === userId && item.match_id === matchId);
      return cursor(row ? [row] : []);
    }
    if (/INSERT INTO predictions/i.test(q)) {
      const [predictionId,userId,matchId,competition,season,home,away,submittedAt,updatedAt,lockedAt] = params;
      this.predictions.set(predictionId, {
        prediction_id: predictionId, user_id:userId, match_id:matchId, competition, season,
        predicted_home:home, predicted_away:away, submitted_at:submittedAt, updated_at:updatedAt, locked_at:lockedAt,
        points:null,result_type:null,final_home:null,final_away:null,result_fingerprint:null,scored_at:null,
      });
      return cursor([], 1);
    }
    if (/UPDATE predictions SET/i.test(q) && /WHERE prediction_id/i.test(q)) {
      const [home,away,updatedAt,lockedAt,predictionId] = params;
      const row = this.predictions.get(predictionId);
      this.predictions.set(predictionId, {
        ...row,
        predicted_home:home,
        predicted_away:away,
        updated_at:updatedAt,
        locked_at:lockedAt,
        points:null,
        result_type:null,
        final_home:null,
        final_away:null,
        result_fingerprint:null,
        scored_at:null,
      });
      return cursor([], 1);
    }
    if (/SELECT .* FROM predictions .*prediction_id/i.test(q) && params.length === 1) {
      const row = this.predictions.get(params[0]);
      return cursor(row ? [row] : []);
    }
    if (/GROUP BY .*user_id/i.test(q)) return cursor(this.rankingRows);
    if (/DELETE FROM predictions/i.test(q)) {
      const n = this.predictions.size;
      this.predictions.clear();
      return cursor([], n);
    }
    if (/DELETE FROM ranking_snapshots/i.test(q)) return cursor([], 1);
    if (/DELETE FROM participants/i.test(q)) {
      const n = this.participants.size;
      this.participants.clear();
      return cursor([], n);
    }
    if (/UPDATE schema_meta/i.test(q) && /prediction_cache_generation/i.test(q)) {
      this.cacheGeneration += 1;
      return cursor([], 1);
    }
    return cursor();
  }
}

function stateWith(sql) {
  return { storage: { sql }, blockConcurrencyWhile: fn => fn() };
}

function writeRequest(home, away) {
  return new Request('https://do.internal/write', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      participant: { user_id:'telegram:42', display_name:'Daniil', username:'ciao42' },
      season:'2026-27',
      predictions:[{
        match_id:'ucl:601024',
        competition:'ucl',
        predicted_home:home,
        predicted_away:away,
        locked_at:'2026-09-16T18:45:00.000Z',
      }],
    }),
  });
}

test('PredictionLeague initializes TEST season metadata exactly once', async () => {
  const sql = new FakeSql();
  new PredictionLeague(stateWith(sql), { CIAO_ENV:'test', PREDICTION_SEASON:'2026-27' });
  await Promise.resolve();
  assert.equal(sql.calls.some(item => /schema_meta/i.test(item.query)), true);
  assert.equal(sql.calls.some(item => item.params.includes?.('2026-27')), true);
});

test('internal write is an upsert keyed by user and match while preserving prediction_id', async () => {
  const sql = new FakeSql();
  let uuidCalls = 0;
  const league = new PredictionLeague(stateWith(sql), {
    CIAO_ENV:'test',
    PREDICTION_SEASON:'2026-27',
    PREDICTION_RANDOM_UUID: () => `pred-${++uuidCalls}`,
  });
  const first = await (await league.fetch(writeRequest(2,1))).json();
  const second = await (await league.fetch(writeRequest(3,1))).json();
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(first.predictions[0].prediction_id, 'pred-1');
  assert.equal(second.predictions[0].prediction_id, 'pred-1');
  assert.equal(second.predictions[0].predicted_home, 3);
  assert.equal(uuidCalls, 1);
});

test('internal ranking ordering follows approved tie breakers', async () => {
  const sql = new FakeSql({ rankingRows: [
    { user_id:'telegram:3', display_name:'C', username:null, points:10, exact_scores:1, correct_outcomes:4, scored_predictions:5 },
    { user_id:'telegram:2', display_name:'B', username:null, points:10, exact_scores:2, correct_outcomes:3, scored_predictions:6 },
    { user_id:'telegram:1', display_name:'A', username:null, points:10, exact_scores:2, correct_outcomes:3, scored_predictions:5 },
  ] });
  const league = new PredictionLeague(stateWith(sql), { CIAO_ENV:'test', PREDICTION_SEASON:'2026-27' });
  const response = await league.fetch(new Request('https://do.internal/rankings?scope=overall'));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(body.ranking.map(row => row.user_id), ['telegram:1','telegram:2','telegram:3']);
});

test('internal reset clears prediction domain and increments cache generation only', async () => {
  const sql = new FakeSql();
  sql.predictions.set('p1', { prediction_id:'p1' });
  sql.predictions.set('p2', { prediction_id:'p2' });
  sql.participants.set('telegram:42', {});
  const league = new PredictionLeague(stateWith(sql), { CIAO_ENV:'test', PREDICTION_SEASON:'2026-27' });
  const response = await league.fetch(new Request('https://do.internal/reset', {
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({ environment:'test', season:'2026-27' }),
  }));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(body.stages, {
    predictions:{ok:true,affected:2},
    points:{ok:true,affected:2},
    ranking:{ok:true,affected:1},
    caches:{ok:true,affected:1},
  });
  assert.equal(sql.calls.some(item => /DELETE FROM schema_meta/i.test(item.query)), false);
  assert.equal(sql.cacheGeneration, 1);
});

test('internal reset rejects non-TEST identity before mutation', async () => {
  const sql = new FakeSql();
  const league = new PredictionLeague(stateWith(sql), { CIAO_ENV:'test', PREDICTION_SEASON:'2026-27' });
  const before = sql.calls.length;
  const response = await league.fetch(new Request('https://do.internal/reset', {
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({ environment:'production', season:'2026-27' }),
  }));
  assert.equal(response.status, 403);
  const mutationCalls = sql.calls.slice(before).filter(item => /DELETE|UPDATE schema_meta/i.test(item.query));
  assert.equal(mutationCalls.length, 0);
});
