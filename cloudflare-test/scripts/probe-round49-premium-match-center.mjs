import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ORIGIN = 'https://ciao-web-app-test.ciao-web.workers.dev/';
const ARTIFACT_PATH = 'artifacts/v23-3-round49-premium-match-center.json';
const MODULES = Object.freeze([
  'match-center-theme.mjs',
  'match-center-view.mjs',
  'match-center-stats.mjs',
  'match-center-events.mjs',
  'match-center-lineups.mjs',
  'match-center-players.mjs',
]);

async function fetchText(path, fetchImpl) {
  const url = new URL(path, ORIGIN);
  url.searchParams.set('round49_probe', `${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const response = await fetchImpl(url, {
    headers:{ 'cache-control':'no-cache, no-store, max-age=0', pragma:'no-cache' },
  });
  return { status:response.status, ok:response.ok, text:await response.text() };
}

function compact(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function includesAll(text, markers) {
  return markers.every(marker => text.includes(marker));
}

export async function probeRound49PremiumMatchCenter({ fetchImpl = fetch, writeArtifact = true } = {}) {
  const responses = Object.fromEntries(await Promise.all(MODULES.map(async moduleName => [
    moduleName,
    await fetchText(`/v23.3/${moduleName}`, fetchImpl),
  ])));
  const source = Object.fromEntries(MODULES.map(moduleName => [moduleName, compact(responses[moduleName].text)]));

  const theme = source['match-center-theme.mjs'];
  const view = source['match-center-view.mjs'];
  const stats = source['match-center-stats.mjs'];
  const events = source['match-center-events.mjs'];
  const lineups = source['match-center-lineups.mjs'];
  const players = source['match-center-players.mjs'];

  const responseOk = MODULES.every(moduleName => responses[moduleName].ok);
  const fiveTournamentThemes = includesAll(theme, [
    "serie_a:freezeTheme('serie-a'",
    "coppa_italia:freezeTheme('coppa'",
    "ucl:freezeTheme('champions'",
    "uel:freezeTheme('europa'",
    "uecl:freezeTheme('conference'",
    "'--mc-surface-raised'",
    "'--mc-accent-soft'",
    "'--mc-pitch'",
  ]);
  const premiumHero = includesAll(view, [
    'data-cw239-match-center',
    'data-cw239-scorers',
    'goalQualifier',
    "return '(П)'",
    "return '(АГ)'",
    'scrollbar-width:none',
    '.cw239-mc::-webkit-scrollbar',
    'grid-template-columns:repeat(5,minmax(0,1fr))',
  ]);
  const premiumStats = includesAll(stats, [
    'data-cw233-mc-shotmap',
    'data-cw233-mc-shot-marker',
    'data-cw233-mc-shot-list',
    'data-cw233-mc-shot-row',
    'Карта ударов',
    'Все удары',
  ]);
  const premiumEvents = includesAll(events, [
    'data-cw233-mc-events-timeline',
    'return minuteA - minuteB',
    'return addedA - addedB',
    'cw233-mc-event-period',
    'cw233-mc-goal-qualifier',
    "goal_confirmed:'Гол подтверждён'",
  ]);
  const premiumLineups = includesAll(lineups, [
    'data-cw233-mc-lineup-switch',
    'data-cw233-mc-lineup-pitch',
    'data-cw233-mc-pitch-team',
    'data-cw233-mc-pitch-player',
    'gridPosition',
    'parseFormation',
    'Схема недоступна',
  ]);
  const premiumPlayers = includesAll(players, [
    'cw233-mc-player-card',
    'data-cw233-mc-player-rank',
    'var(--mc-surface-raised)',
    'var(--mc-accent-soft)',
    'player.shots',
    'player.keyPasses',
    '@media(max-width:360px)',
  ]);

  const report = {
    ok:responseOk
      && fiveTournamentThemes
      && premiumHero
      && premiumStats
      && premiumEvents
      && premiumLineups
      && premiumPlayers,
    observedAt:new Date().toISOString(),
    origin:ORIGIN,
    modules:Object.fromEntries(MODULES.map(moduleName => [moduleName, {
      status:responses[moduleName].status,
      responseOk:responses[moduleName].ok,
    }])),
    fiveTournamentThemes,
    premiumHero,
    premiumStats,
    premiumEvents,
    premiumLineups,
    premiumPlayers,
  };

  if (writeArtifact) {
    await mkdir('artifacts', { recursive:true });
    await writeFile(ARTIFACT_PATH, JSON.stringify(report, null, 2));
  }

  console.log(JSON.stringify(report));
  if (!report.ok) throw new Error('Round 49 Premium Match Center deployment markers are incomplete');
  return report;
}

const isCli = process.argv[1]
  && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isCli) {
  probeRound49PremiumMatchCenter().catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
