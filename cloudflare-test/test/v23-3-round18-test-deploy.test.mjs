import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ROUND18_TEST_BRANCH,
  shouldDeployRound18Test,
  isRound18TestWranglerConfig,
} from '../scripts/deploy-round18-test.mjs';

const branch = 'debug-v23-3-round18-match-center-parity';

test('Round 18 TEST deploy is allowed only from the approved Workers Builds branch', () => {
  assert.equal(ROUND18_TEST_BRANCH, branch);
  assert.equal(shouldDeployRound18Test({ WORKERS_CI: '1', WORKERS_CI_BRANCH: branch }), true);
  assert.equal(shouldDeployRound18Test({ WORKERS_CI: '1', WORKERS_CI_BRANCH: 'develop' }), false);
  assert.equal(shouldDeployRound18Test({ WORKERS_CI: '1', WORKERS_CI_BRANCH: 'main' }), false);
  assert.equal(shouldDeployRound18Test({ WORKERS_CI: '0', WORKERS_CI_BRANCH: branch }), false);
  assert.equal(shouldDeployRound18Test({ WORKERS_CI_BRANCH: branch }), false);
});

test('Round 18 TEST deploy refuses any Wrangler config that is not the isolated TEST worker', () => {
  assert.equal(isRound18TestWranglerConfig(`{
    "name": "ciao-web-app-test",
    "vars": { "CIAO_ENV": "test" }
  }`), true);

  assert.equal(isRound18TestWranglerConfig(`{
    "name": "ciao-web-app",
    "vars": { "CIAO_ENV": "test" }
  }`), false);

  assert.equal(isRound18TestWranglerConfig(`{
    "name": "ciao-web-app-test",
    "vars": { "CIAO_ENV": "production" }
  }`), false);
});
