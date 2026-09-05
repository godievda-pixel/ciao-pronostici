import { rememberMatchBootstrap } from './match-bootstrap-cache.mjs';

export const ROUND511_ACTIVE_MATCH_CENTER_STYLE_ID = 'ciao-v233-round51-1-active-match-center-ui';

export const ROUND511_ACTIVE_MATCH_CENTER_CSS = `
#ciao-v239-match-center-overlay .cw233-mc-form-run{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px}
#ciao-v239-match-center-overlay .cw233-mc-form-chip{min-width:0;width:100%;height:24px}
#ciao-v239-match-center-overlay .cw250-user-prediction{padding:15px;border-color:color-mix(in srgb,var(--mc-accent) 48%,var(--mc-border));background:linear-gradient(145deg,color-mix(in srgb,var(--mc-accent-soft) 52%,var(--mc-surface-raised)),var(--mc-surface));box-shadow:inset 0 1px 0 rgba(255,255,255,.07),0 10px 26px rgba(0,0,0,.16)}
#ciao-v239-match-center-overlay .cw250-user-prediction small{font-size:9px;letter-spacing:.06em}
#ciao-v239-match-center-overlay .cw250-user-prediction strong{font-size:12px}
#ciao-v239-match-center-overlay .cw250-user-prediction b{min-width:84px;padding:13px 12px;border-radius:15px;font-size:32px;line-height:1}
`;

function text(value) {
  return String(value ?? '').trim();
}

function attribute(node, name) {
  return text(node?.getAttribute?.(name));
}

function teamFromCard(card, side) {
  const root = `.cw232-match-team--${side}`;
  return {
    name:text(card?.querySelector?.(`${root} strong`)?.textContent),
    crestUrl:attribute(card?.querySelector?.(`${root} img`), 'src'),
  };
}

export function serieAMatchBootstrapFromCard(card) {
  const matchId = text(card?.dataset?.cw232Match);
  if (!matchId.startsWith('serie_a:')) return null;
  return {
    competition:'serie_a',
    matchId,
    kickoffAt:attribute(card?.querySelector?.('time[datetime]'), 'datetime'),
    status:text(card?.dataset?.cw232MatchState).toLowerCase(),
    homeTeam:teamFromCard(card, 'home'),
    awayTeam:teamFromCard(card, 'away'),
  };
}

export function rememberSerieAMatchCards(documentRef = globalThis.document) {
  if (!documentRef?.querySelectorAll) return 0;
  let count = 0;
  for (const card of documentRef.querySelectorAll('.cw232-competition[data-cw232-competition="serie_a"] [data-cw232-match]')) {
    const bootstrap = serieAMatchBootstrapFromCard(card);
    if (!bootstrap) continue;
    rememberMatchBootstrap(bootstrap);
    count += 1;
  }
  return count;
}

export function installRound511ActiveMatchCenterUi(documentRef = globalThis.document) {
  if (!documentRef?.createElement) return null;
  let style = documentRef.getElementById?.(ROUND511_ACTIVE_MATCH_CENTER_STYLE_ID) || null;
  if (!style) {
    style = documentRef.createElement('style');
    style.id = ROUND511_ACTIVE_MATCH_CENTER_STYLE_ID;
    style.textContent = ROUND511_ACTIVE_MATCH_CENTER_CSS;
    (documentRef.head || documentRef.documentElement || documentRef.body)?.appendChild?.(style);
  }

  const scan = () => rememberSerieAMatchCards(documentRef);
  scan();
  const Observer = documentRef.defaultView?.MutationObserver || globalThis.MutationObserver;
  const observer = typeof Observer === 'function' && documentRef.body
    ? new Observer(() => scan())
    : null;
  observer?.observe?.(documentRef.body, { childList:true, subtree:true });

  return Object.freeze({
    style,
    scan,
    disconnect() { observer?.disconnect?.(); },
  });
}

if (typeof document !== 'undefined') installRound511ActiveMatchCenterUi(document);
