const LEGACY_CORE_API = '/api/ciao-core-api-fast-v4';

function text(value) { return String(value ?? '').trim(); }
function normalizedName(value) { return text(value).toLowerCase().replace(/\s+/g, ' '); }

function crestUrl(team = {}) {
  return text(
    team?.crestUrl
    || team?.crest_url
    || team?.logo
    || team?.logo_url
    || team?.logoUrl
    || team?.team_logo,
  );
}

function teamId(team = {}) {
  return text(team?.id ?? team?.team_id ?? team?.teamId);
}

function stateRoots(payload = {}) {
  return [payload, payload?.state, payload?.data, payload?.data?.state]
    .filter(item => item && typeof item === 'object');
}

function legacyMatchTeam(match = {}, side) {
  const direct = match?.[side];
  const nested = match?.[`${side}_team`] || match?.[`${side}Team`];
  const object = direct && typeof direct === 'object'
    ? direct
    : nested && typeof nested === 'object'
      ? nested
      : {};
  const directName = typeof direct === 'string' ? direct : '';
  const nestedName = typeof nested === 'string' ? nested : '';
  const team = {
    ...object,
    id: object?.id
      ?? object?.team_id
      ?? match?.[`${side}_id`]
      ?? match?.[`${side}_team_id`]
      ?? '',
    name: text(
      object?.name
      || object?.team_name
      || directName
      || nestedName
      || match?.[`${side}_name`]
      || match?.[`${side}_team_name`],
    ),
    logo: text(
      object?.logo
      || object?.logo_url
      || object?.logoUrl
      || object?.crest
      || object?.crest_url
      || object?.team_logo
      || match?.[`${side}_logo`]
      || match?.[`${side}_logo_url`]
      || match?.[`${side}_team_logo`]
      || match?.[`${side}_team_logo_url`],
    ),
  };
  return teamId(team) || text(team.name) || crestUrl(team) ? team : null;
}

export function serieAStateTeams(payload = {}) {
  for (const root of stateRoots(payload)) {
    const round = root?.round && typeof root.round === 'object' ? root.round : null;
    const matches = Array.isArray(round?.matches) ? round.matches : [];
    if (!matches.length) continue;
    const teams = [];
    for (const match of matches) {
      const home = legacyMatchTeam(match, 'home');
      const away = legacyMatchTeam(match, 'away');
      if (home) teams.push(home);
      if (away) teams.push(away);
    }
    if (teams.length) return teams;
  }
  return [];
}

export function serieAStateCrestLookup(payload = {}) {
  const byId = new Map();
  const byName = new Map();
  for (const team of serieAStateTeams(payload)) {
    const url = crestUrl(team);
    if (!url) continue;
    const id = teamId(team);
    const name = normalizedName(team?.name || team?.team_name);
    if (id) byId.set(id, url);
    if (name) byName.set(name, url);
  }
  return Object.freeze({ byId, byName });
}

export function resolveSerieAStateCrest(lookup, { id, name } = {}) {
  const keyId = text(id);
  const keyName = normalizedName(name);
  return text(lookup?.byId?.get?.(keyId) || lookup?.byName?.get?.(keyName));
}

function telegramInitData() {
  return text(globalThis.Telegram?.WebApp?.initData);
}

let lookupPromise = null;

async function loadStableSerieALookup(fetchImpl = globalThis.fetch) {
  if (lookupPromise) return lookupPromise;
  lookupPromise = (async () => {
    const initData = telegramInitData();
    if (!initData || typeof fetchImpl !== 'function') return serieAStateCrestLookup({});
    const response = await fetchImpl(LEGACY_CORE_API, {
      method:'POST',
      headers:{
        accept:'application/json',
        'content-type':'application/json',
        'x-telegram-init-data':initData,
      },
      body:JSON.stringify({ action:'state' }),
    });
    let payload = null;
    try { payload = await response.json(); } catch {}
    if (!response.ok || payload?.ok === false) throw new Error('serie_a_state_unavailable');
    return serieAStateCrestLookup(payload);
  })().catch(error => {
    lookupPromise = null;
    throw error;
  });
  return lookupPromise;
}

function fallbackNode(letter) {
  const span = document.createElement('span');
  span.className = 'cw233-table-logo-fallback';
  span.textContent = letter || '—';
  return span;
}

export async function hydrateSerieATableCrests({ root = document, fetchImpl = globalThis.fetch } = {}) {
  if (typeof document === 'undefined' || !root?.querySelectorAll) return 0;
  const hub = root.querySelector('[data-cw233-tables-selected="serie_a"]');
  if (!hub) return 0;
  const rows = [...hub.querySelectorAll('tr[data-cw233-standing-team]')]
    .filter(row => row.querySelector('.cw233-table-logo-fallback'));
  if (!rows.length) return 0;

  let lookup;
  try { lookup = await loadStableSerieALookup(fetchImpl); }
  catch { return 0; }

  let hydrated = 0;
  for (const row of rows) {
    const fallback = row.querySelector('.cw233-table-logo-fallback');
    if (!fallback) continue;
    const name = text(row.querySelector('.cw233-standing-team strong')?.textContent);
    const url = resolveSerieAStateCrest(lookup, {
      id:row.dataset?.cw233StandingTeam,
      name,
    });
    if (!url) continue;

    const image = document.createElement('img');
    image.className = 'cw233-table-logo';
    image.src = url;
    image.alt = '';
    image.width = 30;
    image.height = 30;
    image.loading = 'eager';
    image.decoding = 'sync';
    const fallbackLetter = text(fallback.textContent);
    image.addEventListener('error', () => image.replaceWith(fallbackNode(fallbackLetter)), { once:true });
    fallback.replaceWith(image);
    hydrated += 1;
  }
  return hydrated;
}

let installed = false;

export function installSerieALegacyBridge() {
  if (typeof document === 'undefined' || installed) return;
  installed = true;
  const hydrate = () => { void hydrateSerieATableCrests().catch(() => {}); };
  const start = () => {
    hydrate();
    const observer = new MutationObserver(mutations => {
      if (mutations.some(item => item.addedNodes?.length)) hydrate();
    });
    observer.observe(document.body, { childList:true, subtree:true });
    document.addEventListener('click', event => {
      if (event.target?.closest?.('[data-cw233-table-competition="serie_a"]')) {
        queueMicrotask(hydrate);
      }
    }, true);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
}

if (typeof document !== 'undefined') installSerieALegacyBridge();
