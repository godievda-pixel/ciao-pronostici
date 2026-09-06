import { MATCH_CENTER_RUNTIME_BUILD } from './match-center-runtime.mjs';
import {
  installRound512MatchLinks,
  resolveRound512MatchTarget,
} from './round51-2-match-center-links.mjs';

// Historical Round 39 deployment marker: from './match-center-runtime.mjs'
// The active click owner is Round 51.2; the legacy runtime build is retained only as a compatibility identity.
void MATCH_CENTER_RUNTIME_BUILD;

export const resolveCanonicalMatchTarget = resolveRound512MatchTarget;

export async function openCanonicalMatchCenter(payload = {}) {
  const { openRound512MatchCenter } = await import('./round51-2-match-center-runtime.mjs');
  return openRound512MatchCenter(payload);
}

export function installCanonicalMatchLinks(
  documentRef = globalThis.document,
  { open = openCanonicalMatchCenter } = {},
) {
  return installRound512MatchLinks(documentRef, { open });
}
