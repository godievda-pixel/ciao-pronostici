function text(value) {
  return String(value ?? '').trim();
}

export const ROUND50_3_BUILD = 'round50-3-rebuild-bottom-drawer-seamless-refresh';

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
  const snaps = round503SnapHeights(viewportHeight, options);
  return Object.entries(snaps).reduce((best, [state, snapHeight]) => {
    const distance = Math.abs(currentHeight - snapHeight);
    if (!best || distance < best.distance) return { state, distance };
    return best;
  }, null)?.state || 'standard';
}

export function resolveRound503Snap({ viewportHeight, currentHeight, deltaY = 0, minHeight = 1, maxHeight } = {}) {
  const viewport = Math.max(1, Number(viewportHeight) || 1);
  const options = { minHeight, maxHeight:maxHeight || viewport };
  const snaps = round503SnapHeights(viewport, options);
  const suppliedHeight = Number(currentHeight);
  const current = Number.isFinite(suppliedHeight) && suppliedHeight > 0 ? suppliedHeight : snaps.standard;
  const drag = Number(deltaY) || 0;
  const dismissThreshold = Math.max(84, viewport * 0.12);
  const compactRangeEnd = (snaps.compact + snaps.standard) / 2;

  if (current <= compactRangeEnd && drag >= dismissThreshold) {
    return Object.freeze({ action:'dismiss' });
  }

  const projected = current - drag;
  const state = nearestSnapState(projected, viewport, options);
  return Object.freeze({ action:'snap', snap:state, height:snaps[state] });
}

function openingTagStart(html, markerPosition) {
  return html.lastIndexOf('<', markerPosition);
}

function findBalancedElement(html, marker, from = 0) {
  const markerPosition = html.indexOf(marker, from);
  if (markerPosition < 0) return null;
  const start = openingTagStart(html, markerPosition);
  if (start < 0) return null;
  const openingEnd = html.indexOf('>', start);
  if (openingEnd < 0) return null;
  const opening = html.slice(start + 1, openingEnd);
  const tagMatch = opening.match(/^([a-z][a-z0-9-]*)\b/i);
  if (!tagMatch) return null;
  const tag = tagMatch[1];
  const token = new RegExp(`<\\/?${tag}\\b`, 'gi');
  token.lastIndex = openingEnd + 1;
  let depth = 1;
  let match;
  while ((match = token.exec(html))) {
    if (html[match.index + 1] === '/') depth -= 1;
    else depth += 1;
    if (depth !== 0) continue;
    const closeEnd = html.indexOf('>', match.index);
    if (closeEnd < 0) return null;
    return { start, openingEnd, end:closeEnd + 1, tag };
  }
  return null;
}

function removeMarkedElements(html, marker) {
  let output = String(html || '');
  while (true) {
    const block = findBalancedElement(output, marker);
    if (!block) return output;
    output = `${output.slice(0, block.start)}${output.slice(block.end)}`;
  }
}

function replaceMarkedElement(html, marker, replacement) {
  const block = findBalancedElement(html, marker);
  return block ? `${html.slice(0, block.start)}${replacement}${html.slice(block.end)}` : html;
}

function replaceActiveStatsInner(html, transform) {
  const block = findBalancedElement(html, 'data-cw239-active-section="stats"');
  if (!block) return html;
  const closingStart = html.lastIndexOf(`</${block.tag}>`, block.end);
  if (closingStart < 0) return html;
  const inner = html.slice(block.openingEnd + 1, closingStart);
  return `${html.slice(0, block.openingEnd + 1)}${transform(inner)}${html.slice(closingStart)}`;
}

function userTabs(activeViewTab) {
  const active = canonicalRound503ViewTab(activeViewTab);
  return `<nav class="cw239-mc-tabs cw503-mc-tabs" data-cw239-tabs data-cw503-tabs role="tablist" aria-label="Разделы матча">${ROUND503_VIEW_TABS.map(tab => `<button type="button" class="cw239-mc-tab${tab.key === active ? ' is-active' : ''}" data-cw239-tab="${tab.key}" data-cw503-view-tab="${tab.key}" role="tab" aria-selected="${tab.key === active}">${tab.label}</button>`).join('')}</nav>`;
}

function statisticsOnly(inner) {
  let output = removeMarkedElements(inner, 'data-cw233-mc-shotmap');
  output = removeMarkedElements(output, 'data-cw233-mc-shot-list');
  output = removeMarkedElements(output, 'class="cw502-selected-shot');
  return output;
}

function shotsOnly(inner) {
  let output = removeMarkedElements(inner, 'data-cw233-mc-stats-section=');
  output = removeMarkedElements(output, 'data-cw250-mc-pressure');
  return output;
}

export function enhanceRound503MatchCenterView(html, state = {}, viewState = {}) {
  const activeView = canonicalRound503ViewTab(viewState.activeViewTab || state.activeTab);
  let output = replaceMarkedElement(String(html || ''), 'data-cw239-tabs', userTabs(activeView));

  if (state.activeTab !== 'stats') return output;
  if (activeView === 'statistics') output = replaceActiveStatsInner(output, statisticsOnly);
  else if (activeView === 'shots') output = replaceActiveStatsInner(output, shotsOnly);

  return output;
}
