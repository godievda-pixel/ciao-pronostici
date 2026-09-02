import { normalizeMatch, shouldIncludeMatch } from './match-normalizer.mjs';
import { localizeTeam } from './team-registry.mjs';

function text(value) {
  return String(value ?? '').trim();
}

function countryCode(value) {
  const code = text(value).toUpperCase();
  if (code === 'IT') return 'ITA';
  if (code === 'GB' || code === 'UK') return 'ENG';
  return code;
}

function teamFrom(event, side, italianTeamIds) {
  const object = event?.[`${side}_team`];
  const id = text(
    (object && typeof object === 'object' ? object.id : '')
      || event?.[`${side}_team_id`]
      || event?.[`${side}_id`],
  );
  const name = text(
    (object && typeof object === 'object' ? object.name : object)
      || event?.[`${side}_team_name`]
      || event?.[`${side}_name`],
  );
  const rawCountry = object && typeof object === 'object'
    ? object.country_code || object.country?.code || object.country
    : '';
  const isItalian = italianTeamIds.has(id) || ['IT', 'ITA'].includes(text(rawCountry).toUpperCase());

  return {
    id,
    name,
    country_code: isItalian ? 'ITA' : countryCode(rawCountry),
    logo: id ? `https://sports.bzzoiro.com/img/team/${encodeURIComponent(id)}/?bg=transparent` : '',
  };
}

function statusFrom(event) {
  const status = text(event?.status).toLowerCase();
  if (['live', 'inprogress', 'in_progress'].includes(status)) return 'LIVE';
  if (['finished', 'ended', 'fulltime', 'full_time'].includes(status)) return 'FINISHED';
  if (status === 'postponed') return 'POSTPONED';
  if (status === 'cancelled' || status === 'canceled') return 'CANCELLED';
  return 'SCHEDULED';
}

function score(event, side, status) {
  if (!['LIVE', 'FINISHED'].includes(status)) return null;
  const direct = event?.[`${side}_score`];
  const nested = event?.score?.[side];
  const value = direct ?? nested;
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function seasonFrom(event) {
  const season = event?.season;
  if (season && typeof season === 'object') {
    return text(season.name || season.label || season.year);
  }
  return text(season || event?.season_name || event?.season_year);
}

function venueFrom(event) {
  const venue = event?.venue;
  if (venue && typeof venue === 'object') return text(venue.name || venue.full_name);
  return text(venue || event?.venue_name);
}

function sourceMatchReference(event, side) {
  const object = event?.[`${side}_source_event`] || event?.[`${side}_source_match`];
  return text(
    event?.[`${side}_source_event_id`]
      || event?.[`${side}_source_match_id`]
      || event?.[`${side}_from_event_id`]
      || event?.[`${side}_from_match_id`]
      || (object && typeof object === 'object' ? object.id : object),
  );
}

function localizeMatchTeams(match) {
  return Object.freeze({
    ...match,
    homeTeam: localizeTeam(match.homeTeam),
    awayTeam: localizeTeam(match.awayTeam),
  });
}

export function adaptBsdEvents(payload, competition, options = {}) {
  const italianTeamIds = options.italianTeamIds instanceof Set
    ? options.italianTeamIds
    : new Set((options.italianTeamIds || []).map(value => text(value)));
  const events = Array.isArray(payload) ? payload : Array.isArray(payload?.results) ? payload.results : [];
  const matches = [];

  for (const event of events) {
    try {
      const id = text(event?.id ?? event?.event_id);
      if (!id) continue;
      const status = statusFrom(event);
      const raw = {
        id,
        season: seasonFrom(event),
        kickoff_at: text(event?.event_date || event?.kickoff_at || event?.kickoff || event?.date),
        status,
        minute: status === 'LIVE' ? event?.current_minute ?? event?.minute ?? event?.time?.minute : null,
        stage: text(event?.round_name || event?.stage || event?.phase || event?.group_name),
        round: event?.round_number ?? event?.round ?? null,
        home: teamFrom(event, 'home', italianTeamIds),
        away: teamFrom(event, 'away', italianTeamIds),
        home_score: score(event, 'home', status),
        away_score: score(event, 'away', status),
        venue: venueFrom(event),
        home_source_match_id: sourceMatchReference(event, 'home'),
        away_source_match_id: sourceMatchReference(event, 'away'),
        rawVersion: 'bsd-football-v2',
      };
      const match = localizeMatchTeams(normalizeMatch(raw, competition));
      if (shouldIncludeMatch(match)) matches.push(match);
    } catch {
      // A malformed BSD row must not break the whole tournament calendar.
    }
  }

  return matches.sort((a, b) =>
    Date.parse(a.kickoffAt || 0) - Date.parse(b.kickoffAt || 0)
    || a.matchId.localeCompare(b.matchId)
  );
}
