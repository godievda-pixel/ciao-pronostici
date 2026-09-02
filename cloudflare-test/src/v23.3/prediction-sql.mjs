import { getCompetitionConfig } from '../v23.2/competition-config.mjs';

export const PREDICTION_SCHEMA_VERSION = '1';

export const PREDICTION_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS schema_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS participants (
  user_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  username TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS predictions (
  prediction_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  match_id TEXT NOT NULL,
  competition TEXT NOT NULL CHECK (competition IN ('serie_a','coppa_italia','ucl','uel','uecl')),
  season TEXT NOT NULL,
  predicted_home INTEGER NOT NULL CHECK (predicted_home BETWEEN 0 AND 20),
  predicted_away INTEGER NOT NULL CHECK (predicted_away BETWEEN 0 AND 20),
  submitted_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  locked_at TEXT NOT NULL,
  points INTEGER,
  result_type TEXT,
  final_home INTEGER,
  final_away INTEGER,
  result_fingerprint TEXT,
  scored_at TEXT,
  UNIQUE(user_id, match_id)
);
CREATE INDEX IF NOT EXISTS predictions_user_competition ON predictions(user_id, competition);
CREATE INDEX IF NOT EXISTS predictions_competition_match ON predictions(competition, match_id);
CREATE INDEX IF NOT EXISTS predictions_competition_points ON predictions(competition, points);
CREATE INDEX IF NOT EXISTS predictions_scored_at ON predictions(scored_at);
CREATE TABLE IF NOT EXISTS ranking_snapshots (
  snapshot_id TEXT PRIMARY KEY,
  scope TEXT NOT NULL,
  period_key TEXT NOT NULL,
  created_at TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  UNIQUE(scope, period_key)
);
`;

function text(value) {
  return String(value ?? '').trim();
}

function assertTestIdentity({ environment, season } = {}) {
  const env = text(environment).toLowerCase();
  const value = text(season);
  if (env !== 'test') throw new Error('TEST prediction backend only');
  if (!/^\d{4}-\d{2}$/.test(value)) throw new Error('Invalid prediction season');
  return { environment: env, season: value };
}

export function predictionObjectName(identity = {}) {
  const { environment, season } = assertTestIdentity(identity);
  return `prediction-league:${environment}:${season}`;
}

export function rankingScope({ scope, competition } = {}) {
  if (scope === 'overall') return 'overall';
  if (scope !== 'competition') throw new Error('Invalid ranking scope');
  getCompetitionConfig(competition);
  return `competition:${competition}`;
}

export function initializePredictionSchema(sql, identity = {}) {
  if (!sql || typeof sql.exec !== 'function') throw new Error('Prediction SQL executor is required');
  const { environment, season } = assertTestIdentity(identity);

  sql.exec(PREDICTION_SCHEMA_SQL);
  sql.exec(
    'INSERT OR REPLACE INTO schema_meta (key, value) VALUES (?, ?)',
    'schema_version',
    PREDICTION_SCHEMA_VERSION,
  );
  sql.exec(
    'INSERT OR REPLACE INTO schema_meta (key, value) VALUES (?, ?)',
    'environment',
    environment,
  );
  sql.exec(
    'INSERT OR REPLACE INTO schema_meta (key, value) VALUES (?, ?)',
    'season',
    season,
  );
  sql.exec(
    'INSERT OR IGNORE INTO schema_meta (key, value) VALUES (?, ?)',
    'prediction_cache_generation',
    '0',
  );
}

export function rows(cursor) {
  if (!cursor) return [];
  if (typeof cursor.toArray === 'function') return cursor.toArray();
  return Array.from(cursor);
}

export function normalizePredictionRow(row = {}) {
  return Object.freeze({
    prediction_id: String(row.prediction_id),
    user_id: String(row.user_id),
    match_id: String(row.match_id),
    competition: String(row.competition),
    season: String(row.season),
    predicted_home: Number(row.predicted_home),
    predicted_away: Number(row.predicted_away),
    submitted_at: String(row.submitted_at),
    updated_at: String(row.updated_at),
    locked_at: String(row.locked_at),
    points: row.points == null ? null : Number(row.points),
    result_type: row.result_type == null ? null : String(row.result_type),
    final_home: row.final_home == null ? null : Number(row.final_home),
    final_away: row.final_away == null ? null : Number(row.final_away),
    result_fingerprint: row.result_fingerprint == null ? null : String(row.result_fingerprint),
    scored_at: row.scored_at == null ? null : String(row.scored_at),
  });
}

function first(cursor) {
  return rows(cursor)[0] || null;
}

function affected(cursor) {
  const value = Number(cursor?.rowsWritten ?? cursor?.changes ?? 0);
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

function integerScore(value) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0 || number > 20) throw new Error('Invalid prediction score');
  return number;
}

export function upsertParticipant(sql, participant = {}, nowIso) {
  const userId = text(participant.user_id);
  const displayName = text(participant.display_name) || 'Участник';
  const username = text(participant.username) || null;
  if (!userId) throw new Error('Prediction participant user_id is required');
  sql.exec(
    `INSERT INTO participants (user_id, display_name, username, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       display_name = excluded.display_name,
       username = excluded.username,
       updated_at = excluded.updated_at`,
    userId, displayName, username, nowIso, nowIso,
  );
  return Object.freeze({ user_id: userId, display_name: displayName, username });
}

export function upsertPrediction(sql, prediction = {}, nowIso, randomUUID = () => crypto.randomUUID()) {
  const userId = text(prediction.user_id);
  const matchId = text(prediction.match_id);
  const competition = text(prediction.competition);
  const season = text(prediction.season);
  const lockedAt = text(prediction.locked_at);
  getCompetitionConfig(competition);
  if (!userId || !matchId || !matchId.startsWith(`${competition}:`)) throw new Error('Invalid prediction identity');
  if (!season || !lockedAt) throw new Error('Prediction season and locked_at are required');
  const home = integerScore(prediction.predicted_home);
  const away = integerScore(prediction.predicted_away);

  const existing = first(sql.exec(
    'SELECT * FROM predictions WHERE user_id = ? AND match_id = ? LIMIT 1',
    userId, matchId,
  ));

  let predictionId;
  if (existing) {
    predictionId = String(existing.prediction_id);
    sql.exec(
      `UPDATE predictions SET
         predicted_home = ?, predicted_away = ?, updated_at = ?, locked_at = ?,
         points = NULL, result_type = NULL, final_home = NULL, final_away = NULL,
         result_fingerprint = NULL, scored_at = NULL
       WHERE prediction_id = ?`,
      home, away, nowIso, lockedAt, predictionId,
    );
  } else {
    predictionId = String(randomUUID());
    sql.exec(
      `INSERT INTO predictions (
         prediction_id, user_id, match_id, competition, season,
         predicted_home, predicted_away, submitted_at, updated_at, locked_at,
         points, result_type, final_home, final_away, result_fingerprint, scored_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, NULL, NULL)`,
      predictionId, userId, matchId, competition, season,
      home, away, nowIso, nowIso, lockedAt,
    );
  }

  const stored = first(sql.exec('SELECT * FROM predictions WHERE prediction_id = ? LIMIT 1', predictionId));
  if (!stored) throw new Error('Prediction persistence failed');
  return normalizePredictionRow(stored);
}

export function listUserPredictions(sql, { userId, competition } = {}) {
  const id = text(userId);
  if (!id) throw new Error('Prediction user id is required');
  if (competition && competition !== 'all') {
    getCompetitionConfig(competition);
    return rows(sql.exec(
      'SELECT * FROM predictions WHERE user_id = ? AND competition = ? ORDER BY submitted_at, match_id',
      id, competition,
    )).map(normalizePredictionRow);
  }
  return rows(sql.exec(
    'SELECT * FROM predictions WHERE user_id = ? ORDER BY submitted_at, match_id',
    id,
  )).map(normalizePredictionRow);
}

export function reconcileMatchPredictions(sql, {
  matchId, finalHome, finalAway, resultFingerprint, scoredAt, scorePrediction,
} = {}) {
  if (typeof scorePrediction !== 'function') throw new Error('scorePrediction is required');
  const id = text(matchId);
  const fingerprint = text(resultFingerprint);
  if (!id || !fingerprint) throw new Error('Result identity is required');
  const finalH = Number(finalHome);
  const finalA = Number(finalAway);
  if (!Number.isInteger(finalH) || !Number.isInteger(finalA)) throw new Error('Invalid final score');
  let updated = 0;
  for (const row of rows(sql.exec('SELECT * FROM predictions WHERE match_id = ?', id))) {
    if (String(row.result_fingerprint || '') === fingerprint) continue;
    const scored = scorePrediction({
      predictedHome: Number(row.predicted_home),
      predictedAway: Number(row.predicted_away),
      finalHome: finalH,
      finalAway: finalA,
    });
    sql.exec(
      `UPDATE predictions SET points = ?, result_type = ?, final_home = ?, final_away = ?,
       result_fingerprint = ?, scored_at = ? WHERE prediction_id = ?`,
      Number(scored.points), text(scored.resultType), finalH, finalA, fingerprint, scoredAt, String(row.prediction_id),
    );
    updated += 1;
  }
  return updated;
}

function normalizeRankingRow(row = {}) {
  return Object.freeze({
    user_id: String(row.user_id),
    display_name: String(row.display_name || 'Участник'),
    username: row.username == null ? null : String(row.username),
    points: Number(row.points || 0),
    exact_scores: Number(row.exact_scores || 0),
    correct_outcomes: Number(row.correct_outcomes || 0),
    scored_predictions: Number(row.scored_predictions || 0),
  });
}

function rankingSort(a, b) {
  return b.points - a.points
    || b.exact_scores - a.exact_scores
    || b.correct_outcomes - a.correct_outcomes
    || a.scored_predictions - b.scored_predictions
    || a.user_id.localeCompare(b.user_id);
}

export function queryRanking(sql, { scope = 'overall', competition } = {}) {
  const canonicalScope = rankingScope({ scope, competition });
  const competitionFilter = canonicalScope === 'overall' ? '' : 'AND p.competition = ?';
  const params = canonicalScope === 'overall' ? [] : [competition];
  const result = rows(sql.exec(
    `SELECT p.user_id, COALESCE(MAX(u.display_name), 'Участник') AS display_name,
       MAX(u.username) AS username,
       COALESCE(SUM(p.points), 0) AS points,
       SUM(CASE WHEN p.result_type = 'exact' THEN 1 ELSE 0 END) AS exact_scores,
       SUM(CASE WHEN p.result_type IN ('exact','outcome') THEN 1 ELSE 0 END) AS correct_outcomes,
       SUM(CASE WHEN p.points IS NOT NULL THEN 1 ELSE 0 END) AS scored_predictions
     FROM predictions p LEFT JOIN participants u ON u.user_id = p.user_id
     WHERE 1=1 ${competitionFilter}
     GROUP BY p.user_id`,
    ...params,
  )).map(normalizeRankingRow).sort(rankingSort);
  return Object.freeze(result);
}

export function queryRankingMe(sql, { userId } = {}) {
  const id = text(userId);
  if (!id) throw new Error('Prediction user id is required');
  const overall = queryRanking(sql, { scope: 'overall' });
  const index = overall.findIndex(row => row.user_id === id);
  return index < 0 ? null : Object.freeze({ position: index + 1, ...overall[index] });
}

export function createRankingSnapshot(sql, { scope, periodKey, payload, nowIso, randomUUID = () => crypto.randomUUID() } = {}) {
  const canonical = rankingScope(scope?.startsWith?.('competition:')
    ? { scope: 'competition', competition: scope.slice('competition:'.length) }
    : { scope: scope || 'overall' });
  const key = text(periodKey);
  if (!key) throw new Error('Ranking snapshot period is required');
  const snapshotId = String(randomUUID());
  sql.exec(
    `INSERT OR IGNORE INTO ranking_snapshots (snapshot_id, scope, period_key, created_at, payload_json)
     VALUES (?, ?, ?, ?, ?)`,
    snapshotId, canonical, key, nowIso, JSON.stringify(payload ?? null),
  );
  return Object.freeze({ snapshot_id: snapshotId, scope: canonical, period_key: key, created_at: nowIso });
}

export function resetPredictionDomain(sql) {
  const predictions = affected(sql.exec('DELETE FROM predictions'));
  const ranking = affected(sql.exec('DELETE FROM ranking_snapshots'));
  affected(sql.exec('DELETE FROM participants'));
  const caches = affected(sql.exec(
    `UPDATE schema_meta
     SET value = CAST(CAST(value AS INTEGER) + 1 AS TEXT)
     WHERE key = 'prediction_cache_generation'`,
  ));
  return Object.freeze({
    predictions,
    points: predictions,
    ranking,
    caches,
  });
}
