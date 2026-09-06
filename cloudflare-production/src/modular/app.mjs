import { createLegacySurfaceAdapter } from './core/legacy-surface-adapter.mjs';
import { createLiveEngine } from './core/live-engine.mjs';
import { createRouter } from './core/router.mjs';
import { renderModularRoute } from './core/route-renderer.mjs';
import { createApiClient } from './data/api-client.mjs';
import { CURRENT_API } from './data/api-contract.mjs';
import { createDataService } from './data/data-service.mjs';

export const MODULAR_BUILD = 'main-modular-v1';
export const MODULAR_FEATURES = Object.freeze({
  matchCenter:'shared',
  predictions:'dedicated',
  ranking:'scoped',
  matches:'tournament-first',
  tables:'multi-tournament',
});

const DEFAULT_ROUTES = Object.freeze({
  home:Object.freeze({ screen:'home' }),
  predictions:Object.freeze({ screen:'predictions', subview:'predictions' }),
  ranking:Object.freeze({ screen:'ranking', subview:'all' }),
  matches:Object.freeze({ screen:'matches' }),
  tables:Object.freeze({ screen:'tables', tournament:'serie_a' }),
});
const LIVE_SCREENS = new Set(['home','matches']);

function text(value) { return String(value ?? '').trim(); }
function esc(value) {
  return text(value).replace(/[&<>"']/g, char => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;',
  }[char]));
}

function loadingHtml() {
  return '<section class="ciao-modular-status" data-ciao-modular-status="loading"><b>Загружаем…</b></section>';
}

function errorHtml(error) {
  const code = text(error?.code || error?.message || 'data_unavailable');
  return `<section class="ciao-modular-status is-error" data-ciao-modular-status="error"><b>Данные временно недоступны</b><span>${esc(code)}</span></section>`;
}

function closest(target, selector) {
  return target?.closest?.(selector) || null;
}

function sameLiveRoute(current, context) {
  if (!current?.screen || current.screen !== context?.screen) return false;
  if (current.screen === 'matches') return text(current.tournament) === text(context?.tournament);
  return current.screen === 'home';
}

function predictionScore(value) {
  const raw = text(value);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 && n <= 20 ? n : null;
}

function setInputInvalid(input, invalid) {
  if (!input) return;
  if (invalid) input.setAttribute?.('aria-invalid', 'true');
  else input.removeAttribute?.('aria-invalid');
}

function setPredictionFeedback(card, message) {
  const feedback = card?.querySelector?.('[data-prediction-feedback]');
  if (feedback) feedback.textContent = text(message);
}

function serieAMatchId(value) {
  const raw = text(value).replace(/^serie_a:/i, '');
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) throw new Error('invalid_serie_a_match_id');
  return n;
}

