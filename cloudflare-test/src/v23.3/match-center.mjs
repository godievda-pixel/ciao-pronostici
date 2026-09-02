import { getCompetitionConfig } from '../v23.2/competition-config.mjs';
import { loadMatchCenterSnapshot } from './data-client.mjs';

const OVERLAY_ID = 'ciao-v233-match-center-overlay';
const STYLE_ID = 'ciao-v233-match-center-style';
const POLL_MS = 15_000;

let installedApi = null;

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function hasNumber(value) {
  return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
}

function scoreText(match) {
  if (!hasNumber(match?.homeScore) || !hasNumber(match?.awayScore)) return '—';
  return `${Number(match.homeScore)}:${Number(match.awayScore)}`;
}

function kickoffText(value, timeZone) {
  const time = Date.parse(value || '');
  if (!Number.isFinite(time)) return 'Время уточняется';
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    ...(timeZone ? { timeZone } : {}),
  }).format(new Date(time));
}

function statusText(match) {
  const status = String(match?.status || '').toLowerCase();
  if (status === 'live') {
    return hasNumber(match?.minute) ? `LIVE · ${Number(match.minute)}′` : 'LIVE';
  }
  if (status === 'finished') return 'Матч завершён';
  if (status === 'postponed') return 'Матч перенесён';
  if (status === 'cancelled') return 'Матч отменён';
  return 'Предстоящий матч';
}

function crest(team) {
  const src = String(team?.crestUrl || '').trim();
  if (!src) return '<span class="cw233-mc-logo cw233-mc-logo--empty" aria-hidden="true"></span>';
  return `<img class="cw233-mc-logo" src="${esc(src)}" alt="" width="58" height="58" loading="eager" decoding="async">`;
}

export function renderMatchCenter(state = {}) {
  const match = state?.match || null;
  const competition = String(match?.competition || state?.competition || '');
  let title = 'Матч-центр';
  try {
    if (competition) title = getCompetitionConfig(competition).title;
  } catch {}

  const error = String(state?.error || '').trim();
  const errorHtml = error
    ? `<div class="cw233-mc-notice">Не удалось обновить данные. Последний полученный результат сохранён.<button type="button" data-cw233-mc-action="retry">Повторить</button></div>`
    : '';

  if (!match) {
    return `<section class="cw233-mc-shell" data-cw233-mc-view>
      <header class="cw233-mc-toolbar"><button type="button" data-cw233-mc-action="close" aria-label="Закрыть">←</button><strong>Матч-центр</strong></header>
      <div class="cw233-mc-loading">Загружаем матч…</div>${errorHtml}
    </section>`;
  }

  const status = String(match?.status || '').toLowerCase();
  const showScore = status === 'live' || status === 'finished';
  return `<section class="cw233-mc-shell" data-cw233-mc-view data-cw233-competition="${esc(competition)}" data-cw233-match="${esc(match?.matchId || state?.matchId || '')}">
    <header class="cw233-mc-toolbar"><button type="button" data-cw233-mc-action="close" aria-label="Закрыть">←</button><strong>Матч-центр</strong></header>
    <div class="cw233-mc-competition">${esc(title)}</div>
    <time class="cw233-mc-kickoff" datetime="${esc(match?.kickoffAt || '')}">${esc(kickoffText(match?.kickoffAt, state?.timeZone))}</time>
    <div class="cw233-mc-board">
      <div class="cw233-mc-team">${crest(match?.homeTeam)}<b>${esc(match?.homeTeam?.name || '—')}</b></div>
      <div class="cw233-mc-center"><strong>${showScore ? esc(scoreText(match)) : '—'}</strong><span>${esc(statusText(match))}</span></div>
      <div class="cw233-mc-team away">${crest(match?.awayTeam)}<b>${esc(match?.awayTeam?.name || '—')}</b></div>
    </div>
    ${errorHtml}
  </section>`;
}

function snapshotMatch(payload) {
  if (payload?.match && typeof payload.match === 'object') return payload.match;
  if (payload?.data?.match && typeof payload.data.match === 'object') return payload.data.match;
  return payload && typeof payload === 'object' ? payload : null;
}

