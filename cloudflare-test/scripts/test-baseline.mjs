import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { BASE_BUILD, DEFAULT_BASE_URL } from './build.mjs';

export { BASE_BUILD };

export const PINNED_BASE_URL = 'https://ciao-web-app-test.ciao-web.workers.dev/__baseline/v23-3-round18.html';
export const RECOVERY_BASE_URL = 'https://ciao-web-app-test.ciao-web.workers.dev/';

function assertBaseBuild(html) {
  const source = String(html ?? '');
  if (!source.includes(BASE_BUILD)) {
    throw new Error(`base build marker missing: ${BASE_BUILD}`);
  }
  return source;
}

export async function loadBaseHtml({
  baseFile = process.env.BASE_FILE,
  baseUrl = process.env.BASE_URL,
  fetchImpl = fetch,
  includeLegacyBase = true,
} = {}) {
  if (baseFile) {
    const html = assertBaseBuild(await readFile(resolve(baseFile), 'utf8'));
    return { html, sourceUrl:`file:${baseFile}` };
  }

  const urls = baseUrl
    ? [String(baseUrl)]
    : [
        PINNED_BASE_URL,
        ...(includeLegacyBase ? [DEFAULT_BASE_URL] : []),
        RECOVERY_BASE_URL,
      ];

  let lastStatus = null;
  for (const url of urls) {
    let response;
    try {
      response = await fetchImpl(url, { headers:{ 'cache-control':'no-cache' } });
    } catch {
      continue;
    }
    lastStatus = response.status;
    if (!response.ok) continue;
    const html = assertBaseBuild(await response.text());
    return { html, sourceUrl:String(url) };
  }

  throw new Error(`base fetch failed: HTTP ${lastStatus ?? 0}`);
}
