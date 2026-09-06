const BSD_BASE = 'https://sports.bzzoiro.com/api/v2';

const LEAGUE_ALIASES = Object.freeze({
  serie_a:['serie a'],
  coppa_italia:['coppa italia'],
  ucl:['champions league','uefa champions league'],
  uel:['europa league','uefa europa league'],
  uecl:['conference league','uefa conference league'],
});

const SECTION_PATHS = Object.freeze({
  overview:id=>`/events/${id}/`,
  stats:id=>`/events/${id}/stats/`,
  events:id=>`/events/${id}/incidents/`,
  lineups:id=>`/events/${id}/lineups/`,
  players:id=>`/events/${id}/player-stats/`,
});

const text = value => String(value ?? '').trim();
const number = value => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const lower = value => text(value)
  .toLowerCase()
  .replace(/^uefa\s+/,'')
  .replace(/\s+/g,' ');
const rows = payload => Array.isArray(payload)
  ? payload
  : Array.isArray(payload?.results)
    ? payload.results
    : Array.isArray(payload?.data)
      ? payload.data
      : [];

function auth(apiKey) {
  const key = text(apiKey);
  if (!key) throw new Error('bsd_api_key_required');
  return {accept:'application/json', authorization:`Token ${key}`};
}

async function getJson(fetchImpl, apiKey, path, params = {}) {
  const url = new URL(`${BSD_BASE}${path}`);
  for (const [key,value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  }

  const response = await fetchImpl(url, {headers:auth(apiKey)});
  if (!response?.ok) throw new Error(`bsd_http_${response?.status ?? 0}`);
  return await response.json();
}

async function all(fetchImpl, apiKey, path, params = {}) {
  const result = [];
  let offset = 0;
  const limit = 200;

  while (true) {
    const payload = await getJson(fetchImpl, apiKey, path, {...params, limit, offset});
    const page = rows(payload);
    result.push(...page);
    const count = number(payload?.count);

    if (!page.length || page.length < limit || (count !== null && result.length >= count)) break;
    offset += page.length;
  }

  return result;
}

async function resolveLeague(fetchImpl, apiKey, competition) {
  const aliases = LEAGUE_ALIASES[competition];
  if (!aliases) throw new Error(`invalid_competition:${competition}`);

  const list = await all(fetchImpl, apiKey, '/leagues/');
  const expected = new Set(aliases.map(lower));
  const league = list.find(item => expected.has(lower(item?.name ?? item?.league_name)));
  if (!league?.id) throw new Error(`bsd_league_not_found:${competition}`);
  return league;
}

async function resolveSeason(fetchImpl, apiKey, leagueId) {
  const encoded = encodeURIComponent(leagueId);
  const direct = await getJson(fetchImpl, apiKey, `/leagues/${encoded}/season/`).catch(() => null);
  const candidate = direct?.id ? direct : direct?.season?.id ? direct.season : null;
  if (candidate?.id) return candidate;

  const list = await all(fetchImpl, apiKey, `/leagues/${encoded}/seasons/`);
  const current = list.find(item => item?.is_current === true || item?.current === true);
  const chosen = current || [...list].sort((a,b) =>
    (Number(b?.year) || 0) - (Number(a?.year) || 0) ||
    Number(b?.id || 0) - Number(a?.id || 0)
  )[0];
  if (!chosen?.id) throw new Error('bsd_season_not_found');
  return chosen;
}

async function competitionMeta(fetchImpl, apiKey, competition) {
  const league = await resolveLeague(fetchImpl, apiKey, competition);
  const season = await resolveSeason(fetchImpl, apiKey, league.id);
  return {league, season};
}

export function createBsdModularProvider({apiKey, fetchImpl = globalThis.fetch} = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('fetch_unavailable');
  // Validate once while keeping the credential private inside this closure.
  auth(apiKey);

  return Object.freeze({
    async listMatches({competition, from, to} = {}) {
      const {league, season} = await competitionMeta(fetchImpl, apiKey, competition);
      return await all(fetchImpl, apiKey, '/events/', {
        league_id:league.id,
        season_id:season.id,
        date_from:from,
        date_to:to,
      });
    },

    async getStandings({competition} = {}) {
      const {league, season} = await competitionMeta(fetchImpl, apiKey, competition);
      return await getJson(
        fetchImpl,
        apiKey,
        `/leagues/${encodeURIComponent(league.id)}/standings/`,
        {season_id:season.id},
      );
    },

    async getMatchSection({competition, providerMatchId, section = 'overview'} = {}) {
      if (!LEAGUE_ALIASES[competition]) throw new Error(`invalid_competition:${competition}`);
      const source = text(providerMatchId);
      if (!source) throw new Error('provider_match_id_required');
      const path = SECTION_PATHS[section]?.(encodeURIComponent(source));
      if (!path) throw new Error(`invalid_match_center_section:${section}`);
      return await getJson(fetchImpl, apiKey, path);
    },

    async listItalianTeamIds() {
      const list = await all(fetchImpl, apiKey, '/teams/', {country_code:'IT'});
      return new Set(list.map(item => text(item?.id)).filter(Boolean));
    },
  });
}

export { BSD_BASE };
