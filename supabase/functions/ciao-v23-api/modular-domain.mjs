export const MODULAR_COMPETITIONS = Object.freeze([
  'serie_a',
  'coppa_italia',
  'ucl',
  'uel',
  'uecl',
]);

const EXTERNAL_COMPETITIONS = new Set(['coppa_italia','ucl','uel','uecl']);
const RANKING_SCOPES = Object.freeze({
  all: MODULAR_COMPETITIONS,
  italy: Object.freeze(['serie_a','coppa_italia']),
  europe: Object.freeze(['ucl','uel','uecl']),
});

function score(value) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0 || number > 20) throw new Error('invalid_score');
  return number;
}

function competition(value) {
  const key = String(value ?? '').trim().toLowerCase();
  if (!MODULAR_COMPETITIONS.includes(key)) throw new Error(`invalid_competition:${key}`);
  return key;
}

export function scorePrediction({ predictedHome, predictedAway, finalHome, finalAway } = {}) {
  const ph = score(predictedHome), pa = score(predictedAway), fh = score(finalHome), fa = score(finalAway);
  if (ph === fh && pa === fa) return Object.freeze({ points:5, resultType:'exact' });
  const predictedDiff = ph - pa, finalDiff = fh - fa;
  if (Math.sign(predictedDiff) === Math.sign(finalDiff) && predictedDiff === finalDiff) return Object.freeze({ points:3, resultType:'goal_difference' });
  if (Math.sign(predictedDiff) === Math.sign(finalDiff)) return Object.freeze({ points:2, resultType:'outcome' });
  return Object.freeze({ points:0, resultType:'miss' });
}

export function predictionDeadlineIso(kickoffAt) {
  const time = Date.parse(String(kickoffAt ?? '').trim());
  if (!Number.isFinite(time)) throw new Error('invalid_kickoff');
  return new Date(time - 15 * 60 * 1000).toISOString();
}

export function rankingCompetitions(scope = 'all') {
  const key = String(scope ?? '').trim().toLowerCase();
  const list = RANKING_SCOPES[key];
  if (!list) throw new Error(`invalid_ranking_scope:${key}`);
  return list;
}

export function normalizeCanonicalMatchId(competitionId, rawId) {
  const key = competition(competitionId), raw = String(rawId ?? '').trim();
  if (!raw) throw new Error('match_id_required');
  const colon = raw.indexOf(':');
  if (colon > 0) {
    const prefix = raw.slice(0, colon).trim().toLowerCase();
    if (prefix !== key) throw new Error(`match_competition_mismatch:${prefix}`);
    const source = raw.slice(colon + 1).trim();
    if (!source) throw new Error('match_id_required');
    return `${key}:${source}`;
  }
  return `${key}:${raw}`;
}

export function isExternalPredictionCompetition(value) {
  return EXTERNAL_COMPETITIONS.has(String(value ?? '').trim().toLowerCase());
}
