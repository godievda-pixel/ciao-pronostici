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

function text(value) {
  return String(value ?? '').trim();
}

function list(value) {
  return Array.isArray(value) ? value : [];
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

function titleFor(competition) {
  try {
    if (competition) return getCompetitionConfig(competition).title;
  } catch {}
  return 'Матч-центр';
}

function themeFor(competition) {
  try {
    return getCompetitionConfig(competition).theme || 'serie-a';
  } catch {}
  return 'serie-a';
}

function crest(team) {
  const src = String(team?.crestUrl || '').trim();
  if (!src) return '<span class="cw233-mc-logo cw233-mc-logo--empty" aria-hidden="true"></span>';
  return `<img class="cw233-mc-logo" src="${esc(src)}" alt="" width="58" height="58" loading="eager" decoding="async">`;
}

function noticeHtml(error) {
  return error
    ? `<div class="cw233-mc-notice">Не удалось обновить данные. Последний полученный результат сохранён.<button type="button" data-cw233-mc-action="retry">Повторить</button></div>`
    : '';
}

function eventLabel(item = {}) {
  const minute = hasNumber(item?.minute) ? `${Number(item.minute)}′` : '';
  const label = text(item?.label || item?.title || item?.name || item?.type || item?.event_type) || 'Событие';
  const team = text(item?.team?.name || item?.team_name || item?.player?.name || item?.player_name);
  return [minute, label, team].filter(Boolean).join(' · ');
}

function statisticRow(item = {}) {
  const label = text(item?.label || item?.name || item?.type || item?.statistic) || 'Статистика';
  const home = item?.home ?? item?.home_value ?? item?.homeValue ?? '—';
  const away = item?.away ?? item?.away_value ?? item?.awayValue ?? '—';
  return `<div class="cw233-mc-stat-row"><span>${esc(home)}</span><b>${esc(label)}</b><span>${esc(away)}</span></div>`;
}

function lineupLabel(item = {}) {
  const team = text(item?.team?.name || item?.team_name || item?.name) || 'Состав';
  const formation = text(item?.formation);
  return formation ? `${team} · ${formation}` : team;
}

function predictionLabel(prediction = {}) {
  const home = prediction?.homeScore ?? prediction?.home_score ?? prediction?.pred_home_score;
  const away = prediction?.awayScore ?? prediction?.away_score ?? prediction?.pred_away_score;
  if (!hasNumber(home) || !hasNumber(away)) return 'Прогноз сохранён';
  return `Ваш прогноз: ${Number(home)}:${Number(away)}`;
}

function detailsHtml(match) {
  if (!match) return '';
  const blocks = [];
  const venue = text(match?.venue);
  const events = list(match?.events);
  const statistics = list(match?.statistics);
  const lineups = list(match?.lineups);
  const prediction = match?.prediction && typeof match.prediction === 'object' ? match.prediction : null;

  if (venue) {
    blocks.push(`<section class="cw233-mc-detail" data-cw233-mc-detail="venue"><h3>Стадион</h3><p>${esc(venue)}</p></section>`);
  }
  if (events.length) {
    blocks.push(`<section class="cw233-mc-detail" data-cw233-mc-detail="events"><h3>События</h3><div class="cw233-mc-detail-list">${events.map(item => `<div>${esc(eventLabel(item))}</div>`).join('')}</div></section>`);
  }
  if (statistics.length) {
    blocks.push(`<section class="cw233-mc-detail" data-cw233-mc-detail="statistics"><h3>Статистика</h3><div class="cw233-mc-stat-list">${statistics.map(statisticRow).join('')}</div></section>`);
  }
  if (lineups.length) {
    blocks.push(`<section class="cw233-mc-detail" data-cw233-mc-detail="lineups"><h3>Составы</h3><div class="cw233-mc-detail-list">${lineups.map(item => `<div>${esc(lineupLabel(item))}</div>`).join('')}</div></section>`);
  }
  if (prediction) {
    blocks.push(`<section class="cw233-mc-detail" data-cw233-mc-detail="prediction"><h3>Прогноз</h3><p>${esc(predictionLabel(prediction))}</p></section>`);
  }
  return blocks.join('');
}

export function renderMatchCenter(state = {}) {
  const match = state?.match || null;
  const competition = String(match?.competition || state?.competition || '');
  const title = titleFor(competition);
  const theme = themeFor(competition);
  const error = String(state?.error || '').trim();
  const status = String(match?.status || '').toLowerCase();
  const showScore = status === 'live' || status === 'finished';
  const loading = !match;
  const matchId = String(match?.matchId || state?.matchId || '');

  return `<section class="cw233-mc-shell${loading ? ' is-loading' : ''}" data-cw233-mc-view data-cw233-mc-theme="${esc(theme)}" data-cw233-competition="${esc(competition)}" data-cw233-match="${esc(matchId)}"${loading ? ' data-cw233-mc-loading-frame="true"' : ''}>
    <header class="cw233-mc-toolbar"><button type="button" data-cw233-mc-action="close" aria-label="Закрыть">←</button><strong>Матч-центр</strong><span aria-hidden="true"></span></header>
    <div class="cw233-mc-competition" data-cw233-mc-competition-label>${esc(title)}</div>
    <time class="cw233-mc-kickoff" data-cw233-mc-kickoff datetime="${esc(match?.kickoffAt || '')}">${loading ? 'Загружаем данные…' : esc(kickoffText(match?.kickoffAt, state?.timeZone))}</time>
    <div class="cw233-mc-board${loading ? ' cw233-mc-loading-board' : ''}" data-cw233-mc-board>
      <div class="cw233-mc-team"><span class="cw233-mc-logo-slot" data-cw233-mc-logo-slot="home">${loading ? '<span class="cw233-mc-logo cw233-mc-logo--empty" aria-hidden="true"></span>' : crest(match?.homeTeam)}</span><b data-cw233-mc-home-name>${loading ? ' ' : esc(match?.homeTeam?.name || '—')}</b></div>
      <div class="cw233-mc-center"><strong data-cw233-mc-score>${loading ? '—' : showScore ? esc(scoreText(match)) : '—'}</strong><span data-cw233-mc-status>${loading ? 'Загружаем матч…' : esc(statusText(match))}</span></div>
      <div class="cw233-mc-team away"><span class="cw233-mc-logo-slot" data-cw233-mc-logo-slot="away">${loading ? '<span class="cw233-mc-logo cw233-mc-logo--empty" aria-hidden="true"></span>' : crest(match?.awayTeam)}</span><b data-cw233-mc-away-name>${loading ? ' ' : esc(match?.awayTeam?.name || '—')}</b></div>
    </div>
    <div class="cw233-mc-details" data-cw233-mc-details-slot>${detailsHtml(match)}</div>
    <div data-cw233-mc-notice-slot>${noticeHtml(error)}</div>
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
#${OVERLAY_ID}{--mc-bg:#07101f;--mc-surface:rgba(255,255,255,.055);--mc-border:rgba(255,255,255,.1);--mc-accent:#2f6fff;--mc-accent-2:#784cff;position:fixed;inset:0;z-index:58;overflow-y:auto;background:radial-gradient(circle at 50% -10%,color-mix(in srgb,var(--mc-accent) 24%,transparent),transparent 42%),linear-gradient(180deg,var(--mc-bg),#050a12 100%);color:#fff;padding:calc(14px + env(safe-area-inset-top,0px)) 14px calc(104px + env(safe-area-inset-bottom,0px));font-family:inherit;-webkit-overflow-scrolling:touch;overflow-anchor:none}
#${OVERLAY_ID}[data-cw233-mc-theme="serie-a"]{--mc-bg:#07162e;--mc-accent:#0f52ba;--mc-accent-2:#2153f8}#${OVERLAY_ID}[data-cw233-mc-theme="coppa"]{--mc-bg:#180b12;--mc-accent:#d7263d;--mc-accent-2:#16834b}#${OVERLAY_ID}[data-cw233-mc-theme="champions"]{--mc-bg:#090c2d;--mc-accent:#3157ff;--mc-accent-2:#7b42ff}#${OVERLAY_ID}[data-cw233-mc-theme="europa"]{--mc-bg:#1d0d05;--mc-accent:#f06722;--mc-accent-2:#ff9b32}#${OVERLAY_ID}[data-cw233-mc-theme="conference"]{--mc-bg:#071b13;--mc-accent:#22a866;--mc-accent-2:#55d68e}
#${OVERLAY_ID}[hidden]{display:none!important}#${OVERLAY_ID} *{box-sizing:border-box}.cw233-mc-shell{width:min(100%,620px);margin:0 auto;contain:layout style}.cw233-mc-toolbar{display:grid;grid-template-columns:44px 1fr 44px;align-items:center;margin-bottom:24px}.cw233-mc-toolbar button{width:44px;height:44px;border:1px solid color-mix(in srgb,var(--mc-accent) 38%,rgba(255,255,255,.14));border-radius:15px;background:color-mix(in srgb,var(--mc-accent) 12%,rgba(255,255,255,.05));color:#fff;font:700 21px/1 inherit}.cw233-mc-toolbar strong{text-align:center;font-size:14px}.cw233-mc-competition{height:14px;text-align:center;font-size:11px;font-weight:850;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.58)}.cw233-mc-kickoff{display:block;height:17px;text-align:center;margin-top:7px;font-size:12px;color:rgba(255,255,255,.64)}.cw233-mc-board{display:grid;grid-template-columns:minmax(0,1fr) 92px minmax(0,1fr);align-items:center;gap:10px;min-height:126px;margin-top:24px;padding:22px 14px;border:1px solid color-mix(in srgb,var(--mc-accent) 28%,var(--mc-border));border-radius:24px;background:linear-gradient(145deg,color-mix(in srgb,var(--mc-accent) 9%,var(--mc-surface)),var(--mc-surface));box-shadow:inset 0 1px 0 rgba(255,255,255,.035)}.cw233-mc-team{display:flex;flex-direction:column;align-items:center;gap:9px;min-width:0;text-align:center}.cw233-mc-team b{min-height:15px;font-size:12px;line-height:1.2;overflow-wrap:anywhere}.cw233-mc-logo-slot{display:grid;place-items:center;width:58px;height:58px;min-width:58px;min-height:58px}.cw233-mc-logo{display:block;width:58px;height:58px;min-width:58px;min-height:58px;object-fit:contain}.cw233-mc-logo--empty{border-radius:50%;background:rgba(255,255,255,.08)}.cw233-mc-center{text-align:center}.cw233-mc-center strong{display:block;min-height:34px;font-size:28px;letter-spacing:-.04em}.cw233-mc-center span{display:block;min-height:12px;margin-top:5px;font-size:10px;color:rgba(255,255,255,.6)}.cw233-mc-details{display:grid;gap:10px;margin-top:14px}.cw233-mc-detail{padding:14px;border:1px solid color-mix(in srgb,var(--mc-accent) 24%,var(--mc-border));border-radius:17px;background:color-mix(in srgb,var(--mc-accent) 7%,rgba(255,255,255,.04))}.cw233-mc-detail h3{margin:0 0 9px;font-size:11px;letter-spacing:.07em;text-transform:uppercase;color:color-mix(in srgb,var(--mc-accent) 55%,#fff)}.cw233-mc-detail p{margin:0;font-size:12px;color:rgba(255,255,255,.82)}.cw233-mc-detail-list{display:grid;gap:7px;font-size:11px;color:rgba(255,255,255,.78)}.cw233-mc-stat-list{display:grid;gap:7px}.cw233-mc-stat-row{display:grid;grid-template-columns:1fr minmax(90px,1.5fr) 1fr;gap:8px;align-items:center;font-size:11px;text-align:center}.cw233-mc-stat-row span:first-child{text-align:left}.cw233-mc-stat-row span:last-child{text-align:right}.cw233-mc-stat-row b{font-size:10px;color:rgba(255,255,255,.65)}.cw233-mc-notice{margin-top:16px;padding:14px;border:1px solid color-mix(in srgb,var(--mc-accent) 26%,var(--mc-border));border-radius:16px;background:rgba(255,255,255,.045);font-size:11px;line-height:1.45;color:rgba(255,255,255,.7)}.cw233-mc-notice button{display:block;margin-top:9px;border:0;border-radius:11px;padding:9px 12px;background:var(--mc-accent);color:#fff;font:800 11px/1 inherit}.cw233-mc-loading-board .cw233-mc-logo--empty,.cw233-mc-shell.is-loading .cw233-mc-team b{animation:cw233McPulse 1.15s ease-in-out infinite alternate}.cw233-mc-shell.is-loading .cw233-mc-team b{width:74%;border-radius:5px;background:rgba(255,255,255,.07);color:transparent}@keyframes cw233McPulse{from{opacity:.5}to{opacity:1}}
@media(max-width:390px){.cw233-mc-board{grid-template-columns:minmax(0,1fr) 72px minmax(0,1fr);padding-left:10px;padding-right:10px}.cw233-mc-logo-slot,.cw233-mc-logo{width:48px;height:48px;min-width:48px;min-height:48px}.cw233-mc-center strong{font-size:24px}}
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

function patchLogo(slot, team) {
  if (!slot) return;
  const src = String(team?.crestUrl || '').trim();
  const image = slot.querySelector?.('img');
  if (src && image?.getAttribute?.('src') === src) return;
  if (!src && slot.querySelector?.('.cw233-mc-logo--empty')) return;
  slot.innerHTML = crest(team);
}

export function patchMatchCenterOverlay(overlay, state = {}) {
  const shell = overlay?.querySelector?.('[data-cw233-mc-view]');
  if (!shell) return false;
  const match = state?.match || null;
  const competition = String(match?.competition || state?.competition || '');
  const matchId = String(match?.matchId || state?.matchId || '');
  if (shell.dataset?.cw233Competition !== competition || shell.dataset?.cw233Match !== matchId) return false;

  const theme = themeFor(competition);
  overlay.dataset.cw233McTheme = theme;
  shell.dataset.cw233McTheme = theme;
  shell.classList?.toggle?.('is-loading', !match);
  if (match) delete shell.dataset.cw233McLoadingFrame;
  else shell.dataset.cw233McLoadingFrame = 'true';
  const competitionLabel = shell.querySelector?.('[data-cw233-mc-competition-label]');
  const kickoff = shell.querySelector?.('[data-cw233-mc-kickoff]');
  const board = shell.querySelector?.('[data-cw233-mc-board]');
  const homeName = shell.querySelector?.('[data-cw233-mc-home-name]');
  const awayName = shell.querySelector?.('[data-cw233-mc-away-name]');
  const score = shell.querySelector?.('[data-cw233-mc-score]');
  const status = shell.querySelector?.('[data-cw233-mc-status]');
  const details = shell.querySelector?.('[data-cw233-mc-details-slot]');
  const notice = shell.querySelector?.('[data-cw233-mc-notice-slot]');
  if (competitionLabel) competitionLabel.textContent = titleFor(competition);
  if (kickoff) {
    kickoff.setAttribute?.('datetime', String(match?.kickoffAt || ''));
    kickoff.textContent = match ? kickoffText(match?.kickoffAt, state?.timeZone) : 'Загружаем данные…';
  }
  board?.classList?.toggle?.('cw233-mc-loading-board', !match);
  if (homeName) homeName.textContent = match ? String(match?.homeTeam?.name || '—') : ' ';
  if (awayName) awayName.textContent = match ? String(match?.awayTeam?.name || '—') : ' ';
  patchLogo(shell.querySelector?.('[data-cw233-mc-logo-slot="home"]'), match?.homeTeam);
  patchLogo(shell.querySelector?.('[data-cw233-mc-logo-slot="away"]'), match?.awayTeam);
  if (score) {
    const currentStatus = String(match?.status || '').toLowerCase();
    score.textContent = match && (currentStatus === 'live' || currentStatus === 'finished') ? scoreText(match) : '—';
  }
  if (status) status.textContent = match ? statusText(match) : 'Загружаем матч…';
  if (details) {
    const next = detailsHtml(match);
    if (details.innerHTML !== next) details.innerHTML = next;
  }
  if (notice) notice.innerHTML = noticeHtml(String(state?.error || '').trim());
  return true;
}

function mountMatchCenterOverlay(overlay, state) {
  const competition = String(state?.match?.competition || state?.competition || '');
  overlay.dataset.cw233McTheme = themeFor(competition);
  overlay.innerHTML = renderMatchCenter(state);
}

function legacyId(matchId) {
  const valueText = String(matchId || '');
  if (!valueText.startsWith('serie_a:')) return 0;
  const value = Number(valueText.slice('serie_a:'.length));
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
      if (!patchMatchCenterOverlay(overlay, state)) mountMatchCenterOverlay(overlay, state);
    },
  });

  async function open(payload = {}) {
    if (payload?.competition === 'serie_a') {
      controller.close();
      overlay.hidden = true;
      return delegateSerieA(payload, root) ? 'legacy' : 'legacy_unavailable';
    }
    if (typeof overlay.scrollTo === 'function') overlay.scrollTo(0, 0);
    else overlay.scrollTop = 0;
    return controller.open(payload);
  }

  function close() {
    controller.close();
  }

  documentRef.addEventListener('click', event => {
    const target = event?.target;
    if (!target?.closest) return;
    const homePredict = target.closest('[data-cw231-action="predict"]');
    if (homePredict) return;
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
