import {
  competitionById,
  isCoppaVisibleStage,
  isEuropeanCompetition,
  isQualificationStage,
} from './competitions.mjs';

function text(value) {
  return String(value ?? '').trim();
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizedCountry(value) {
  const code = text(value).toUpperCase();
  return code === 'ITA' ? 'IT' : code;
}

function normalizedStatus(value) {
  const status = text(value).toLowerCase().replace(/[\s-]+/g, '_');
  if (['live', 'inprogress', 'in_progress'].includes(status)) return 'live';
  if (['finished', 'ended', 'fulltime', 'full_time'].includes(status)) return 'finished';
  if (status === 'postponed') return 'postponed';
  if (['cancelled', 'canceled'].includes(status)) return 'cancelled';
  return 'scheduled';
}

function normalizeTeam(raw, italianTeamIds, localizeTeam) {
  const team = raw && typeof raw === 'object' ? raw : {};
  const id = text(team.id ?? team.team_id);
  const providerCountry = normalizedCountry(
    team.country_code ?? team.countryCode ?? team.country?.code ?? team.country,
  );
  const inferredItalian = italianTeamIds instanceof Set && italianTeamIds.has(id);
  const countryCode = inferredItalian ? 'IT' : providerCountry;
  const localized = typeof localizeTeam === 'function' ? localizeTeam(team) : null;

  return {
    id,
    nameProvider: text(team.name ?? team.short_name ?? team.shortName),
    nameRu: text(localized?.nameRu ?? team.name_ru ?? team.nameRu),
    countryCode,
    crestUrl: text(team.crest_url ?? team.crestUrl ?? team.logo_url ?? team.logo),
  };
}

export function canonicalMatchId(competition, providerMatchId) {
  const competitionId = competitionById(competition).id;
  const raw = text(providerMatchId);
  if (!raw) throw new Error('match_id_required');

  const separator = raw.indexOf(':');
  if (separator > 0) {
    const prefix = raw.slice(0, separator).trim().toLowerCase();
    const source = raw.slice(separator + 1).trim();
    if (prefix !== competitionId) throw new Error(`match_competition_mismatch:${prefix}`);
    if (!source) throw new Error('match_id_required');
    return `${competitionId}:${source}`;
  }

  return `${competitionId}:${raw}`;
}

export function isMatchEligible(match) {
  const competition = competitionById(match?.competition).id;
  const stage = text(match?.stage);
  const qualification = Boolean(match?.isQualification) || isQualificationStage(stage);

  if (isEuropeanCompetition(competition)) {
    if (qualification) return false;
    const homeCountry = normalizedCountry(match?.home?.countryCode);
    const awayCountry = normalizedCountry(match?.away?.countryCode);
    return homeCountry === 'IT' || awayCountry === 'IT';
  }

  if (competition === 'coppa_italia') return isCoppaVisibleStage(stage);
  return true;
}

export function normalizeProviderMatch(raw = {}, context = {}) {
  const competition = competitionById(context.competition ?? raw.competition).id;
  const italianTeamIds = context.italianTeamIds;
  const providerMatchId = text(raw.id ?? raw.event_id ?? raw.match_id ?? raw.providerMatchId);
  if (!providerMatchId) throw new Error('match_id_required');

  const stage = text(raw.round_name ?? raw.stage ?? raw.phase ?? raw.group_name);
  const home = normalizeTeam(
    raw.home_team ?? raw.home ?? { id: raw.home_team_id, name: raw.home_team_name },
    italianTeamIds,
    context.localizeTeam,
  );
  const away = normalizeTeam(
    raw.away_team ?? raw.away ?? { id: raw.away_team_id, name: raw.away_team_name },
    italianTeamIds,
    context.localizeTeam,
  );
  const status = normalizedStatus(raw.status ?? raw.live_status);
  const isQualification = isQualificationStage(stage);

  return {
    id: canonicalMatchId(competition, providerMatchId),
    providerMatchId,
    competition,
    season: text(raw.season?.name ?? raw.season?.year ?? raw.season),
    stage,
    round: text(raw.round_number ?? raw.round),
    kickoffAt: text(raw.event_date ?? raw.kickoff_at ?? raw.date ?? raw.kickoffAt),
    status,
    minute: status === 'live'
      ? numberOrNull(raw.current_minute ?? raw.minute ?? raw.live_elapsed)
      : null,
    home,
    away,
    score: {
      home: ['live', 'finished'].includes(status)
        ? numberOrNull(raw.home_score ?? raw.score?.home)
        : null,
      away: ['live', 'finished'].includes(status)
        ? numberOrNull(raw.away_score ?? raw.score?.away)
        : null,
    },
    isItalianRelevant: home.countryCode === 'IT' || away.countryCode === 'IT',
    isQualification,
  };
}
