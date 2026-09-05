import { getCompetitionConfig } from '../v23.2/competition-config.mjs';
import { MATCH_CENTER_SECTIONS } from './match-center-contract.mjs';
import { matchCenterTheme, matchCenterThemeStyle } from './match-center-theme.mjs';
import { renderMatchCenterOverview } from './match-center-overview.mjs';
import { renderMatchCenterStats } from './match-center-stats.mjs';
import { renderMatchCenterEvents } from './match-center-events.mjs';
import { renderMatchCenterLineups } from './match-center-lineups.mjs';
import { renderMatchCenterPlayers } from './match-center-players.mjs';

export const MATCH_CENTER_VIEW_TABS = Object.freeze([...MATCH_CENTER_SECTIONS]);

const TAB_LABELS = Object.freeze({
  overview:'Обзор',
  stats:'Статы',
  events:'События',
  lineups:'Составы',
  players:'Игроки',
});

const SECTION_RENDERERS = Object.freeze({
  overview:renderMatchCenterOverview,
  stats:renderMatchCenterStats,
  events:renderMatchCenterEvents,
  lineups:renderMatchCenterLineups,
  players:renderMatchCenterPlayers,
});

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function hasNumber(value) {
  return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
}

function canonicalTab(value) {
  const key = String(value || '').trim().toLowerCase();
  return MATCH_CENTER_VIEW_TABS.includes(key) ? key : 'overview';
}

function competitionTitle(competition) {
  try { return getCompetitionConfig(competition).title; } catch { return 'Матч-центр'; }
}

function themeKey(competition) {
  try { return matchCenterTheme(competition).key; } catch { return 'serie-a'; }
}

function themeStyle(competition) {
  try { return matchCenterThemeStyle(competition); } catch { return ''; }
}

function kickoffText(value, timeZone) {
  const timestamp = Date.parse(value || '');
  if (!Number.isFinite(timestamp)) return 'Время уточняется';
  return new Intl.DateTimeFormat('ru-RU', {
    day:'2-digit',
    month:'2-digit',
    hour:'2-digit',
    minute:'2-digit',
    ...(timeZone ? { timeZone } : {}),
  }).format(new Date(timestamp));
}

function statusText(match) {
  const status = String(match?.status || '').trim().toLowerCase();
  if (status === 'live') return hasNumber(match?.minute) ? `LIVE · ${Number(match.minute)}′` : 'LIVE';
  if (status === 'finished') return 'Матч завершён';
  if (status === 'postponed') return 'Матч перенесён';
  if (status === 'cancelled') return 'Матч отменён';
  return 'Предстоящий матч';
}

function scoreText(match) {
  const status = String(match?.status || '').trim().toLowerCase();
  if (status !== 'live' && status !== 'finished') return '—';
  const home = match?.score?.home ?? match?.homeScore;
  const away = match?.score?.away ?? match?.awayScore;
  if (!hasNumber(home) || !hasNumber(away)) return '—';
  return `${Number(home)}:${Number(away)}`;
}

function crest(team, side) {
  const src = String(team?.crestUrl || '').trim();
  if (!src) return `<span class="cw239-mc-crest is-empty" data-cw239-crest="${side}" aria-hidden="true"></span>`;
  return `<img class="cw239-mc-crest" data-cw239-crest="${side}" src="${esc(src)}" alt="" width="64" height="64" loading="eager" decoding="async">`;
}

function tabsHtml(activeTab, sectionState = {}) {
  return MATCH_CENTER_VIEW_TABS.map(tab => {
    const active = tab === activeTab;
    const unavailable = String(sectionState?.[tab]?.status || '').trim().toLowerCase() === 'unavailable';
    return `<button type="button" class="cw239-mc-tab${active ? ' is-active' : ''}" data-cw239-tab="${tab}" aria-selected="${active ? 'true' : 'false'}"${unavailable ? ' aria-disabled="true"' : ''}>${TAB_LABELS[tab]}</button>`;
  }).join('');
}

