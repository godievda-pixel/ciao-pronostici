export const USER_FEEDBACK_ROUND31_BUILD = '2026-09-04-r31';

const STYLE_ID = 'ciao-v233-round31-match-center-stability';
const OWNED_CLASS = 'cw233-r31-match-center-owned';
const EXTERNAL_OPEN_EVENT = 'ciao-v233-open-external-legacy-match';
const SERIE_A_OPEN_EVENT = 'ciao-v233-open-serie-a-match';
const EXTERNAL_COMPETITIONS = new Set([
  'coppa_italia',
  'ucl',
  'uel',
  'uecl',
  'champions_league',
  'europa_league',
  'conference_league',
]);

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function finite(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function numberText(value, { pct = false, digits = 2 } = {}) {
  const number = finite(value);
  if (number === null) return '—';
  const text = Number.isInteger(number)
    ? String(number)
    : number.toFixed(digits).replace(/0+$/, '').replace(/\.$/, '');
  return pct ? `${text}%` : text;
}

export function isRound31ExternalCompetition(value) {
  return EXTERNAL_COMPETITIONS.has(String(value || '').trim().toLowerCase());
}

function legacyStats(snapshot, side) {
  const value = snapshot?.stats?.stats?.[side];
  return value && typeof value === 'object' ? value : {};
}

function snapshotEvents(snapshot) {
  const value = snapshot?.incidents?.incidents;
  return Array.isArray(value) ? value : [];
}

function snapshotPlayers(snapshot) {
  const value = snapshot?.player_stats?.player_stats;
  return Array.isArray(value) ? value : [];
}

export function externalMatchCenterSnapshotSignature(snapshot = {}) {
  const match = snapshot?.match && typeof snapshot.match === 'object' ? snapshot.match : {};
  const home = legacyStats(snapshot, 'home');
  const away = legacyStats(snapshot, 'away');
  const incidents = snapshotEvents(snapshot);
  const players = snapshotPlayers(snapshot);
  const signature = {
    status:String(snapshot?.status || ''),
    id:String(snapshot?.match_id || match?.id || ''),
    score:[match?.home_score ?? null, match?.away_score ?? null],
    minute:match?.live_elapsed ?? snapshot?.detail?.current_minute ?? null,
    home:[home.expected_goals ?? null, home.ball_possession ?? null, home.total_shots ?? null, home.shots_on_target ?? null],
    away:[away.expected_goals ?? null, away.ball_possession ?? null, away.total_shots ?? null, away.shots_on_target ?? null],
    incidents:incidents.map(item => [item?.type ?? '', item?.minute ?? null, item?.home_score ?? null, item?.away_score ?? null]),
    players:players.map(item => [item?.player_id ?? null, item?.rating ?? null, item?.goals ?? null, item?.goal_assist ?? null]),
    lineupStatus:String(snapshot?.lineups?.lineup_status || ''),
  };
  return JSON.stringify(signature);
}

function statCell(label, home, away, options) {
  return `<div class="cw233-r31-stat"><span>${esc(label)}</span><b><strong>${esc(numberText(home, options))}</strong><i>—</i><strong>${esc(numberText(away, options))}</strong></b></div>`;
}

function matchInfoHtml(snapshot) {
  const detail = snapshot?.detail && typeof snapshot.detail === 'object' ? snapshot.detail : {};
  const stadium = String(detail?.stadium || detail?.venue || '').trim();
  const city = String(detail?.city || '').trim();
  const referee = String(detail?.referee || '').trim();
  if (!stadium && !city && !referee) return '';
  const venue = [stadium, city && !stadium.includes(city) ? city : ''].filter(Boolean).join(' · ');
  return `<section class="mc-section cw233-r31-info"><div class="mc-section-head"><div class="mc-section-title">Информация о матче</div></div><div class="cw233-r31-info-grid">${venue ? `<div><span>Стадион</span><b>${esc(venue)}</b></div>` : ''}${referee ? `<div><span>Судья</span><b>${esc(referee)}</b></div>` : ''}</div></section>`;
}

export function renderRound31ExternalOverview(snapshot = {}) {
  const home = legacyStats(snapshot, 'home');
  const away = legacyStats(snapshot, 'away');
  const rows = [
    statCell('xG', home.expected_goals, away.expected_goals),
    statCell('Владение', home.ball_possession, away.ball_possession, { pct:true, digits:0 }),
    statCell('Удары', home.total_shots, away.total_shots, { digits:0 }),
    statCell('В створ', home.shots_on_target, away.shots_on_target, { digits:0 }),
  ].join('');
  const hasStats = [
    home.expected_goals,
    away.expected_goals,
    home.ball_possession,
    away.ball_possession,
    home.total_shots,
    away.total_shots,
    home.shots_on_target,
    away.shots_on_target,
  ].some(value => finite(value) !== null);

  const main = hasStats
    ? `<section class="mc-section cw233-r31-key"><div class="mc-section-head"><div class="mc-section-title">Ключевые показатели</div></div><div class="cw233-r31-stat-grid">${rows}</div></section>`
    : `<section class="mc-section cw233-r31-key"><div class="mc-section-head"><div class="mc-section-title">Ключевые показатели</div></div><div class="cw233-r31-empty">Статистика появится после начала матча</div></section>`;

  return `<div class="cw233-r31-overview" data-cw233-r31-overview>${main}${matchInfoHtml(snapshot)}</div>`;
}

export const ROUND31_CSS = `
/* Match Center owns the viewport even if the legacy root class is briefly rewritten. */
html.${OWNED_CLASS} #ciao-v232-matches-overlay{
  display:none!important;
  visibility:hidden!important;
  pointer-events:none!important;
}
#ciao-miniapp-root.match-center-open .content{
  overflow-anchor:none!important;
}
#ciao-miniapp-root.match-center-open [data-mc-tab-content]{
  min-height:220px;
  overflow-anchor:none!important;
}
#ciao-miniapp-root.match-center-open .cw233-r31-overview{
  display:grid;
  gap:12px;
}
#ciao-miniapp-root.match-center-open .cw233-r31-stat-grid{
  display:grid;
  grid-template-columns:repeat(2,minmax(0,1fr));
  gap:8px;
  padding:0 12px 12px;
}
#ciao-miniapp-root.match-center-open .cw233-r31-stat{
  min-width:0;
  padding:12px 10px;
  border:1px solid var(--cw233-mc-border)!important;
  border-radius:14px;
  background:var(--cw233-mc-surface)!important;
  text-align:center;
}
#ciao-miniapp-root.match-center-open .cw233-r31-stat>span,
#ciao-miniapp-root.match-center-open .cw233-r31-info-grid span{
  display:block;
  margin-bottom:7px;
  color:rgba(232,238,249,.58);
  font-size:8px;
  font-weight:800;
  letter-spacing:.04em;
  text-transform:uppercase;
}
#ciao-miniapp-root.match-center-open .cw233-r31-stat>b{
  display:grid;
  grid-template-columns:1fr auto 1fr;
  align-items:center;
  gap:7px;
  color:#fff;
}
#ciao-miniapp-root.match-center-open .cw233-r31-stat strong{
  font-size:14px;
  font-weight:900;
}
#ciao-miniapp-root.match-center-open .cw233-r31-stat i{
  color:rgba(232,238,249,.42);
  font-style:normal;
  font-weight:700;
}
#ciao-miniapp-root.match-center-open .cw233-r31-info-grid{
  display:grid;
  grid-template-columns:repeat(2,minmax(0,1fr));
  gap:8px;
  padding:0 12px 12px;
}
#ciao-miniapp-root.match-center-open .cw233-r31-info-grid>div{
  min-width:0;
  padding:12px 10px;
  border:1px solid var(--cw233-mc-border);
  border-radius:14px;
  background:var(--cw233-mc-surface);
}
#ciao-miniapp-root.match-center-open .cw233-r31-info-grid b{
  display:block;
  overflow:hidden;
  color:#f7f9ff;
  font-size:10px;
  line-height:1.35;
  text-overflow:ellipsis;
}
#ciao-miniapp-root.match-center-open .cw233-r31-empty{
  padding:20px 14px 22px;
  color:rgba(232,238,249,.58);
  font-size:10px;
  text-align:center;
}
@media(max-width:390px){
  #ciao-miniapp-root.match-center-open [data-mc-tab-content]{min-height:200px}
  #ciao-miniapp-root.match-center-open .cw233-r31-stat-grid{gap:7px;padding-left:10px;padding-right:10px}
  #ciao-miniapp-root.match-center-open .cw233-r31-info-grid{grid-template-columns:1fr;padding-left:10px;padding-right:10px}
}
`;

function ensureStyle(documentRef) {
  if (!documentRef?.head || !documentRef?.createElement || documentRef.getElementById?.(STYLE_ID)) return;
  const style = documentRef.createElement('style');
  style.id = STYLE_ID;
  style.textContent = ROUND31_CSS;
  documentRef.head.appendChild(style);
}

function activeOverview(root) {
  const selected = root?.querySelector?.('[data-mc-tab].active,[data-mc-tab][aria-selected="true"]');
  if (selected?.dataset?.mcTab) return selected.dataset.mcTab === 'overview';
  const host = root?.querySelector?.('[data-mc-tab-content]');
  return host?.dataset?.mcTabContent === 'overview';
}

function setOverviewTabState(root, button) {
  for (const node of root?.querySelectorAll?.('[data-mc-tab]') || []) {
    const active = node === button || node?.dataset?.mcTab === 'overview' && !button;
    node.classList?.toggle?.('active', active);
    node.setAttribute?.('aria-selected', active ? 'true' : 'false');
  }
}

function removeExternalSerieASurfaces(root) {
  for (const marker of root?.querySelectorAll?.('.cw14-form-card,.cw14-match-info') || []) {
    const section = marker.closest?.('.mc-section') || marker.closest?.('section');
    (section || marker).remove?.();
  }
  for (const section of root?.querySelectorAll?.('section') || []) {
    if (/Контекст\s+Серии\s*[АA]/i.test(String(section?.textContent || ''))) section.remove?.();
  }
}

export function installRound31MatchCenterStability(
  documentRef = globalThis.document,
  windowRef = globalThis,
) {
  if (!documentRef?.addEventListener || !documentRef?.getElementById) return null;
  ensureStyle(documentRef);

  const root = documentRef.getElementById('ciao-miniapp-root');
  if (!root) return null;
  const html = documentRef.documentElement;
  let activeExternal = null;
  let lastSnapshotSignature = '';
  let rendering = false;

  const claimViewport = () => {
    html?.classList?.add?.(OWNED_CLASS);
    const overlay = documentRef.getElementById('ciao-v232-matches-overlay');
    if (overlay && overlay.hidden !== true) overlay.hidden = true;
    if (overlay?.getAttribute?.('aria-hidden') !== 'true') overlay?.setAttribute?.('aria-hidden', 'true');
  };

  const releaseViewportIfClosed = () => {
    if (root.classList?.contains?.('match-center-open')) return;
    html?.classList?.remove?.(OWNED_CLASS);
    activeExternal = null;
  };

  const renderExternalOverview = () => {
    if (rendering || !activeExternal || !root.classList?.contains?.('match-center-open')) return;
    rendering = true;
    try {
      claimViewport();
      removeExternalSerieASurfaces(root);
      if (!activeOverview(root)) return;
      const host = root.querySelector?.('[data-mc-tab-content]');
      if (!host) return;
      const nextHtml = renderRound31ExternalOverview(activeExternal.data);
      host.dataset.mcTabContent = 'overview';
      if (host.innerHTML !== nextHtml) host.innerHTML = nextHtml;
    } finally {
      rendering = false;
    }
  };

  const onExternalOpen = event => {
    const detail = event?.detail || {};
    const competition = String(detail?.competition || '').trim().toLowerCase();
    if (!isRound31ExternalCompetition(competition) || !detail?.data) return;
    activeExternal = { competition, matchId:String(detail?.matchId || ''), data:detail.data };
    lastSnapshotSignature = externalMatchCenterSnapshotSignature(detail.data);
    claimViewport();
    setOverviewTabState(root, root.querySelector?.('[data-mc-tab="overview"]'));
    renderExternalOverview();
  };

  const onSerieAOpen = () => {
    activeExternal = null;
    lastSnapshotSignature = '';
    claimViewport();
  };

  const onClick = event => {
    const overview = event?.target?.closest?.('[data-mc-tab="overview"]');
    if (overview && activeExternal) {
      event.preventDefault?.();
      event.stopPropagation?.();
      event.stopImmediatePropagation?.();
      setOverviewTabState(root, overview);
      const host = root.querySelector?.('[data-mc-tab-content]');
      if (host) host.dataset.mcTabContent = 'overview';
      renderExternalOverview();
      return;
    }
    if (event?.target?.closest?.('.mc-back')) {
      const defer = windowRef.queueMicrotask || (fn => Promise.resolve().then(fn));
      defer(releaseViewportIfClosed);
    }
  };
  documentRef.addEventListener('click', onClick, true);

  windowRef.addEventListener?.(EXTERNAL_OPEN_EVENT, onExternalOpen);
  windowRef.addEventListener?.(SERIE_A_OPEN_EVENT, onSerieAOpen);

  const baseApi = windowRef.CiaoV233ExternalLegacyMatchCenter;
  if (baseApi?.refresh && !baseApi.__cw233Round31StableRefresh) {
    const wrappedRefresh = async context => {
      const next = await baseApi.refresh(context);
      if (!next) return next;
      const signature = externalMatchCenterSnapshotSignature(next);
      if (signature === lastSnapshotSignature) return null;
      lastSnapshotSignature = signature;
      if (activeExternal) activeExternal = { ...activeExternal, data:next };
      return next;
    };
    try {
      windowRef.CiaoV233ExternalLegacyMatchCenter = Object.freeze({
        ...baseApi,
        refresh:wrappedRefresh,
        __cw233Round31StableRefresh:true,
      });
    } catch {}
  }

  const MutationObserverCtor = windowRef.MutationObserver;
  const observer = typeof MutationObserverCtor === 'function'
    ? new MutationObserverCtor(() => {
        if (root.classList?.contains?.('match-center-open')) {
          claimViewport();
          if (activeExternal) renderExternalOverview();
        } else {
          releaseViewportIfClosed();
        }
      })
    : null;
  observer?.observe?.(root, { subtree:true, childList:true, attributes:true, attributeFilter:['class','hidden','aria-selected','data-mc-tab-content'] });
  const matchesOverlay = documentRef.getElementById('ciao-v232-matches-overlay');
  if (matchesOverlay) observer?.observe?.(matchesOverlay, { attributes:true, attributeFilter:['hidden','aria-hidden'] });

  return Object.freeze({
    disconnect(){
      observer?.disconnect?.();
      documentRef.removeEventListener?.('click', onClick, true);
      windowRef.removeEventListener?.(EXTERNAL_OPEN_EVENT, onExternalOpen);
      windowRef.removeEventListener?.(SERIE_A_OPEN_EVENT, onSerieAOpen);
      html?.classList?.remove?.(OWNED_CLASS);
    },
  });
}

if (typeof document !== 'undefined') installRound31MatchCenterStability(document, globalThis);
