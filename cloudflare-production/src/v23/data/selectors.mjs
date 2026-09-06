import { formatKickoff } from '../locale/time.mjs';

const DAY_MS = 86400000;

function text(value) {
  return String(value ?? '').trim();
}

function validDate(value, code) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error(code);
  return date;
}

function zonedDateTimeParts(date, timeZone) {
  let formatter;
  try {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year:'numeric',
      month:'2-digit',
      day:'2-digit',
      hour:'2-digit',
      minute:'2-digit',
      second:'2-digit',
      hourCycle:'h23',
    });
  } catch {
    throw new Error('invalid_timezone');
  }
  const values = Object.create(null);
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== 'literal') values[part.type] = Number(part.value);
  }
  return {
    year:values.year,
    month:values.month,
    day:values.day,
    hour:values.hour,
    minute:values.minute,
    second:values.second,
  };
}

function localCalendarMidnightUtc(year, month, day, timeZone) {
  const wantedPseudoUtc = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
  let guess = wantedPseudoUtc;

  for (let index = 0; index < 4; index += 1) {
    const parts = zonedDateTimeParts(new Date(guess), timeZone);
    const actualPseudoUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
      0,
    );
    const correction = wantedPseudoUtc - actualPseudoUtc;
    guess += correction;
    if (correction === 0) break;
  }
  return new Date(guess);
}

export function localDayBoundsUtc(now, timeZone) {
  const current = validDate(now, 'invalid_now_time');
  const zone = text(timeZone);
  if (!zone) throw new Error('invalid_timezone');
  const local = zonedDateTimeParts(current, zone);
  const start = localCalendarMidnightUtc(local.year, local.month, local.day, zone);

  const nextCalendarDay = new Date(Date.UTC(local.year, local.month - 1, local.day) + DAY_MS);
  const end = localCalendarMidnightUtc(
    nextCalendarDay.getUTCFullYear(),
    nextCalendarDay.getUTCMonth() + 1,
    nextCalendarDay.getUTCDate(),
    zone,
  );

  return { start:start.toISOString(), end:end.toISOString() };
}

function statusLabel(match) {
  const status = text(match?.status).toLowerCase();
  if (status === 'live') {
    const minute = Number(match?.minute);
    return Number.isFinite(minute) && minute >= 0 ? `В эфире · ${Math.trunc(minute)}'` : 'В эфире';
  }
  if (status === 'finished' || status === 'final') return 'Завершён';
  if (status === 'postponed') return 'Перенесён';
  if (status === 'cancelled' || status === 'canceled') return 'Отменён';
  if (status === 'scheduled' || status === 'not_started' || status === 'upcoming') return 'Скоро';
  return 'Скоро';
}

function uiTeam(team = {}) {
  const nameRu = text(team?.nameRu);
  if (!nameRu) throw new Error('team_name_ru_missing');
  return {
    id:text(team?.id),
    nameRu,
    logoUrl:text(team?.crestUrl ?? team?.logoUrl ?? team?.logo),
    countryCode:text(team?.countryCode),
  };
}

function scoreValue(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function toUiMatch(match = {}, { now = new Date(), timeZone } = {}) {
  const id = text(match?.id);
  if (!id) throw new Error('match_id_missing');
  const kickoffAt = text(match?.kickoffAt);
  if (!kickoffAt) throw new Error('match_kickoff_missing');
  return {
    id,
    providerMatchId:text(match?.providerMatchId),
    competition:text(match?.competition),
    competitionNameRu:text(match?.competitionNameRu),
    stageNameRu:text(match?.stage),
    round:match?.round ?? null,
    kickoffAt,
    status:text(match?.status),
    statusRu:statusLabel(match),
    minute:match?.minute ?? null,
    homeTeam:uiTeam(match?.home),
    awayTeam:uiTeam(match?.away),
    score:{
      home:scoreValue(match?.score?.home),
      away:scoreValue(match?.score?.away),
    },
    timeLabel:formatKickoff(kickoffAt, { now, timeZone }),
    isItalianRelevant:match?.isItalianRelevant === true,
    isQualification:match?.isQualification === true,
  };
}

export function sortLiveFirst(matches = []) {
  return [...(Array.isArray(matches) ? matches : [])].sort((left, right) => {
    const leftLive = text(left?.status).toLowerCase() === 'live';
    const rightLive = text(right?.status).toLowerCase() === 'live';
    if (leftLive !== rightLive) return leftLive ? -1 : 1;
    return Date.parse(left?.kickoffAt || 0) - Date.parse(right?.kickoffAt || 0);
  });
}
