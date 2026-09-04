export const USER_FEEDBACK_ROUND31_BUILD = '2026-09-04-r31';
export const USER_FEEDBACK_ROUND32_BUILD = '2026-09-04-r32';
export const USER_FEEDBACK_ROUND33_BUILD = '2026-09-04-r33';

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

function list(value) {
  return Array.isArray(value) ? value : [];
}

function record(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function numberText(value, { pct = false, digits = 2 } = {}) {
  const number = finite(value);
  if (number === null) return '—';
  const text = Number.isInteger(number)
    ? String(number)
    : number.toFixed(digits).replace(/0+$/, '').replace(/\.$/, '');
  return pct ? `${text}%` : text;
}

function integerLocaleText(value) {
  const number = finite(value);
  return number === null ? '' : Math.round(number).toLocaleString('ru-RU');
}

export function isRound31ExternalCompetition(value) {
  return EXTERNAL_COMPETITIONS.has(String(value || '').trim().toLowerCase());
}

function legacyStats(snapshot, side) {
  const value = snapshot?.stats?.stats?.[side];
  return value && typeof value === 'object' ? value : {};
}

function snapshotEvents(snapshot) {
  return list(snapshot?.incidents?.incidents);
}

function snapshotPlayers(snapshot) {
  return list(snapshot?.player_stats?.player_stats);
}

function normalizedForm(snapshot, side) {
  return list(snapshot?.form?.[side]).map(value => {
    const raw = typeof value === 'object'
      ? value?.result ?? value?.outcome ?? value?.status ?? value?.value ?? ''
      : value;
    const token = String(raw || '').trim().toUpperCase();
    if (/^(W|WIN|В)$/.test(token)) return 'В';
    if (/^(D|DRAW|Н)$/.test(token)) return 'Н';
    if (/^(L|LOSS|П)$/.test(token)) return 'П';
    return token.slice(0, 1) || '—';
  }).slice(0, 5);
}

function predictionScore(snapshot) {
  const model = record(snapshot?.prediction_model);
  const saved = record(snapshot?.match?.prediction);
  const sources = [model, saved];
  for (const source of sources) {
    const home = finite(source?.homeScore ?? source?.home_score ?? source?.home);
    const away = finite(source?.awayScore ?? source?.away_score ?? source?.away);
    if (home !== null && away !== null) return [home, away];
  }
  return null;
}

function predictionSplit(snapshot) {
  const split = record(snapshot?.prediction_split);
  const home = finite(split?.home ?? split?.homeWin ?? split?.home_win ?? split?.homePct ?? split?.home_pct);
  const draw = finite(split?.draw ?? split?.drawPct ?? split?.draw_pct);
  const away = finite(split?.away ?? split?.awayWin ?? split?.away_win ?? split?.awayPct ?? split?.away_pct);
  return home === null && draw === null && away === null ? null : { home, draw, away };
}

export function externalMatchCenterSnapshotSignature(snapshot = {}) {
  const match = record(snapshot?.match);
  const detail = record(snapshot?.detail);
  const home = legacyStats(snapshot, 'home');
  const away = legacyStats(snapshot, 'away');
  const incidents = snapshotEvents(snapshot);
  const players = snapshotPlayers(snapshot);
  const momentum = list(snapshot?.stats?.momentum);
  const shotmap = list(snapshot?.stats?.shotmap);
  const signature = {
    status:String(snapshot?.status || ''),
    id:String(snapshot?.match_id || match?.id || ''),
    score:[match?.home_score ?? null, match?.away_score ?? null],
    minute:match?.live_elapsed ?? detail?.current_minute ?? null,
    detail:[
      String(detail?.stadium || detail?.venue || '').trim(),
      String(detail?.city || '').trim(),
      detail?.stadium_capacity ?? null,
      String(detail?.referee || '').trim(),
    ],
    home:[home.expected_goals ?? null, home.ball_possession ?? null, home.total_shots ?? null, home.shots_on_target ?? null],
    away:[away.expected_goals ?? null, away.ball_possession ?? null, away.total_shots ?? null, away.shots_on_target ?? null],
    form:[normalizedForm(snapshot, 'home'), normalizedForm(snapshot, 'away')],
    prediction:[predictionScore(snapshot), predictionSplit(snapshot)],
    momentum:momentum.map(item => [item?.m ?? item?.minute ?? null, item?.v ?? null, item?.home ?? null, item?.away ?? null]),
    shotmap:shotmap.map(item => [item?.pos?.x ?? item?.x ?? null, item?.pos?.y ?? item?.y ?? null, item?.home ?? null, item?.xg ?? null, item?.min ?? item?.minute ?? null, item?.type ?? '']),
    incidents:incidents.map(item => [item?.type ?? '', item?.minute ?? null, item?.home_score ?? null, item?.away_score ?? null]),
    players:players.map(item => [item?.player_id ?? null, item?.rating ?? null, item?.goals ?? null, item?.goal_assist ?? null]),
    lineupStatus:String(snapshot?.lineups?.lineup_status || ''),
  };
  return JSON.stringify(signature);
}

function statCell(label, home, away, options) {
  return `<div class="cw233-r31-stat"><span>${esc(label)}</span><b><strong>${esc(numberText(home, options))}</strong><i>—</i><strong>${esc(numberText(away, options))}</strong></b></div>`;
}

function keyStatsHtml(snapshot) {
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

  return hasStats
    ? `<section class="mc-section cw233-r31-key"><div class="mc-section-head"><div class="mc-section-title">Ключевые показатели</div></div><div class="cw233-r31-stat-grid">${rows}</div></section>`
    : `<section class="mc-section cw233-r31-key"><div class="mc-section-head"><div class="mc-section-title">Ключевые показатели</div></div><div class="cw233-r31-empty">Статистика появится после начала матча</div></section>`;
}

function formRowHtml(label, values) {
  if (!values.length) return '';
  return `<div class="cw233-r31-form-row"><span>${esc(label)}</span><div>${values.map(value => `<i class="cw233-r31-form-${value === 'В' ? 'win' : value === 'Н' ? 'draw' : value === 'П' ? 'loss' : 'other'}">${esc(value)}</i>`).join('')}</div></div>`;
}

function formHtml(snapshot) {
  const home = normalizedForm(snapshot, 'home');
  const away = normalizedForm(snapshot, 'away');
  if (!home.length && !away.length) return '';
  const match = record(snapshot?.match);
  const homeName = String(match?.home?.name || 'Хозяева');
  const awayName = String(match?.away?.name || 'Гости');
  return `<section class="mc-section cw233-r31-form"><div class="mc-section-head"><div class="mc-section-title">Форма</div></div><div class="cw233-r31-form-grid">${formRowHtml(homeName, home)}${formRowHtml(awayName, away)}</div></section>`;
}

function matchInfoHtml(snapshot) {
  const detail = record(snapshot?.detail);
  const stadium = String(detail?.stadium || detail?.venue || '').trim();
  const city = String(detail?.city || '').trim();
  const referee = String(detail?.referee || '').trim();
  const capacity = integerLocaleText(detail?.stadium_capacity);
  if (!stadium && !city && !referee && !capacity) return '';
  const venue = [stadium, city && !stadium.includes(city) ? city : ''].filter(Boolean).join(' · ');
  return `<section class="mc-section cw233-r31-info"><div class="mc-section-head"><div class="mc-section-title">Информация о матче</div></div><div class="cw233-r31-info-grid">${venue ? `<div><span>Стадион</span><b>${esc(venue)}</b></div>` : ''}${capacity ? `<div><span>Вместимость</span><b>${esc(capacity)}</b></div>` : ''}${referee ? `<div><span>Судья</span><b>${esc(referee)}</b></div>` : ''}</div></section>`;
}

function predictionsHtml(snapshot) {
  const score = predictionScore(snapshot);
  const split = predictionSplit(snapshot);
  if (!score && !split) return '';
  const splitHtml = split
    ? `<div class="cw233-r31-prediction-split"><div><span>П1</span><b>${esc(numberText(split.home, { pct:true, digits:0 }))}</b></div><div><span>Х</span><b>${esc(numberText(split.draw, { pct:true, digits:0 }))}</b></div><div><span>П2</span><b>${esc(numberText(split.away, { pct:true, digits:0 }))}</b></div></div>`
    : '';
  const scoreHtml = score
    ? `<div class="cw233-r31-prediction-score"><span>Прогноз счёта</span><b>${esc(numberText(score[0], { digits:0 }))} <i>:</i> ${esc(numberText(score[1], { digits:0 }))}</b></div>`
    : '';
  return `<section class="mc-section cw233-r31-predictions"><div class="mc-section-head"><div class="mc-section-title">Прогнозы</div></div><div class="cw233-r31-predictions-body">${scoreHtml}${splitHtml}</div></section>`;
}

function momentumHtml(snapshot) {
  const points = list(snapshot?.stats?.momentum).map(item => ({
    minute:finite(item?.m ?? item?.minute),
    value:finite(item?.v),
  })).filter(item => item.minute !== null && item.value !== null);
  if (!points.length) return '';
  const max = Math.max(1, ...points.map(item => Math.abs(item.value)));
  const bars = points.map(item => {
    const width = Math.max(4, Math.min(100, Math.round(Math.abs(item.value) / max * 100)));
    const side = item.value >= 0 ? 'home' : 'away';
    return `<div class="cw233-r31-pressure-point" data-side="${side}"><span>${esc(numberText(item.minute, { digits:0 }))}′</span><div><i style="width:${width}%"></i></div></div>`;
  }).join('');
  return `<section class="mc-section cw233-r31-pressure"><div class="mc-section-head"><div class="mc-section-title">Давление</div></div><div class="cw233-r31-pressure-grid">${bars}</div></section>`;
}

function shotmapHtml(snapshot) {
  const shots = list(snapshot?.stats?.shotmap).map(item => {
    const x = finite(item?.pos?.x ?? item?.x);
    const y = finite(item?.pos?.y ?? item?.y);
    if (x === null || y === null) return null;
    return {
      x:Math.max(2, Math.min(98, x)),
      y:Math.max(2, Math.min(98, y)),
      home:item?.home !== false,
      xg:finite(item?.xg),
      minute:finite(item?.min ?? item?.minute),
    };
  }).filter(Boolean);
  if (!shots.length) return '';
  const dots = shots.map(item => {
    const title = [item.minute !== null ? `${numberText(item.minute, { digits:0 })}′` : '', item.xg !== null ? `xG ${numberText(item.xg)}` : ''].filter(Boolean).join(' · ');
    return `<i class="cw233-r31-shot ${item.home ? 'is-home' : 'is-away'}" style="left:${item.x}%;top:${100 - item.y}%"${title ? ` title="${esc(title)}"` : ''}></i>`;
  }).join('');
  return `<section class="mc-section cw233-r31-shotmap"><div class="mc-section-head"><div class="mc-section-title">Карта ударов</div></div><div class="cw233-r31-pitch" data-cw233-r31-shotmap>${dots}<span class="cw233-r31-pitch-mid"></span></div></section>`;
}

export function renderRound31ExternalOverview(snapshot = {}) {
  return `<div class="cw233-r31-overview" data-cw233-r31-overview>${keyStatsHtml(snapshot)}${formHtml(snapshot)}${matchInfoHtml(snapshot)}${predictionsHtml(snapshot)}${momentumHtml(snapshot)}${shotmapHtml(snapshot)}</div>`;
}

export const ROUND31_CSS = `
/* Match Center owns only the visual viewport. Overlay hidden/aria state stays with the legacy lifecycle. */
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
#ciao-miniapp-root.match-center-open .cw233-r31-info-grid span,
#ciao-miniapp-root.match-center-open .cw233-r31-prediction-score>span,
#ciao-miniapp-root.match-center-open .cw233-r31-prediction-split span{
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
#ciao-miniapp-root.match-center-open .cw233-r31-stat i,
#ciao-miniapp-root.match-center-open .cw233-r31-prediction-score i{
  color:rgba(232,238,249,.42);
  font-style:normal;
  font-weight:700;
}
#ciao-miniapp-root.match-center-open .cw233-r31-form-grid,
#ciao-miniapp-root.match-center-open .cw233-r31-predictions-body,
#ciao-miniapp-root.match-center-open .cw233-r31-pressure-grid{
  display:grid;
  gap:8px;
  padding:0 12px 12px;
}
#ciao-miniapp-root.match-center-open .cw233-r31-form-row{
  display:grid;
  grid-template-columns:minmax(90px,1fr) auto;
  gap:10px;
  align-items:center;
  padding:11px 12px;
  border:1px solid var(--cw233-mc-border);
  border-radius:14px;
  background:linear-gradient(145deg,color-mix(in srgb,var(--cw233-mc-accent) 9%,var(--cw233-mc-surface)),var(--cw233-mc-surface));
}
#ciao-miniapp-root.match-center-open .cw233-r31-form-row>span{
  min-width:0;
  overflow:hidden;
  color:#f7f9ff;
  font-size:10px;
  font-weight:800;
  text-overflow:ellipsis;
  white-space:nowrap;
}
#ciao-miniapp-root.match-center-open .cw233-r31-form-row>div{
  display:flex;
  gap:5px;
}
#ciao-miniapp-root.match-center-open .cw233-r31-form-row i{
  display:grid;
  place-items:center;
  width:24px;
  height:24px;
  border-radius:8px;
  color:#fff;
  font-size:9px;
  font-style:normal;
  font-weight:900;
}
#ciao-miniapp-root.match-center-open .cw233-r31-form-win{background:color-mix(in srgb,#32c878 72%,var(--cw233-mc-bg))}
#ciao-miniapp-root.match-center-open .cw233-r31-form-draw{background:rgba(148,163,184,.38)}
#ciao-miniapp-root.match-center-open .cw233-r31-form-loss{background:rgba(220,70,80,.58)}
#ciao-miniapp-root.match-center-open .cw233-r31-form-other{background:color-mix(in srgb,var(--cw233-mc-accent) 48%,var(--cw233-mc-bg))}
#ciao-miniapp-root.match-center-open .cw233-r31-info-grid{
  display:grid;
  grid-template-columns:repeat(2,minmax(0,1fr));
  gap:8px;
  padding:0 12px 12px;
}
#ciao-miniapp-root.match-center-open .cw233-r31-info-grid>div,
#ciao-miniapp-root.match-center-open .cw233-r31-prediction-score,
#ciao-miniapp-root.match-center-open .cw233-r31-prediction-split>div{
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
#ciao-miniapp-root.match-center-open .cw233-r31-prediction-score{
  text-align:center;
}
#ciao-miniapp-root.match-center-open .cw233-r31-prediction-score b{
  color:#fff;
  font-size:24px;
  font-weight:950;
  letter-spacing:.03em;
}
#ciao-miniapp-root.match-center-open .cw233-r31-prediction-split{
  display:grid;
  grid-template-columns:repeat(3,minmax(0,1fr));
  gap:7px;
}
#ciao-miniapp-root.match-center-open .cw233-r31-prediction-split>div{
  padding:10px 8px;
  text-align:center;
}
#ciao-miniapp-root.match-center-open .cw233-r31-prediction-split b{
  color:#fff;
  font-size:12px;
  font-weight:900;
}
#ciao-miniapp-root.match-center-open .cw233-r31-pressure-point{
  display:grid;
  grid-template-columns:30px minmax(0,1fr);
  gap:8px;
  align-items:center;
}
#ciao-miniapp-root.match-center-open .cw233-r31-pressure-point>span{
  color:rgba(232,238,249,.58);
  font-size:8px;
  font-weight:800;
  text-align:right;
}
#ciao-miniapp-root.match-center-open .cw233-r31-pressure-point>div{
  position:relative;
  height:7px;
  overflow:hidden;
  border-radius:999px;
  background:rgba(255,255,255,.055);
}
#ciao-miniapp-root.match-center-open .cw233-r31-pressure-point i{
  position:absolute;
  top:0;
  bottom:0;
  border-radius:999px;
  background:linear-gradient(90deg,var(--cw233-mc-accent),var(--cw233-mc-accent-2));
}
#ciao-miniapp-root.match-center-open .cw233-r31-pressure-point[data-side="home"] i{left:0}
#ciao-miniapp-root.match-center-open .cw233-r31-pressure-point[data-side="away"] i{right:0;filter:saturate(.7) brightness(.8)}
#ciao-miniapp-root.match-center-open .cw233-r31-pitch{
  position:relative;
  height:170px;
  margin:0 12px 12px;
  overflow:hidden;
  border:1px solid var(--cw233-mc-border);
  border-radius:16px;
  background:
    linear-gradient(90deg,transparent 49.7%,rgba(255,255,255,.13) 49.8%,rgba(255,255,255,.13) 50.2%,transparent 50.3%),
    linear-gradient(180deg,color-mix(in srgb,var(--cw233-mc-accent) 12%,var(--cw233-mc-surface)),var(--cw233-mc-surface));
}
#ciao-miniapp-root.match-center-open .cw233-r31-pitch:before,
#ciao-miniapp-root.match-center-open .cw233-r31-pitch:after{
  content:"";
  position:absolute;
  top:25%;
  bottom:25%;
  width:16%;
  border:1px solid rgba(255,255,255,.12);
}
#ciao-miniapp-root.match-center-open .cw233-r31-pitch:before{left:-1px;border-left:0}
#ciao-miniapp-root.match-center-open .cw233-r31-pitch:after{right:-1px;border-right:0}
#ciao-miniapp-root.match-center-open .cw233-r31-shot{
  position:absolute;
  z-index:2;
  width:10px;
  height:10px;
  transform:translate(-50%,-50%);
  border:2px solid rgba(255,255,255,.74);
  border-radius:50%;
  box-shadow:0 0 0 3px rgba(0,0,0,.14);
}
#ciao-miniapp-root.match-center-open .cw233-r31-shot.is-home{background:var(--cw233-mc-accent)}
#ciao-miniapp-root.match-center-open .cw233-r31-shot.is-away{background:var(--cw233-mc-accent-2)}
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
  #ciao-miniapp-root.match-center-open .cw233-r31-form-grid,
  #ciao-miniapp-root.match-center-open .cw233-r31-predictions-body,
  #ciao-miniapp-root.match-center-open .cw233-r31-pressure-grid{padding-left:10px;padding-right:10px}
  #ciao-miniapp-root.match-center-open .cw233-r31-pitch{margin-left:10px;margin-right:10px}
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

function removeExternalSerieAContext(root) {
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

  const syncViewportOwnership = () => {
    const open = !!root.classList?.contains?.('match-center-open');
    if (open) {
      html?.classList?.add?.(OWNED_CLASS);
      return true;
    }
    html?.classList?.remove?.(OWNED_CLASS);
    activeExternal = null;
    lastSnapshotSignature = '';
    return false;
  };

  const afterLegacyOpen = callback => {
    const defer = windowRef.queueMicrotask || (fn => Promise.resolve().then(fn));
    defer(callback);
  };

  const afterLegacyRefresh = callback => {
    const defer = windowRef.setTimeout || globalThis.setTimeout;
    defer(callback, 0);
  };

  const renderExternalOverview = () => {
    if (rendering || !activeExternal || !root.classList?.contains?.('match-center-open')) return;
    rendering = true;
    try {
      removeExternalSerieAContext(root);
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
    afterLegacyOpen(() => {
      if (!syncViewportOwnership() || !activeExternal) return;
      setOverviewTabState(root, root.querySelector?.('[data-mc-tab="overview"]'));
      renderExternalOverview();
    });
  };

  const onSerieAOpen = () => {
    activeExternal = null;
    lastSnapshotSignature = '';
    afterLegacyOpen(syncViewportOwnership);
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
    if (event?.target?.closest?.('.mc-back')) afterLegacyOpen(syncViewportOwnership);
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
      if (activeExternal) afterLegacyRefresh(renderExternalOverview);
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
        const open = syncViewportOwnership();
        if (open && activeExternal) {
          setOverviewTabState(root, root.querySelector?.('[data-mc-tab="overview"]'));
          renderExternalOverview();
        }
      })
    : null;
  observer?.observe?.(root, { attributes:true, attributeFilter:['class'] });
  syncViewportOwnership();

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
