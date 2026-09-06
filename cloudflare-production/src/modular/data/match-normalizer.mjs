import { getTournament } from '../core/tournament-registry.mjs';

function text(value) { return String(value ?? '').trim(); }
function first(...values) { return values.find(value => value !== undefined && value !== null && value !== ''); }
function numberOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function normalizeTeam(raw = {}) {
  const value = raw || {};
  return Object.freeze({
    id: first(value.id, value.team_id, value.teamId, null),
    name: text(first(value.name, value.team_name, value.teamName, value.short_name, '')),
    crestUrl: text(first(value.crestUrl, value.crest_url, value.logoUrl, value.logo_url, value.logo, value.crest, '')),
    aliases: Object.freeze(Array.isArray(value.aliases) ? value.aliases.map(text).filter(Boolean) : []),
  });
}

export function isQualificationStage(value) {
  const stage = text(value).toLowerCase();
  return /qualif|qualification|qualifying|preliminary|предвар|квалификац/.test(stage);
}

export function normalizeMatch(raw = {}, competitionId = raw?.competition) {
  const competition = getTournament(competitionId).id;
  const rawId = text(first(raw.id, raw.match_id, raw.matchId, raw.event_id, raw.eventId));
  const id = rawId.startsWith(`${competition}:`) ? rawId : `${competition}:${rawId}`;
  const kickoffAt = text(first(raw.kickoffAt, raw.kickoff_at, raw.start_at, raw.startAt, raw.date));
  const stage = text(first(raw.stage, raw.stage_name, raw.stageName, raw.phase));
  const round = text(first(raw.round, raw.round_name, raw.roundName));
  const status = text(first(raw.status, raw.live_status, raw.state, raw.is_finished ? 'finished' : '')).toLowerCase();
  const home = normalizeTeam(first(raw.home, raw.homeTeam, raw.home_team, {}));
  const away = normalizeTeam(first(raw.away, raw.awayTeam, raw.away_team, {}));
  const homeScore = first(raw?.score?.home, raw.home_score, raw.homeScore);
  const awayScore = first(raw?.score?.away, raw.away_score, raw.awayScore);
  return Object.freeze({
    id,
    sourceId: rawId,
    competition,
    kickoffAt,
    status,
    minute: numberOrNull(first(raw.minute, raw.live_elapsed, raw.elapsed)),
    home,
    away,
    score: Object.freeze({ home: numberOrNull(homeScore), away: numberOrNull(awayScore) }),
    round,
    stage,
    isQualification: raw.isQualification === true || raw.is_qualification === true || isQualificationStage(stage || round),
  });
}
