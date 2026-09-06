import { copyFile, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const TEST_API_URL = 'https://lcnwccnkkxaosxnfvjvr.supabase.co/functions/v1/ciao-v23-api';
export const PROD_SUPABASE_REF = 'dkefzepiiudehhzbbrjn';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = resolve(root, 'src/v23');
const defaultDistDir = resolve(root, 'dist');
const legacyReleaseMarker = ['v22', '5'].join('-');

function escapeHtmlAttribute(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function validApiUrl(value) {
  let url;
  try { url = new URL(String(value || '')); }
  catch { throw new Error('ciao API URL is invalid'); }
  if (url.protocol !== 'https:') throw new Error('ciao API URL must use HTTPS');
  return url.href;
}

function injectApiUrl(template, apiUrl) {
  const escaped = escapeHtmlAttribute(apiUrl);
  const pattern = /(<meta\s+name=["']ciao-api-url["']\s+content=["'])[^"']*(["']\s*\/?>)/i;
  if (!pattern.test(template)) throw new Error('ciao-api-url meta tag missing');
  return template.replace(pattern, `$1${escaped}$2`);
}

async function copyTree(source, target, { skipIndex = false } = {}) {
  await mkdir(target, { recursive:true });
  for (const entry of await readdir(source, { withFileTypes:true })) {
    if (skipIndex && entry.name === 'index.html') continue;
    const from = resolve(source, entry.name);
    const to = resolve(target, entry.name);
    if (entry.isDirectory()) await copyTree(from, to);
    else if (entry.isFile()) await copyFile(from, to);
  }
}

async function textFiles(path) {
  const files = [];
  async function walk(current) {
    for (const entry of await readdir(current, { withFileTypes:true })) {
      const next = resolve(current, entry.name);
      if (entry.isDirectory()) await walk(next);
      else if (entry.isFile() && /\.(?:html|mjs|js|css|json|txt)$/i.test(entry.name)) files.push(next);
    }
  }
  await walk(path);
  return files;
}

async function assertTestIsolation(outputDir) {
  for (const file of await textFiles(outputDir)) {
    const source = await readFile(file, 'utf8');
    if (source.includes(PROD_SUPABASE_REF)) {
      throw new Error(`production Supabase reference in TEST build: ${relative(outputDir, file)}`);
    }
    if (source.includes(legacyReleaseMarker)) {
      throw new Error(`legacy release marker in TEST build: ${relative(outputDir, file)}`);
    }
  }
}

export async function build({
  apiUrl,
  outputDir = defaultDistDir,
  environment = process.env.CIAO_ENVIRONMENT || 'test',
} = {}) {
  const env = String(environment || '').trim().toLowerCase() || 'test';
  const configured = apiUrl || process.env.CIAO_API_URL || (env === 'test' ? TEST_API_URL : '');
  if (!configured) throw new Error('CIAO_API_URL is required outside TEST');
  const endpoint = validApiUrl(configured);
  const dist = resolve(String(outputDir));

  await rm(dist, { recursive:true, force:true });
  await mkdir(dist, { recursive:true });

  const template = await readFile(resolve(sourceDir, 'index.html'), 'utf8');
  const indexHtml = injectApiUrl(template, endpoint);
  await writeFile(resolve(dist, 'index.html'), indexHtml, 'utf8');
  await copyTree(sourceDir, resolve(dist, 'v23'), { skipIndex:true });

  if (env === 'test') await assertTestIsolation(dist);

  return Object.freeze({
    ok:true,
    entry:resolve(dist, 'index.html'),
    environment:env,
    apiUrl:endpoint,
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  build().then(result => console.log(JSON.stringify(result))).catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
