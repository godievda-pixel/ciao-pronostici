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
