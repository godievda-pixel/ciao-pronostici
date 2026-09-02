import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function workflowSource() {
  return readFile(
    new URL('../../.github/workflows/ciao-test-check.yml', import.meta.url),
    'utf8',
  );
}

test('Ciao TEST workflow observes and uploads the v23.2 API contract after build', async () => {
  const workflow = await workflowSource();

  assert.match(workflow, /name: Observe v23\.1 API contract/);
  assert.match(workflow, /run: npm run inspect:api-contract/);
  assert.match(workflow, /uses: actions\/upload-artifact@v4/);
  assert.match(workflow, /name: ciao-v23-2-api-contract/);
  assert.match(
    workflow,
    /cloudflare-test\/artifacts\/api-contract-observed\.json/,
  );
});

test('Ciao TEST workflow records explicit v23.3 provider and deployment evidence', async () => {
  const workflow = await workflowSource();

  assert.match(workflow, /name: Probe BSD provider contract/);
  assert.match(workflow, /run: node scripts\/probe-bsd-provider\.mjs/);
  assert.match(workflow, /name: ciao-v23-3-bsd-provider/);
  assert.match(workflow, /cloudflare-test\/artifacts\/bsd-provider-probe\.json/);
  assert.match(workflow, /name: Probe deployed TEST markers/);
  assert.match(workflow, /run: node scripts\/probe-test-deployment\.mjs/);
  assert.match(workflow, /name: ciao-v23-3-test-deployment/);
  assert.match(workflow, /cloudflare-test\/artifacts\/test-deployment-probe\.json/);
});
