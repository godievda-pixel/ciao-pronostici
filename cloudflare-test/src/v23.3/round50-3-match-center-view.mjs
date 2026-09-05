export const MATCH_CENTER_USER_TABS = Object.freeze(['overview','lineups','events','stats','shots']);
export const MATCH_CENTER_DRAWER_RATIOS = Object.freeze({ compact:0.46, standard:0.78, expanded:0.94 });

const USER_TAB_SET = new Set(MATCH_CENTER_USER_TABS);
const USER_TAB_LABELS = Object.freeze({
  overview:'Обзор',
  lineups:'Составы',
  events:'События',
  stats:'Статистика',
  shots:'Удары',
});

function text(value) {
  return String(value ?? '').trim();
}

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function canonicalViewTab(value) {
  const key = text(value).toLowerCase();
  return USER_TAB_SET.has(key) ? key : 'overview';
}

export function providerTabForView(value) {
  const key = canonicalViewTab(value);
  return key === 'shots' ? 'stats' : key;
}

export function drawerHeightForState(viewportHeight, state = 'standard') {
  const viewport = Math.max(1, Number(viewportHeight) || 1);
  const key = Object.hasOwn(MATCH_CENTER_DRAWER_RATIOS, state) ? state : 'standard';
  return viewport * MATCH_CENTER_DRAWER_RATIOS[key];
}

