import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ORIGIN = 'https://ciao-web-app-test.ciao-web.workers.dev/';
const ARTIFACT_PATH = 'artifacts/v23-3-round50-match-center.json';
const MODULES = Object.freeze([
  'match-center-runtime.mjs',
  'match-center-theme.mjs',
  'match-center-view.mjs',
  'match-center-overview.mjs',
  'match-center-stats.mjs',
  'match-center-events.mjs',
  'match-center-lineups.mjs',
  'match-center-players.mjs',
]);

async function fetchText(path, fetchImpl) {
  const url = new URL(path, ORIGIN);
  url.searchParams.set('round50_probe', `${Date.now()}-${Math.random().toString(16).slice(2)}`);
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

export async function probeRound50MatchCenter({ fetchImpl = fetch, writeArtifact = true } = {}) {
  const responses = Object.fromEntries(await Promise.all(MODULES.map(async moduleName => [
    moduleName,
    await fetchText(`/v23.3/${moduleName}`, fetchImpl),
  ])));
  const source = Object.fromEntries(MODULES.map(moduleName => [moduleName, compact(responses[moduleName].text)]));

  const runtime = source['match-center-runtime.mjs'];
  const theme = source['match-center-theme.mjs'];
  const view = source['match-center-view.mjs'];
  const overview = source['match-center-overview.mjs'];
  const stats = source['match-center-stats.mjs'];
  const events = source['match-center-events.mjs'];
  const lineups = source['match-center-lineups.mjs'];
  const players = source['match-center-players.mjs'];

  const responseOk = MODULES.every(moduleName => responses[moduleName].ok);
  const runtimeLifecycle = includesAll(runtime, [
    'MATCH_CENTER_HOST_SCROLLBAR_CSS',
    'scrollbar-width:none',
    '::-webkit-scrollbar{display:none',
    'restoreSource',
    'suspendSource',
  ]);
  const fiveTournamentThemes = includesAll(theme, [
    "serie_a:freezeTheme('serie-a'",
    "coppa_italia:freezeTheme('coppa'",
    "ucl:freezeTheme('champions'",
    "uel:freezeTheme('europa'",
    "uecl:freezeTheme('conference'",
    "'--mc-surface-raised'",
    "'--mc-accent-soft'",
  ]);
  const canonicalShell = includesAll(view, [
    'data-cw239-match-center',
    'data-cw239-competition',
    'data-cw239-theme',
    'data-cw239-tab',
    'grid-template-columns:repeat(5,minmax(0,1fr))',
  ]);
  const overviewParity = includesAll(overview, [
    'data-cw250-overview-redraw-style',
    'data-cw250-key-indicators',
    'data-cw250-best-player',
    'data-cw250-recent-events',
    'data-cw250-prediction-distribution',
    'data-cw250-exact-score',
    'data-cw250-popular-scores',
  ]);
  const statsParity = includesAll(stats, [
    'data-cw250-mc-stats-primary',
    'data-cw250-mc-stats-secondary',
    'data-cw250-mc-pressure',
    'data-cw233-mc-shotmap',
    'data-cw233-mc-shot-list',
  ]);
  const eventsParity = includesAll(events, [
    'data-cw250-mc-events-timeline',
    'data-cw250-mc-side',
    'data-cw250-mc-period',
    'data-cw250-mc-event-kind',
    'data-cw250-mc-score-after',
  ]);
  const lineupsParity = includesAll(lineups, [
    'data-cw250-mc-lineups-redraw-style',
    'data-cw250-mc-lineup-stage',
    'data-cw250-mc-lineup-switch',
    'data-cw250-mc-pitch-head',
    'data-cw250-mc-starting-xi',
    'data-cw250-mc-bench',
    'data-cw233-mc-pitch',
  ]);
  const playersParity = includesAll(players, [
    'data-cw250-mc-players-redraw-style',
    'data-cw250-mc-player-card',
    'data-cw250-mc-player-metric',
    'is-top-player',
    '@media(max-width:420px)',
  ]);

  const report = {
    ok:responseOk
      && runtimeLifecycle
      && fiveTournamentThemes
      && canonicalShell
      && overviewParity
      && statsParity
      && eventsParity
      && lineupsParity
      && playersParity,
    observedAt:new Date().toISOString(),
    origin:ORIGIN,
    modules:Object.fromEntries(MODULES.map(moduleName => [moduleName, {
      status:responses[moduleName].status,
      responseOk:responses[moduleName].ok,
    }])),
    runtimeLifecycle,
    fiveTournamentThemes,
    canonicalShell,
    overviewParity,
    statsParity,
    eventsParity,
    lineupsParity,
    playersParity,
  };

  if (writeArtifact) {
    await mkdir('artifacts', { recursive:true });
    await writeFile(ARTIFACT_PATH, JSON.stringify(report, null, 2));
  }

  console.log(JSON.stringify(report));
  if (!report.ok) throw new Error('Round 50 Match Center deployment markers are incomplete');
  return report;
}

const isCli = process.argv[1]
  && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isCli) {
  probeRound50MatchCenter().catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
