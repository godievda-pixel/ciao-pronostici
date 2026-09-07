import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PROD_SUPABASE_REF = 'dkefzepiiudehhzbbrjn';
export const TEST_SUPABASE_REF = 'lcnwccnkkxaosxnfvjvr';
export const STABLE_MARKER = 'ciao-prod-no-x2-20260903';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = resolve(root, 'src/v22-5-evolution.html');
const outPath = resolve(root, 'dist/index.html');

export function rewriteLegacyFunctionEndpoints(input) {
  const source = String(input ?? '');
  const pattern = new RegExp(
    `https://${PROD_SUPABASE_REF}\\.supabase\\.co/functions/v1/([a-zA-Z0-9_-]+)`,
    'g',
  );
  return source.replace(
    pattern,
    (_whole, slug) => `https://${TEST_SUPABASE_REF}.supabase.co/functions/v1/ciao-v23-api/${slug}`,
  );
}

export function validateEvolutionBuild(input) {
  const html = String(input ?? '');
  if (!html.includes(STABLE_MARKER)) throw new Error('stable_v22_5_marker_missing');
  if (/legacy-surface-adapter|modular\/app\.mjs|src\/v23\/app\.mjs/.test(html)) {
    throw new Error('second_frontend_runtime_forbidden');
  }
  const prodFunctions = new RegExp(
    `https://${PROD_SUPABASE_REF}\\.supabase\\.co/functions/v1/`,
  );
  if (prodFunctions.test(html)) throw new Error('production_function_endpoint_remains');
  return true;
}

export async function buildEvolution() {
  const frozen = await readFile(sourcePath, 'utf8');
  if (!frozen.includes(STABLE_MARKER)) throw new Error('stable_v22_5_marker_missing');
  const html = rewriteLegacyFunctionEndpoints(frozen);
  validateEvolutionBuild(html);
  await mkdir(dirname(outPath), { recursive:true });
  await writeFile(outPath, html, 'utf8');
  return { ok:true, entry:'dist/index.html', bytes:Buffer.byteLength(html), environment:'v23-evolution-test' };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  buildEvolution()
    .then(result => console.log(JSON.stringify(result)))
    .catch(error => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
