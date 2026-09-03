import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROUND18_TEST_BRANCH = 'debug-v23-3-round18-match-center-parity';
export const ROUND18_TEST_WORKER = 'ciao-web-app-test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const configPath = resolve(root, 'wrangler.jsonc');

export function shouldDeployRound18Test(env = {}) {
  return String(env.WORKERS_CI || '') === '1'
    && String(env.WORKERS_CI_BRANCH || '') === ROUND18_TEST_BRANCH;
}

export function isRound18TestWranglerConfig(source) {
  try {
    const config = JSON.parse(String(source || ''));
    return config?.name === ROUND18_TEST_WORKER
      && config?.vars?.CIAO_ENV === 'test';
  } catch {
    return false;
  }
}

function runWranglerDeploy() {
  return spawnSync(
    'npx',
    ['wrangler', 'deploy', '--config', 'wrangler.jsonc'],
    {
      cwd: root,
      stdio: 'inherit',
      env: process.env,
      shell: process.platform === 'win32',
    },
  );
}

export async function deployRound18Test({ env = process.env, run = runWranglerDeploy } = {}) {
  if (!shouldDeployRound18Test(env)) {
    console.log('[round18-test-deploy] skip: not the approved Workers Builds branch');
    return Object.freeze({ deployed: false, reason: 'branch_guard' });
  }

  const wranglerSource = await readFile(configPath, 'utf8');
  if (!isRound18TestWranglerConfig(wranglerSource)) {
    throw new Error('Round 18 TEST deploy refused: wrangler config is not ciao-web-app-test / CIAO_ENV=test');
  }

  console.log(`[round18-test-deploy] deploying ${ROUND18_TEST_BRANCH} to ${ROUND18_TEST_WORKER}`);
  const result = run();
  if (!result || result.error || result.status !== 0) {
    const detail = result?.error?.message || `exit ${result?.status ?? 'unknown'}`;
    throw new Error(`Round 18 TEST deploy failed: ${detail}`);
  }

  return Object.freeze({ deployed: true, worker: ROUND18_TEST_WORKER, branch: ROUND18_TEST_BRANCH });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await deployRound18Test();
}
