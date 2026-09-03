import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from './build.mjs';
import { loadBaseHtml } from './test-baseline.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const temporaryBasePath = resolve(root, '.round18-test-base.html');
const baselineOutPath = resolve(root, 'dist/__baseline/v23-3-round18.html');

async function run() {
  const { html, sourceUrl } = await loadBaseHtml({ includeLegacyBase:false });
  await writeFile(temporaryBasePath, html, 'utf8');

  const previousBaseFile = process.env.BASE_FILE;
  process.env.BASE_FILE = temporaryBasePath;
  try {
    const result = await build();
    await mkdir(dirname(baselineOutPath), { recursive:true });
    await writeFile(baselineOutPath, html, 'utf8');
    console.log(JSON.stringify({
      ok:true,
      ...result,
      baseSource:sourceUrl,
      baseline:baselineOutPath,
    }));
  } finally {
    if (previousBaseFile === undefined) delete process.env.BASE_FILE;
    else process.env.BASE_FILE = previousBaseFile;
    await rm(temporaryBasePath, { force:true });
  }
}

run().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
