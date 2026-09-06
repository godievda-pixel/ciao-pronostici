export const MODULAR_BUILD = 'main-modular-v1';
export const MODULAR_FEATURES = Object.freeze({
  matchCenter:'shared',
  predictions:'dedicated',
  ranking:'scoped',
});

document.documentElement.dataset.ciaoModular = MODULAR_BUILD;
