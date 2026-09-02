import { COMPETITION_KEYS, getCompetitionConfig } from '../v23.2/competition-config.mjs';

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

function text(value) {
  return String(value ?? '').trim();
}

function timeOf(match) {
  const value = Date.parse(match?.kickoffAt || '');
  return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
}

function chronological(matches) {
  return [...matches].sort((a, b) => (
    timeOf(a) - timeOf(b)
    || text(a?.competition).localeCompare(text(b?.competition))
    || text(a?.matchId).localeCompare(text(b?.matchId))
  ));
}

function dateParts(value, timeZone) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('Invalid date');
  const formatter = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...(timeZone ? { timeZone } : {}),
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(date)
      .filter(part => ['year', 'month', 'day'].includes(part.type))
      .map(part => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function dateLabel(value, timeZone) {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    ...(timeZone ? { timeZone } : {}),
  }).format(date);
}

export function predictionDeadlineForKickoff(kickoffAt) {
  const kickoff = Date.parse(kickoffAt || '');
  if (!Number.isFinite(kickoff)) throw new Error('Invalid kickoff time');
  return new Date(kickoff - FIFTEEN_MINUTES_MS).toISOString();
}

export function canonicalPredictionKey({ competition, matchId } = {}) {
  const key = text(competition);
  const id = text(matchId);
  getCompetitionConfig(key);
  if (!id) throw new Error('Prediction match id is required');
  if (!id.startsWith(`${key}:`)) {
    throw new Error(`Prediction competition mismatch: ${key} vs ${id}`);
  }
  return `${key}|${id}`;
}

export async function loadAllCompetitionMatches({
  loadMatches,
  from = '',
  to = '',
} = {}) {
  if (typeof loadMatches !== 'function') throw new Error('loadMatches is required');

  const settled = await Promise.allSettled(
    COMPETITION_KEYS.map(competition => loadMatches(competition, { from, to })),
  );
  const data = {};
  const errors = {};

  settled.forEach((result, index) => {
    const competition = COMPETITION_KEYS[index];
    if (result.status === 'fulfilled') data[competition] = result.value;
    else errors[competition] = result.reason instanceof Error
      ? result.reason
      : new Error(text(result.reason) || 'competition_load_failed');
  });

  return Object.freeze({
    data: Object.freeze(data),
    errors: Object.freeze(errors),
  });
}

export function flattenCompetitionFeeds(data = {}) {
  const unique = new Map();
  for (const competition of COMPETITION_KEYS) {
    const feed = data?.[competition];
    const matches = Array.isArray(feed) ? feed : Array.isArray(feed?.matches) ? feed.matches : [];
    for (const match of matches) {
      if (!match?.matchId || !match?.competition) continue;
      const key = `${match.competition}|${match.matchId}`;
      if (!unique.has(key)) unique.set(key, match);
    }
  }
  return chronological([...unique.values()]);
}

export function selectHomeMatches(matches = [], { now = new Date(), timeZone } = {}) {
  const nowDate = now instanceof Date ? now : new Date(now);
  const nowMs = nowDate.getTime();
  if (!Number.isFinite(nowMs)) throw new Error('Invalid Home selection time');
  const today = dateParts(nowDate, timeZone);
  const source = chronological(
    (Array.isArray(matches) ? matches : [])
      .filter(match => match?.status !== 'cancelled')
      .filter(match => Number.isFinite(Date.parse(match?.kickoffAt || ''))),
  );

  const todayMatches = source.filter(match => dateParts(match.kickoffAt, timeZone) === today);
  if (todayMatches.length) return todayMatches;

  const upcoming = source.filter(match => Date.parse(match.kickoffAt) >= nowMs);
  if (!upcoming.length) return [];
  const nearestDate = dateParts(upcoming[0].kickoffAt, timeZone);
  return upcoming.filter(match => dateParts(match.kickoffAt, timeZone) === nearestDate);
}

export function groupPredictionMatches(matches = [], competition, { timeZone } = {}) {
  const config = getCompetitionConfig(competition);
  const source = chronological(
    (Array.isArray(matches) ? matches : []).filter(match => match?.competition === competition),
  );
  const groups = new Map();

  for (const match of source) {
    let key;
    let label;
    if (config.navigation === 'rounds' && match.round !== null && match.round !== undefined && text(match.round)) {
      key = `round:${match.round}`;
      label = `${match.round}-й тур`;
    } else if (text(match.stage)) {
      key = `stage:${text(match.stage)}`;
      label = text(match.stage);
    } else {
      const localDate = dateParts(match.kickoffAt, timeZone);
      key = `date:${localDate}`;
      label = dateLabel(match.kickoffAt, timeZone);
    }

    if (!groups.has(key)) groups.set(key, { key, label, matches: [] });
    groups.get(key).matches.push(match);
  }

  return [...groups.values()].map(group => Object.freeze({
    key: group.key,
    label: group.label,
    matches: Object.freeze(chronological(group.matches)),
  }));
}
