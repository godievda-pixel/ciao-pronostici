export const MODULAR_BUILD = 'main-modular-v1';

if (typeof document !== 'undefined' && document.documentElement) {
  document.documentElement.dataset.ciaoModular = MODULAR_BUILD;
}
