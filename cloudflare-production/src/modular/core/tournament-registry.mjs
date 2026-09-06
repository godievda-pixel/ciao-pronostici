export const TOURNAMENT_IDS = Object.freeze([
  'serie_a',
  'coppa_italia',
  'ucl',
  'uel',
  'uecl',
]);

const registry = {
  serie_a: {
    id: 'serie_a', label: 'Серия А', shortLabel: 'Серия А', theme: 'serie-a', tables: true,
    colors: { accent: '#3150ff', surface: '#091b4f', glow: '#4b6dff' },
  },
  coppa_italia: {
    id: 'coppa_italia', label: 'Кубок Италии', shortLabel: 'Кубок', theme: 'coppa', tables: false,
    colors: { accent: '#e53935', surface: '#10281f', glow: '#2bb673' },
  },
  ucl: {
    id: 'ucl', label: 'Лига Чемпионов', shortLabel: 'ЛЧ', theme: 'champions', tables: true,
    colors: { accent: '#7657ff', surface: '#111348', glow: '#8f72ff' },
  },
  uel: {
    id: 'uel', label: 'Лига Европы', shortLabel: 'ЛЕ', theme: 'europa', tables: true,
    colors: { accent: '#ff7a00', surface: '#2a1909', glow: '#ff9f43' },
  },
  uecl: {
    id: 'uecl', label: 'Лига Конференций', shortLabel: 'ЛК', theme: 'conference', tables: true,
    colors: { accent: '#30c46c', surface: '#0b2818', glow: '#63df91' },
  },
};

export const TOURNAMENTS = Object.freeze(Object.fromEntries(
  Object.entries(registry).map(([key, value]) => [key, Object.freeze({ ...value, colors: Object.freeze(value.colors) })]),
));

export function getTournament(id) {
  const key = String(id || '').trim().toLowerCase();
  const tournament = TOURNAMENTS[key];
  if (!tournament) throw new Error(`Unknown tournament: ${id}`);
  return tournament;
}

export function isTournamentSupported(id) {
  return Object.hasOwn(TOURNAMENTS, String(id || '').trim().toLowerCase());
}
