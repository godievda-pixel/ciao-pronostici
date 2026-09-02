import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PREDICTION_SCHEMA_VERSION,
  PREDICTION_SCHEMA_SQL,
  predictionObjectName,
  rankingScope,
  initializePredictionSchema,
  queryRanking,
  queryRankingMe,
} from '../src/v23.3/prediction-sql.mjs';

test('prediction object identity is environment and season scoped', () => {
  assert.equal(predictionObjectName({ environment: 'test', season: '2026-27' }), 'prediction-league:test:2026-27');
  assert.throws(() => predictionObjectName({ environment: 'production', season: '2026-27' }), /TEST prediction backend/i);
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
  assert.equal(rankingScope({ scope: 'competition', competition: 'ucl' }), 'competition:ucl');
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
  assert.equal(calls.some(item => item.query.includes('CREATE TABLE IF NOT EXISTS predictions')), true);
  assert.equal(calls.some(item => item.params.includes('schema_version') && item.params.includes('1')), true);
  assert.equal(calls.some(item => item.params.includes('environment') && item.params.includes('test')), true);
  assert.equal(calls.some(item => item.params.includes('season') && item.params.includes('2026-27')), true);
  assert.equal(calls.some(item => item.params.includes('prediction_cache_generation') && item.params.includes('0')), true);

  const blocked = { exec() { throw new Error('SQL must not run'); } };
  assert.throws(() => initializePredictionSchema(blocked, { environment: 'production', season: '2026-27' }), /TEST prediction backend/i);
});

test('prediction row normalization preserves nullable scoring state', async () => {
  const { normalizePredictionRow, rows } = await import('../src/v23.3/prediction-sql.mjs');
  assert.deepEqual(rows({ toArray: () => [{ id: 1 }] }), [{ id: 1 }]);
  assert.deepEqual(
    normalizePredictionRow({
      prediction_id: 'p1', user_id: 'telegram:42', match_id: 'ucl:1', competition: 'ucl', season: '2026-27',
      predicted_home: 2, predicted_away: 1, submitted_at: 's', updated_at: 'u', locked_at: 'l',
      points: null, result_type: null, final_home: null, final_away: null, result_fingerprint: null, scored_at: null,
    }),
    {
      prediction_id: 'p1', user_id: 'telegram:42', match_id: 'ucl:1', competition: 'ucl', season: '2026-27',
      predicted_home: 2, predicted_away: 1, submitted_at: 's', updated_at: 'u', locked_at: 'l',
      points: null, result_type: null, final_home: null, final_away: null, result_fingerprint: null, scored_at: null,
    },
  );
});

test('ranking includes a registered participant before the first prediction is submitted', () => {
  const calls = [];
  const sql = {
    exec(query, ...params) {
      calls.push({ query, params });
      if (/FROM participants u\s+LEFT JOIN predictions p/i.test(String(query).replace(/\s+/g, ' '))) {
        return { toArray: () => [{
          user_id:'telegram:42', display_name:'Daniil', username:'ciao42', points:0,
          exact_scores:0, correct_outcomes:0, scored_predictions:0,
        }] };
      }
      return { toArray: () => [] };
    },
  };
  const ranking = queryRanking(sql, { scope:'overall' });
  assert.equal(ranking.length, 1);
  assert.deepEqual(ranking[0], {
    user_id:'telegram:42', display_name:'Daniil', username:'ciao42', points:0,
    exact_scores:0, correct_outcomes:0, scored_predictions:0,
  });
  assert.equal(calls.some(item => /FROM participants u\s+LEFT JOIN predictions p/i.test(String(item.query).replace(/\s+/g, ' '))), true);
});

test('current-user ranking includes all five per-competition point totals', () => {
  const totals = { serie_a:4, coppa_italia:2, ucl:8, uel:3, uecl:1 };
  const sql = {
    exec(query, ...params) {
      if (!/GROUP BY u\.user_id/i.test(query)) return { toArray: () => [] };
      const competition = params[0];
      const points = competition ? totals[competition] : Object.values(totals).reduce((a,b)=>a+b,0);
      return { toArray: () => [{
        user_id:'telegram:42', display_name:'Daniil', username:'ciao42', points,
        exact_scores:2, correct_outcomes:5, scored_predictions:7,
      }] };
    },
  };
  const me = queryRankingMe(sql, { userId:'telegram:42' });
  assert.equal(me.position, 1);
  assert.equal(me.points, 18);
  assert.deepEqual(me.competition_points, totals);
});

test('ranking SQL counts exact goal-difference and outcome results as correct outcomes', async () => {
  const source = await import('node:fs/promises').then(fs => fs.readFile(new URL('../src/v23.3/prediction-sql.mjs', import.meta.url), 'utf8'));
  assert.match(source, /result_type IN \('exact','goal_difference','outcome'\)/);
});
