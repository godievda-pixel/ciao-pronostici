import { getCompetitionConfig } from './competition-config.mjs';

const BSD_CREST_ORIGIN = 'https://sports.bzzoiro.com/img/team';
const EUROPEAN = new Set(['ucl', 'uel', 'uecl']);
const LIVE_STATUSES = new Set(['live', 'inprogress', 'in_progress', 'playing', '1h', 'ht', '2h', 'et', 'pen_live']);
const FINISHED_STATUSES = new Set(['finished', 'ended', 'fulltime', 'full_time', 'ft', 'aet', 'pen']);
const POSTPONED_STATUSES = new Set(['postponed', 'pst']);
const CANCELLED_STATUSES = new Set(['cancelled', 'canceled', 'canc']);

function text(value) {
  return String(value ?? '').trim();
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function integerOrNull(value) {
  const number = numberOrNull(value);
  return Number.isInteger(number) ? number : null;
}

function normalizeCountryCode(value) {
  const code = text(value).toUpperCase();
  if (!code) return '';
  if (code === 'IT') return 'ITA';
  if (code === 'GB' || code === 'UK') return 'ENG';
  return code;
}

function italianIdSet(values) {
  if (values instanceof Set) return new Set([...values].map(value => text(value)).filter(Boolean));
  if (Array.isArray(values)) return new Set(values.map(value => text(value)).filter(Boolean));
  return new Set();
}

function teamObject(event, side) {
  const value = event?.[`${side}_team`] ?? event?.[`${side}Team`];
  return value && typeof value === 'object' ? value : {};
}

function preferredTeamName(event, side, object) {
  return text(
    object?.name_ru ??
      object?.ru_name ??
      object?.localized_name?.ru ??
      event?.[`${side}_team_name_ru`] ??
      event?.[`${side}_name_ru`] ??
      object?.name ??
      object?.team_name ??
      (typeof event?.[`${side}_team`] === 'string' ? event?.[`${side}_team`] : '') ??
      event?.[`${side}_team_name`] ??
      event?.[`${side}_name`],
  ) || '—';
}

function teamId(event, side, object) {
  return text(
    object?.id ??
      object?.team_id ??
      event?.[`${side}_team_id`] ??
      event?.[`${side}_id`],
  );
}

function teamCountry(object) {
  return normalizeCountryCode(
    object?.country_code ?? object?.countryCode ?? object?.country?.code ?? object?.country,
  );
}

function normalizeTeam(event, side, italianTeamIds) {
  const object = teamObject(event, side);
  const id = teamId(event, side, object);
  const countryCode = teamCountry(object);
  const isItalian = italianTeamIds.has(id) || countryCode === 'ITA';
  return Object.freeze({
    id,
    name: preferredTeamName(event, side, object),
    countryCode: isItalian ? 'ITA' : countryCode,
    crestUrl: id ? `${BSD_CREST_ORIGIN}/${encodeURIComponent(id)}/?bg=transparent` : '',
    isItalian,
  });
}

export function isItalianTeam(team = {}) {
  return team?.isItalian === true || text(team?.countryCode).toUpperCase() === 'ITA';
}

function normalizeStatus(event) {
  const status = text(event?.status ?? event?.state).toLowerCase();
  if (LIVE_STATUSES.has(status)) return 'live';
  if (FINISHED_STATUSES.has(status)) return 'finished';
  if (POSTPONED_STATUSES.has(status)) return 'postponed';
  if (CANCELLED_STATUSES.has(status)) return 'cancelled';
  return 'scheduled';
}

function score(event, side, status) {
  if (status !== 'live' && status !== 'finished') return null;
  const value = event?.[`${side}_score`] ?? event?.score?.[side] ?? event?.scores?.[side];
  return numberOrNull(value);
}

function rawStage(event) {
  return text(event?.round_name ?? event?.stage ?? event?.phase ?? event?.group_name);
}

function roundFrom(event, stageText) {
  const direct = integerOrNull(event?.round_number ?? event?.round ?? event?.matchday);
  if (direct !== null) return direct;
  const match = text(stageText).match(/(?:round|matchday|тур)\s*(\d{1,2})/i);
  return match ? integerOrNull(match[1]) : null;
}

function normalizeStage(stageText, round, competition) {
  const raw = text(stageText);
  const lower = raw.toLowerCase().replace(/[–—]/g, '-').replace(/\s+/g, ' ');

  if (
    EUROPEAN.has(competition) &&
    /^(матчи|matches)$/i.test(lower) &&
    Number.isInteger(round) &&
    round >= 1 &&
    round <= 8
  ) {
    return {
      key: `league-${round}`,
      label: `Общий этап · ${round} тур`,
      order: 100 + round,
      recognized: true,
    };
  }

  if (/league\s+(phase|stage)/i.test(lower)) {
    const number = round ?? integerOrNull(lower.match(/(?:round|matchday)\s*(\d{1,2})/i)?.[1]);
    return number
      ? { key: `league-${number}`, label: `Общий этап · ${number} тур`, order: 100 + number, recognized: true }
      : { key: 'league', label: 'Общий этап', order: 100, recognized: true };
  }
  if (/knockout\s+(phase\s+)?play-?offs?|play-?offs?/i.test(lower)) {
    return { key: 'playoff', label: 'Стыковые матчи', order: 250, recognized: true };
  }
  if (/round\s+of\s+64|1\s*\/\s*32/i.test(lower)) {
    return { key: 'r64', label: '1/32 финала', order: 290, recognized: true };
  }
  if (/round\s+of\s+32|1\s*\/\s*16/i.test(lower)) {
    return { key: 'r32', label: '1/16 финала', order: 300, recognized: true };
  }
  if (/round\s+of\s+16|1\s*\/\s*8/i.test(lower)) {
    return { key: 'r16', label: '1/8 финала', order: 400, recognized: true };
  }
  if (/quarter[-\s]?finals?|quarterfinals?|1\s*\/\s*4/i.test(lower)) {
    return { key: 'qf', label: '1/4 финала', order: 500, recognized: true };
  }
  if (/semi[-\s]?finals?|semifinals?|1\s*\/\s*2/i.test(lower)) {
    return { key: 'sf', label: '1/2 финала', order: 600, recognized: true };
  }
  if (/^final$|\bfinal\b/i.test(lower)) {
    return { key: 'final', label: 'Финал', order: 700, recognized: true };
  }
  const safeLabel = raw || 'Матчи';
  const key = `stage-${safeLabel.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'other'}`;
  return { key, label: safeLabel, order: 900, recognized: false };
}

export function normalizeBsdEvent(event, competition, options = {}) {
  getCompetitionConfig(competition);
  if (!event || typeof event !== 'object') return null;
  const sourceId = text(event?.id ?? event?.event_id ?? event?.match_id);
  if (!sourceId) return null;

  try {
    const italianTeamIds = italianIdSet(options.italianTeamIds);
    const homeTeam = normalizeTeam(event, 'home', italianTeamIds);
    const awayTeam = normalizeTeam(event, 'away', italianTeamIds);
    const status = normalizeStatus(event);
    const stageText = rawStage(event);
    const round = roundFrom(event, stageText);
    const stage = normalizeStage(stageText, round, competition);

    if (competition === 'coppa_italia' && !['r32','r16','qf','sf','final'].includes(stage.key)) return null;
    if (EUROPEAN.has(competition) && !isItalianTeam(homeTeam) && !isItalianTeam(awayTeam)) return null;

    return Object.freeze({
      matchId: `${competition}:${sourceId}`,
      sourceId,
      competition,
      kickoffAt: text(event?.event_date ?? event?.kickoff_at ?? event?.kickoff ?? event?.utcDate ?? event?.date),
      status,
      minute: status === 'live'
        ? numberOrNull(event?.current_minute ?? event?.minute ?? event?.time?.minute ?? event?.elapsed)
        : null,
      stageKey: stage.key,
      stageLabel: stage.label,
      stageOrder: stage.order,
      round,
      homeTeam,
      awayTeam,
      homeScore: score(event, 'home', status),
      awayScore: score(event, 'away', status),
    });
  } catch {
    return null;
  }
}

export function groupMatches(matches, competition) {
  getCompetitionConfig(competition);
  const groups = new Map();
  for (const match of Array.isArray(matches) ? matches : []) {
    if (!match || match.competition !== competition) continue;
    const key = text(match.stageKey) || 'other';
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        label: text(match.stageLabel) || 'Матчи',
        order: Number.isFinite(Number(match.stageOrder)) ? Number(match.stageOrder) : 900,
        matches: [],
      });
    }
    groups.get(key).matches.push(match);
  }

  const firstKickoff = group => {
    const times = group.matches
      .map(match => Date.parse(match?.kickoffAt || ''))
      .filter(Number.isFinite);
    return times.length ? Math.min(...times) : Number.POSITIVE_INFINITY;
  };

  return [...groups.values()]
    .map(group => ({
      ...group,
      matches: [...group.matches].sort((a, b) => {
        const ta = Date.parse(a?.kickoffAt || '') || 0;
        const tb = Date.parse(b?.kickoffAt || '') || 0;
        return ta - tb || String(a?.matchId || '').localeCompare(String(b?.matchId || ''));
      }),
    }))
    .sort((a, b) => firstKickoff(a) - firstKickoff(b) || a.order - b.order || a.label.localeCompare(b.label, 'ru'));
}
