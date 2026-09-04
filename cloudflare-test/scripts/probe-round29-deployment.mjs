import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ORIGIN = 'https://ciao-web-app-test.ciao-web.workers.dev/';
const ARTIFACT_PATH = 'artifacts/v23-3-round29-deployment.json';

async function fetchText(path, fetchImpl) {
  const url = new URL(path, ORIGIN);
  url.searchParams.set('round29_probe', `${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const response = await fetchImpl(url, {
    headers:{ 'cache-control':'no-cache, no-store, max-age=0', pragma:'no-cache' },
  });
  return { status:response.status, ok:response.ok, text:await response.text() };
}

function compact(value) { return String(value || '').replace(/\s+/g, ' ').trim(); }

export async function probeRound29Deployment({ fetchImpl = fetch, writeArtifact = true } = {}) {
  const [matchesResponse, round8Response] = await Promise.all([
    fetchText('/v23.2/matches-ui.mjs', fetchImpl),
    fetchText('/v23.3/round8-performance-premium.mjs', fetchImpl),
  ]);
  const matchesText = compact(matchesResponse.text);
  const round8Text = compact(round8Response.text);

  const matches = {
    status:matchesResponse.status,
    responseOk:matchesResponse.ok,
    serieARoundNavigation:matchesText.includes("competition !== 'serie_a' && !UEFA_COMPETITIONS.has(competition)")
      && matchesText.includes("if (competition === 'serie_a')")
      && matchesText.includes("key = `round:${round}`; label = String(round); order = round;")
      && matchesText.includes("const body = competition === 'serie_a' || UEFA_COMPETITIONS.has(competition) || competition === 'coppa_italia'"),
    nativeSingleMeta:matchesText.includes('cw232-match-card__meta')
      && matchesText.includes('cw232-match-card__status')
      && matchesText.includes('cw232-match-card__kickoff'),
  };

  const round8 = {
    status:round8Response.status,
    responseOk:round8Response.ok,
    nativeCardGuard:round8Text.includes("card.querySelector?.('.cw232-match-card__meta')")
      && round8Text.includes("card.dataset.cw233Round8 = '1';")
      && round8Text.includes('return;'),
    neutralInactiveSelectors:round8Text.includes(".cw232-group-tabs button{min-width:54px;height:46px;padding:0 16px;border-radius:14px;background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.10)")
      && !round8Text.includes(".cw232-group-tabs button{min-width:54px;height:46px;padding:0 16px;border-radius:14px;border:1px solid rgba(121,145,212,.13);background:linear-gradient"),
    tournamentActiveSelector:round8Text.includes(".cw232-group-tabs button[aria-selected='true']{background:linear-gradient(145deg,var(--cw232-match-accent),var(--cw232-match-accent-2))"),
    tournamentStatusBadge:round8Text.includes('.cw232-match-card__status{')
      && round8Text.includes('var(--cw232-match-accent)')
      && round8Text.includes('var(--cw232-match-accent-2)'),
  };

  const report = {
    ok:[matches.responseOk,matches.serieARoundNavigation,matches.nativeSingleMeta,round8.responseOk,round8.nativeCardGuard,round8.neutralInactiveSelectors,round8.tournamentActiveSelector,round8.tournamentStatusBadge].every(Boolean),
    observedAt:new Date().toISOString(),
    origin:ORIGIN,
    matches,
    round8,
  };

  if (writeArtifact) {
    await mkdir('artifacts', { recursive:true });
    await writeFile(ARTIFACT_PATH, JSON.stringify(report, null, 2));
  }
  console.log(JSON.stringify(report));
  if (!report.ok) throw new Error('Round 29 deployment markers are incomplete');
  return report;
}

const isCli = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isCli) probeRound29Deployment().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
