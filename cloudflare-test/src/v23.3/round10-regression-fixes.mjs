import { normalizeTeamAlias, russianTeamName } from '../v23.2/team-registry.mjs';

export const USER_FEEDBACK_ROUND10_BUILD = '2026-09-03-r10';

const STYLE_ID = 'ciao-v233-round10-regression-style';
let observer = null;
let queued = false;

const CSS = `
/* UEFA league-stage navigation: every round is visible at once on mobile. */
#ciao-v232-matches-overlay .cw232-competition[data-cw232-theme='champions'] .cw232-group-tabs,
#ciao-v232-matches-overlay .cw232-competition[data-cw232-theme='europa'] .cw232-group-tabs{
  display:grid!important;grid-template-columns:repeat(8,minmax(0,1fr))!important;gap:6px!important;
  width:100%!important;max-width:100%!important;overflow-x:hidden!important;padding:3px 0 16px!important
}
#ciao-v232-matches-overlay .cw232-competition[data-cw232-theme='conference'] .cw232-group-tabs{
  display:grid!important;grid-template-columns:repeat(6,minmax(0,1fr))!important;gap:7px!important;
  width:100%!important;max-width:100%!important;overflow-x:hidden!important;padding:3px 0 16px!important
}
#ciao-v232-matches-overlay .cw232-competition[data-cw232-theme='champions'] .cw232-group-tabs button,
#ciao-v232-matches-overlay .cw232-competition[data-cw232-theme='europa'] .cw232-group-tabs button,
#ciao-v232-matches-overlay .cw232-competition[data-cw232-theme='conference'] .cw232-group-tabs button{
  min-width:0!important;width:100%!important;padding:0!important;margin:0!important;height:44px!important;min-height:44px!important;border-radius:13px!important
}
@media(max-width:390px){
  #ciao-v232-matches-overlay .cw232-competition[data-cw232-theme='champions'] .cw232-group-tabs,
  #ciao-v232-matches-overlay .cw232-competition[data-cw232-theme='europa'] .cw232-group-tabs{gap:4px!important}
  #ciao-v232-matches-overlay .cw232-competition[data-cw232-theme='champions'] .cw232-group-tabs button,
  #ciao-v232-matches-overlay .cw232-competition[data-cw232-theme='europa'] .cw232-group-tabs button{height:41px!important;min-height:41px!important;font-size:10px!important}
}

/* Full-screen premium tournament ambience, not only the match cards. */
#ciao-v232-matches-overlay{background:#07101f!important;transition:background .18s ease}
#ciao-v232-matches-overlay[data-cw233-round10-theme='serie-a']{
  background:radial-gradient(circle at 78% 6%,rgba(49,91,255,.28),transparent 36%),radial-gradient(circle at 8% 74%,rgba(17,66,158,.22),transparent 42%),linear-gradient(165deg,#081632 0%,#061027 46%,#050b1b 100%)!important
}
#ciao-v232-matches-overlay[data-cw233-round10-theme='coppa']{
  background:radial-gradient(circle at 86% 7%,rgba(202,45,58,.21),transparent 34%),radial-gradient(circle at 4% 68%,rgba(0,143,72,.18),transparent 40%),linear-gradient(165deg,#171218 0%,#0d1215 48%,#07100d 100%)!important
}
#ciao-v232-matches-overlay[data-cw233-round10-theme='champions']{
  background:radial-gradient(circle at 82% 5%,rgba(83,100,255,.30),transparent 36%),radial-gradient(circle at 6% 70%,rgba(44,31,141,.22),transparent 42%),linear-gradient(165deg,#0b1236 0%,#070d27 48%,#040817 100%)!important
}
#ciao-v232-matches-overlay[data-cw233-round10-theme='europa']{
  background:radial-gradient(circle at 84% 7%,rgba(255,119,0,.25),transparent 35%),radial-gradient(circle at 4% 72%,rgba(129,48,0,.22),transparent 42%),linear-gradient(165deg,#201207 0%,#120d09 48%,#090909 100%)!important
}
#ciao-v232-matches-overlay[data-cw233-round10-theme='conference']{
  background:radial-gradient(circle at 84% 7%,rgba(33,199,112,.24),transparent 35%),radial-gradient(circle at 5% 73%,rgba(8,103,57,.22),transparent 42%),linear-gradient(165deg,#081d14 0%,#07140f 48%,#050c09 100%)!important
}
html.cw233-serie-a-active #ciao-miniapp-root .content{
  background:radial-gradient(circle at 86% 4%,rgba(49,91,255,.25),transparent 35%),radial-gradient(circle at 4% 72%,rgba(16,68,164,.20),transparent 42%),linear-gradient(165deg,#081632 0%,#061027 48%,#050b1b 100%)!important
}

/* Favorite club next match: keep the compact useful card and make it feel intentional. */
#ciao-miniapp-root .cw211-favorite-body{grid-template-columns:minmax(0,1fr) minmax(0,1.16fr)!important;gap:10px!important}
#ciao-miniapp-root .cw211-favorite-body .cw231-favorite-shell,
#ciao-miniapp-root .cw211-favorite-body [data-cw233-favorite-next]{display:flex!important;position:relative;min-height:84px!important;flex-direction:column;justify-content:center;align-items:stretch;padding:12px 14px!important;cursor:pointer;overflow:hidden}
#ciao-miniapp-root [data-cw233-favorite-next] small{display:block;margin:0 0 7px;color:#849ee8;font-size:8px;font-weight:850;letter-spacing:.08em;text-transform:uppercase}
#ciao-miniapp-root .cw233-favorite-opponent{display:grid;grid-template-columns:28px minmax(0,1fr) 18px;gap:8px;align-items:center;min-width:0}
#ciao-miniapp-root .cw233-favorite-opponent img{width:28px!important;height:28px!important;object-fit:contain;filter:drop-shadow(0 4px 8px rgba(0,0,0,.2))}
#ciao-miniapp-root .cw233-favorite-opponent-logo--empty{width:28px;height:28px;border-radius:50%;background:rgba(111,139,219,.14)}
#ciao-miniapp-root .cw233-favorite-opponent strong{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:12px;font-weight:900;color:#fff}
#ciao-miniapp-root .cw233-favorite-next-arrow{font-size:16px;color:#fff;text-align:right}
#ciao-miniapp-root .cw233-favorite-next-time{display:block;margin-top:5px;padding-left:36px;color:#829be2;font-size:9px;font-weight:700;font-variant-numeric:tabular-nums}
@media(max-width:390px){#ciao-miniapp-root .cw211-favorite-body{grid-template-columns:minmax(0,1fr) minmax(0,1.08fr)!important}}

/* Predictions: the date/stage title is enough; remove noisy “1 матч. / 3 матч.” captions. */
#ciao-miniapp-root .cw231-prediction-tabs~.section-title>span{display:none!important}
#ciao-miniapp-root .cw231-prediction-tabs~.section-title{justify-content:flex-start!important}

/* Tables remain premium and tournament-aware while real crests are now supplied server-side. */
#ciao-v233-tables-overlay .cw233-tables-hub{--r10a:#315bff;--r10b:#183bd8;--r10soft:rgba(49,91,255,.15);--r10line:rgba(103,142,255,.30);--r10glow:rgba(45,79,228,.22)}
#ciao-v233-tables-overlay .cw233-tables-hub[data-cw233-theme='coppa']{--r10a:#e53b49;--r10b:#087e46;--r10soft:rgba(229,59,73,.13);--r10line:rgba(236,92,104,.27);--r10glow:rgba(203,51,65,.18)}
#ciao-v233-tables-overlay .cw233-tables-hub[data-cw233-theme='champions']{--r10a:#4b63ff;--r10b:#222b9d;--r10soft:rgba(75,99,255,.15);--r10line:rgba(112,130,255,.29);--r10glow:rgba(67,82,220,.22)}
#ciao-v233-tables-overlay .cw233-tables-hub[data-cw233-theme='europa']{--r10a:#ff790d;--r10b:#b84000;--r10soft:rgba(255,121,13,.13);--r10line:rgba(255,145,58,.28);--r10glow:rgba(222,93,0,.19)}
#ciao-v233-tables-overlay .cw233-tables-hub[data-cw233-theme='conference']{--r10a:#22c875;--r10b:#087b46;--r10soft:rgba(34,200,117,.13);--r10line:rgba(73,218,141,.27);--r10glow:rgba(17,157,87,.19)}
#ciao-v233-tables-overlay .cw233-tables-head{border-color:var(--r10line)!important;background:radial-gradient(circle at 92% 5%,var(--r10soft),transparent 43%),linear-gradient(145deg,rgba(20,36,78,.88),rgba(8,18,40,.93))!important;box-shadow:0 14px 34px rgba(0,0,0,.17),inset 0 1px 0 rgba(255,255,255,.045)!important}
#ciao-v233-tables-overlay .cw233-table-selector.is-active{background:linear-gradient(145deg,var(--r10a),var(--r10b))!important;box-shadow:0 8px 22px var(--r10glow),inset 0 1px 0 rgba(255,255,255,.18)!important}
#ciao-v233-tables-overlay .cw233-standing-table tbody td{border-top-color:var(--r10line)!important;border-bottom-color:var(--r10line)!important;background:radial-gradient(circle at 0 50%,var(--r10soft),transparent 35%),linear-gradient(180deg,rgba(20,34,61,.985),rgba(12,23,43,.985))!important}
#ciao-v233-tables-overlay .cw233-standing-table tbody td:first-child{border-left-color:var(--r10line)!important;box-shadow:inset 3px 0 0 var(--r10a)!important}
`;

