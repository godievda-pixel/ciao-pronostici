function normalizeSnippet(value) {
  return String(value).replace(/\s+/g, ' ').trim().slice(0, 240);
}

function sanitizeSourceSnippet(value) {
  return String(value)
    .replace(/eyJ[A-Za-z0-9_-]{30,}(?:\.[A-Za-z0-9_-]{10,}){1,2}/g, '[redacted-token]')
    .replace(/[A-Za-z0-9_-]{80,}/g, '[redacted-long-literal]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 900);
}

function inferMethod(callText) {
  const match = String(callText).match(/method\s*:\s*['\"]([A-Za-z]+)['\"]/i);
  return String(match?.[1] || 'GET').toUpperCase();
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function discoverApiCalls(source) {
  const text = String(source);
  const calls = [];
  const pattern = /fetch\s*\(\s*([`'\"])(\/api\/[\s\S]*?)\1([\s\S]{0,220}?)\)/g;
  let match;

  while ((match = pattern.exec(text))) {
    const route = String(match[2]).trim();
    const callText = match[0];
    calls.push({
      route,
      method: inferMethod(callText),
      concrete: !/[${}]/.test(route),
      snippet: normalizeSnippet(callText),
    });
  }

  const unique = new Map();
  for (const call of calls) {
    const key = `${call.method} ${call.route}`;
    if (!unique.has(key)) unique.set(key, call);
  }

  return [...unique.values()].sort((a, b) =>
    a.route.localeCompare(b.route) || a.method.localeCompare(b.method)
  );
}

export function discoverApiRouteLiterals(source) {
  const text = String(source);
  const routes = new Set();
  const pattern = /([`'\"])(\/api\/[A-Za-z0-9._~!$&()*+,;=:@%/?#\[\]-]+)\1/g;
  let match;

  while ((match = pattern.exec(text))) {
    routes.add(String(match[2]).trim());
  }

  return [...routes].sort();
}

export function discoverObjectLiteralValues(source, key) {
  const text = String(source);
  const wanted = escapeRegExp(key);
  const values = new Set();
  let match;

  const stringPattern = new RegExp(
    `(?:["']?${wanted}["']?\\s*:\\s*)(["'])([^"'\\r\\n]*?)\\1`,
    'g',
  );
  while ((match = stringPattern.exec(text))) {
    values.add(String(match[2]));
  }

  const numberPattern = new RegExp(
    `(?:["']?${wanted}["']?\\s*:\\s*)(-?\\d+(?:\\.\\d+)?)\\b`,
    'g',
  );
  while ((match = numberPattern.exec(text))) {
    values.add(String(match[1]));
  }

  return [...values].sort();
}

export const V233_SOURCE_MARKERS = Object.freeze([
  'Начало нового сезона!',
  'function predict',
  'function mine',
  "action:'save_predictions'",
  "action:'state'",
  'openMatchCenter',
  '__cw231HomeHtml',
  'serie_a_table',
]);

const SOURCE_HINT_MARKERS = Object.freeze([
  'Матчи',
  '__cw209LoadSchedule',
  '/api/ciao-club-calendar-fast-v1',
  '__cw9Post(__CW208_CLUB_CALENDAR',
  '__cw16MatchesHtml=function',
  'const rows=all.filter',
  '__cw9FastApi(',
  '__cw9Post',
  'boardStatus',
  'boardScore',
  '__cw209CalendarHtml',
  '__cw9CalendarCard',
  '__cw231RawScheduleMatches',
  'normalizeMatch',
  '__CW209_SCHEDULE',
  '__CW9_FAST_API',
  '__CW9_MATCH_API',
  '__CW9_SUMMARY_API',
  '/api/',
  'fetch(',
  'API_BASE',
  'apiFetch',
  'apiJson',
  ...V233_SOURCE_MARKERS,
]);

export function extractSourceHints(source) {
  const text = String(source);
  const hints = [];

  for (const marker of SOURCE_HINT_MARKERS) {
    let from = 0;
    let foundForMarker = 0;

    while (hints.length < 80 && foundForMarker < 3) {
      const index = text.indexOf(marker, from);
      if (index < 0) break;

      const start = Math.max(0, index - 300);
      const end = Math.min(text.length, index + 600);
      hints.push({
        marker,
        index,
        snippet: sanitizeSourceSnippet(text.slice(start, end)),
      });

      foundForMarker += 1;
      from = index + marker.length;
    }
  }

  return hints;
}

function primitiveKind(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function nestedKeys(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  return Object.keys(value).sort();
}

export function summarizeJsonShape(value) {
  const kind = primitiveKind(value);

  if (kind === 'array') {
    const first = value.find(item => item && typeof item === 'object' && !Array.isArray(item));
    if (!first) return { kind: 'array', itemKeys: [] };

    const itemKeys = Object.keys(first).sort();
    const nested = {};
    for (const key of itemKeys) {
      const keys = nestedKeys(first[key]);
      if (keys) nested[key] = keys;
    }

    return {
      kind: 'array',
      itemKeys,
      ...(Object.keys(nested).length ? { nestedKeys: nested } : {}),
    };
  }

  if (kind === 'object') {
    const keys = Object.keys(value).sort();
    const objectKeys = {};

    for (const key of keys) {
      const child = value[key];
      const childKind = primitiveKind(child);

      if (childKind === 'array') {
        const first = child.find(item => item && typeof item === 'object' && !Array.isArray(item));
        const itemKeys = first ? Object.keys(first).sort() : [];
        const nested = {};

        if (first) {
          for (const itemKey of itemKeys) {
            const keys2 = nestedKeys(first[itemKey]);
            if (keys2) nested[itemKey] = keys2;
          }
        }

        objectKeys[key] = {
          kind: 'array',
          itemKeys,
          ...(Object.keys(nested).length ? { nestedKeys: nested } : {}),
        };
      } else if (childKind === 'object') {
        objectKeys[key] = { kind: 'object', keys: Object.keys(child).sort() };
      } else {
        objectKeys[key] = { kind: childKind };
      }
    }

    return { kind: 'object', keys, objectKeys };
  }

  return { kind };
}
