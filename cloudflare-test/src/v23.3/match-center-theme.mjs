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
    '--mc-bg-deep':'#04101d',
    '--mc-surface':'rgba(255,255,255,.055)',
    '--mc-surface-2':'rgba(18,52,82,.82)',
    '--mc-surface-raised':'rgba(19,59,92,.92)',
    '--mc-border':'rgba(40,127,199,.28)',
    '--mc-border-strong':'rgba(67,157,225,.52)',
    '--mc-accent':'#0c5aa8',
    '--mc-accent-2':'#287fc7',
    '--mc-accent-soft':'rgba(40,127,199,.17)',
    '--mc-glow':'rgba(21,105,181,.32)',
    '--mc-pitch':'#0b3550',
    '--mc-pitch-line':'rgba(200,234,255,.2)',
    '--mc-home-marker':'#55b9f3',
    '--mc-away-marker':'#dcecff',
  }),
  coppa_italia:freezeTheme('coppa', {
    '--mc-bg':'#180b12',
    '--mc-bg-deep':'#0b0508',
    '--mc-surface':'rgba(255,255,255,.052)',
    '--mc-surface-2':'rgba(70,20,31,.78)',
    '--mc-surface-raised':'rgba(82,23,36,.9)',
    '--mc-border':'rgba(215,38,61,.2)',
    '--mc-border-strong':'rgba(239,72,93,.46)',
    '--mc-accent':'#d7263d',
    '--mc-accent-2':'#16834b',
    '--mc-accent-soft':'rgba(215,38,61,.16)',
    '--mc-glow':'rgba(215,38,61,.25)',
    '--mc-pitch':'#241319',
    '--mc-pitch-line':'rgba(255,226,230,.18)',
    '--mc-home-marker':'#f05a6d',
    '--mc-away-marker':'#4ec985',
  }),
  ucl:freezeTheme('champions', {
    '--mc-bg':'#090c2d',
    '--mc-bg-deep':'#040617',
    '--mc-surface':'rgba(255,255,255,.055)',
    '--mc-surface-2':'rgba(28,34,91,.8)',
    '--mc-surface-raised':'rgba(34,41,112,.9)',
    '--mc-border':'rgba(123,66,255,.2)',
    '--mc-border-strong':'rgba(114,126,255,.48)',
    '--mc-accent':'#3157ff',
    '--mc-accent-2':'#7b42ff',
    '--mc-accent-soft':'rgba(77,86,255,.18)',
    '--mc-glow':'rgba(69,72,255,.3)',
    '--mc-pitch':'#111a55',
    '--mc-pitch-line':'rgba(210,215,255,.2)',
    '--mc-home-marker':'#7190ff',
    '--mc-away-marker':'#b58cff',
  }),
  uel:freezeTheme('europa', {
    '--mc-bg':'#160f0b',
    '--mc-bg-deep':'#090604',
    '--mc-surface':'rgba(255,255,255,.05)',
    '--mc-surface-2':'rgba(66,39,20,.78)',
    '--mc-surface-raised':'rgba(78,45,21,.9)',
    '--mc-border':'rgba(240,103,34,.2)',
    '--mc-border-strong':'rgba(255,146,64,.46)',
    '--mc-accent':'#f06722',
    '--mc-accent-2':'#ff9b32',
    '--mc-accent-soft':'rgba(240,103,34,.16)',
    '--mc-glow':'rgba(240,103,34,.28)',
    '--mc-pitch':'#2c1c10',
    '--mc-pitch-line':'rgba(255,226,203,.2)',
    '--mc-home-marker':'#ff9b32',
    '--mc-away-marker':'#ffe0b8',
  }),
  uecl:freezeTheme('conference', {
    '--mc-bg':'#071b13',
    '--mc-bg-deep':'#03100b',
    '--mc-surface':'rgba(255,255,255,.052)',
    '--mc-surface-2':'rgba(16,64,44,.8)',
    '--mc-surface-raised':'rgba(18,76,51,.9)',
    '--mc-border':'rgba(34,168,102,.2)',
    '--mc-border-strong':'rgba(76,208,141,.46)',
    '--mc-accent':'#22a866',
    '--mc-accent-2':'#55d68e',
    '--mc-accent-soft':'rgba(34,168,102,.16)',
    '--mc-glow':'rgba(34,168,102,.27)',
    '--mc-pitch':'#0c3324',
    '--mc-pitch-line':'rgba(210,255,231,.2)',
    '--mc-home-marker':'#55d68e',
    '--mc-away-marker':'#d8ffea',
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
