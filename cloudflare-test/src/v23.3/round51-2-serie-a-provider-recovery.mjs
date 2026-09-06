import {
  SERIE_A_MATCH_CENTER_PATH,
  unwrapSerieAMatchCenterPayload,
} from './serie-a-match-center-provider.mjs';
import { normalizeSerieALegacyMatchCenter } from './serie-a-match-center-legacy-normalizer.mjs';
import { adaptSerieALegacyMatchCenter } from './serie-a-match-center-adapter.mjs';
import { normalizeRound512SerieARaw } from './round51-2-serie-a-recovery.mjs';

function text(value) {
  return String(value ?? '').trim();
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

function finiteRating(value) {
  if (value === null || value === undefined || value === '') return null;
  const rating = Number(value);
  return Number.isFinite(rating) ? rating : null;
}

function numericMatchId(matchId) {
  const value = Number(text(matchId).replace(/^serie_a:/, ''));
  return Number.isFinite(value) && value > 0 ? value : null;
}

function ratingIndex(players) {
  const byId = new Map();
  const byName = new Map();
  for (const player of list(players)) {
    const rating = finiteRating(player?.rating);
    if (rating === null) continue;
    const id = text(player?.playerId ?? player?.player_id ?? player?.id);
    const name = text(player?.name ?? player?.shortName ?? player?.short_name).toLocaleLowerCase('ru-RU');
    if (id) byId.set(id, rating);
    if (name) byName.set(name, rating);
  }
  return { byId, byName };
}

function enrichPlayer(player, index) {
  if (finiteRating(player?.rating) !== null) return player;
  const id = text(player?.playerId ?? player?.player_id ?? player?.id);
  const name = text(player?.name ?? player?.shortName ?? player?.short_name).toLocaleLowerCase('ru-RU');
  const rating = (id && index.byId.get(id)) ?? (name && index.byName.get(name));
  return finiteRating(rating) !== null ? Object.freeze({ ...player, rating:finiteRating(rating) }) : player;
}

function enrichLineups(lineups, players) {
  const index = ratingIndex(players);
  const side = value => Object.freeze({
    ...(value || {}),
    starters:Object.freeze(list(value?.starters).map(player => enrichPlayer(player, index))),
    substitutes:Object.freeze(list(value?.substitutes).map(player => enrichPlayer(player, index))),
  });
  return Object.freeze({
    home:side(lineups?.home),
    away:side(lineups?.away),
  });
}

export function round512NeedsCanonicalSectionRecovery(sectionPayload, section) {
  if (section !== 'lineups') return false;
  const homeStarters = list(sectionPayload?.data?.home?.starters).length;
  const awayStarters = list(sectionPayload?.data?.away?.starters).length;
  const substitutes = list(sectionPayload?.data?.home?.substitutes).length
    + list(sectionPayload?.data?.away?.substitutes).length;
  return homeStarters === 11 && awayStarters === 11 && substitutes === 0;
}

export async function recoverRound512SerieASection({ request, env, initData, matchId, section } = {}) {
  if (section !== 'lineups' || !env?.CIAO_WEB_API?.fetch || !request?.url) return null;
  const id = numericMatchId(matchId);
  if (!id) return null;

  const upstream = await env.CIAO_WEB_API.fetch(new Request(new URL(SERIE_A_MATCH_CENTER_PATH, request.url), {
    method:'POST',
    headers:{
      'content-type':'application/json',
      'x-telegram-init-data':text(initData),
    },
    body:JSON.stringify({
      match_id:id,
      sections:['lineups','player_stats'],
      include_split:false,
    }),
  }));
  if (!upstream.ok) return null;

  let payload;
  try {
    payload = await upstream.json();
  } catch {
    return null;
  }
  if (payload?.ok === false) return null;

  const raw = normalizeRound512SerieARaw(unwrapSerieAMatchCenterPayload(payload));
  const adapted = adaptSerieALegacyMatchCenter(normalizeSerieALegacyMatchCenter(raw));
  const substitutes = list(adapted?.lineups?.home?.substitutes).length
    + list(adapted?.lineups?.away?.substitutes).length;
  if (!substitutes) return null;

  return Object.freeze({
    available:true,
    coverage:adapted.coverage,
    data:enrichLineups(adapted.lineups, adapted.players),
  });
}
