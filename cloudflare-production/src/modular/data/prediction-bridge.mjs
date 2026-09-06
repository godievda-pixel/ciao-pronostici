export const PREDICTION_HOME_OWNERSHIP = false;

const MODES = new Set(['predictions','mine']);

export function createPredictionBridge({ loadAvailable, loadMine, save } = {}) {
  if (typeof loadAvailable !== 'function') throw new Error('prediction_available_loader_required');
  if (typeof loadMine !== 'function') throw new Error('prediction_mine_loader_required');
  if (typeof save !== 'function') throw new Error('prediction_save_required');

  return Object.freeze({
    load(mode = 'predictions') {
      if (!MODES.has(mode)) throw new Error(`invalid_prediction_mode:${mode}`);
      return mode === 'mine' ? loadMine() : loadAvailable();
    },
    save(payload) {
      return save(payload);
    },
  });
}
