export const DEFAULT_PREDICTION_MODE = 'predictions';
const MODES = new Set(['predictions','mine']);

function text(value) { return String(value ?? '').trim(); }
function esc(value) { return text(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function contentHtml(data, mode) {
  if (typeof data?.html === 'string') return data.html;
  const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
  if (!items.length) return `<div class="ciao-predictions-empty">${mode === 'mine' ? 'У вас пока нет сохранённых прогнозов' : 'Сейчас нет матчей для прогноза'}</div>`;
  return `<div class="ciao-predictions-list">${items.map((item, index) => `<div class="ciao-predictions-item" data-prediction-item="${index}">${esc(item?.title || item?.label || item?.match?.title || 'Матч')}</div>`).join('')}</div>`;
}

export function renderPredictionsScreen({ mode = DEFAULT_PREDICTION_MODE, data = null, loading = false, error = null } = {}) {
  const active = MODES.has(mode) ? mode : DEFAULT_PREDICTION_MODE;
  return `<section class="ciao-predictions-screen">
    <div class="ciao-predictions-head"><span>Твои футбольные прогнозы</span><h2>Прогнозы</h2></div>
    <div class="ciao-predictions-switch" role="tablist">
      <button type="button" data-prediction-mode="predictions" class="ciao-predictions-mode${active === 'predictions' ? ' is-active' : ''}">Прогнозы</button>
      <button type="button" data-prediction-mode="mine" class="ciao-predictions-mode${active === 'mine' ? ' is-active' : ''}">Мои прогнозы</button>
    </div>
    <div class="ciao-predictions-content">${loading ? '<div class="ciao-predictions-loading">Загружаем прогнозы…</div>' : error ? `<div class="ciao-predictions-error">${esc(error.message || error)}</div>` : contentHtml(data, active)}</div>
  </section>`;
}

export function createPredictionsController({ bridge, render } = {}) {
  if (!bridge?.load || !bridge?.save) throw new Error('prediction_bridge_required');
  if (typeof render !== 'function') throw new Error('prediction_render_required');
  const state = { mode:DEFAULT_PREDICTION_MODE, data:null, loading:false, error:null };

  function snapshot() { return Object.freeze({ ...state }); }
  function emit() { const value = snapshot(); render(renderPredictionsScreen(value), value); return value; }

  async function load(mode) {
    if (!MODES.has(mode)) throw new Error(`invalid_prediction_mode:${mode}`);
    state.mode = mode;
    state.loading = true;
    state.error = null;
    emit();
    try { state.data = await bridge.load(mode); }
    catch (error) { state.error = error instanceof Error ? error : new Error(String(error)); }
    finally { state.loading = false; emit(); }
    return snapshot();
  }

  return Object.freeze({
    start() { return load(DEFAULT_PREDICTION_MODE); },
    selectMode(mode) { return load(mode); },
    save(payload) { return bridge.save(payload); },
    state: snapshot,
  });
}
