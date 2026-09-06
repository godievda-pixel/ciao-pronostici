const COMPETITIONS = Object.freeze({
  serie_a:Object.freeze({ name:'Серия А', genitive:'Серии А', in:'в Серии А' }),
  coppa_italia:Object.freeze({ name:'Кубок Италии', genitive:'Кубка Италии', in:'в Кубке Италии' }),
  ucl:Object.freeze({ name:'Лига чемпионов', genitive:'Лиги чемпионов', in:'в Лиге чемпионов' }),
  uel:Object.freeze({ name:'Лига Европы', genitive:'Лиги Европы', in:'в Лиге Европы' }),
  uecl:Object.freeze({ name:'Лига конференций', genitive:'Лиги конференций', in:'в Лиге конференций' }),
});

const COMPETITION_FORMS = new Set(['name','genitive','in']);
const TEAM_FORMS = new Set(['name','genitive','dative','prepositional']);
const TEAM_FIELD = Object.freeze({
  name:'nameRu',
  genitive:'genitiveRu',
  dative:'dativeRu',
  prepositional:'prepositionalRu',
});

const text = value => String(value ?? '').trim();

export function pluralRu(value, one, few, many) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error('plural_value_invalid');
  const integer = Math.abs(Math.trunc(number));
  const mod100 = integer % 100;
  const mod10 = integer % 10;
  if (mod100 >= 11 && mod100 <= 14) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

function counted(value, one, few, many) {
  return `${value} ${pluralRu(value, one, few, many)}`;
}

export const pointsLabel = value => counted(value, 'очко', 'очка', 'очков');
export const matchesLabel = value => counted(value, 'матч', 'матча', 'матчей');
export const predictionsLabel = value => counted(value, 'прогноз', 'прогноза', 'прогнозов');
export const goalsLabel = value => counted(value, 'гол', 'гола', 'голов');

export function competitionPhrase(id, form = 'name') {
  const key = text(id);
  const requestedForm = text(form) || 'name';
  if (!COMPETITION_FORMS.has(requestedForm)) throw new Error(`competition_form_invalid:${requestedForm}`);
  const competition = COMPETITIONS[key];
  if (!competition) throw new Error(`competition_phrase_missing:${key}`);
  return competition[requestedForm];
}

export function teamPhrase(team, form = 'name') {
  const requestedForm = text(form) || 'name';
  if (!TEAM_FORMS.has(requestedForm)) throw new Error(`team_form_invalid:${requestedForm}`);
  const nameRu = text(team?.nameRu);
  if (!nameRu) throw new Error('team_name_ru_missing');
  if (requestedForm === 'name') return nameRu;
  return text(team?.[TEAM_FIELD[requestedForm]]) || nameRu;
}

export const RU_COMPETITION_PHRASES = COMPETITIONS;
