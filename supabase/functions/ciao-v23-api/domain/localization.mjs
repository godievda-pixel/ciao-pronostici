import { competitionById } from './competitions.mjs';

const STAGE_NAMES_RU = new Map([
  ['round of 16', '1/8 финала'],
  ['round of 16s', '1/8 финала'],
  ['last 16', '1/8 финала'],
  ['1/8 finals', '1/8 финала'],
  ['1/8 final', '1/8 финала'],
  ['quarter-finals', '1/4 финала'],
  ['quarter-final', '1/4 финала'],
  ['quarter finals', '1/4 финала'],
  ['quarter final', '1/4 финала'],
  ['semi-finals', '1/2 финала'],
  ['semi-final', '1/2 финала'],
  ['semi finals', '1/2 финала'],
  ['semi final', '1/2 финала'],
  ['final', 'Финал'],
  ['league phase', 'Общий этап'],
  ['league stage', 'Общий этап'],
  ['group stage', 'Групповой этап'],
]);

function normalizeStageKey(stage) {
  return String(stage ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function lookupTeamRow(id, lookup) {
  if (lookup instanceof Map) return lookup.get(id) ?? lookup.get(String(id));
  if (typeof lookup === 'function') return lookup(id);
  if (lookup && typeof lookup === 'object') return lookup[id] ?? lookup[String(id)];
  return null;
}

export function localizeCompetition(id) {
  try {
    return competitionById(String(id)).nameRu;
  } catch {
    throw new Error(`competition_not_supported:${id}`);
  }
}

export function localizeStage(stage) {
  const raw = String(stage ?? '').trim();
  const key = normalizeStageKey(raw);
  if (!key) throw new Error('stage_localization_missing:');

  const direct = STAGE_NAMES_RU.get(key);
  if (direct) return direct;

  const matchday = key.match(/^matchday\s+(\d+)$/i);
  if (matchday) return `${Number(matchday[1])}-й тур`;

  const round = key.match(/^round\s+(\d+)$/i);
  if (round) return `${Number(round[1])}-й тур`;

  throw new Error(`stage_localization_missing:${raw}`);
}

export function localizeTeam(team, lookup) {
  const id = String(team?.id ?? team?.providerTeamId ?? team?.provider_team_id ?? '').trim();
  if (!id) throw new Error('team_localization_missing:');

  const row = lookupTeamRow(id, lookup);
  const nameRu = String(row?.name_ru ?? row?.nameRu ?? '').trim();
  if (!nameRu) throw new Error(`team_localization_missing:${id}`);

  const aliases = row?.aliases_ru ?? row?.aliasesRu ?? [];

  return {
    id,
    nameRu,
    genitiveRu: row?.genitive_ru ?? row?.genitiveRu ?? null,
    dativeRu: row?.dative_ru ?? row?.dativeRu ?? null,
    prepositionalRu: row?.prepositional_ru ?? row?.prepositionalRu ?? null,
    aliasesRu: Array.isArray(aliases) ? [...aliases] : [],
    countryCode: team?.countryCode ?? team?.country_code ?? null,
    crestUrl: team?.crestUrl ?? team?.crest_url ?? null,
  };
}
