import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROD_SUPABASE_REF, TEST_API_URL } from './build.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const defaultDist = resolve(root, 'dist');
const wranglerPath = resolve(root, 'wrangler.jsonc');
const REQUIRED_FILES = Object.freeze([
  'index.html',
  'v23/app.mjs',
  'v23/styles/tokens.css',
  'v23/styles/base.css',
  'v23/styles/shell.css',
  'v23/styles/components.css',
  'v23/styles/screens.css',
]);
const LEGACY_PATTERN = /data-ciao-modular|legacy-surface-adapter|releases\/v22-5|\/modular\//i;

async function exists(path) {
  try { return (await stat(path)).isFile(); }
  catch { return false; }
}

async function allFiles(base) {
  const files = [];
  async function walk(path) {
    for (const entry of await readdir(path, { withFileTypes:true })) {
      const next = resolve(path, entry.name);
      if (entry.isDirectory()) await walk(next);
      else if (entry.isFile()) files.push(next);
    }
  }
  try { await walk(base); }
  catch { return []; }
  return files;
}

export async function probeProductionBuild({ distDir = defaultDist } = {}) {
  const dist = resolve(String(distDir));
  const checks = [];
  const errors = [];
  const check = (name, ok, detail = '') => {
    checks.push({ name, ok:Boolean(ok), detail:String(detail || '') });
    if (!ok) errors.push(detail ? `${name}: ${detail}` : name);
  };

  const missing = [];
  for (const file of REQUIRED_FILES) if (!(await exists(resolve(dist, file)))) missing.push(file);
  check('required_files', missing.length === 0, missing.join(', '));

  const index = await readFile(resolve(dist, 'index.html'), 'utf8').catch(() => '');
  check('standalone_marker', /data-ciao-app=["']v23["']/.test(index), 'data-ciao-app=v23');
  check('standalone_module_entry', /src=["']\/v23\/app\.mjs["']/.test(index), '/v23/app.mjs');
  check('test_api_config', index.includes(TEST_API_URL), TEST_API_URL);
  check('no_legacy_root', !LEGACY_PATTERN.test(index), 'legacy root marker');
  check('no_production_supabase_root', !index.includes(PROD_SUPABASE_REF), PROD_SUPABASE_REF);

  const wrangler = await readFile(wranglerPath, 'utf8').catch(() => '');
  check('test_worker_name', /["']?name["']?\s*:\s*["']ciao-web-v23-test["']/.test(wrangler), 'ciao-web-v23-test');

  let forbiddenFile = '';
  for (const file of await allFiles(dist)) {
    if (!/\.(?:html|mjs|js|css|json|txt)$/i.test(file)) continue;
    const source = await readFile(file, 'utf8');
    if (source.includes(PROD_SUPABASE_REF) || LEGACY_PATTERN.test(source)) {
      forbiddenFile = relative(dist, file);
      break;
    }
  }
  check('clean_standalone_artifact', !forbiddenFile, forbiddenFile);

  return Object.freeze({
    ok:errors.length === 0,
    dist,
    checks:Object.freeze(checks),
    errors:Object.freeze(errors),
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  probeProductionBuild().then(result => {
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) process.exitCode = 1;
  }).catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