export function createMatchCenterController({
  loadSnapshot = loadMatchCenterSnapshot,
  now = () => new Date(),
  setTimer = (fn, ms) => setTimeout(fn, ms),
  clearTimer = id => clearTimeout(id),
  documentRef = globalThis.document,
  onStateChange = () => {},
} = {}) {
  if (typeof loadSnapshot !== 'function') throw new Error('Match Center loadSnapshot is required');
  if (typeof now !== 'function') throw new Error('Match Center now is required');

  let requestVersion = 0;
  let timerId = null;
  let state = {
    open: false,
    competition: '',
    matchId: '',
    match: null,
    loading: false,
    error: '',
    updatedAt: null,
  };

  const getState = () => Object.freeze({ ...state });
  const emit = () => onStateChange(getState());

  function clearPoll() {
    if (timerId === null || timerId === undefined) return;
    clearTimer(timerId);
    timerId = null;
  }

  function shouldPoll() {
    return Boolean(
      state.open
      && String(state?.match?.status || '').toLowerCase() === 'live'
      && !documentRef?.hidden,
    );
  }

  function schedulePoll() {
    clearPoll();
    if (!shouldPoll()) return;
    timerId = setTimer(async () => {
      timerId = null;
      await refresh();
    }, POLL_MS);
  }

  async function refresh() {
    if (!state.open) return getState();
    const version = requestVersion;
    const competition = state.competition;
    const matchId = state.matchId;
    try {
      const payload = await loadSnapshot(competition, matchId);
      if (!state.open || version !== requestVersion) return getState();
      const match = snapshotMatch(payload);
      if (!match) throw new Error('match_snapshot_missing');
      state = {
        ...state,
        match,
        loading: false,
        error: '',
        updatedAt: now(),
      };
      emit();
      schedulePoll();
    } catch (error) {
      if (!state.open || version !== requestVersion) return getState();
      state = {
        ...state,
        loading: false,
        error: String(error?.message || error || 'match_center_refresh_failed'),
      };
      emit();
      schedulePoll();
    }
    return getState();
  }

  async function open({ competition, matchId, initialMatch = null } = {}) {
    getCompetitionConfig(competition);
    if (!matchId) throw new Error('Match Center matchId is required');
    requestVersion += 1;
    clearPoll();
    state = {
      open: true,
      competition,
      matchId: String(matchId),
      match: initialMatch || null,
      loading: true,
      error: '',
      updatedAt: null,
    };
    emit();
    return refresh();
  }

  function close() {
    requestVersion += 1;
    clearPoll();
    state = { ...state, open: false, loading: false };
    emit();
    return getState();
  }

  const visibilityHandler = () => {
    if (!state.open) return;
    if (documentRef?.hidden) {
      clearPoll();
      return;
    }
    if (String(state?.match?.status || '').toLowerCase() === 'live') {
      void refresh();
    }
  };
  documentRef?.addEventListener?.('visibilitychange', visibilityHandler);

  return Object.freeze({ open, close, refresh, getState });
}

