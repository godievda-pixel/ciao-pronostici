export const ROUND512_USER_VIEW_TABS = Object.freeze([
  Object.freeze({ key:'overview', label:'Обзор' }),
  Object.freeze({ key:'lineups', label:'Составы' }),
  Object.freeze({ key:'events', label:'События' }),
  Object.freeze({ key:'statistics', label:'Статистика' }),
  Object.freeze({ key:'shots', label:'Удары' }),
]);

const USER_VIEW_KEYS = new Set(ROUND512_USER_VIEW_TABS.map(tab => tab.key));
const PROVIDER_SECTION_BY_VIEW = Object.freeze({
  overview:'overview',
  lineups:'lineups',
  events:'events',
  statistics:'stats',
  shots:'stats',
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

function finite(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function list(value) {
  return Array.isArray(value) ? value.filter(item => item && typeof item === 'object') : [];
}

function findBalancedElement(html, marker, from = 0) {
  const markerPosition = html.indexOf(marker, from);
  if (markerPosition < 0) return null;
  const start = html.lastIndexOf('<', markerPosition);
  if (start < 0) return null;
  const openingEnd = html.indexOf('>', start);
  if (openingEnd < 0) return null;
  const tagMatch = html.slice(start + 1, openingEnd).match(/^([a-z][a-z0-9-]*)\b/i);
  if (!tagMatch) return null;
  const tag = tagMatch[1];
  const token = new RegExp(`<\\/?${tag}\\b`, 'gi');
  token.lastIndex = openingEnd + 1;
  let depth = 1;
  let match;
  while ((match = token.exec(html))) {
    depth += html[match.index + 1] === '/' ? -1 : 1;
    if (depth !== 0) continue;
    const closeEnd = html.indexOf('>', match.index);
    return closeEnd < 0 ? null : { start, end:closeEnd + 1, tag };
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

function insertAfterMarkedElement(html, marker, insertion) {
  if (!insertion) return html;
  const block = findBalancedElement(html, marker);
  return block ? `${html.slice(0, block.end)}${insertion}${html.slice(block.end)}` : `${html}${insertion}`;
}

function round512MobileLayoutStyles() {
  return `<style data-cw512-mobile-layout-style>
    .cw512-mc-tabs .cw239-mc-tab{font-size:9px;padding-left:1px;padding-right:1px}
    @media(max-width:430px){.cw250-recent-events{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));overflow:visible;gap:6px}.cw250-event-chip{min-width:0;max-width:none;overflow:hidden;text-overflow:ellipsis}.cw512-mc-tabs .cw239-mc-tab{font-size:8.5px}}
    @media(max-width:350px){.cw250-recent-events{grid-template-columns:1fr}}
  </style>`;
}

export function canonicalRound512UserView(value) {
  const key = text(value).toLowerCase();
  return USER_VIEW_KEYS.has(key) ? key : 'overview';
}

export function providerSectionForRound512UserView(value) {
  return PROVIDER_SECTION_BY_VIEW[canonicalRound512UserView(value)];
}

function userTabsHtml(activeUserView, state = {}) {
  return `<div class="cw239-mc-tabs cw512-mc-tabs" data-cw512-user-tabs>${ROUND512_USER_VIEW_TABS.map(tab => {
    const active = tab.key === activeUserView;
    const providerSection = providerSectionForRound512UserView(tab.key);
    const unavailable = text(state?.sectionState?.[providerSection]?.status).toLowerCase() === 'unavailable';
    return `<button type="button" class="cw239-mc-tab${active ? ' is-active' : ''}" data-cw512-user-view="${tab.key}" data-cw512-provider-section="${providerSection}" aria-selected="${active ? 'true' : 'false'}"${unavailable ? ' aria-disabled="true"' : ''}>${tab.label}</button>`;
  }).join('')}</div>`;
}

function shotClock(shot = {}) {
  const minute = finite(shot.minute);
  if (minute === null) return '—';
  const added = finite(shot.addedTime ?? shot.added_time);
  return `${Math.trunc(minute)}${added !== null && added > 0 ? `+${Math.trunc(added)}` : ''}′`;
}

function shotListHtml(stats = {}) {
  const shots = list(stats?.shots);
  if (!shots.length) return '<div class="cw512-shot-list-empty" data-cw512-shot-list>Ударов пока нет</div>';
  return `<div class="cw512-shot-list" data-cw233-mc-shot-list data-cw512-shot-list>${shots.map((shot, index) => {
    const player = text(shot.player) || 'Игрок не указан';
    const xg = finite(shot.xg);
    return `<button type="button" class="cw512-shot-row" data-cw502-action="shot" data-cw502-shot-action="${index}"><time>${esc(shotClock(shot))}</time><strong>${esc(player)}</strong>${xg === null ? '' : `<span>xG ${esc(xg.toFixed(2))}</span>`}</button>`;
  }).join('')}</div>`;
}

export function enhanceRound512MatchCenterView(html, state = {}, viewState = {}) {
  let output = String(html || '');
  if (!output) return output;

  output = `${round512MobileLayoutStyles()}${output}`;
  const activeUserView = canonicalRound512UserView(viewState.activeUserView);
  output = replaceMarkedElement(output, 'class="cw239-mc-tabs', userTabsHtml(activeUserView, state));

  if (activeUserView === 'statistics') {
    output = removeMarkedElement(output, 'data-cw233-mc-shotmap');
    output = removeMarkedElement(output, 'data-cw233-mc-shot-list');
    output = removeMarkedElement(output, 'class="cw502-selected-shot');
    return output;
  }

  if (activeUserView === 'shots') {
    output = removeMarkedElement(output, 'data-cw233-mc-stats-section');
    output = removeMarkedElement(output, 'data-cw250-mc-pressure');
    if (!output.includes('data-cw233-mc-shot-list') && !output.includes('data-cw512-shot-list')) {
      output = insertAfterMarkedElement(output, 'data-cw233-mc-shotmap', shotListHtml(state?.sections?.stats));
    }
  }

  return output;
}
