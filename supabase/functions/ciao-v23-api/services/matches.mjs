import { COMPETITIONS, competitionById } from '../domain/competitions.mjs';
import { canonicalMatchId, isMatchEligible, normalizeProviderMatch } from '../domain/match.mjs';
import { localizeCompetition, localizeStage, localizeTeam } from '../domain/localization.mjs';

const text = value => String(value ?? '').trim();
const numberOrNull = value => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

function sourceRows(payload) {
  if (Array.isArray(payload?.standings)) return payload.standings;
  if (Array.isArray(payload?.groups)) {
    return payload.groups.flatMap(group => group?.standings ?? group?.rows ?? []);
  }
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.data)) return payload.data;
  return Array.isArray(payload) ? payload : [];
}

function localizedStage(competition, stage) {
  const raw = text(stage);
  if (raw) return localizeStage(raw);
  return localizeCompetition(competition);
}

function providerTeam(row) {
  const raw = row?.team && typeof row.team === 'object' ? row.team : {};
  return {
    ...raw,
    id:raw.id ?? row?.team_id ?? row?.teamId,
    name:raw.name ?? row?.team_name ?? row?.teamName,
    country_code:raw.country_code ?? row?.country_code,
    crest_url:raw.crest_url ?? raw.logo ?? row?.crest_url ?? row?.logo,
  };
}