function sectionView(state, match, activeTab) {
  const local = state?.sectionState?.[activeTab] || {};
  const status = String(local?.status || '').trim().toLowerCase();
  const coverage = match?.coverage && typeof match.coverage === 'object' ? match.coverage : {};
  const data = state?.sections?.[activeTab] ?? null;

  if (!match || status === 'loading') {
    return {
      status:'loading',
      html:'<div class="cw239-mc-message"><span class="cw239-mc-spinner" aria-hidden="true"></span><b>Загружаем раздел…</b><span>Карточка матча остаётся на месте.</span></div>',
    };
  }
  if (status === 'error') {
    return {
      status:'error',
      html:`<div class="cw239-mc-message"><b>Раздел временно недоступен</b><span>Остальные вкладки продолжают работать.</span><button type="button" data-cw239-action="retry-section" data-cw239-section="${activeTab}">Повторить</button></div>`,
    };
  }
  if (status === 'unavailable') {
    return {
      status:'unavailable',
      html:'<div class="cw239-mc-message"><b>Данные пока недоступны</b><span>Раздел появится автоматически, когда провайдер опубликует данные.</span></div>',
    };
  }
  if (status === 'idle' || data === null || data === undefined) {
    return {
      status:'idle',
      html:'<div class="cw239-mc-message"><b>Раздел готов</b><span>Данные загрузятся при открытии вкладки.</span></div>',
    };
  }

  const renderer = SECTION_RENDERERS[activeTab];
  return {
    status:'ready',
    html:renderer(data, { match, coverage }),
  };
}

function viewStyles() {
  return `<style data-cw239-match-center-style>
    .cw239-mc{--mc-text:#f7f9ff;--mc-muted:rgba(225,233,248,.66);position:relative;min-height:100%;box-sizing:border-box;padding:14px 14px 32px;color:var(--mc-text);background:var(--mc-bg,#07162e);font-family:inherit;overflow-x:hidden}
    .cw239-mc *{box-sizing:border-box}.cw239-mc-toolbar{display:grid;grid-template-columns:42px 1fr 42px;align-items:center;min-height:44px;margin-bottom:8px}.cw239-mc-toolbar strong{text-align:center;font-size:15px;letter-spacing:.02em}.cw239-mc-back{width:38px;height:38px;border:1px solid var(--mc-border);border-radius:13px;background:var(--mc-surface);color:var(--mc-text);font-size:22px;line-height:1;cursor:pointer}
    .cw239-mc-competition{text-align:center;color:var(--mc-muted);font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}.cw239-mc-kickoff{display:block;margin:6px 0 12px;text-align:center;color:var(--mc-muted);font-size:12px}
    .cw239-mc-board{display:grid;grid-template-columns:minmax(0,1fr) 92px minmax(0,1fr);align-items:center;gap:8px;padding:18px 10px;border:1px solid var(--mc-border);border-radius:22px;background:linear-gradient(145deg,var(--mc-surface),rgba(255,255,255,.025));box-shadow:0 18px 42px rgba(0,0,0,.18)}
    .cw239-mc-team{min-width:0;display:grid;justify-items:center;gap:9px;text-align:center}.cw239-mc-team b{max-width:100%;font-size:13px;line-height:1.2;overflow-wrap:anywhere}.cw239-mc-crest{width:58px;height:58px;object-fit:contain}.cw239-mc-crest.is-empty{display:block;border-radius:50%;border:1px solid var(--mc-border);background:rgba(255,255,255,.04)}
    .cw239-mc-scorebox{display:grid;justify-items:center;gap:6px}.cw239-mc-scorebox strong{font-size:27px;line-height:1;font-weight:950;letter-spacing:-.04em}.cw239-mc-scorebox span{font-size:10px;line-height:1.2;color:var(--mc-muted);font-weight:800;text-align:center}
    .cw239-mc-tabs{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:2px;margin:12px 0;padding:4px;border:1px solid var(--mc-border);border-radius:16px;background:linear-gradient(180deg,rgba(255,255,255,.055),rgba(255,255,255,.018));box-shadow:inset 0 1px 0 rgba(255,255,255,.045),0 12px 28px rgba(0,0,0,.16);overflow:hidden}.cw239-mc-tab{min-width:0;min-height:42px;padding:9px 2px;border:0;border-radius:12px;background:transparent;color:var(--mc-muted);font:inherit;font-size:9.5px;font-weight:850;cursor:pointer;white-space:nowrap;transition:background .18s ease,color .18s ease,box-shadow .18s ease,transform .18s ease}.cw239-mc-tab:not(.is-active):not([aria-disabled="true"]):active{background:rgba(255,255,255,.045);transform:scale(.985)}.cw239-mc-tab.is-active{background:linear-gradient(135deg,var(--mc-accent),var(--mc-accent-2));color:#fff;box-shadow:0 7px 20px rgba(0,0,0,.24),inset 0 1px 0 rgba(255,255,255,.2),inset 0 -1px 0 rgba(0,0,0,.12)}.cw239-mc-tab[aria-disabled="true"]{opacity:.42}
    .cw233-mc-section-heading{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:center;gap:10px;margin:0 0 10px}.cw233-mc-section-heading span{min-width:0;color:var(--mc-text);font-size:11px;font-weight:900;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.cw233-mc-section-heading span:last-child{text-align:right}.cw233-mc-section-heading b{color:var(--mc-muted);font-size:9px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;text-align:center}
    .cw239-mc-detail{min-height:126px;border:1px solid var(--mc-border);border-radius:18px;background:rgba(255,255,255,.025);padding:12px;overflow:hidden}.cw239-mc-message{min-height:100px;display:grid;place-items:center;align-content:center;gap:7px;text-align:center;color:var(--mc-muted);font-size:12px}.cw239-mc-message b{color:var(--mc-text);font-size:13px}.cw239-mc-message button{margin-top:4px;border:1px solid var(--mc-border);border-radius:10px;padding:8px 13px;background:var(--mc-surface);color:var(--mc-text);font:inherit;font-weight:800}.cw239-mc-spinner{width:18px;height:18px;border:2px solid var(--mc-border);border-top-color:var(--mc-accent-2);border-radius:50%}
    .cw239-mc-notice{margin-top:10px;padding:10px 12px;border:1px solid var(--mc-border);border-radius:12px;background:rgba(255,255,255,.035);font-size:11px;color:var(--mc-muted)}
    .cw239-mc-loading-board{min-height:132px}.cw239-mc-loading-copy{min-height:54px;display:grid;place-items:center;color:var(--mc-muted);font-size:12px;font-weight:800}
  </style>`;
}

