import { russianTeamName } from './team-registry.mjs';

const ITALIAN_CLUBS = new Set([
  'Интер','Ювентус','Милан','Наполи','Рома','Аталанта','Лацио','Болонья','Фиорентина','Торино',
  'Удинезе','Дженоа','Парма','Лечче','Кальяри','Комо','Верона','Кремонезе','Пиза','Сассуоло',
  'Палермо','Монца','Фрозиноне','Венеция','Эмполи','Специя','Бари','Сампдория','Чезена',
]);

function text(value) {
  return String(value ?? '').trim();
}

export function isItalianTeam(team = {}) {
  const countryCode = text(team.countryCode || team.country_code).toUpperCase();
  if (countryCode === 'ITA' || countryCode === 'IT') return true;

  const country = text(team.country || team.country_name).toLowerCase();
  if (country === 'italy' || country === 'italia' || country === 'italia / italy') return true;

  const sourceName = text(team.rawName || team.raw_name || team.name || team.team_name);
  if (!sourceName) return false;
  const localized = russianTeamName(sourceName);
  return ITALIAN_CLUBS.has(localized) || ITALIAN_CLUBS.has(sourceName);
}