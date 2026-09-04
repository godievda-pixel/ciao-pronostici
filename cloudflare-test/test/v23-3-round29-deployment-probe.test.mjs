import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { probeRound29Deployment } from '../scripts/probe-round29-deployment.mjs';

const ORIGIN = 'https://ciao-web-app-test.ciao-web.workers.dev/';
function response(body, status = 200) { return new Response(body, { status, headers:{ 'content-type':'text/plain; charset=utf-8' } }); }
function fixtureFetch(overrides = {}) {
  const bodies = {
    '/v23.2/matches-ui.mjs': `
      if (competition !== 'serie_a' && !UEFA_COMPETITIONS.has(competition) && competition !== 'coppa_italia') return Object.freeze([]);
      if (competition === 'serie_a') { const round = numericRound(match); key = \`round:\${round}\`; label = String(round); order = round; }
      const body = competition === 'serie_a' || UEFA_COMPETITIONS.has(competition) || competition === 'coppa_italia' ? renderNavigableGroups(matches, competition, now) : renderMatchGroups(matches, competition);
      <div class="cw232-match-card__meta"><span class="cw232-match-card__status"></span><time class="cw232-match-card__kickoff"></time></div>
    `,
    '/v23.3/round8-performance-premium.mjs': `
      .cw232-group-tabs button{min-width:54px;height:46px;padding:0 16px;border-radius:14px;background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.10)}
      .cw232-group-tabs button[aria-selected='true']{background:linear-gradient(145deg,var(--cw232-match-accent),var(--cw232-match-accent-2))}
      .cw232-match-card__status{border:1px solid var(--cw232-match-accent);background:linear-gradient(135deg,var(--cw232-match-accent),var(--cw232-match-accent-2))}
      function decorateMatchCard(card){ if (card.querySelector?.('.cw232-match-card__meta')) { card.dataset.cw233Round8 = '1'; return; } }
    `,
    ...overrides,
  };
  return async input => { const url = new URL(String(input), ORIGIN); return response(bodies[url.pathname] ?? '', bodies[url.pathname] === undefined ? 404 : 200); };
}

test('Round 29 deployment probe proves selectors, single-card meta and tournament colors', async () => {
  const report = await probeRound29Deployment({ fetchImpl:fixtureFetch(), writeArtifact:false });
  assert.equal(report.ok, true);
  assert.equal(report.matches.serieARoundNavigation, true);
  assert.equal(report.matches.nativeSingleMeta, true);
  assert.equal(report.round8.nativeCardGuard, true);
  assert.equal(report.round8.neutralInactiveSelectors, true);
  assert.equal(report.round8.tournamentActiveSelector, true);
  assert.equal(report.round8.tournamentStatusBadge, true);
});

test('Round 29 deployment probe fails closed on the old app-blue selector layer', async () => {
  await assert.rejects(
    probeRound29Deployment({ fetchImpl:fixtureFetch({ '/v23.3/round8-performance-premium.mjs':`.cw232-group-tabs button{min-width:54px;height:46px;padding:0 16px;border-radius:14px;border:1px solid rgba(121,145,212,.13);background:linear-gradient(180deg,rgba(28,43,87,.9),rgba(15,27,62,.9))}` }), writeArtifact:false }),
    /Round 29 deployment markers are incomplete/,
  );
});

test('Round 29 live probe is enforced on develop pushes and uploaded as an artifact', async () => {
  const workflow = await readFile(new URL('../../.github/workflows/ciao-test-check.yml', import.meta.url), 'utf8');
  assert.match(workflow, /Probe deployed Round 29 fixes/);
  assert.match(workflow, /node scripts\/probe-round29-deployment\.mjs/);
  assert.match(workflow, /name:\s*ciao-v23-3-round29-deployment/);
  assert.match(workflow, /path:\s*cloudflare-test\/artifacts\/v23-3-round29-deployment\.json/);
});