export function renderMatchCenterView(state = {}) {
  if (state?.open === false || String(state?.phase || '') === 'closed') return '';

  const match = state?.match && typeof state.match === 'object' ? state.match : null;
  const competition = String(match?.competition || state?.competition || '').trim();
  const matchId = String(match?.matchId || state?.matchId || '').trim();
  const activeTab = canonicalTab(state?.activeTab);
  const loading = !match || String(state?.phase || '') === 'loading-base';
  const baseError = !match && String(state?.phase || '') === 'error-base';
  const viewState = baseError ? 'error' : loading ? 'loading' : 'ready';
  const theme = themeKey(competition);
  const section = sectionView(state, match, activeTab);
  const error = String(state?.error || '').trim();

  const board = match
    ? `<div class="cw239-mc-board" data-cw239-board>
        <div class="cw239-mc-team">${crest(match.homeTeam, 'home')}<b>${esc(match.homeTeam?.name || '—')}</b></div>
        <div class="cw239-mc-scorebox"><strong data-cw239-score>${esc(scoreText(match))}</strong><span data-cw239-status>${esc(statusText(match))}</span></div>
        <div class="cw239-mc-team">${crest(match.awayTeam, 'away')}<b>${esc(match.awayTeam?.name || '—')}</b></div>
      </div>`
    : `<div class="cw239-mc-board cw239-mc-loading-board" data-cw239-board><div class="cw239-mc-team"><span class="cw239-mc-crest is-empty"></span><b>&nbsp;</b></div><div class="cw239-mc-loading-copy">${baseError ? 'Не удалось загрузить матч' : 'Загружаем матч'}</div><div class="cw239-mc-team"><span class="cw239-mc-crest is-empty"></span><b>&nbsp;</b></div></div>`;

  const baseErrorAction = baseError
    ? '<div class="cw239-mc-message"><button type="button" data-cw239-action="retry-base">Повторить</button></div>'
    : '';
  const notice = error && match
    ? '<div class="cw239-mc-notice">Не удалось обновить данные. Последний полученный результат сохранён.</div>'
    : '';

  return `${viewStyles()}<section class="cw239-mc" data-cw239-match-center data-cw239-competition="${esc(competition)}" data-cw239-theme="${esc(theme)}" data-cw239-view-state="${viewState}" data-cw239-match-id="${esc(matchId)}" style="${esc(themeStyle(competition))}">
    <header class="cw239-mc-toolbar"><button type="button" class="cw239-mc-back" data-cw239-action="back" aria-label="Назад">←</button><strong>Матч-центр</strong><span aria-hidden="true"></span></header>
    <div class="cw239-mc-competition">${esc(competitionTitle(competition))}</div>
    <time class="cw239-mc-kickoff" datetime="${esc(match?.kickoffAt || '')}">${match ? esc(kickoffText(match.kickoffAt, state?.timeZone)) : 'Время уточняется'}</time>
    ${board}
    <nav class="cw239-mc-tabs" aria-label="Разделы матча">${tabsHtml(activeTab, state?.sectionState)}</nav>
    <div class="cw239-mc-detail" data-cw239-section-state="${esc(baseError ? 'error' : section.status)}" data-cw239-active-section="${esc(activeTab)}">${baseError ? baseErrorAction : section.html}</div>
    ${notice}
  </section>`;
}