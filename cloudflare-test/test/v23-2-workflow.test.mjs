import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Ciao TEST workflow observes and uploads the v23.2 API contract after build', async () => {
  const workflow = await readFile(
    new URL('../../.github/workflows/ciao-test-check.yml', import.meta.url),
    'utf8',
  );

  assert.match(workflow, /name: Observe v23\.1 API contract/);
  assert.match(workflow, /run: npm run inspect:api-contract/);
  assert.match(workflow, /uses: actions\/upload-artifact@v4/);
  assert.match(workflow, /name: ciao-v23-2-api-contract/);
  assert.match(
    workflow,
    /cloudflare-test\/artifacts\/api-contract-observed\.json/,
  );
});