function clean(value) { return String(value ?? '').trim(); }
function canonical(value) {
  const raw = clean(value);
  return raw ? normalizeTeamAlias(russianTeamName(raw)) : '';
}
function crest(team = {}) {
  return clean(team?.crestUrl || team?.logo_url || team?.logoUrl || team?.logo || team?.crest_url || team?.team_logo || team?.team_logo_url);
}
function installStyles(documentRef) {
  if (documentRef.getElementById?.(STYLE_ID)) return;
  const style = documentRef.createElement?.('style');
  if (!style) return;
  style.id = STYLE_ID;
  style.textContent = CSS;
  documentRef.head?.appendChild?.(style);
}

function syncMatchesTheme(documentRef = globalThis.document) {
  const overlay = documentRef?.getElementById?.('ciao-v232-matches-overlay');
  if (!overlay) return '';
  const competition = overlay.querySelector?.('.cw232-competition[data-cw232-theme]');
  const theme = clean(competition?.dataset?.cw232Theme);
  if (theme) {
    if (overlay.dataset?.cw233Round10Theme !== theme) overlay.dataset.cw233Round10Theme = theme;
  } else if (overlay.dataset?.cw233Round10Theme) {
    delete overlay.dataset.cw233Round10Theme;
  }
  return theme;
}

