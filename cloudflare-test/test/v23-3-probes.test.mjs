import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const providerProbeUrl = new URL('../scripts/probe-bsd-provider.mjs', import.meta.url);
const deploymentProbeUrl = new URL('../scripts/probe-test-deployment.mjs', import.meta.url);
const workflowUrl = new URL('../../.github/workflows/ciao-test-check.yml', import.meta.url);

test('v23.3 BSD provider probe covers full external tournament release evidence', async () => {
  const source = await readFile(providerProbeUrl, 'utf8');

  for (const competition of ['coppa_italia', 'ucl', 'uel', 'uecl']) {
    assert.match(source, new RegExp(competition));
  }
  assert.match(source, /fetchBsdMatches/);
  assert.match(source, /fetchBsdStandings/);
  assert.match(source, /fetchBsdMatchSnapshot/);
  assert.match(source, /foreignVsForeign/);
  assert.match(source, /unknownTeamNames/);
  assert.match(source, /duplicateTie/);
  assert.match(source, /snapshot/);
  assert.match(source, /provider:\s*'bsd-football-v2'/);
  assert.doesNotMatch(source, /authorization:\s*item\.authorization/);
});

test('v23.3 deployment probe verifies unified runtime and every release surface', async () => {
  const source = await readFile(deploymentProbeUrl, 'utf8');

  assert.match(source, /id="ciao-v233"/);
  assert.match(source, /\/v23\.3\/index\.mjs/);
  assert.match(source, /Серия А/);
  assert.match(source, /Начало нового сезона!/);
  assert.match(source, /homeResetBannerAbsent/);
  assert.match(source, /homeMultiCompetition/);
  assert.match(source, /hasTablesRuntime/);
  assert.match(source, /hasMatchCenterRuntime/);
  assert.match(source, /hasCoppaBracket/);
  assert.match(source, /hasCoppaScheduleOnly/);
  assert.match(source, /profileMarker/);
  assert.match(source, /documentOverflowGuard/);
  assert.match(source, /\/api\/v23\.3\/standings/);
  assert.match(source, /\/api\/v23\.3\/match-center/);
  assert.match(source, /foreignVsForeign/);
  assert.match(source, /allUnknownTeamNames/);
  assert.match(source, /releaseHeldForUnknownTeams/);
  assert.match(source, /predictionsBlocked/);
});

test('v23.3 workflow uploads explicitly versioned provider and deployment evidence', async () => {
  const workflow = await readFile(workflowUrl, 'utf8');

  assert.match(workflow, /name: ciao-v23-3-bsd-provider/);
  assert.match(workflow, /name: ciao-v23-3-test-deployment/);
  assert.match(workflow, /Probe BSD provider contract/);
  assert.match(workflow, /Probe deployed TEST markers/);
});
