const MATCH_TOURNAMENTS = new Set(['serie_a','coppa_italia','ucl','uel','uecl']);
const TABLE_TOURNAMENTS = new Set(['serie_a','ucl','uel','uecl']);
const RANKING_SCOPES = new Set(['all','italy','europe']);
const MATCH_SECTIONS = new Set(['overview','stats','events','lineups','players']);

const PATH_TO_TOURNAMENT = Object.freeze({
  'serie-a':'serie_a',
  'coppa-italia':'coppa_italia',
  ucl:'ucl',
  uel:'uel',
  uecl:'uecl',
});

const TOURNAMENT_TO_PATH = Object.freeze(Object.fromEntries(
  Object.entries(PATH_TO_TOURNAMENT).map(([path,id]) => [id,path]),
));

const HOME = Object.freeze({
  screen:'home',
  tournament:null,
  subview:null,
  matchId:null,
  section:null,
  scrollY:0,
});

const clean = value => String(value ?? '').trim();
const safeDecode = value => {
  try { return decodeURIComponent(value); }
  catch { return ''; }
};

function pathOf(input) {
  if (input && typeof input === 'object' && typeof input.pathname === 'string') return input.pathname;
  const source = clean(input);
  if (!source) return '/home';
  try {
    if (/^https?:\/\//i.test(source)) return new URL(source).pathname;
  } catch {}
  return source.split(/[?#]/,1)[0] || '/home';
}

function route(fields = {}) {
  return {
    screen:fields.screen ?? 'home',
    tournament:fields.tournament ?? null,
    subview:fields.subview ?? null,
    matchId:fields.matchId ?? null,
    section:fields.section ?? null,
    scrollY:Number.isFinite(Number(fields.scrollY)) && Number(fields.scrollY) >= 0 ? Number(fields.scrollY) : 0,
  };
}

export function homeRoute() {
  return { ...HOME };
}

export function parseRoute(urlOrPath) {
  const pathname = pathOf(urlOrPath).replace(/\/+$/, '') || '/';
  const parts = pathname.split('/').filter(Boolean).map(safeDecode);
  if (parts.some(part => !part)) return homeRoute();

  if (parts.length === 1 && parts[0] === 'home') return route({screen:'home'});
  if (parts.length === 1 && parts[0] === 'settings') return route({screen:'settings'});

  if (parts[0] === 'predictions') {
    if (parts.length === 1) return route({screen:'predictions'});
    if (parts.length === 2 && parts[1] === 'mine') return route({screen:'predictions',subview:'mine'});
    return homeRoute();
  }

  if (parts[0] === 'ranking' && parts.length === 2 && RANKING_SCOPES.has(parts[1])) {
    return route({screen:'ranking',subview:parts[1]});
  }

  if (parts[0] === 'matches' && parts.length === 2) {
    const tournament = PATH_TO_TOURNAMENT[parts[1]];
    if (tournament && MATCH_TOURNAMENTS.has(tournament)) return route({screen:'matches',tournament});
    return homeRoute();
  }

  if (parts[0] === 'tables' && parts.length === 2) {
    const tournament = PATH_TO_TOURNAMENT[parts[1]];
    if (tournament && TABLE_TOURNAMENTS.has(tournament)) return route({screen:'tables',tournament});
    return homeRoute();
  }

  if (parts[0] === 'match' && parts.length === 4) {
    const tournament = PATH_TO_TOURNAMENT[parts[1]];
    const providerMatchId = clean(parts[2]);
    const section = clean(parts[3]);
    if (tournament && MATCH_TOURNAMENTS.has(tournament) && providerMatchId && MATCH_SECTIONS.has(section)) {
      return route({
        screen:'match',
        tournament,
        matchId:`${tournament}:${providerMatchId}`,
        section,
      });
    }
    return homeRoute();
  }

  return homeRoute();
}

function matchProviderId(matchId, tournament) {
  const raw = clean(matchId);
  if (!raw || !tournament) return '';
  const prefix = `${tournament}:`;
  if (raw.startsWith(prefix)) return raw.slice(prefix.length);
  if (raw.includes(':')) return '';
  return raw;
}

export function serializeRoute(input = {}) {
  const screen = clean(input.screen);
  if (screen === 'home') return '/home';
  if (screen === 'settings') return '/settings';

  if (screen === 'predictions') {
    const subview = clean(input.subview);
    if (!subview || subview === 'available') return '/predictions';
    if (subview === 'mine') return '/predictions/mine';
    return '/home';
  }

  if (screen === 'ranking') {
    const scope = clean(input.subview) || 'all';
    return RANKING_SCOPES.has(scope) ? `/ranking/${scope}` : '/home';
  }

  if (screen === 'matches') {
    const tournament = clean(input.tournament);
    if (!MATCH_TOURNAMENTS.has(tournament)) return '/home';
    return `/matches/${TOURNAMENT_TO_PATH[tournament]}`;
  }

  if (screen === 'tables') {
    const tournament = clean(input.tournament);
    if (!TABLE_TOURNAMENTS.has(tournament)) return '/home';
    return `/tables/${TOURNAMENT_TO_PATH[tournament]}`;
  }

  if (screen === 'match') {
    const tournament = clean(input.tournament);
    const section = clean(input.section) || 'overview';
    const providerId = matchProviderId(input.matchId, tournament);
    if (!MATCH_TOURNAMENTS.has(tournament) || !MATCH_SECTIONS.has(section) || !providerId) return '/home';
    return `/match/${TOURNAMENT_TO_PATH[tournament]}/${encodeURIComponent(providerId)}/${section}`;
  }

  return '/home';
}

export function normalizeRoute(input = {}) {
  const parsed = parseRoute(serializeRoute(input));
  parsed.scrollY = Number.isFinite(Number(input.scrollY)) && Number(input.scrollY) >= 0 ? Number(input.scrollY) : 0;
  return parsed;
}

export const ROUTE_CONTRACT = Object.freeze({
  matchTournaments:Object.freeze([...MATCH_TOURNAMENTS]),
  tableTournaments:Object.freeze([...TABLE_TOURNAMENTS]),
  rankingScopes:Object.freeze([...RANKING_SCOPES]),
  matchSections:Object.freeze([...MATCH_SECTIONS]),
});