function ensureStyles(documentRef) {
  if (!documentRef?.createElement || documentRef.getElementById?.(STYLE_ID)) return;
  const style = documentRef.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
#${OVERLAY_ID}{position:fixed;inset:0 0 calc(78px + env(safe-area-inset-bottom,0px)) 0;z-index:58;overflow-y:auto;background:#07101f;color:#fff;padding:calc(14px + env(safe-area-inset-top,0px)) 14px 28px;font-family:inherit;-webkit-overflow-scrolling:touch}
#${OVERLAY_ID}[hidden]{display:none!important}#${OVERLAY_ID} *{box-sizing:border-box}.cw233-mc-shell{width:min(100%,620px);margin:0 auto}.cw233-mc-toolbar{display:grid;grid-template-columns:44px 1fr 44px;align-items:center;margin-bottom:24px}.cw233-mc-toolbar button{width:44px;height:44px;border:1px solid rgba(255,255,255,.14);border-radius:15px;background:rgba(255,255,255,.07);color:#fff;font:700 21px/1 inherit}.cw233-mc-toolbar strong{text-align:center;font-size:14px}.cw233-mc-competition{text-align:center;font-size:11px;font-weight:850;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.58)}.cw233-mc-kickoff{display:block;text-align:center;margin-top:7px;font-size:12px;color:rgba(255,255,255,.64)}.cw233-mc-board{display:grid;grid-template-columns:minmax(0,1fr) 92px minmax(0,1fr);align-items:center;gap:10px;margin-top:24px;padding:22px 14px;border:1px solid rgba(255,255,255,.1);border-radius:24px;background:rgba(255,255,255,.055)}.cw233-mc-team{display:flex;flex-direction:column;align-items:center;gap:9px;min-width:0;text-align:center}.cw233-mc-team b{font-size:12px;line-height:1.2;overflow-wrap:anywhere}.cw233-mc-logo{width:58px;height:58px;object-fit:contain}.cw233-mc-logo--empty{border-radius:50%;background:rgba(255,255,255,.08)}.cw233-mc-center{text-align:center}.cw233-mc-center strong{display:block;font-size:28px;letter-spacing:-.04em}.cw233-mc-center span{display:block;margin-top:5px;font-size:10px;color:rgba(255,255,255,.6)}.cw233-mc-notice,.cw233-mc-loading{margin-top:16px;padding:14px;border:1px solid rgba(255,255,255,.1);border-radius:16px;background:rgba(255,255,255,.045);font-size:11px;line-height:1.45;color:rgba(255,255,255,.7)}.cw233-mc-notice button{display:block;margin-top:9px;border:0;border-radius:11px;padding:9px 12px;background:#fff;color:#07101f;font:800 11px/1 inherit}
@media(max-width:390px){.cw233-mc-board{grid-template-columns:minmax(0,1fr) 72px minmax(0,1fr);padding-left:10px;padding-right:10px}.cw233-mc-logo{width:48px;height:48px}.cw233-mc-center strong{font-size:24px}}
`;
  documentRef.head?.appendChild?.(style);
}

function ensureOverlay(documentRef) {
  let overlay = documentRef?.getElementById?.(OVERLAY_ID);
  if (overlay) return overlay;
  overlay = documentRef.createElement('div');
  overlay.id = OVERLAY_ID;
  overlay.hidden = true;
  const mount = documentRef.getElementById?.('ciao-miniapp-root') || documentRef.body;
  mount?.appendChild?.(overlay);
  return overlay;
}

function legacyId(matchId) {
  const text = String(matchId || '');
  if (!text.startsWith('serie_a:')) return 0;
  const value = Number(text.slice('serie_a:'.length));
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function delegateSerieA(payload, root = globalThis) {
  const id = legacyId(payload?.matchId);
  if (!id) return false;
  const CustomEventCtor = root?.CustomEvent || globalThis.CustomEvent;
  if (typeof root?.dispatchEvent !== 'function' || typeof CustomEventCtor !== 'function') return false;
  root.dispatchEvent(new CustomEventCtor('ciao-v233-open-serie-a-match', {
    detail: { matchId: String(payload.matchId), legacyId: id },
  }));
  return true;
}

export function installCanonicalMatchCenter(
  documentRef = globalThis.document,
  {
    loadSnapshot = loadMatchCenterSnapshot,
    root = globalThis,
    setTimer,
    clearTimer,
    now,
  } = {},
) {
  if (!documentRef?.createElement || !documentRef?.addEventListener) return null;
  if (installedApi) return installedApi;

  ensureStyles(documentRef);
  const overlay = ensureOverlay(documentRef);
  const controller = createMatchCenterController({
    loadSnapshot,
    documentRef,
    ...(setTimer ? { setTimer } : {}),
    ...(clearTimer ? { clearTimer } : {}),
    ...(now ? { now } : {}),
    onStateChange(state) {
      if (!state.open) {
        overlay.hidden = true;
        overlay.innerHTML = '';
        return;
      }
      overlay.hidden = false;
      overlay.innerHTML = renderMatchCenter(state);
      if (typeof overlay.scrollTo === 'function') overlay.scrollTo(0, 0);
    },
  });

  async function open(payload = {}) {
    if (payload?.competition === 'serie_a') {
      controller.close();
      overlay.hidden = true;
      return delegateSerieA(payload, root) ? 'legacy' : 'legacy_unavailable';
    }
    return controller.open(payload);
  }

  function close() {
    controller.close();
  }

  documentRef.addEventListener('click', event => {
    const target = event?.target;
    if (!target?.closest) return;
    const action = target.closest('[data-cw233-mc-action]');
    if (action) {
      event.preventDefault?.();
      event.stopPropagation?.();
      if (action.dataset?.cw233McAction === 'close') close();
      if (action.dataset?.cw233McAction === 'retry') void controller.refresh();
      return;
    }

    const card = target.closest('[data-cw233-match][data-cw233-competition]');
    if (!card) return;
    const competition = String(card.dataset?.cw233Competition || '');
    const matchId = String(card.dataset?.cw233Match || '');
    if (!competition || !matchId) return;
    event.preventDefault?.();
    event.stopPropagation?.();
    void open({ competition, matchId });
  }, true);

  installedApi = Object.freeze({
    openCanonicalMatchCenter: open,
    close,
    getState: controller.getState,
  });
  root.CiaoV233MatchCenter = installedApi;
  return installedApi;
}

export function openCanonicalMatchCenter(payload) {
  if (payload?.competition === 'serie_a') return delegateSerieA(payload) ? 'legacy' : 'legacy_unavailable';
  if (!installedApi && typeof document !== 'undefined') installCanonicalMatchCenter(document);
  if (!installedApi) throw new Error('Match Center UI is not installed');
  return installedApi.openCanonicalMatchCenter(payload);
}
