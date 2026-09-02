import { localizeTeam } from '../v23.2/team-registry.mjs';

function text(value) {
  return String(value ?? '').trim();
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function rowsFrom(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.standings)) return payload.standings;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.groups)) {
    return payload.groups.flatMap(group => (
      Array.isArray(group?.standings) ? group.standings
        : Array.isArray(group?.rows) ? group.rows
          : []
    ));
  }
  return [];
}

function standingTeam(row = {}) {
  const source = row?.team && typeof row.team === 'object' ? row.team : {};
  const id = text(source?.id ?? row?.team_id);
  const name = text(source?.name ?? row?.team_name);
  const crestUrl = text(
    source?.logo
      || source?.crest
      || source?.crest_url
      || row?.team_logo
      || (id ? `https://sports.bzzoiro.com/img/team/${encodeURIComponent(id)}/?bg=transparent` : ''),
  );

  return localizeTeam({ id, name: name || '—', rawName: name, crestUrl });
}

export function normalizeStandingRows(payload, competition) {
  return Object.freeze(rowsFrom(payload).map(row => Object.freeze({
    competition: text(competition),
    position: numberOrNull(row?.position ?? row?.rank),
    team: standingTeam(row),
    played: numberOrNull(row?.played ?? row?.matches_played ?? row?.played_games),
    wins: numberOrNull(row?.won ?? row?.wins),
    draws: numberOrNull(row?.drawn ?? row?.draws),
    losses: numberOrNull(row?.lost ?? row?.losses),
    goalsFor: numberOrNull(row?.goals_for ?? row?.goals_scored ?? row?.gf),
    goalsAgainst: numberOrNull(row?.goals_against ?? row?.goals_conceded ?? row?.ga),
    goalDifference: numberOrNull(row?.goal_difference ?? row?.goal_diff ?? row?.gd),
    points: numberOrNull(row?.pts ?? row?.points),
  })));
}
