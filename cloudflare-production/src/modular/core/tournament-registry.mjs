export const COMPETITION_IDS = Object.freeze(['serie_a','coppa_italia','ucl','uel','uecl']);

const THEMES = Object.freeze({
  serie_a:Object.freeze({key:'serie-a',surface:'calcio-blue',accent:'blue'}),
  coppa_italia:Object.freeze({key:'coppa',surface:'italian-cup',accent:'red-green'}),
  ucl:Object.freeze({key:'champions',surface:'champions-night',accent:'blue-purple'}),
  uel:Object.freeze({key:'europa',surface:'europa-night',accent:'orange'}),
  uecl:Object.freeze({key:'conference',surface:'conference-night',accent:'green'}),
});

const REGISTRY = Object.freeze({
  serie_a:Object.freeze({id:'serie_a',title:'Серия А',shortTitle:'Серия А',tables:true,european:false,theme:THEMES.serie_a}),
  coppa_italia:Object.freeze({id:'coppa_italia',title:'Кубок Италии',shortTitle:'Кубок Италии',tables:false,european:false,theme:THEMES.coppa_italia}),
  ucl:Object.freeze({id:'ucl',title:'Лига Чемпионов',shortTitle:'ЛЧ',tables:true,european:true,theme:THEMES.ucl}),
  uel:Object.freeze({id:'uel',title:'Лига Европы',shortTitle:'ЛЕ',tables:true,european:true,theme:THEMES.uel}),
  uecl:Object.freeze({id:'uecl',title:'Лига Конференций',shortTitle:'ЛК',tables:true,european:true,theme:THEMES.uecl}),
});

export function getTournament(id) {
  const tournament=REGISTRY[String(id||'').trim().toLowerCase()];
  if(!tournament) throw new Error('unknown_competition');
  return tournament;
}

export function tournamentTheme(id) {
  return getTournament(id).theme;
}
