import {
  ESPN_COMPETITION_SLUGS,
  extractEspnTeamIds,
  adaptEspnScoreboard,
} from './espn-adapter.mjs';

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer';
const MAX_RANGE_DAYS = 370;

function isoDate(value) {
  const text = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new Error(`Invalid date: ${text || 'empty'}`);
  }
  const time = Date.parse(`${text}T00:00:00Z`);
  if (!Number.isFinite(time)) throw new Error(`Invalid date: ${text}`);
  return { text, time };
}

function compactDate(value) {
  return value.replaceAll('-', '');
}

function assertRange(from, to) {
  const start = isoDate(from);
  const end = isoDate(to);
  if (end.time < start.time) throw new Error('Invalid date range: to is before from');
  const days = Math.floor((end.time - start.time) / 86400000) + 1;
  if (days > MAX_RANGE_DAYS) {
    throw new Error(`Date range exceeds ${MAX_RANGE_DAYS} days`);
  }
  return { from: start.text, to: end.text };
}

async function fetchJson(url, fetchImpl) {
  const response = await fetchImpl(url, {
    headers: {
      accept: 'application/json',
      'cache-control': 'no-cache',
    },
  });

  if (!response.ok) {
    throw new Error(`ESPN upstream failed: HTTP ${response.status}`);
  }

  const type = String(response.headers.get('content-type') || '').toLowerCase();
  if (type && !type.includes('json')) {
    throw new Error(`ESPN upstream returned non-JSON content: ${type}`);
  }

  try {
    return await response.json();
  } catch {
    throw new Error('ESPN upstream returned invalid JSON');
  }
}

export function buildEspnScoreboardUrl(competition, from, to) {
  const slug = ESPN_COMPETITION_SLUGS[competition];
  if (!slug) throw new Error(`Unsupported ESPN competition: ${competition}`);
  const range = assertRange(from, to);
  return `${ESPN_BASE}/${slug}/scoreboard?dates=${compactDate(range.from)}-${compactDate(range.to)}`;
}

export async function fetchItalianEspnTeamIds({ fetchImpl = fetch } = {}) {
  const urls = [
    `${ESPN_BASE}/ita.1/teams`,
    `${ESPN_BASE}/ita.2/teams`,
  ];
  const payloads = await Promise.all(urls.map(url => fetchJson(url, fetchImpl)));
  const ids = new Set();
  for (const payload of payloads) {
    for (const id of extractEspnTeamIds(payload)) ids.add(id);
  }
  return ids;
}

export async function fetchEspnMatches({
  competition,
  from,
  to,
  fetchImpl = fetch,
}) {
  const scoreboardUrl = buildEspnScoreboardUrl(competition, from, to);

  if (competition === 'coppa_italia') {
    const payload = await fetchJson(scoreboardUrl, fetchImpl);
    return adaptEspnScoreboard(payload, competition);
  }

  const [payload, italianTeamIds] = await Promise.all([
    fetchJson(scoreboardUrl, fetchImpl),
    fetchItalianEspnTeamIds({ fetchImpl }),
  ]);

  return adaptEspnScoreboard(payload, competition, { italianTeamIds });
}