export function createModularApplication({
  documentRef = globalThis.document,
  windowRef = globalThis,
  dataService = null,
  adapterFactory = createLegacySurfaceAdapter,
  routeRenderer = renderModularRoute,
  liveEngineFactory = createLiveEngine,
} = {}) {
  const service = dataService || createDataService({
    apiClient:createApiClient(),
    coreUrl:CURRENT_API.core,
  });

  let started = false;
  let root = null;
  let renderGeneration = 0;
  let renderTask = Promise.resolve();
  let adapter = null;
  let liveEngine = null;
  let unsubscribeLive = null;

  const router = createRouter({
    history:windowRef?.history,
    renderRoute:route => scheduleRender(route),
    readScroll:() => Number(windowRef?.scrollY) || 0,
    restoreScroll:value => windowRef?.scrollTo?.(0, value),
    afterRender:callback => windowRef?.requestAnimationFrame
      ? windowRef.requestAnimationFrame(callback)
      : queueMicrotask(callback),
    fallbackRoute:{ screen:'home' },
  });

  function ensureLiveEngine() {
    if (liveEngine) return liveEngine;
    liveEngine = liveEngineFactory({
      refresh:context => routeRenderer(
        context?.screen ? context : DEFAULT_ROUTES.home,
        { dataService:service, now:new Date() },
      ),
    });
    unsubscribeLive = liveEngine?.subscribe?.(snapshot => {
      if (!started) return;
      const current = router.current();
      if (!sameLiveRoute(current, snapshot?.context)) return;

      if (current.screen === 'home') {
        if (snapshot?.error) {
          adapter?.hideHomeCompanion?.({ restore:true });
          return;
        }
        if (snapshot?.data != null) adapter?.showHomeCompanion?.(String(snapshot.data));
        return;
      }

      if (current.screen === 'matches') {
        if (snapshot?.error) return;
        if (snapshot?.data != null) adapter?.showModular?.(String(snapshot.data));
      }
    }) || null;
    return liveEngine;
  }

  function stopLiveEngine() {
    if (liveEngine?.state?.().running) liveEngine.stop?.();
  }

  function scheduleRender(route) {
    const generation = ++renderGeneration;
    renderTask = Promise.resolve().then(async () => {
      if (!started || generation !== renderGeneration) return '';

      if (route?.screen === 'home') {
        adapter?.hideModular?.();
        try {
          const engine = ensureLiveEngine();
          const snapshot = await engine.start(route);
          if (!started || generation !== renderGeneration) return snapshot?.data || '';
          if (snapshot?.error) adapter?.hideHomeCompanion?.({ restore:true });
          return snapshot?.data || '';
        } catch (_error) {
          if (started && generation === renderGeneration) adapter?.hideHomeCompanion?.({ restore:true });
          return '';
        }
      }

      adapter?.hideHomeCompanion?.({ restore:true });
      adapter?.showModular?.(loadingHtml());

      if (LIVE_SCREENS.has(route?.screen)) {
        try {
          const snapshot = await ensureLiveEngine().start(route);
          const html = snapshot?.data || '';
          if (!started || generation !== renderGeneration) return html;
          if (snapshot?.error && !html) adapter?.showModular?.(errorHtml(snapshot.error));
          else adapter?.showModular?.(html || errorHtml({ code:'empty_modular_screen' }));
          return html;
        } catch (error) {
          if (started && generation === renderGeneration) adapter?.showModular?.(errorHtml(error));
          return '';
        }
      }

      stopLiveEngine();
      try {
        const html = await routeRenderer(route, { dataService:service, now:new Date() });
        if (!started || generation !== renderGeneration) return html;
        adapter?.showModular?.(html || errorHtml({ code:'empty_modular_screen' }));
        return html;
      } catch (error) {
        if (started && generation === renderGeneration) adapter?.showModular?.(errorHtml(error));
        return '';
      }
    });
    return renderTask;
  }

  function navigateLegacy(screen) {
    const key = text(screen).toLowerCase();
    const route = DEFAULT_ROUTES[key];
    if (!route) return false;
    router.navigate(route);
    return true;
  }

  async function savePrediction(saveControl) {
    const card = closest(saveControl, '[data-prediction-card]');
    if (!card || typeof service.savePredictions !== 'function') return false;
    const competition = text(card.dataset?.predictionCompetition).toLowerCase();
    const matchId = text(card.dataset?.predictionMatchId);
    const homeInput = card.querySelector?.('[data-prediction-home]');
    const awayInput = card.querySelector?.('[data-prediction-away]');
    const homeScore = predictionScore(homeInput?.value);
    const awayScore = predictionScore(awayInput?.value);
    const homeInvalid = homeScore === null;
    const awayInvalid = awayScore === null;
    setInputInvalid(homeInput, homeInvalid);
    setInputInvalid(awayInput, awayInvalid);
    if (homeInvalid || awayInvalid) {
      setPredictionFeedback(card, 'Введите счёт от 0 до 20');
      return false;
    }
    setPredictionFeedback(card, '');
    const prediction = {
      match_id:competition === 'serie_a' ? serieAMatchId(matchId) : matchId,
      home_score:homeScore,
      away_score:awayScore,
    };
    const payload = { competition, predictions:[prediction] };
    if (competition === 'serie_a') {
      const round = Number(card.dataset?.predictionRound);
      if (Number.isInteger(round) && round > 0) payload.round = round;
    }
    try {
      await service.savePredictions(payload);
    } catch (_error) {
      setPredictionFeedback(card, 'Не удалось сохранить прогноз');
      return false;
    }
    const current = router.current();
    if (current?.screen === 'predictions') await scheduleRender(current);
    return true;
  }

  async function delegatedClick(event) {
    const target = event?.target;

    const back = closest(target, '[data-ciao-mc-back]');
    if (back) {
      event?.preventDefault?.();
      router.back();
      return;
    }

    const predictionSave = closest(target, '[data-prediction-save]');
    if (predictionSave) {
      event?.preventDefault?.();
      await savePrediction(predictionSave);
      return;
    }

    const predictionMode = closest(target, '[data-prediction-mode]');
    if (predictionMode) {
      const subview = text(predictionMode.dataset?.predictionMode);
      if (subview === 'predictions' || subview === 'mine') {
        event?.preventDefault?.();
        router.navigate({ screen:'predictions', subview });
      }
      return;
    }

    const rankingScope = closest(target, '[data-ranking-scope]');
    if (rankingScope) {
      const subview = text(rankingScope.dataset?.rankingScope);
      if (['all','italy','europe'].includes(subview)) {
        event?.preventDefault?.();
        router.navigate({ screen:'ranking', subview });
      }
      return;
    }

    const tableTournament = closest(target, '[data-ciao-table-tournament]');
    if (tableTournament) {
      const tournament = text(tableTournament.dataset?.ciaoTableTournament);
      if (tournament) {
        event?.preventDefault?.();
        router.navigate({ screen:'tables', tournament });
      }
      return;
    }

    const tournament = closest(target, '[data-ciao-tournament]');
    if (tournament) {
      const id = text(tournament.dataset?.ciaoTournament);
      if (id) {
        event?.preventDefault?.();
        router.navigate({ screen:'matches', tournament:id });
      }
      return;
    }

    const tab = closest(target, '[data-ciao-mc-tab]');
    if (tab) {
      const subview = text(tab.dataset?.ciaoMcTab);
      const current = router.current();
      if (current?.screen === 'match-center' && subview) {
        event?.preventDefault?.();
        router.navigate({ ...current, subview, scrollY:0 }, { replace:true });
      }
      return;
    }

    const match = closest(target, '[data-ciao-match-id]');
    if (match) {
      const competition = text(match.dataset?.ciaoCompetition);
      const matchId = text(match.dataset?.ciaoMatchId);
      if (competition && matchId) {
        event?.preventDefault?.();
        router.openMatchCenter({ competition, matchId });
      }
    }
  }

  function popstate(event) {
    router.handlePopState(event);
  }

  function start() {
    if (started) return true;
    documentRef?.documentElement?.dataset && (documentRef.documentElement.dataset.ciaoModular = MODULAR_BUILD);
    adapter = adapterFactory({ documentRef, onNavigate:navigateLegacy });
    if (!adapter?.start?.()) return false;
    root = adapter.root?.() || null;
    root?.addEventListener?.('click', delegatedClick);
    windowRef?.addEventListener?.('popstate', popstate);
    started = true;
    scheduleRender(DEFAULT_ROUTES.home);
    return true;
  }

  function stop() {
    if (!started) return false;
    renderGeneration += 1;
    stopLiveEngine();
    unsubscribeLive?.();
    unsubscribeLive = null;
    liveEngine = null;
    root?.removeEventListener?.('click', delegatedClick);
    windowRef?.removeEventListener?.('popstate', popstate);
    adapter?.stop?.();
    root = null;
    adapter = null;
    started = false;
    return true;
  }

  return Object.freeze({
    start,
    stop,
    navigate(route, options) { return router.navigate(route, options); },
    router() { return router; },
    flush() { return renderTask; },
    started() { return started; },
  });
}

let automaticApplication = null;

function autoStart() {
  if (automaticApplication || !globalThis.document) return automaticApplication;
  automaticApplication = createModularApplication();
  automaticApplication.start();
  return automaticApplication;
}

if (globalThis.document?.documentElement) {
  globalThis.document.documentElement.dataset.ciaoModular = MODULAR_BUILD;
  if (globalThis.document.readyState === 'loading') {
    globalThis.document.addEventListener?.('DOMContentLoaded', autoStart, { once:true });
  } else {
    queueMicrotask(autoStart);
  }
}
