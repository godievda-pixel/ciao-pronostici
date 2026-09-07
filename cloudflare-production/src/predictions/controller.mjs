import { groupPredictionMatches } from './model.mjs';

const REFRESH_MS = 15000;
const clampScore = value => Math.max(0, Math.min(20, Number.isFinite(Number(value)) ? Number(value) : 0));

function externalMatchId(match) {
  return String(match?.matchId ?? '');
}

function serieMatchId(match) {
  const id = Number(match?.id ?? match?.match_id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function externalScore(match, draft) {
  if (draft) return { h: clampScore(draft.h), a: clampScore(draft.a) };
  if (match?.prediction) {
    return {
      h: clampScore(match.prediction.home_score),
      a: clampScore(match.prediction.away_score),
    };
  }
  return { h: 0, a: 0 };
}

function serieScore(match, draft) {
  if (draft) return { h: clampScore(draft.h), a: clampScore(draft.a) };
  const prediction = match?.prediction;
  if (prediction) {
    return {
      h: clampScore(prediction.home_score ?? prediction.home),
      a: clampScore(prediction.away_score ?? prediction.away),
    };
  }
  return { h: 0, a: 0 };
}

export function createPredictionsController({
  dataClient,
  render,
  setTimer = globalThis.setTimeout?.bind(globalThis),
  clearTimer = globalThis.clearTimeout?.bind(globalThis),
  documentRef = globalThis.document,
} = {}) {
  if (!dataClient) throw new TypeError('dataClient required');
  if (typeof render !== 'function') throw new TypeError('render required');
  if (typeof setTimer !== 'function' || typeof clearTimer !== 'function') throw new TypeError('timer functions required');

  const state = {
    open: false,
    view: 'hub',
    competition: '',
    mode: 'edit',
    stageKey: '',
    serieRound: null,
    payload: null,
    drafts: new Map(),
    loading: false,
    saving: false,
    error: '',
  };

  let timerId = null;
  let refreshPromise = null;
  let requestVersion = 0;

  function snapshot() {
    return Object.freeze({
      open: state.open,
      view: state.view,
      competition: state.competition,
      mode: state.mode,
      stageKey: state.stageKey,
      serieRound: state.serieRound,
      payload: state.payload,
      drafts: new Map(state.drafts),
      loading: state.loading,
      saving: state.saving,
      error: state.error,
    });
  }

  function paint() {
    render(snapshot());
  }

  function cancelTimer() {
    if (timerId == null) return;
    clearTimer(timerId);
    timerId = null;
  }

  function schedule() {
    if (!state.open || documentRef?.hidden || timerId != null) return;
    timerId = setTimer(async () => {
      timerId = null;
      await refresh().catch(() => {});
      schedule();
    }, REFRESH_MS);
  }

  async function loadCurrent({ quiet = false } = {}) {
    if (!state.competition) return null;
    const version = ++requestVersion;
    if (!quiet) {
      state.loading = true;
      state.error = '';
      paint();
    }

    try {
      let payload;
      if (state.competition === 'serie_a') {
        payload = await dataClient.loadSerieAState(state.serieRound);
      } else {
        payload = await dataClient.loadExternalState(state.competition);
      }
      if (version !== requestVersion || !state.open) return null;
      state.payload = payload;
      if (state.competition === 'serie_a') {
        const selected = Number(payload?.selected_round);
        if (Number.isInteger(selected) && selected > 0) state.serieRound = selected;
      } else {
        const groups = groupPredictionMatches(payload?.matches ?? []);
        if (!state.stageKey || !groups.some(group => group.key === state.stageKey)) {
          state.stageKey = String(payload?.prediction_stage_key || groups[0]?.key || '');
        }
      }
      state.loading = false;
      state.error = '';
      paint();
      return payload;
    } catch (error) {
      if (version !== requestVersion || !state.open) return null;
      state.loading = false;
      if (!quiet || !state.payload) state.error = error instanceof Error ? error.message : String(error);
      paint();
      throw error;
    }
  }

  function open() {
    state.open = true;
    state.view = 'hub';
    state.competition = '';
    state.stageKey = '';
    state.payload = null;
    state.drafts.clear();
    state.loading = false;
    state.saving = false;
    state.error = '';
    paint();
    schedule();
  }

  function close() {
    requestVersion += 1;
    state.open = false;
    cancelTimer();
    paint();
  }

  function openHub() {
    requestVersion += 1;
    state.view = 'hub';
    state.competition = '';
    state.stageKey = '';
    state.payload = null;
    state.drafts.clear();
    state.loading = false;
    state.saving = false;
    state.error = '';
    paint();
  }

  async function openCompetition(competition) {
    const key = String(competition || '');
    if (!['serie_a','coppa_italia','ucl','uel','uecl'].includes(key)) throw new Error(`Unknown competition: ${key}`);
    if (state.competition && state.competition !== key) state.drafts.clear();
    state.view = 'competition';
    state.competition = key;
    state.stageKey = '';
    state.payload = null;
    state.error = '';
    if (key !== 'serie_a') state.serieRound = null;
    return loadCurrent({ quiet: false });
  }

  function setMode(mode) {
    state.mode = mode === 'mine' ? 'mine' : 'edit';
    paint();
  }

  function setStage(stageKey) {
    state.stageKey = String(stageKey || '');
    paint();
  }

  async function setSerieRound(round) {
    const value = Number(round);
    if (!Number.isInteger(value) || value <= 0) return;
    state.serieRound = value;
    state.drafts.clear();
    await loadCurrent({ quiet: false });
  }

  function findMatch(matchId) {
    if (state.competition === 'serie_a') {
      return (state.payload?.round?.matches ?? []).find(match => String(serieMatchId(match)) === String(matchId));
    }
    return (state.payload?.matches ?? []).find(match => externalMatchId(match) === String(matchId));
  }

  function adjustScore(matchId, side, delta) {
    const match = findMatch(matchId);
    if (!match) return;
    const key = String(matchId);
    const current = state.competition === 'serie_a'
      ? serieScore(match, state.drafts.get(key))
      : externalScore(match, state.drafts.get(key));
    const field = side === 'a' ? 'a' : 'h';
    current[field] = clampScore(current[field] + Number(delta || 0));
    state.drafts.set(key, current);
    paint();
  }

  function selectedExternalGroup() {
    const groups = groupPredictionMatches(state.payload?.matches ?? []);
    return groups.find(group => group.key === state.stageKey) || groups[0] || null;
  }

  async function save() {
    if (!state.open || !state.competition || state.mode !== 'edit' || state.saving) return { saved: 0 };
    state.saving = true;
    state.error = '';
    paint();
    try {
      let result;
      let savedKeys = [];
      if (state.competition === 'serie_a') {
        const round = Number(state.serieRound || state.payload?.selected_round);
        const items = (state.payload?.round?.matches ?? [])
          .filter(match => match?.open === true)
          .map(match => {
            const id = serieMatchId(match);
            const key = String(id ?? '');
            const score = serieScore(match, state.drafts.get(key));
            return id ? { match_id: id, home_score: score.h, away_score: score.a } : null;
          })
          .filter(Boolean);
        savedKeys = items.map(item => String(item.match_id));
        result = await dataClient.saveSerieAPredictions(round, items);
      } else {
        const group = selectedExternalGroup();
        const items = (group?.matches ?? [])
          .filter(match => match?.open === true)
          .map(match => {
            const key = externalMatchId(match);
            const score = externalScore(match, state.drafts.get(key));
            return key ? { match_id: key, home_score: score.h, away_score: score.a } : null;
          })
          .filter(Boolean);
        savedKeys = items.map(item => item.match_id);
        result = await dataClient.saveExternalPredictions(state.competition, items);
      }
      for (const key of savedKeys) state.drafts.delete(String(key));
      state.saving = false;
      await loadCurrent({ quiet: true });
      return result;
    } catch (error) {
      state.saving = false;
      state.error = error instanceof Error ? error.message : String(error);
      paint();
      throw error;
    }
  }

  function refresh() {
    if (!state.open || !state.competition) return Promise.resolve(null);
    if (refreshPromise) return refreshPromise;
    refreshPromise = loadCurrent({ quiet: true })
      .finally(() => { refreshPromise = null; });
    return refreshPromise;
  }

  function visibilityHandler() {
    if (!state.open) return;
    if (documentRef?.hidden) {
      cancelTimer();
      return;
    }
    void refresh().finally(schedule);
  }

  documentRef?.addEventListener?.('visibilitychange', visibilityHandler);

  return Object.freeze({
    open,
    close,
    openHub,
    openCompetition,
    setMode,
    setStage,
    setSerieRound,
    adjustScore,
    save,
    refresh,
    snapshot,
    isOpen: () => state.open,
    destroy() {
      close();
      documentRef?.removeEventListener?.('visibilitychange', visibilityHandler);
    },
  });
}

export const PREDICTIONS_REFRESH_MS = REFRESH_MS;
