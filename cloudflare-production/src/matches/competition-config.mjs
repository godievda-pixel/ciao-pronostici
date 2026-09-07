export const COMPETITION_KEYS = Object.freeze([
  'serie_a',
  'coppa_italia',
  'ucl',
  'uel',
  'uecl',
]);

export const COMPETITIONS = Object.freeze({
  serie_a: Object.freeze({
    key: 'serie_a',
    title: 'Серия А',
    theme: 'serie-a',
    external: false,
    leagueAliases: Object.freeze([]),
  }),
  coppa_italia: Object.freeze({
    key: 'coppa_italia',
    title: 'Кубок Италии',
    theme: 'coppa',
    external: true,
    leagueAliases: Object.freeze(['Coppa Italia']),
  }),
  ucl: Object.freeze({
    key: 'ucl',
    title: 'Лига Чемпионов',
    theme: 'champions',
    external: true,
    leagueAliases: Object.freeze(['Champions League', 'UEFA Champions League']),
  }),
  uel: Object.freeze({
    key: 'uel',
    title: 'Лига Европы',
    theme: 'europa',
    external: true,
    leagueAliases: Object.freeze(['Europa League', 'UEFA Europa League']),
  }),
  uecl: Object.freeze({
    key: 'uecl',
    title: 'Лига Конференций',
    theme: 'conference',
    external: true,
    leagueAliases: Object.freeze(['Conference League', 'UEFA Conference League']),
  }),
});

export function getCompetitionConfig(key) {
  const config = COMPETITIONS[String(key || '')];
  if (!config) throw new Error(`Unknown competition: ${key}`);
  return config;
}

export function isExternalCompetition(key) {
  return getCompetitionConfig(key).external === true;
}
