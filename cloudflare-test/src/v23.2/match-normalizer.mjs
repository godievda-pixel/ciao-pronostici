import { getCompetitionConfig } from './competition-config.mjs';
import { isItalianTeam } from './italian-team.mjs';

export const MATCH_STATUSES = Object.freeze([
  'scheduled',
  'live',
  'finished',
  'postponed',
  'cancelled',
]);

const STATUS_MAP = Object.freeze({
  NS: 'scheduled',
  SCHEDULED: 'scheduled',
  TIMED: 'scheduled',
  LIVE: 'live',
  INPROGRESS: 'live',
  IN_PROGRESS: 'live',
  '1H': 'live',
  HT: 'live',
  '2H': 'live',
  ET: 'live',
  PEN_LIVE: 'live',
  FT: 'finished',
  AET: 'finished',
  PEN: 'finished',
  FINISHED: 'finished',
  ENDED: 'finished',
  FULLTIME: 'finished',
  FULL_TIME: 'finished',
  PST: 'postponed',
  POSTPONED: 'postponed',
  CANC: 'cancelled',
  CANCELLED: 'cancelled',
  CANCELED: 'cancelled',
});

const COUNTRY_CODES = Object.freeze({
  italy: 'ITA',
  italia: 'ITA',
  england: 'ENG',
  spain: 'ESP',
  germany: 'GER',
  france: 'FRA',
  portugal: 'POR',
});

const ITALIAN_ONLY_COMPETITIONS = new Set(['coppa_italia', 'ucl', 'uel', 'uecl']);
const UEFA_COMPETITIONS = new Set(['ucl', 'uel', 'uecl']);
const UEFA_LEAGUE_ROUND_LIMIT = Object.freeze({ ucl:8, uel:8, uecl:6 });
const UEFA_QUALIFICATION_STAGE = /(?:qualif(?:ication|ying)?|preliminary|предваритель|квалификац)/i;
const UEFA_LEAGUE_STAGE = /(?:league\s+(?:stage|phase)|этап\s+лиги)/i;

function text(value) {
  return String(value ?? '').trim();
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function normalizeTeam(raw = {}) {
  const country = text(raw.country || raw.country_name);
  return Object.freeze({
    id: text(raw.id ?? raw.team_id),
    name: text(raw.name || raw.team_name) || '—',
    countryCode:
      text(raw.country_code).toUpperCase()
      || COUNTRY_CODES[country.toLowerCase()]
      || '',
    crestUrl: text(raw.logo || raw.logo_url || raw.logoUrl || raw.crest || raw.crest_url || raw.team_logo),
  });
}

function sourceMatchId(value, competition) {
  const id = text(value);
  if (!id) return '';
  return id.includes(':') ? id : `${competition}:${id}`;
}

export function normalizeMatch(raw, competition) {
  getCompetitionConfig(competition);

  const sourceId = text(raw?.id ?? raw?.match_id);
  if (!sourceId) throw new Error('Match source id is required');

  const kickoffAt = text(raw.kickoffAt || raw.kickoff_at || raw.utcDate);
  const predictionDeadline = text(
    raw.predictionDeadline || raw.prediction_deadline || kickoffAt,
  );
  const providerStatus = text(raw.status).toUpperCase();
  const status = STATUS_MAP[providerStatus] || 'scheduled';

  return Object.freeze({
    matchId: `${competition}:${sourceId}`,
    competition,
    season: text(raw.season),
    stage: text(raw.stage || raw.phase),
    round: raw.round ?? raw.round_number ?? null,
    kickoffAt,
    status,
    minute: status === 'live' ? numberOrNull(raw.minute) : null,
    homeTeam: normalizeTeam(raw.home || raw.homeTeam),
    awayTeam: normalizeTeam(raw.away || raw.awayTeam),
    homeScore: numberOrNull(raw.homeScore ?? raw.home_score),
    awayScore: numberOrNull(raw.awayScore ?? raw.away_score),
    aggregateScore: raw.aggregateScore ?? raw.aggregate_score ?? null,
    leg: raw.leg ?? null,
    venue: text(raw.venue),
    predictionDeadline,
    homeSourceMatchId: sourceMatchId(raw.homeSourceMatchId || raw.home_source_match_id, competition),
    awaySourceMatchId: sourceMatchId(raw.awaySourceMatchId || raw.away_source_match_id, competition),
    rawVersion: text(raw.rawVersion || raw.version),
  });
}

export function isUefaQualificationMatch(match = {}) {
  const competition = text(match?.competition);
  if (!UEFA_COMPETITIONS.has(competition)) return false;
  const stage = text(match?.stage);
  if (UEFA_QUALIFICATION_STAGE.test(stage)) return true;

  const round = Number(match?.round);
  if (!Number.isFinite(round) || round <= 0) return false;
  // BSD occasionally exposes qualification phase identifiers as huge round numbers
  // (for example 636), which must never become user-facing matchday tabs.
  if (round >= 100) return true;

  const limit = UEFA_LEAGUE_ROUND_LIMIT[competition];
  if (UEFA_LEAGUE_STAGE.test(stage) && Number.isFinite(limit) && round > limit) return true;
  return false;
}

export function shouldIncludeMatch(match) {
  getCompetitionConfig(match.competition);
  if (isUefaQualificationMatch(match)) return false;
  if (!ITALIAN_ONLY_COMPETITIONS.has(match.competition)) return true;
  return isItalianTeam(match.homeTeam) || isItalianTeam(match.awayTeam);
}
