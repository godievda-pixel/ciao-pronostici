export const ROUND512_USER_VIEW_TABS = Object.freeze([
  Object.freeze({ key:'overview', label:'Обзор' }),
  Object.freeze({ key:'lineups', label:'Составы' }),
  Object.freeze({ key:'events', label:'События' }),
  Object.freeze({ key:'statistics', label:'Статистика' }),
  Object.freeze({ key:'shots', label:'Удары' }),
]);

const USER_VIEW_KEYS = new Set(ROUND512_USER_VIEW_TABS.map(tab => tab.key));
const PROVIDER_SECTION_BY_VIEW = Object.freeze({
  overview:'overview',
  lineups:'lineups',
  events:'events',
  statistics:'stats',
  shots:'stats',
});

export function canonicalRound512UserView(value) {
  const key = String(value || '').trim().toLowerCase();
  return USER_VIEW_KEYS.has(key) ? key : 'overview';
}

export function providerSectionForRound512UserView(value) {
  return PROVIDER_SECTION_BY_VIEW[canonicalRound512UserView(value)];
}
