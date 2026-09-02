import { getCompetitionConfig } from './competition-config.mjs';
import { loadCompetitionMatches } from './data-client.mjs';
import { profileCompetitionMatches } from './profile-matches.mjs';

const EXTERNAL_COMPETITIONS = Object.freeze(['coppa_italia', 'ucl', 'uel', 'uecl']);
const STYLE_ID = 'ciao-v232-profile-tournament-style';

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isoDate(year, month, day) {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function profileSeasonDateRange(now = new Date()) {
  const date = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(date.getTime())) throw new Error('Invalid season date');
  const year = date.getUTCFullYear();
  const startYear = date.getUTCMonth() + 1 >= 7 ? year : year - 1;
  return Object.freeze({
    from: isoDate(startYear, 7, 1),
    to: isoDate(startYear + 1, 6, 30),
  });
}

function formatKickoff(value) {
  const time = Date.parse(value || '');
  if (!Number.isFinite(time)) return 'Время уточняется';
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(time));
}

function scoreText(match) {
  const home = match?.homeScore;
  const away = match?.awayScore;
  if (home === null || home === undefined || away === null || away === undefined) return '';
  return `${home}:${away}`;
}

function statusText(match) {
  if (match?.status === 'live') return scoreText(match) ? `${scoreText(match)} · LIVE` : 'LIVE';
  if (match?.status === 'finished') return scoreText(match) || 'Матч завершён';
  if (match?.status === 'postponed') return 'Матч перенесён';
  if (match?.status === 'cancelled') return 'Матч отменён';
  return formatKickoff(match?.kickoffAt);
}

function teamLogo(team) {
  const url = String(team?.crestUrl || '').trim();
  return url
    ? `<img class="cw232-profile-team-logo" src="${esc(url)}" alt="" loading="lazy" decoding="async">`
    : '<span class="cw232-profile-team-logo cw232-profile-team-logo--empty" aria-hidden="true"></span>';
}

function profileMatchCard(match) {
  const config = getCompetitionConfig(match.competition);
  return `<article class="cw232-profile-tournament-match" data-cw232-profile-match="${esc(match.matchId || '')}" data-cw232-competition="${esc(match.competition)}">
    <div class="cw232-profile-tournament-label">${esc(config.title)}</div>
    <div class="cw232-profile-tournament-teams">
      <div class="cw232-profile-tournament-team">${teamLogo(match.homeTeam)}<b>${esc(match.homeTeam?.name || '—')}</b></div>
      <div class="cw232-profile-tournament-center"><strong>${esc(scoreText(match) || '—')}</strong><small>${esc(statusText(match))}</small></div>
      <div class="cw232-profile-tournament-team away"><b>${esc(match.awayTeam?.name || '—')}</b>${teamLogo(match.awayTeam)}</div>
    </div>
  </article>`;
}

export function renderProfileTournamentSection(matches = []) {
  const rows = Array.isArray(matches) ? matches : [];
  if (!rows.length) return '';
  return `<section class="cw16-club-section cw232-profile-tournament-enrichment">
    <div class="cw16-club-section-head">
      <div class="cw16-club-section-title">Кубки и еврокубки</div>
      <div class="cw16-club-section-note">${rows.length} матч${rows.length === 1 ? '' : rows.length < 5 ? 'а' : 'ей'}</div>
    </div>
    <div class="cw232-profile-tournament-list">${rows.map(profileMatchCard).join('')}</div>
  </section>`;
}

function installStyles(documentRef = globalThis.document) {
  if (!documentRef?.createElement || documentRef.getElementById?.(STYLE_ID)) return;
  const style = documentRef.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
.cw232-profile-tournament-enrichment{margin-top:14px}
.cw232-profile-tournament-list{display:grid;gap:9px;margin-top:10px}
.cw232-profile-tournament-match{border:1px solid rgba(255,255,255,.09);border-radius:18px;background:rgba(255,255,255,.045);padding:11px 12px}
.cw232-profile-tournament-label{margin-bottom:8px;font-size:9px;font-weight:850;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.52)}
.cw232-profile-tournament-teams{display:grid;grid-template-columns:minmax(0,1fr) 76px minmax(0,1fr);gap:7px;align-items:center}
.cw232-profile-tournament-team{display:flex;gap:7px;align-items:center;min-width:0;font-size:11px;line-height:1.2}.cw232-profile-tournament-team.away{flex-direction:row-reverse;text-align:right}.cw232-profile-tournament-team b{overflow-wrap:anywhere}
.cw232-profile-team-logo{width:30px;height:30px;flex:0 0 30px;object-fit:contain}.cw232-profile-team-logo--empty{border-radius:50%;background:rgba(255,255,255,.07)}
.cw232-profile-tournament-center{text-align:center}.cw232-profile-tournament-center strong{display:block;font-size:15px}.cw232-profile-tournament-center small{display:block;margin-top:2px;font-size:8px;line-height:1.25;color:rgba(255,255,255,.52)}
`;
  documentRef.head?.appendChild?.(style);
}

export function createProfileTournamentIntegration({
  loadMatches = loadCompetitionMatches,
  now = () => new Date(),
} = {}) {
  let cacheKey = '';
  let cache = Object.create(null);
  let loadPromise = null;
  let successfulLoads = 0;

  function currentRange() {
    return profileSeasonDateRange(now());
  }

  async function loadTournamentData() {
    const range = currentRange();
    const key = `${range.from}:${range.to}`;
    if (cacheKey === key && (loadPromise || successfulLoads > 0)) {
      if (loadPromise) await loadPromise;
      return cache;
    }

    cacheKey = key;
    cache = Object.create(null);
    successfulLoads = 0;
    loadPromise = Promise.allSettled(
      EXTERNAL_COMPETITIONS.map(async competition => {
        const data = await loadMatches(competition, range);
        cache[competition] = data;
        successfulLoads += 1;
      }),
    ).finally(() => { loadPromise = null; });
    await loadPromise;
    return cache;
  }

  async function ensureClub(teamIdentity) {
    await loadTournamentData();
    return profileCompetitionMatches(cache, teamIdentity);
  }

  function renderForClub(teamIdentity) {
    if (!successfulLoads) return '';
    return renderProfileTournamentSection(profileCompetitionMatches(cache, teamIdentity));
  }

  return Object.freeze({
    ensureClub,
    renderForClub,
    get data() { return cache; },
  });
}

export function installProfileTournamentIntegration(root = globalThis) {
  if (!root || root.CiaoV232Profile) return root?.CiaoV232Profile || null;
  installStyles(root.document);
  const integration = createProfileTournamentIntegration();
  root.CiaoV232Profile = integration;
  return integration;
}

if (typeof globalThis !== 'undefined' && typeof globalThis.document !== 'undefined') {
  installProfileTournamentIntegration(globalThis);
}