export function resolveDrawerSnap(viewportHeight, height, deltaY = 0) {
  const viewport = Math.max(1, Number(viewportHeight) || 1);
  const startHeight = Math.max(0, Number(height) || 0);
  const drag = Number(deltaY) || 0;
  const compact = drawerHeightForState(viewport, 'compact');
  const standard = drawerHeightForState(viewport, 'standard');
  const expanded = drawerHeightForState(viewport, 'expanded');

  const compactRange = compact * 1.12;
  const deliberateDismiss = Math.max(88, viewport * 0.12);
  if (startHeight <= compactRange && drag >= deliberateDismiss) return 'close';

  const finalHeight = Math.max(compact * 0.78, Math.min(expanded, startHeight - drag));
  const candidates = [
    ['compact', compact],
    ['standard', standard],
    ['expanded', expanded],
  ];
  candidates.sort((a, b) => Math.abs(finalHeight - a[1]) - Math.abs(finalHeight - b[1]));
  return candidates[0][0];
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

function removeMarkedElement(html, marker) {
  const block = findBalancedElement(html, marker);
  return block ? `${html.slice(0, block.start)}${html.slice(block.end)}` : html;
}

function replaceMarkedElement(html, marker, replacement) {
  const block = findBalancedElement(html, marker);
  return block ? `${html.slice(0, block.start)}${replacement}${html.slice(block.end)}` : html;
}

function transformDetail(html, transform) {
  const block = findBalancedElement(html, 'class="cw239-mc-detail');
  if (!block) return html;
  const closingStart = html.lastIndexOf(`</${block.tag}>`, block.end);
  if (closingStart < 0) return html;
  const inner = html.slice(block.openingEnd + 1, closingStart);
  return `${html.slice(0, block.openingEnd + 1)}${transform(inner)}${html.slice(closingStart)}`;
}

function unavailableForView(tab, sectionState) {
  const provider = providerTabForView(tab);
  return text(sectionState?.[provider]?.status).toLowerCase() === 'unavailable';
}

function userTabsHtml(activeViewTab, sectionState = {}) {
  const active = canonicalViewTab(activeViewTab);
  return MATCH_CENTER_USER_TABS.map(tab => {
    const selected = tab === active;
    const unavailable = unavailableForView(tab, sectionState);
    return `<button type="button" class="cw239-mc-tab${selected ? ' is-active' : ''}" data-cw239-tab="${tab}" aria-selected="${selected ? 'true' : 'false'}"${unavailable ? ' aria-disabled="true"' : ''}>${USER_TAB_LABELS[tab]}</button>`;
  }).join('');
}

function replaceUserTabs(html, activeViewTab, sectionState) {
  return replaceMarkedElement(
    html,
    'class="cw239-mc-tabs',
    `<nav class="cw239-mc-tabs" data-cw503-user-tabs aria-label="Разделы матча">${userTabsHtml(activeViewTab, sectionState)}</nav>`,
  );
}

function emptyState(title, body = '') {
  return `<div class="cw502-empty-state cw503-empty-state" data-cw503-empty-state><div><strong>${esc(title)}</strong>${body ? `<span>${esc(body)}</span>` : ''}</div></div>`;
}

function statisticsOnly(inner) {
  let output = inner;
  output = removeMarkedElement(output, 'data-cw233-mc-shotmap');
  output = removeMarkedElement(output, 'class="cw502-selected-shot');
  output = removeMarkedElement(output, 'data-cw233-mc-shot-list');
  const hasMetrics = output.includes('data-cw250-mc-stats-primary')
    || output.includes('data-cw250-mc-stats-secondary')
    || output.includes('data-cw250-mc-pressure');
  if (!hasMetrics) return emptyState('Статистика появится после начала матча');
  return output.replace(/<b>Статы<\/b>/, '<b>Статистика</b>');
}

function shotsOnly(inner) {
  let output = inner;
  output = removeMarkedElement(output, 'data-cw250-mc-stats-primary');
  output = removeMarkedElement(output, 'data-cw250-mc-stats-secondary');
  output = removeMarkedElement(output, 'data-cw250-mc-pressure');
  const hasShots = output.includes('data-cw233-mc-shotmap') || output.includes('data-cw233-mc-shot-list');
  if (!hasShots) return emptyState('Удары появятся после первого удара матча');
  return output.replace(/<b>Статы<\/b>/, '<b>Удары</b>');
}

function splitStatsView(html, activeViewTab) {
  const active = canonicalViewTab(activeViewTab);
  if (active !== 'stats' && active !== 'shots') return html;
  let output = transformDetail(html, inner => active === 'shots' ? shotsOnly(inner) : statisticsOnly(inner));
  output = output.replace(
    'data-cw239-active-section="stats"',
    `data-cw239-active-section="stats" data-cw503-active-view="${active}"`,
  );
  return output;
}

function drawerStyles() {
  return `<style data-cw503-match-center-style>
    .cw503-mc-drawer{height:100%;display:grid;grid-template-rows:28px minmax(0,1fr);overflow:hidden;border-radius:24px 24px 0 0;background:#071626;box-shadow:0 -18px 48px rgba(0,0,0,.34),inset 0 1px 0 rgba(255,255,255,.05)}
    .cw503-mc-drawer-handle{appearance:none;display:grid;place-items:center;width:100%;height:28px;padding:0;border:0;background:linear-gradient(180deg,rgba(255,255,255,.045),rgba(255,255,255,.012));touch-action:none;cursor:ns-resize}
    .cw503-mc-drawer-handle span{display:block;width:42px;height:4px;border-radius:999px;background:rgba(225,233,248,.38);box-shadow:0 1px 0 rgba(255,255,255,.08)}
    .cw503-mc-drawer-scroll{min-height:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;scrollbar-width:none;-ms-overflow-style:none;background:#071626}
    .cw503-mc-drawer-scroll::-webkit-scrollbar{display:none;width:0;height:0}
    .cw503-mc-drawer-scroll>.cw239-mc{min-height:100%;padding-top:8px;padding-bottom:max(26px,env(safe-area-inset-bottom))}
  </style>`;
}

function wrapDrawer(html) {
  if (!html || html.includes('data-cw503-drawer-shell')) return html;
  return `${drawerStyles()}<section class="cw503-mc-drawer" data-cw503-drawer-shell data-cw503-drawer-state="standard">
    <button type="button" class="cw503-mc-drawer-handle" data-cw503-drawer-handle aria-label="Изменить высоту матч-центра"><span aria-hidden="true"></span></button>
    <div class="cw503-mc-drawer-scroll" data-cw503-drawer-scroll>${html}</div>
  </section>`;
}

export function enhanceRound503MatchCenterView(html, state = {}, viewState = {}) {
  let output = String(html || '');
  if (!output) return output;
  const activeViewTab = canonicalViewTab(viewState.activeViewTab || state?.activeTab || 'overview');
  output = replaceUserTabs(output, activeViewTab, state?.sectionState || {});
  output = splitStatsView(output, activeViewTab);
  return wrapDrawer(output);
}
