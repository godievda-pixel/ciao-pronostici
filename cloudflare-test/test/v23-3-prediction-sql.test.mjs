import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PREDICTION_SCHEMA_VERSION,
  PREDICTION_SCHEMA_SQL,
  predictionObjectName,
  rankingScope,
  initializePredictionSchema,
} from '../src/v23.3/prediction-sql.mjs';

test('prediction object identity is environment and season scoped', () => {
  assert.equal(
    predictionObjectName({ environment: 'test', season: '2026-27' }),
    'prediction-league:test:2026-27',
  );
  assert.throws(
    () => predictionObjectName({ environment: 'production', season: '2026-27' }),
    /TEST prediction backend/i,
  );
});

test('SQLite schema contains the four approved tables and uniqueness rules', () => {
  assert.equal(PREDICTION_SCHEMA_VERSION, '1');
  assert.match(PREDICTION_SCHEMA_SQL, /CREATE TABLE IF NOT EXISTS schema_meta/i);
  assert.match(PREDICTION_SCHEMA_SQL, /CREATE TABLE IF NOT EXISTS participants/i);
  assert.match(PREDICTION_SCHEMA_SQL, /CREATE TABLE IF NOT EXISTS predictions/i);
  assert.match(PREDICTION_SCHEMA_SQL, /CREATE TABLE IF NOT EXISTS ranking_snapshots/i);
  assert.match(PREDICTION_SCHEMA_SQL, /UNIQUE\s*\(\s*user_id\s*,\s*match_id\s*\)/i);
  assert.match(PREDICTION_SCHEMA_SQL, /predicted_home[^;]*CHECK[^;]*BETWEEN 0 AND 20/is);
  assert.match(PREDICTION_SCHEMA_SQL, /predicted_away[^;]*CHECK[^;]*BETWEEN 0 AND 20/is);
});

test('ranking scope is finite and canonical', () => {
  assert.equal(rankingScope({ scope: 'overall' }), 'overall');
  assert.equal(
    rankingScope({ scope: 'competition', competition: 'ucl' }),
    'competition:ucl',
  );
  assert.throws(() => rankingScope({ scope: 'competition' }), /competition/i);
  assert.throws(() => rankingScope({ scope: 'other' }), /scope/i);
});

test('schema initialization is TEST-only and seeds stable metadata', () => {
  const calls = [];
  const sql = {
    exec(query, ...params) {
      calls.push({ query, params });
      return { toArray: () => [] };
    },
  };

  initializePredictionSchema(sql, { environment: 'test', season: '2026-27' });

  assert.equal(
    calls.some(item => item.query.includes('CREATE TABLE IF NOT EXISTS predictions')),
    true,
  );
  assert.equal(
    calls.some(item => item.params.includes('schema_version') && item.params.includes('1')),
    true,
  );
  assert.equal(
    calls.some(item => item.params.includes('environment') && item.params.includes('test')),
    true,
  );
  assert.equal(
    calls.some(item => item.params.includes('season') && item.params.includes('2026-27')),
    true,
  );
  assert.equal(
    calls.some(item => item.params.includes('prediction_cache_generation') && item.params.includes('0')),
    true,
  );

  const blocked = { exec() { throw new Error('SQL must not run'); } };
  assert.throws(
    () => initializePredictionSchema(blocked, { environment: 'production', season: '2026-27' }),
    /TEST prediction backend/i,
  );
});
