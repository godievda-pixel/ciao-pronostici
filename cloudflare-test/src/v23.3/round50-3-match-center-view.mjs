function text(value) {
  return String(value ?? '').trim();
}

export const ROUND503_VIEW_TABS = Object.freeze([
  Object.freeze({ key:'overview', label:'Обзор', provider:'overview' }),
  Object.freeze({ key:'lineups', label:'Составы', provider:'lineups' }),
  Object.freeze({ key:'events', label:'События', provider:'events' }),
  Object.freeze({ key:'statistics', label:'Статистика', provider:'stats' }),
  Object.freeze({ key:'shots', label:'Удары', provider:'stats' }),
]);

const ROUND503_VIEW_KEYS = new Set(ROUND503_VIEW_TABS.map(tab => tab.key));

export function canonicalRound503ViewTab(value) {
  const key = text(value).toLowerCase();
  return ROUND503_VIEW_KEYS.has(key) ? key : 'overview';
}

export function providerTabForRound503View(value) {
  const key = canonicalRound503ViewTab(value);
  return ROUND503_VIEW_TABS.find(tab => tab.key === key)?.provider || 'overview';
}

export function round503SnapHeights(viewportHeight) {
  const height = Math.max(0, Number(viewportHeight) || 0);
  return Object.freeze({
    compact:Math.round(height * 0.46),
    standard:Math.round(height * 0.78),
    expanded:Math.round(height * 0.94),
  });
}

export function resolveRound503Snap({ viewportHeight, currentHeight, deltaY = 0 } = {}) {
  const snaps = round503SnapHeights(viewportHeight);
  const height = Number(currentHeight);
  const current = Number.isFinite(height) && height > 0 ? height : snaps.standard;
  const drag = Number(deltaY) || 0;
  const viewport = Math.max(0, Number(viewportHeight) || 0);
  const dismissThreshold = Math.max(84, viewport * 0.12);
  const compactRangeEnd = (snaps.compact + snaps.standard) / 2;

  if (current <= compactRangeEnd && drag >= dismissThreshold) {
    return Object.freeze({ action:'dismiss' });
  }

  const projected = current - drag;
  const nearest = Object.entries(snaps).reduce((best, [snap, snapHeight]) => {
    const distance = Math.abs(projected - snapHeight);
    if (!best || distance < best.distance) return { snap, height:snapHeight, distance };
    return best;
  }, null);

  return Object.freeze({ action:'snap', snap:nearest.snap, height:nearest.height });
}
