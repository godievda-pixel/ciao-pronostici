import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ORIGIN = 'https://ciao-web-app-test.ciao-web.workers.dev/';
const ARTIFACT_PATH = 'artifacts/v23-3-round28-deployment.json';

async function fetchText(path, fetchImpl) {
  const url = new URL(path, ORIGIN);
  url.searchParams.set('round28_probe', `${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const response = await fetchImpl(url, {
    headers:{
      'cache-control':'no-cache, no-store, max-age=0',
      pragma:'no-cache',
    },
  });
  return { status:response.status, ok:response.ok, text:await response.text() };
}

function compact(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function blockHas(text, selector, declaration) {
  const normalized = compact(text);
  const at = normalized.indexOf(selector);
  if (at < 0) return false;
  const close = normalized.indexOf('}', at);
  if (close < 0) return false;
  return normalized.slice(at, close + 1).includes(declaration);
}

export async function probeRound28Deployment({ fetchImpl = fetch, writeArtifact = true } = {}) {
  const [homeResponse, matchCenterResponse, matchesResponse] = await Promise.all([
    fetchText('/', fetchImpl),
    fetchText('/v23.3/legacy-match-center-theme.mjs', fetchImpl),
    fetchText('/v23.2/matches-ui.mjs', fetchImpl),
  ]);

  const homeText = compact(homeResponse.text);
  const matchCenterText = compact(matchCenterResponse.text);
  const matchesText = compact(matchesResponse.text);

  const home = {
    status:homeResponse.status,
    responseOk:homeResponse.ok,
    positiveExternalRuntimeId:homeText.includes('function __cw233ExternalRuntimeId(')
      && homeText.includes('matchViewId = __cw233ExternalRuntimeId(detail);')
      && !homeText.includes('matchViewId = -1;'),
  };

  const matchCenter = {
    status:matchCenterResponse.status,
    responseOk:matchCenterResponse.ok,
    round28ThemeBuild:matchCenterText.includes("LEGACY_MATCH_CENTER_THEME_BUILD = 'r28-match-center-fixes'"),
    backControlVisible:blockHas(
      matchCenterText,
      '#ciao-miniapp-root.match-center-open .mc-back',
      'display:flex!important',
    ),
    viewportFrameRemoved:blockHas(
      matchCenterText,
      '#ciao-miniapp-root.match-center-open .mc-shell',
      'border:0!important',
    ) && blockHas(
      matchCenterText,
      '#ciao-miniapp-root.match-center-open .mc-shell',
      'outline:0!important',
    ),
    premiumContextCards:matchCenterText.includes('.cw14-info-item,')
      && matchCenterText.includes('.cw14-form-card {')
      && matchCenterText.includes('linear-gradient(145deg,')
      && matchCenterText.includes('var(--cw233-mc-accent)')
      && matchCenterText.includes('var(--cw233-mc-accent-2)')
      && matchCenterText.includes('border:1px solid color-mix(in srgb,var(--cw233-mc-accent)'),
  };

  const matches = {
    status:matchesResponse.status,
    responseOk:matchesResponse.ok,
    richScheduledCard:matchesText.includes('cw232-match-card__meta')
      && matchesText.includes('cw232-match-card__status')
      && matchesText.includes('cw232-match-card__kickoff')
      && matchesText.includes('cw232-match-card__score')
      && matchesText.includes('— : —')
      && matchesText.includes('МАТЧ НЕ НАЧАЛСЯ')
      && matchesText.includes('ОЖИДАЕМ НАЧАЛО'),
    allTournamentPalettes:matchesText.includes('--cw232-match-accent:#0c5aa8')
      && matchesText.includes("data-cw232-theme='coppa'")
      && matchesText.includes('--cw232-match-accent:#ce2b37')
      && matchesText.includes('--cw232-match-accent-2:#009246')
      && matchesText.includes("data-cw232-theme='champions'")
      && matchesText.includes('--cw232-match-accent:#3157ff')
      && matchesText.includes('--cw232-match-accent-2:#7b42ff')
      && matchesText.includes("data-cw232-theme='europa'")
      && matchesText.includes('--cw232-match-accent:#f06722')
      && matchesText.includes('--cw232-match-accent-2:#ff9b32')
      && matchesText.includes("data-cw232-theme='conference'")
      && matchesText.includes('--cw232-match-accent:#22a866')
      && matchesText.includes('--cw232-match-accent-2:#55d68e'),
    groupTabsThemed:matchesText.includes(".cw232-group-tabs button[aria-selected='true']")
      && matchesText.includes('linear-gradient(135deg,var(--cw232-match-accent),var(--cw232-match-accent-2))'),
  };

  const checks = [
    home.responseOk,
    home.positiveExternalRuntimeId,
    matchCenter.responseOk,
    matchCenter.round28ThemeBuild,
    matchCenter.backControlVisible,
    matchCenter.viewportFrameRemoved,
    matchCenter.premiumContextCards,
    matches.responseOk,
    matches.richScheduledCard,
    matches.allTournamentPalettes,
    matches.groupTabsThemed,
  ];

  const report = {
    ok:checks.every(Boolean),
    observedAt:new Date().toISOString(),
    origin:ORIGIN,
    home,
    matchCenter,
    matches,
  };

  if (writeArtifact) {
    await mkdir('artifacts', { recursive:true });
    await writeFile(ARTIFACT_PATH, JSON.stringify(report, null, 2));
  }

  console.log(JSON.stringify(report));
  if (!report.ok) throw new Error('Round 28 deployment markers are incomplete');
  return report;
}

const isCli = process.argv[1]
  && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isCli) {
  probeRound28Deployment().catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
