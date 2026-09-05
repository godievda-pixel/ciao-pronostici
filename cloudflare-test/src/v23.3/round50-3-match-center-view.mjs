function text(value) {
  return String(value ?? '').trim();
}

export const ROUND50_3_BUILD = 'round50-3-bottom-drawer-seamless-refresh';

export const VIEW_TABS = Object.freeze([
  'overview',
  'lineups',
  'events',
  'statistics',
  'shots',
]);

export const VIEW_TO_PROVIDER_SECTION = Object.freeze({
  overview:'overview',
  lineups:'lineups',
  events:'events',
  statistics:'stats',
  shots:'stats',
});

export const ROUND503_VIEW_TABS = Object.freeze([
  Object.freeze({ key:'overview', label:'Обзор', provider:'overview' }),
  Object.freeze({ key:'lineups', label:'Составы', provider:'lineups' }),
  Object.freeze({ key:'events', label:'События', provider:'events' }),
  Object.freeze({ key:'statistics', label:'Статистика', provider:'stats' }),
  Object.freeze({ key:'shots', label:'Удары', provider:'stats' }),
]);

const VIEW_TAB_ALIASES = Object.freeze({
  game:'overview',
  overview:'overview',
  lineups:'lineups',
  events:'events',
  stats:'statistics',
  statistics:'statistics',
  shots:'shots',
});

const SNAP_RATIOS = Object.freeze({
  compact:0.46,
  standard:0.78,
  expanded:0.94,
});

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function normalizeViewTab(value) {
  const key = text(value).toLowerCase();
  return VIEW_TAB_ALIASES[key] || 'overview';
}

export function providerSectionForViewTab(value) {
  return VIEW_TO_PROVIDER_SECTION[normalizeViewTab(value)] || 'overview';
}

export function canonicalRound503ViewTab(value) {
  return normalizeViewTab(value);
}

export function providerTabForRound503View(value) {
  return providerSectionForViewTab(value);
}

export function snapHeightForViewport(state, viewportHeight, options = {}) {
  const height = Math.max(1, Number(viewportHeight) || 1);
  const minHeight = Math.max(1, Number(options.minHeight) || 1);
  const maxHeight = Math.max(minHeight, Number(options.maxHeight) || height);
  const ratio = SNAP_RATIOS[state] ?? SNAP_RATIOS.standard;
  return clamp(Math.round(height * ratio), minHeight, maxHeight);
}

export function round503SnapHeights(viewportHeight, options = {}) {
  return Object.freeze({
    compact:snapHeightForViewport('compact', viewportHeight, options),
    standard:snapHeightForViewport('standard', viewportHeight, options),
    expanded:snapHeightForViewport('expanded', viewportHeight, options),
  });
}

export function nearestSnapState(height, viewportHeight, options = {}) {
  const currentHeight = Math.max(0, Number(height) || 0);
  const viewport = Math.max(1, Number(viewportHeight) || 1);
  const dismissThreshold = Math.max(120, Math.round(viewport * 0.15));
  if (currentHeight <= dismissThreshold) return null;

  const snaps = round503SnapHeights(viewport, options);
  return Object.entries(snaps).reduce((best, [state, snapHeight]) => {
    const distance = Math.abs(currentHeight - snapHeight);
    if (!best || distance < best.distance) return { state, distance };
    return best;
  }, null)?.state || 'standard';
}

export function resolveRound503Snap({ viewportHeight, currentHeight, deltaY = 0, minHeight = 1, maxHeight } = {}) {
  const viewport = Math.max(1, Number(viewportHeight) || 1);
  const current = Math.max(0, Number(currentHeight) || snapHeightForViewport('standard', viewport, { minHeight, maxHeight: maxHeight || viewport }));
  const projected = current - (Number(deltaY) || 0);
  const state = nearestSnapState(projected, viewport, { minHeight, maxHeight: maxHeight || viewport });
  if (!state) return Object.freeze({ action:'dismiss' });
  return Object.freeze({
    action:'snap',
    snap:state,
    height:snapHeightForViewport(state, viewport, { minHeight, maxHeight: maxHeight || viewport }),
  });
}
