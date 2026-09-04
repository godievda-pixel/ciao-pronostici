import { MATCH_CENTER_SECTIONS } from './match-center-contract.mjs';
import {
  loadMatchCenterBase,
  loadMatchCenterSection,
} from './data-client.mjs';

const SECTION_SET = new Set(MATCH_CENTER_SECTIONS);

function invalidSection() {
  const error = new Error('invalid_match_center_section');
  error.code = 'invalid_match_center_section';
  return error;
}

function trackedRequest(inflight, key, factory) {
  const existing = inflight.get(key);
  if (existing) return existing;

  let source;
  try {
    source = Promise.resolve(factory());
  } catch (error) {
    return Promise.reject(error);
  }

  let tracked;
  tracked = source.finally(() => {
    if (inflight.get(key) === tracked) inflight.delete(key);
  });
  inflight.set(key, tracked);
  return tracked;
}

export function createMatchCenterRepository({
  loadBase = loadMatchCenterBase,
  loadSection = loadMatchCenterSection,
} = {}) {
  if (typeof loadBase !== 'function') throw new Error('match_center_base_loader_required');
  if (typeof loadSection !== 'function') throw new Error('match_center_section_loader_required');

  const inflight = new Map();

  function base(competition, matchId, { force = false } = {}) {
    const canonicalCompetition = String(competition || '').trim();
    const canonicalMatchId = String(matchId || '').trim();
    const forceFlag = force === true;
    const key = `base\n${canonicalCompetition}\n${canonicalMatchId}\n${forceFlag ? 'force' : 'normal'}`;
    return trackedRequest(inflight, key, () => (
      loadBase(canonicalCompetition, canonicalMatchId, { force:forceFlag })
    ));
  }

  function section(
    competition,
    matchId,
    sectionName,
    { force = false, status = null } = {},
  ) {
    const canonicalSection = String(sectionName || '').trim().toLowerCase();
    if (!SECTION_SET.has(canonicalSection)) return Promise.reject(invalidSection());

    const canonicalCompetition = String(competition || '').trim();
    const canonicalMatchId = String(matchId || '').trim();
    const forceFlag = force === true;
    const key = `section\n${canonicalCompetition}\n${canonicalMatchId}\n${canonicalSection}\n${forceFlag ? 'force' : 'normal'}`;
    return trackedRequest(inflight, key, () => (
      loadSection(canonicalCompetition, canonicalMatchId, canonicalSection, {
        force:forceFlag,
        status,
      })
    ));
  }

  return Object.freeze({ base, section });
}
