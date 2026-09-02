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
    shortTitle: 'Серия А',
    theme: 'serie-a',
    navigation: 'rounds',
    european: false,
  }),
  coppa_italia: Object.freeze({
    key: 'coppa_italia',
    title: 'Кубок Италии',
    shortTitle: 'Кубок Италии',
    theme: 'coppa',
    navigation: 'stages',
    european: false,
  }),
  ucl: Object.freeze({
    key: 'ucl',
    title: 'Лига Чемпионов',
    shortTitle: 'ЛЧ',
    theme: 'champions',
    navigation: 'stages',
    european: true,
  }),
  uel: Object.freeze({
    key: 'uel',
    title: 'Лига Европы',
    shortTitle: 'ЛЕ',
    theme: 'europa',
    navigation: 'stages',
    european: true,
  }),
  uecl: Object.freeze({
    key: 'uecl',
    title: 'Лига Конференций',
    shortTitle: 'ЛК',
    theme: 'conference',
    navigation: 'stages',
    european: true,
  }),
});

export function getCompetitionConfig(key) {
  const config = COMPETITIONS[key];
  if (!config) throw new Error(`Unknown competition: ${key}`);
  return config;
}
