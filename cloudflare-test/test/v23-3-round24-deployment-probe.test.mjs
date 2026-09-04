import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { probeRound23Deployment } from '../scripts/probe-round23-deployment.mjs';

const ORIGIN = 'https://ciao-web-app-test.ciao-web.workers.dev/';

function response(body, status = 200) {
  return new Response(body, { status, headers:{ 'content-type':'text/plain; charset=utf-8' } });
}

function fixtureFetch(overrides = {}) {
  const bodies = {
    '/': '<script>/* cw233-round23-unified-state-fixes */</script>',
    '/v23.3/legacy-match-center-theme.mjs': `
      #ciao-miniapp-root.match-center-open { --cw233-mc-accent:#0c5aa8; --cw233-mc-accent-2:#287fc7; }
      #ciao-miniapp-root.match-center-open .mc-back { display:flex!important; }
      #ciao-miniapp-root.match-center-open .mc-toolbar { border-bottom:0!important; }
      #ciao-miniapp-root.match-center-open .cw20-stat-mini,
      #ciao-miniapp-root.match-center-open .cw20-player-row,
      #ciao-miniapp-root.match-center-open .cw20-event-card { background:var(--cw233-mc-surface)!important; }
      #ciao-miniapp-root.match-center-open .mc-lineup-switch button { background:var(--cw233-mc-surface)!important; }
      #ciao-miniapp-root.match-center-open .mc-lineup-switch button.active { background:linear-gradient(135deg,var(--cw233-mc-accent),var(--cw233-mc-accent-2))!important; }
    `,
    '/v23.3/round11-performance-themes.mjs': `--r11a:#0c5aa8;--r11b:#287fc7; linear-gradient(165deg,#071626 0%,#061321 48%,#050f1a 100%)`,
    '/v23.3/round10-regression-fixes.mjs': `data-cw233-round10-theme='serie-a' #071626 rgba(12,90,168,.28) rgba(40,127,199,.22)`,
    ...overrides,
  };
  return async input => {
    const url = new URL(String(input), ORIGIN);
    return response(bodies[url.pathname] ?? '', bodies[url.pathname] === undefined ? 404 : 200);
  };
}

test('Round 24 deployment probe proves the live TEST contains all surviving Round 23 fixes', async () => {
  const report = await probeRound23Deployment({ fetchImpl:fixtureFetch(), writeArtifact:false });
  assert.equal(report.ok, true);
  assert.equal(report.origin, ORIGIN);
  assert.equal(report.home.round23StateMarker, true);
  assert.equal(report.matchCenter.serieAPalette, true);
  assert.equal(report.matchCenter.backControlVisible, true);
  assert.equal(report.matchCenter.toolbarFrameRemoved, true);
  assert.equal(report.matchCenter.contextSurfacesThemed, true);
  assert.equal(report.matchCenter.lineupSwitchThemed, true);
  assert.equal(report.predictions.serieAPalette, true);
  assert.equal(report.matches.serieAAmbience, true);
});

test('Round 24 deployment probe fails closed when the Round 23 built-state marker is missing', async () => {
  await assert.rejects(
    probeRound23Deployment({ fetchImpl:fixtureFetch({ '/':'<html>old build</html>' }), writeArtifact:false }),
    /Round 23 deployment markers are incomplete/,
  );
});

test('Round 24 live probe is enforced on develop pushes and uploaded as an artifact', async () => {
  const workflow = await readFile(new URL('../../.github/workflows/ciao-test-check.yml', import.meta.url), 'utf8');
  assert.match(workflow, /Probe deployed Round 23 fixes/);
  assert.match(workflow, /node scripts\/probe-round23-deployment\.mjs/);
  assert.match(workflow, /name:\s*ciao-v23-3-round23-deployment/);
  assert.match(workflow, /path:\s*cloudflare-test\/artifacts\/v23-3-round23-deployment\.json/);
});
