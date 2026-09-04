import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ORIGIN = 'https://ciao-web-app-test.ciao-web.workers.dev/';
const ARTIFACT_PATH = 'artifacts/v23-3-round30-deployment.json';

async function fetchText(path, fetchImpl) {
  const url = new URL(path, ORIGIN);
  url.searchParams.set('round30_probe', `${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const response = await fetchImpl(url, {
    headers:{ 'cache-control':'no-cache, no-store, max-age=0', pragma:'no-cache' },
  });
  return { status:response.status, ok:response.ok, text:await response.text() };
}

function compact(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function blockHas(text, selector, declarations = []) {
  const normalized = compact(text);
  const at = normalized.indexOf(selector);
  if (at < 0) return false;
  const close = normalized.indexOf('}', at);
  if (close < 0) return false;
  const block = normalized.slice(at, close + 1);
  return declarations.every(declaration => block.includes(declaration));
}

export async function probeRound30Deployment({ fetchImpl = fetch, writeArtifact = true } = {}) {
  const [indexResponse, runtimeResponse, rankingResponse, authResponse, serviceResponse] = await Promise.all([
    fetchText('/v23.3/index.mjs', fetchImpl),
    fetchText('/v23.3/round30-feedback-fixes.mjs', fetchImpl),
    fetchText('/v23.3/ranking-ui.mjs', fetchImpl),
    fetchText('/v23.3/prediction-auth.mjs', fetchImpl),
    fetchText('/v23.3/prediction-service.mjs', fetchImpl),
  ]);

  const indexText = compact(indexResponse.text);
  const runtimeText = compact(runtimeResponse.text);
  const rankingText = compact(rankingResponse.text);
  const authText = compact(authResponse.text);
  const serviceText = compact(serviceResponse.text);

  const index = {
    status:indexResponse.status,
    responseOk:indexResponse.ok,
    round30Wired:indexText.includes("import './round30-feedback-fixes.mjs'")
      && indexText.includes("round30FeedbackFixes: 'enabled'"),
  };

  const runtime = {
    status:runtimeResponse.status,
    responseOk:runtimeResponse.ok,
    buildMarker:runtimeText.includes("USER_FEEDBACK_ROUND30_BUILD = '2026-09-04-r30'"),
    neutralOverallAndAll:runtimeText.includes("[data-cw233-rank-filter='overall'][aria-selected='true']")
      && runtimeText.includes("[data-cw233-filter='all'][aria-selected='true']")
      && runtimeText.includes('--r11soft:rgba(255,255,255,.055)'),
    matchCenterOwnsViewport:blockHas(
      runtimeText,
      '#ciao-miniapp-root.match-center-open #ciao-v232-matches-overlay',
      ['display:none!important'],
    ),
    backArrowCentered:blockHas(
      runtimeText,
      '#ciao-miniapp-root.match-center-open .mc-back',
      ['display:flex!important','align-items:center!important','justify-content:center!important','padding:0!important'],
    ),
    rankingStatsCentered:blockHas(
      runtimeText,
      '#ciao-miniapp-root .cw233-ranking-stat',
      ['align-items:center!important','justify-content:center!important','text-align:center!important'],
    ),
  };

  const ranking = {
    status:rankingResponse.status,
    responseOk:rankingResponse.ok,
    favoriteClubBadges:rankingText.includes('function favoriteClub(')
      && rankingText.includes('favorite_team||row?.favoriteTeam')
      && rankingText.includes('cw233-ranking-club-logo')
      && !rankingText.includes('function initials('),
  };

  const auth = {
    status:authResponse.status,
    responseOk:authResponse.ok,
    favoriteTeamConditional:authText.includes('export function normalizeFavoriteTeam(')
      && authText.includes('const favoriteTeam = normalizeFavoriteTeam(user)')
      && authText.includes('if (favoriteTeam) result.favoriteTeam = favoriteTeam'),
  };

  const service = {
    status:serviceResponse.status,
    responseOk:serviceResponse.ok,
    favoriteTeamConditional:serviceText.includes('const favoriteTeam = clubs.get(text(row?.user_id))')
      && serviceText.includes('if (favoriteTeam) enriched.favorite_team = favoriteTeam')
      && serviceText.includes('if (authenticated.favoriteTeam) ranking.favorite_team = authenticated.favoriteTeam'),
  };

  const checks = [
    index.responseOk,
    index.round30Wired,
    runtime.responseOk,
    runtime.buildMarker,
    runtime.neutralOverallAndAll,
    runtime.matchCenterOwnsViewport,
    runtime.backArrowCentered,
    runtime.rankingStatsCentered,
    ranking.responseOk,
    ranking.favoriteClubBadges,
    auth.responseOk,
    auth.favoriteTeamConditional,
    service.responseOk,
    service.favoriteTeamConditional,
  ];

  const report = {
    ok:checks.every(Boolean),
    observedAt:new Date().toISOString(),
    origin:ORIGIN,
    index,
    runtime,
    ranking,
    auth,
    service,
  };

  if (writeArtifact) {
    await mkdir('artifacts', { recursive:true });
    await writeFile(ARTIFACT_PATH, JSON.stringify(report, null, 2));
  }

  console.log(JSON.stringify(report));
  if (!report.ok) throw new Error('Round 30 deployment markers are incomplete');
  return report;
}

const isCli = process.argv[1]
  && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isCli) {
  probeRound30Deployment().catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
