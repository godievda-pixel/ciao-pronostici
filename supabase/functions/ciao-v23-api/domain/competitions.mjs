const COMPETITION_LIST = [
  { id: 'serie_a', nameRu: 'Серия А' },
  { id: 'coppa_italia', nameRu: 'Кубок Италии' },
  { id: 'ucl', nameRu: 'Лига чемпионов' },
  { id: 'uel', nameRu: 'Лига Европы' },
  { id: 'uecl', nameRu: 'Лига конференций' },
];

export const COMPETITIONS = Object.freeze(
  COMPETITION_LIST.map(item => Object.freeze({ ...item })),
);

const BY_ID = new Map(COMPETITIONS.map(item => [item.id, item]));
const EUROPEAN = new Set(['ucl', 'uel', 'uecl']);
const RANKING_SCOPES = Object.freeze({
  all: Object.freeze(['serie_a', 'coppa_italia', 'ucl', 'uel', 'uecl']),
  italy: Object.freeze(['serie_a', 'coppa_italia']),
  europe: Object.freeze(['ucl', 'uel', 'uecl']),
});

function normalized(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ');
}

export function competitionById(id) {
  const key = normalized(id);
  const competition = BY_ID.get(key);
  if (!competition) throw new Error(`invalid_competition:${key}`);
  return competition;
}

export function rankingCompetitionIds(scope = 'all') {
  const key = normalized(scope);
  const ids = RANKING_SCOPES[key];
  if (!ids) throw new Error(`invalid_ranking_scope:${key}`);
  return [...ids];
}

export function isEuropeanCompetition(id) {
  return EUROPEAN.has(normalized(id));
}

export function isQualificationStage(stage) {
  const value = normalized(stage);
  return /qualif|preliminary|play-off qualification|qualifying/.test(value);
}

export function isCoppaVisibleStage(stage) {
  const value = normalized(stage)
    .replace(/\bround of 16\b/g, 'round_of_16')
    .replace(/\bquarter[- ]?finals?\b/g, 'quarter_final')
    .replace(/\bsemi[- ]?finals?\b/g, 'semi_final');

  return value === 'round_of_16'
    || value === 'quarter_final'
    || value === 'semi_final'
    || value === 'final';
}
