import { toSerieALegacyMatchCenterData as toLegacyBase } from './bsd-serie-a-legacy-adapter.mjs';

function eventForCw20(event = {}) {
  const player = String(event?.player_name || (typeof event?.player === 'string' ? event.player : event?.player?.name) || '');
  const assist = String(event?.assist_name || (typeof event?.assist === 'string' ? event.assist : event?.assist?.name) || '');
  const playerIn = String(event?.player_in_name || event?.player_in || '');
  const playerOut = String(event?.player_out_name || event?.player_out || '');
  return Object.freeze({
    ...event,
    player,
    assist,
    player_in:playerIn,
    player_out:playerOut,
  });
}

function lineupSideForCw20(side = {}, team = {}) {
  return Object.freeze({
    ...side,
    team_id:team?.id ?? null,
    team_name:String(team?.name || ''),
  });
}

export function toSerieALegacyMatchCenterData(base = {}, sections = {}) {
  const legacy = toLegacyBase(base, sections);
  const events = (legacy?.incidents?.incidents || []).map(eventForCw20);
  return Object.freeze({
    ...legacy,
    incidents:Object.freeze({ incidents:Object.freeze(events) }),
    lineups:Object.freeze({
      ...legacy.lineups,
      lineups:Object.freeze({
        home:lineupSideForCw20(legacy?.lineups?.lineups?.home, legacy?.match?.home),
        away:lineupSideForCw20(legacy?.lineups?.lineups?.away, legacy?.match?.away),
      }),
    }),
  });
}
