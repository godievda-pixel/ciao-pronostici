import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ORIGIN = 'https://ciao-web-app-test.ciao-web.workers.dev/';
const ARTIFACT_PATH = 'artifacts/v23-3-round39-match-center.json';
const MODULES = Object.freeze([
  'match-center-runtime.mjs',
  'match-center-links.mjs',
  'match-center-view.mjs',
  'match-center-store.mjs',
  'match-center-repository.mjs',
  'match-center-contract.mjs',
  'home-integration.mjs',
  'index.mjs',
]);

async function fetchText(path, fetchImpl) {
  const url = new URL(path, ORIGIN);
  url.searchParams.set('round39_probe', `${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const response = await fetchImpl(url, {
    headers:{ 'cache-control':'no-cache, no-store, max-age=0', pragma:'no-cache' },
  });
  return { status:response.status, ok:response.ok, text:await response.text() };
}

function compact(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function excludesLegacyMatchCenter(text) {
  return !/from ['"]\.\/match-center\.mjs['"]|openMatchCenter|matchCenterHtml|external-legacy-match|open-serie-a-match|CiaoV233Round37/i.test(text);
}

export async function probeRound39MatchCenter({ fetchImpl = fetch, writeArtifact = true } = {}) {
  const responses = Object.fromEntries(await Promise.all(MODULES.map(async moduleName => [
    moduleName,
    await fetchText(`/v23.3/${moduleName}`, fetchImpl),
  ])));
  const source = Object.fromEntries(MODULES.map(moduleName => [
    moduleName,
    compact(responses[moduleName].text),
  ]));

  const runtime = source['match-center-runtime.mjs'];
  const links = source['match-center-links.mjs'];
  const view = source['match-center-view.mjs'];
  const store = source['match-center-store.mjs'];
  const repository = source['match-center-repository.mjs'];
  const contract = source['match-center-contract.mjs'];
  const home = source['home-integration.mjs'];
  const index = source['index.mjs'];

  const responseOk = MODULES.every(moduleName => responses[moduleName].ok);
  const runtimeBuild = runtime.match(
    /MATCH_CENTER_RUNTIME_BUILD\s*=\s*['"](round\d+-canonical-match-center)['"]/,
  )?.[1] || '';
  const buildIdentity = Boolean(runtimeBuild)
    && runtime.includes("MATCH_CENTER_RUNTIME_ID = 'ciao-v239-match-center-overlay'");

  const canonicalRouterOnly = links.includes("from './match-center-runtime.mjs'")
    && links.includes('openCanonicalMatchCenter')
    && links.includes('installCanonicalMatchLinks')
    && excludesLegacyMatchCenter(links)
    && excludesLegacyMatchCenter(runtime);

  const canonicalView = view.includes('renderMatchCenterView')
    && view.includes('data-cw239-match-center')
    && view.includes('match?.score?.home')
    && view.includes('match?.score?.away')
    && view.includes('MATCH_CENTER_VIEW_TABS')
    && !/matchCenterHtml|openMatchCenter/i.test(view);

  const singleStore = runtime.includes("from './match-center-store.mjs'")
    && runtime.includes('createMatchCenterStore({ repository, documentRef })')
    && store.includes('export function createMatchCenterStore')
    && store.includes("activeTab:'overview'")
    && store.includes("String(state?.match?.status || '').toLowerCase() === 'live'")
    && store.includes('POLL_MS = 15_000');

  const repositoryBoundary = runtime.includes("from './match-center-repository.mjs'")
    && repository.includes('export function createMatchCenterRepository')
    && repository.includes("from './data-client.mjs'")
    && repository.includes('loadMatchCenterBase')
    && repository.includes('loadMatchCenterSection')
    && !/document\.|querySelector|openMatchCenter|matchCenterHtml/.test(repository);

  const canonicalContract = contract.includes('export const MATCH_CENTER_SECTIONS')
    && contract.includes("'overview'")
    && contract.includes("'stats'")
    && contract.includes("'events'")
    && contract.includes("'lineups'")
    && contract.includes("'players'")
    && contract.includes('normalizeCanonicalBase')
    && contract.includes('normalizeCanonicalSection')
    && contract.includes('score:Object.freeze')
    && contract.includes('coverage:normalizeCanonicalCoverage');

  const browserGraphWired = index.includes("import './home-integration.mjs'")
    && !index.includes("import './match-center.mjs'")
    && home.includes("from './match-center-links.mjs'")
    && home.includes('installCanonicalMatchLinks(globalThis.document)')
    && links.includes("from './match-center-runtime.mjs'");

  const report = {
    ok:responseOk
      && buildIdentity
      && canonicalRouterOnly
      && canonicalView
      && singleStore
      && repositoryBoundary
      && canonicalContract
      && browserGraphWired,
    observedAt:new Date().toISOString(),
    origin:ORIGIN,
    modules:Object.fromEntries(MODULES.map(moduleName => [moduleName, {
      status:responses[moduleName].status,
      responseOk:responses[moduleName].ok,
    }])),
    runtimeBuild,
    buildIdentity,
    canonicalRouterOnly,
    canonicalView,
    singleStore,
    repositoryBoundary,
    canonicalContract,
    browserGraphWired,
  };

  if (writeArtifact) {
    await mkdir('artifacts', { recursive:true });
    await writeFile(ARTIFACT_PATH, JSON.stringify(report, null, 2));
  }

  console.log(JSON.stringify(report));
  if (!report.ok) throw new Error('Round 39 canonical Match Center deployment markers are incomplete');
  return report;
}

const isCli = process.argv[1]
  && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isCli) {
  probeRound39MatchCenter().catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
