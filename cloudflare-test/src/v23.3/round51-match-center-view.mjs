export const ROUND51_VIEW_TABS = Object.freeze([
  Object.freeze({ key:'overview', label:'Обзор' }),
  Object.freeze({ key:'lineups', label:'Составы' }),
  Object.freeze({ key:'events', label:'События' }),
  Object.freeze({ key:'statistics', label:'Статистика' }),
  Object.freeze({ key:'shots', label:'Удары' }),
]);

const VIEW_SET = new Set(ROUND51_VIEW_TABS.map(tab => tab.key));
const PROVIDER_BY_VIEW = Object.freeze({
  overview:'overview',
  lineups:'lineups',
  events:'events',
  statistics:'stats',
  shots:'stats',
});

function text(value) {
  return String(value ?? '').trim();
}

export function canonicalRound51ViewTab(value) {
  const key = text(value).toLowerCase();
  return VIEW_SET.has(key) ? key : 'overview';
}

export function providerTabForRound51View(value) {
  return PROVIDER_BY_VIEW[canonicalRound51ViewTab(value)];
}

function findBalancedElement(html, marker, from = 0) {
  const markerPosition = html.indexOf(marker, from);
  if (markerPosition < 0) return null;
  const start = html.lastIndexOf('<', markerPosition);
  if (start < 0) return null;
  const openingEnd = html.indexOf('>', start);
  if (openingEnd < 0) return null;
  const opening = html.slice(start + 1, openingEnd);
  const tagMatch = opening.match(/^([a-z][a-z0-9-]*)\b/i);
  if (!tagMatch) return null;
  const tag = tagMatch[1];
  if (/\/$/.test(opening.trim())) return { start, end:openingEnd + 1 };

  const token = new RegExp(`<\\/?${tag}\\b`, 'gi');
  token.lastIndex = openingEnd + 1;
  let depth = 1;
  let match;
  while ((match = token.exec(html))) {
    if (html[match.index + 1] === '/') depth -= 1;
    else depth += 1;
    if (depth !== 0) continue;
    const closeEnd = html.indexOf('>', match.index);
    return closeEnd < 0 ? null : { start, end:closeEnd + 1 };
  }
  return null;
}

function removeMarkedElements(html, marker) {
  let output = String(html || '');
  while (output.includes(marker)) {
    const block = findBalancedElement(output, marker);
    if (!block) break;
    output = `${output.slice(0, block.start)}${output.slice(block.end)}`;
  }
  return output;
}

function round51Tabs(activeViewTab) {
  const active = canonicalRound51ViewTab(activeViewTab);
  return `<nav class="cw239-mc-tabs cw251-mc-tabs" data-cw239-tabs data-cw51-tabs>${ROUND51_VIEW_TABS.map(tab => {
    const selected = tab.key === active;
    return `<button type="button" class="cw239-mc-tab${selected ? ' is-active' : ''}" data-cw239-tab="${tab.key}" data-cw51-view-tab="${tab.key}" aria-selected="${selected ? 'true' : 'false'}">${tab.label}</button>`;
  }).join('')}</nav>`;
}

function replaceProviderTabs(html, activeViewTab) {
  const marker = 'data-cw239-tabs';
  const block = findBalancedElement(html, marker);
  if (!block) return html;
  return `${html.slice(0, block.start)}${round51Tabs(activeViewTab)}${html.slice(block.end)}`;
}

function statisticsView(html) {
  let output = html;
  output = removeMarkedElements(output, 'data-cw233-mc-shotmap');
  output = removeMarkedElements(output, 'data-cw502-selected-shot');
  output = removeMarkedElements(output, 'class="cw502-selected-shot');
  output = removeMarkedElements(output, 'data-cw233-mc-shot-list');
  return output;
}

function shotsView(html) {
  let output = html;
  output = removeMarkedElements(output, 'data-cw233-mc-stats-section');
  output = removeMarkedElements(output, 'data-cw250-mc-pressure');
  return output;
}

function annotateUserPrediction(html) {
  if (!html.includes('class="cw250-user-prediction"')) return html;
  return html
    .replace('class="cw250-user-prediction"', 'class="cw250-user-prediction" data-cw511-user-prediction')
    .replace(/(<div class="cw250-user-prediction" data-cw511-user-prediction>[\s\S]*?<\/div>)<b>([^<]*)<\/b><\/div>/, '$1<b data-cw511-user-prediction-score>$2</b></div>');
}

function round511FeedbackStyles() {
  return `<style data-cw511-feedback-style>
    .cw233-mc-form-run{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px}
    .cw233-mc-form-chip{min-width:0;width:100%;height:24px}
    .cw250-user-prediction{padding:15px;border-color:color-mix(in srgb,var(--mc-accent) 48%,var(--mc-border));background:linear-gradient(145deg,color-mix(in srgb,var(--mc-accent-soft) 52%,var(--mc-surface-raised)),var(--mc-surface));box-shadow:inset 0 1px 0 rgba(255,255,255,.07),0 10px 26px rgba(0,0,0,.16)}
    .cw250-user-prediction small{font-size:9px;letter-spacing:.06em}
    .cw250-user-prediction strong{font-size:12px}
    .cw250-user-prediction b{font-size:32px;min-width:84px;padding:13px 12px;border-radius:15px}
  </style>`;
}

export function enhanceRound51MatchCenterView(html, state = {}, viewState = {}) {
  let output = String(html || '');
  if (!output) return output;
  const activeViewTab = canonicalRound51ViewTab(viewState?.activeViewTab || state?.activeTab);
  output = replaceProviderTabs(output, activeViewTab);
  if (activeViewTab === 'overview') output = annotateUserPrediction(output);
  if (activeViewTab === 'statistics') output = statisticsView(output);
  if (activeViewTab === 'shots') output = shotsView(output);
  return `${output}${round511FeedbackStyles()}`;
}
