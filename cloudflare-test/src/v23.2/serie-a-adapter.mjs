import { normalizeMatch } from './match-normalizer.mjs';

const COMPETITION = 'serie_a';
const RAW_VERSION = 'ciao-schedule-fast-v1';

function finiteRound(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function legacyStatus(raw) {
  const status = String(raw?.live_status ?? raw?.status ?? '').trim();
  const lower = status.toLowerCase();
  const live = lower === 'live' || raw?.is_live === true;

  if (live) return 'LIVE';
  if (raw?.is_finished === true) return 'FT';
  return status || 'SCHEDULED';
}

function adaptMatch(raw, round) {
  if (!raw || raw.id === null || raw.id === undefined || raw.id === '') return null;

  return normalizeMatch({
    ...raw,
    status: legacyStatus(raw),
    minute: raw.live_elapsed ?? raw.minute ?? null,
    round_number: round,
    rawVersion: RAW_VERSION,
  }, COMPETITION);
}

export function adaptSerieASchedule(payload = {}) {
  const rounds = [];
  const matches = [];

  for (const rawRound of Array.isArray(payload?.rounds) ? payload.rounds : []) {
    const number = finiteRound(rawRound?.number);
    if (!number) continue;

    const roundMatches = [];
    for (const rawMatch of Array.isArray(rawRound?.matches) ? rawRound.matches : []) {
      const match = adaptMatch(rawMatch, number);
      if (!match) continue;
      roundMatches.push(match);
      matches.push(match);
    }

    rounds.push(Object.freeze({
      number,
      matches: Object.freeze(roundMatches),
    }));
  }

  matches.sort((a, b) => {
    const left = Date.parse(a.kickoffAt);
    const right = Date.parse(b.kickoffAt);
    if (Number.isFinite(left) && Number.isFinite(right)) return left - right;
    return a.matchId.localeCompare(b.matchId);
  });

  return Object.freeze({
    competition: COMPETITION,
    currentRound: finiteRound(payload?.current_round),
    rounds: Object.freeze(rounds),
    matches: Object.freeze(matches),
  });
}
