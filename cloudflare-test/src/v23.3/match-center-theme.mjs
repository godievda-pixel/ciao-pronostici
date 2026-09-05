import { getCompetitionConfig } from '../v23.2/competition-config.mjs';

function freezeTheme(key, vars) {
  return Object.freeze({
    key,
    vars:Object.freeze({ ...vars }),
  });
}

const THEMES = Object.freeze({
  serie_a:freezeTheme('serie-a', {
    '--mc-bg':'#071626',
    '--mc-surface':'rgba(255,255,255,.055)',
    '--mc-border':'rgba(40,127,199,.28)',
    '--mc-accent':'#0c5aa8',
    '--mc-accent-2':'#287fc7',
  }),
  coppa_italia:freezeTheme('coppa', {
    '--mc-bg':'#180b12',
    '--mc-surface':'rgba(255,255,255,.052)',
    '--mc-border':'rgba(215,38,61,.2)',
    '--mc-accent':'#d7263d',
    '--mc-accent-2':'#16834b',
  }),
  ucl:freezeTheme('champions', {
    '--mc-bg':'#090c2d',
    '--mc-surface':'rgba(255,255,255,.055)',
    '--mc-border':'rgba(123,66,255,.2)',
    '--mc-accent':'#3157ff',
    '--mc-accent-2':'#7b42ff',
  }),
  uel:freezeTheme('europa', {
    '--mc-bg':'#160f0b',
    '--mc-surface':'rgba(255,255,255,.05)',
    '--mc-border':'rgba(240,103,34,.2)',
    '--mc-accent':'#f06722',
    '--mc-accent-2':'#ff9b32',
  }),
  uecl:freezeTheme('conference', {
    '--mc-bg':'#071b13',
    '--mc-surface':'rgba(255,255,255,.052)',
    '--mc-border':'rgba(34,168,102,.2)',
    '--mc-accent':'#22a866',
    '--mc-accent-2':'#55d68e',
  }),
});

export function matchCenterTheme(competition) {
  getCompetitionConfig(competition);
  return THEMES[competition];
}

export function matchCenterThemeStyle(competition) {
  return Object.entries(matchCenterTheme(competition).vars)
    .map(([name, value]) => `${name}:${value}`)
    .join(';');
}