export function createMatchService({provider, localizationLookup} = {}) {
  if (!provider?.listMatches || !provider?.getStandings || !provider?.getMatchSection || !provider?.listItalianTeamIds) {
    throw new Error('raw_provider_required');
  }

  let italianIdsPromise = null;
  const italianIds = async () => {
    if (!italianIdsPromise) {
      italianIdsPromise = Promise.resolve(provider.listItalianTeamIds()).then(value => {
        if (!(value instanceof Set)) throw new Error('italian_team_ids_invalid');
        return new Set([...value].map(text).filter(Boolean));
      });
    }
    return await italianIdsPromise;
  };

  const teamLocalization = team => localizeTeam(team, localizationLookup);

  async function normalizedMatch(raw, competition) {
    const ids = await italianIds();
    return normalizeProviderMatch(raw, {
      competition,
      italianTeamIds:ids,
      localizeTeam:teamLocalization,
    });
  }

  function publicTeam(team) {
    return localizeTeam({
      id:team?.id,
      countryCode:team?.countryCode,
      crestUrl:team?.crestUrl,
    }, localizationLookup);
  }

  function publicMatch(match) {
    return {
      id:match.id,
      providerMatchId:match.providerMatchId,
      competition:match.competition,
      competitionNameRu:localizeCompetition(match.competition),
      season:match.season,
      stage:localizedStage(match.competition, match.stage),
      round:match.round,
      kickoffAt:match.kickoffAt,
      status:match.status,
      minute:match.minute,
      home:publicTeam(match.home),
      away:publicTeam(match.away),
      score:{...match.score},
      isItalianRelevant:match.isItalianRelevant,
      isQualification:match.isQualification,
    };
  }

  async function listMatches({competition, from, to} = {}) {
    const competitionId = competitionById(competition).id;
    const raw = await provider.listMatches({competition:competitionId, from, to});
    const normalized = await Promise.all((Array.isArray(raw) ? raw : []).map(item => normalizedMatch(item, competitionId)));

    return normalized
      .filter(isMatchEligible)
      .map(publicMatch)
      .sort((a,b) => Date.parse(a.kickoffAt || 0) - Date.parse(b.kickoffAt || 0));
  }

  async function getStandings({competition} = {}) {
    const competitionId = competitionById(competition).id;
    const payload = await provider.getStandings({competition:competitionId});
    const rows = sourceRows(payload).map((row, index) => {
      const team = localizeTeam(providerTeam(row), localizationLookup);
      const goalsFor = numberOrNull(row?.goals_for ?? row?.goalsFor ?? row?.gf) ?? 0;
      const goalsAgainst = numberOrNull(row?.goals_against ?? row?.goalsAgainst ?? row?.ga) ?? 0;
      return {
        position:numberOrNull(row?.position ?? row?.rank) ?? index + 1,
        team,
        played:numberOrNull(row?.played ?? row?.matches_played ?? row?.mp),
        wins:numberOrNull(row?.wins ?? row?.won ?? row?.w),
        draws:numberOrNull(row?.draws ?? row?.drawn ?? row?.d),
        losses:numberOrNull(row?.losses ?? row?.lost ?? row?.l),
        goalsFor,
        goalsAgainst,
        goalDifference:numberOrNull(row?.goal_difference ?? row?.goalDifference ?? row?.gd) ?? goalsFor - goalsAgainst,
        points:numberOrNull(row?.points ?? row?.pts),
      };
    });

    return {
      competition:competitionId,
      competitionNameRu:localizeCompetition(competitionId),
      rows,
    };
  }

  async function listFavoriteItalianTeams({providerTeamIds} = {}) {
    const ids = await italianIds();
    const requested = Array.isArray(providerTeamIds)
      ? [...new Set(providerTeamIds.map(text).filter(Boolean))]
      : null;
    const eligibleIds = requested === null
      ? [...ids]
      : requested.filter(id => ids.has(id));
    return eligibleIds.map(id => localizeTeam({id, countryCode:'IT', crestUrl:null}, localizationLookup));
  }

  async function getFavoriteNextMatch({favoriteTeamProviderId, nowIso} = {}) {
    const favoriteId = text(favoriteTeamProviderId);
    if (!favoriteId) throw new Error('favorite_team_required');
    const nowMs = Date.parse(nowIso);
    if (!Number.isFinite(nowMs)) throw new Error('now_iso_invalid');

    const from = new Date(nowMs).toISOString().slice(0,10);
    const to = new Date(nowMs + 370 * 86400000).toISOString().slice(0,10);
    const settled = await Promise.allSettled(
      COMPETITIONS.map(item => listMatches({competition:item.id, from, to})),
    );
    const matches = settled.flatMap(result => result.status === 'fulfilled' ? result.value : []);

    return matches
      .filter(match => match.home?.id === favoriteId || match.away?.id === favoriteId)
      .filter(match => match.status === 'live' || Date.parse(match.kickoffAt) >= nowMs)
      .sort((a,b) => {
        if (a.status === 'live' && b.status !== 'live') return -1;
        if (b.status === 'live' && a.status !== 'live') return 1;
        return Date.parse(a.kickoffAt || 0) - Date.parse(b.kickoffAt || 0);
      })[0] ?? null;
  }

  async function listCalcioToday({localDateStartUtc, localDateEndUtc} = {}) {
    const startMs = Date.parse(localDateStartUtc);
    const endMs = Date.parse(localDateEndUtc);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
      throw new Error('local_day_boundaries_invalid');
    }

    const from = new Date(startMs).toISOString().slice(0,10);
    const to = new Date(endMs).toISOString().slice(0,10);
    const settled = await Promise.allSettled(
      COMPETITIONS.map(item => listMatches({competition:item.id, from, to})),
    );

    return settled
      .flatMap(result => result.status === 'fulfilled' ? result.value : [])
      .filter(match => {
        const kickoff = Date.parse(match.kickoffAt);
        return Number.isFinite(kickoff) && kickoff >= startMs && kickoff < endMs;
      })
      .sort((a,b) => Date.parse(a.kickoffAt) - Date.parse(b.kickoffAt));
  }

  async function getMatchCenter({competition, matchId, section = 'overview'} = {}) {
    const competitionId = competitionById(competition).id;
    const canonicalId = canonicalMatchId(competitionId, matchId);
    const providerMatchId = canonicalId.slice(competitionId.length + 1);
    const overview = await provider.getMatchSection({
      competition:competitionId,
      providerMatchId,
      section:'overview',
    });
    const normalized = await normalizedMatch(overview, competitionId);
    if (!isMatchEligible(normalized)) throw new Error('match_not_eligible');

    const match = publicMatch(normalized);
    const data = section === 'overview'
      ? overview
      : await provider.getMatchSection({competition:competitionId, providerMatchId, section});

    return {match, data};
  }

  return Object.freeze({
    listMatches,
    listCalcioToday,
    getFavoriteNextMatch,
    listFavoriteItalianTeams,
    getStandings,
    getMatchCenter,
  });
}