function formatKickoff(value) {
  const date = new Date(value || '');
  if (Number.isNaN(date.getTime())) return 'Время уточняется';
  return new Intl.DateTimeFormat('ru-RU', {
    day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit',
  }).format(date).replace(',', ' ·');
}

function teamOutsideCardName(favorite, card, match) {
  const homeName = clean(match?.homeTeam?.name);
  const awayName = clean(match?.awayTeam?.name);
  const homeKey = canonical(homeName);
  const awayKey = canonical(awayName);
  for (const node of favorite?.querySelectorAll?.('h1,h2,h3,h4,strong,b,[class*="club"],[class*="team"]') || []) {
    if (card?.contains?.(node)) continue;
    const key = canonical(node.textContent);
    if (key && homeKey && (key === homeKey || key.includes(homeKey))) return 'home';
    if (key && awayKey && (key === awayKey || key.includes(awayKey))) return 'away';
  }
  return '';
}

export function decorateFavoriteNext(documentRef = globalThis.document) {
  const favorite = documentRef?.querySelector?.('.cw18-favorite-home,.cw2017-favorite-reminder');
  if (!favorite) return false;
  const card = [...(favorite.querySelectorAll?.('.cw211-favorite-body .cw211-info-card') || [])]
    .find(node => node.classList?.contains?.('cw231-favorite-shell') || /Ближайший матч/i.test(clean(node.querySelector?.('small')?.textContent)));
  if (!card) return false;

  const state = globalThis.CiaoV233Home?.state?.() || null;
  if (!state?.hydrated) return false;
  const currentId = clean(card.dataset?.cw231Match || card.dataset?.cw233Match);
  let match = (Array.isArray(state?.matches) ? state.matches : []).find(item => clean(item?.matchId) === currentId) || null;
  if (!match) {
    const now = Date.now() - 120000;
    const candidates = (Array.isArray(state?.matches) ? state.matches : [])
      .filter(item => item?.competition === 'serie_a' && Date.parse(item?.kickoffAt || '') >= now)
      .sort((a,b) => Date.parse(a.kickoffAt) - Date.parse(b.kickoffAt));
    match = candidates.find(item => {
      const home = canonical(item?.homeTeam?.name);
      const away = canonical(item?.awayTeam?.name);
      const outside = clean(favorite.textContent).toLowerCase();
      return (home && outside.includes(clean(item?.homeTeam?.name).toLowerCase())) || (away && outside.includes(clean(item?.awayTeam?.name).toLowerCase()));
    }) || null;
  }
  if (!match?.matchId) return false;

  const favoriteSide = teamOutsideCardName(favorite, card, match);
  const opponent = favoriteSide === 'away' ? match.homeTeam : favoriteSide === 'home' ? match.awayTeam : match.awayTeam;
  const logo = crest(opponent);
  const marker = clean(match.matchId);
  if (card.dataset?.cw233FavoriteNext === marker && card.querySelector?.('.cw233-favorite-opponent')) return true;

  card.classList?.add?.('cw231-favorite-shell','cw231-favorite-source-link');
  card.dataset.cw233FavoriteNext = marker;
  card.dataset.cw233Competition = clean(match.competition || 'serie_a');
  card.dataset.cw233Match = marker;
  card.dataset.cw231Match = marker;
  card.setAttribute?.('role','button');
  card.setAttribute?.('tabindex','0');
  card.setAttribute?.('aria-label',`Открыть ближайший матч с ${clean(opponent?.name || 'соперником')}`);
  card.innerHTML = `<small>Ближайший матч</small><div class="cw233-favorite-opponent">${logo ? `<img src="${logo.replace(/&/g,'&amp;').replace(/"/g,'&quot;')}" alt="" width="28" height="28">` : '<span class="cw233-favorite-opponent-logo--empty" aria-hidden="true"></span>'}<strong>${clean(opponent?.name || '—')}</strong><span class="cw233-favorite-next-arrow" aria-hidden="true">→</span></div><time class="cw233-favorite-next-time" datetime="${clean(match.kickoffAt)}">${formatKickoff(match.kickoffAt)}</time>`;
  return true;
}

function apply(documentRef = globalThis.document) {
  syncMatchesTheme(documentRef);
  decorateFavoriteNext(documentRef);
}
function queueApply(documentRef) {
  if (queued) return;
  queued = true;
  const run = () => { queued = false; apply(documentRef); };
  if (typeof globalThis.requestAnimationFrame === 'function') globalThis.requestAnimationFrame(run);
  else setTimeout(run, 0);
}

export function installRound10RegressionFixes(documentRef = globalThis.document) {
  if (!documentRef?.createElement || !documentRef?.addEventListener) return null;
  installStyles(documentRef);
  apply(documentRef);
  globalThis.addEventListener?.('ciao-v233-home-updated', () => queueApply(documentRef));
  if (!observer && typeof MutationObserver === 'function') {
    observer = new MutationObserver(() => queueApply(documentRef));
    observer.observe(documentRef.documentElement || documentRef.body, {
      childList:true, subtree:true, attributes:true,
      attributeFilter:['hidden','data-cw232-theme','data-cw233-tables-selected'],
    });
  }
  return Object.freeze({ apply:() => apply(documentRef), disconnect:() => observer?.disconnect?.() });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => installRound10RegressionFixes(document), { once:true });
  else installRound10RegressionFixes(document);
}
