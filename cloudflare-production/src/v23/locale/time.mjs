const DEFAULT_LOCALE = 'ru-RU';

function parseDate(value, errorCode) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error(errorCode);
  return date;
}

function formatter(locale, timeZone, options) {
  try {
    return new Intl.DateTimeFormat(locale, { timeZone, ...options });
  } catch {
    throw new Error('invalid_timezone');
  }
}

function zonedParts(date, { timeZone, locale = DEFAULT_LOCALE }) {
  const parts = formatter(locale, timeZone, {
    year:'numeric',
    month:'2-digit',
    day:'2-digit',
    hour:'2-digit',
    minute:'2-digit',
    hourCycle:'h23',
  }).formatToParts(date);
  const map = Object.create(null);
  for (const part of parts) {
    if (part.type !== 'literal') map[part.type] = part.value;
  }
  return {
    year:Number(map.year),
    month:Number(map.month),
    day:Number(map.day),
    hour:map.hour,
    minute:map.minute,
  };
}

function localDayNumber(parts) {
  return Math.trunc(Date.UTC(parts.year, parts.month - 1, parts.day) / 86400000);
}

function clockLabel(date, options) {
  const parts = zonedParts(date, options);
  return `${parts.hour}:${parts.minute}`;
}

function calendarDateLabel(date, { timeZone, locale = DEFAULT_LOCALE }) {
  return formatter(locale, timeZone, {
    day:'numeric',
    month:'long',
  }).format(date);
}

export function formatKickoff(utcIso, { now = new Date(), timeZone, locale = DEFAULT_LOCALE } = {}) {
  const kickoff = parseDate(utcIso, 'invalid_match_time');
  const current = parseDate(now, 'invalid_now_time');
  if (!String(timeZone ?? '').trim()) throw new Error('invalid_timezone');

  const kickoffParts = zonedParts(kickoff, { timeZone, locale });
  const nowParts = zonedParts(current, { timeZone, locale });
  const deltaDays = localDayNumber(kickoffParts) - localDayNumber(nowParts);
  const clock = `${kickoffParts.hour}:${kickoffParts.minute}`;

  if (deltaDays === 0) return `Сегодня · ${clock}`;
  if (deltaDays === 1) return `Завтра · ${clock}`;
  return `${calendarDateLabel(kickoff, { timeZone, locale })} · ${clock}`;
}

export function formatMatchDate(utcIso, { timeZone, locale = DEFAULT_LOCALE } = {}) {
  const kickoff = parseDate(utcIso, 'invalid_match_time');
  if (!String(timeZone ?? '').trim()) throw new Error('invalid_timezone');
  return `${calendarDateLabel(kickoff, { timeZone, locale })} · ${clockLabel(kickoff, { timeZone, locale })}`;
}
