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
  if (!src) return `<span class="cw239-mc-crest is-empty" data-cw239-crest="${side}" aria-hidden="true"><i></i></span>`;
  return `<img class="cw239-mc-crest" data-cw239-crest="${side}" src="${esc(src)}" alt="" width="64" height="64" loading="eager" decoding="async">`;
}

function goalClock(goal = {}) {
  if (!hasNumber(goal.minute)) return '';
  const minute = Number(goal.minute);
  const added = hasNumber(goal.addedTime) && Number(goal.addedTime) > 0 ? `+${Number(goal.addedTime)}` : '';
  return `${minute}${added}′`;
}

function goalQualifier(kind) {
  const key = String(kind || '').trim().toLowerCase();
  if (key === 'penalty') return '(П)';
  if (key === 'own_goal') return '(АГ)';
  if (key === 'free_kick') return '(ШТ)';
  return '';
}

function scorerList(goals, side) {
  const rows = Array.isArray(goals) ? goals.filter(goal => goal && typeof goal === 'object') : [];
  if (!rows.length) return '';
  return `<div class="cw239-mc-scorers" data-cw239-scorers="${side}">${rows.map(goal => {
    const player = String(goal.player || '').trim() || 'Гол';
    const clock = goalClock(goal);
    const qualifier = goalQualifier(goal.kind);
    const meta = [clock, qualifier].filter(Boolean).join(' ');
    return `<span class="cw239-mc-scorer"><b>${esc(player)}</b>${meta ? `<small>${esc(meta)}</small>` : ''}</span>`;
  }).join('')}</div>`;
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
    .cw239-mc{--mc-text:#f7f9ff;--mc-muted:rgba(225,233,248,.66);position:relative;min-height:100%;box-sizing:border-box;padding:14px 14px 32px;color:var(--mc-text);background:radial-gradient(circle at 76% -8%,var(--mc-glow),transparent 31%),linear-gradient(180deg,var(--mc-bg) 0%,var(--mc-bg-deep) 100%);font-family:inherit;overflow-x:hidden;scrollbar-width:none;-ms-overflow-style:none}
    .cw239-mc::-webkit-scrollbar{display:none;width:0;height:0}
    #ciao-miniapp-root:has(.cw239-mc),#ciao-v232-matches-overlay:has(.cw239-mc),.content:has(.cw239-mc){scrollbar-width:none;-ms-overflow-style:none}
    #ciao-miniapp-root:has(.cw239-mc)::-webkit-scrollbar,#ciao-v232-matches-overlay:has(.cw239-mc)::-webkit-scrollbar,.content:has(.cw239-mc)::-webkit-scrollbar{display:none;width:0;height:0}
    .cw239-mc *{box-sizing:border-box}.cw239-mc::before{content:'';position:absolute;inset:0 0 auto;height:210px;pointer-events:none;background:radial-gradient(ellipse at 50% 0,var(--mc-accent-soft),transparent 68%);opacity:.9}
    .cw239-mc-toolbar{position:relative;z-index:1;display:grid;grid-template-columns:42px 1fr 42px;align-items:center;min-height:44px;margin-bottom:8px}.cw239-mc-toolbar strong{text-align:center;font-size:15px;font-weight:900;letter-spacing:.02em}.cw239-mc-back{width:38px;height:38px;border:1px solid var(--mc-border);border-radius:13px;background:linear-gradient(145deg,var(--mc-surface-raised),var(--mc-surface));color:var(--mc-text);font-size:21px;line-height:1;cursor:pointer;box-shadow:inset 0 1px 0 rgba(255,255,255,.07),0 8px 22px rgba(0,0,0,.16)}
    .cw239-mc-competition{position:relative;z-index:1;text-align:center;color:var(--mc-muted);font-size:11px;font-weight:850;letter-spacing:.1em;text-transform:uppercase}.cw239-mc-kickoff{position:relative;z-index:1;display:block;margin:6px 0 12px;text-align:center;color:var(--mc-muted);font-size:12px;font-weight:700}
    .cw239-mc-board{position:relative;z-index:1;isolation:isolate;display:grid;grid-template-columns:minmax(0,1fr) 92px minmax(0,1fr);align-items:start;gap:8px;min-height:142px;padding:18px 10px 16px;border:1px solid var(--mc-border-strong);border-radius:24px;background:linear-gradient(145deg,var(--mc-surface-raised),var(--mc-surface-2));box-shadow:inset 0 1px 0 rgba(255,255,255,.075),0 20px 48px rgba(0,0,0,.23),0 0 42px color-mix(in srgb,var(--mc-glow) 42%,transparent);overflow:hidden}.cw239-mc-board::after{content:'';position:absolute;z-index:-1;inset:-55% 28% auto;height:150px;background:radial-gradient(circle,var(--mc-accent-soft),transparent 68%);filter:blur(4px)}
    .cw239-mc-team{min-width:0;display:grid;justify-items:center;align-content:start;gap:8px;text-align:center}.cw239-mc-team> b{max-width:100%;font-size:13px;line-height:1.2;font-weight:900;overflow-wrap:anywhere}.cw239-mc-crest{width:58px;height:58px;object-fit:contain;filter:drop-shadow(0 8px 12px rgba(0,0,0,.22))}.cw239-mc-crest.is-empty{display:grid;place-items:center;width:48px;height:48px;margin:5px;border-radius:16px;border:1px solid var(--mc-border);background:linear-gradient(145deg,rgba(255,255,255,.055),rgba(255,255,255,.018));box-shadow:inset 0 1px 0 rgba(255,255,255,.05)}.cw239-mc-crest.is-empty i{width:14px;height:14px;border:1px solid var(--mc-border-strong);border-radius:5px;transform:rotate(45deg);opacity:.7}
    .cw239-mc-scorers{width:100%;display:grid;gap:3px;margin-top:1px}.cw239-mc-scorer{min-width:0;display:flex;align-items:baseline;justify-content:center;gap:4px;font-size:9px;line-height:1.2}.cw239-mc-scorer b{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:9px;font-weight:820;color:var(--mc-text)}.cw239-mc-scorer small{flex:0 0 auto;font-size:8px;font-weight:850;color:var(--mc-muted)}
    .cw239-mc-scorebox{align-self:center;display:grid;justify-items:center;gap:6px;padding-top:16px}.cw239-mc-scorebox strong{font-size:29px;line-height:1;font-weight:950;letter-spacing:-.045em;text-shadow:0 7px 24px var(--mc-glow)}.cw239-mc-scorebox span{font-size:9px;line-height:1.25;color:var(--mc-muted);font-weight:850;text-align:center}
    .cw239-mc-tabs{position:relative;z-index:1;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:2px;margin:12px 0;padding:4px;border:1px solid var(--mc-border);border-radius:16px;background:linear-gradient(180deg,var(--mc-surface),rgba(255,255,255,.018));box-shadow:inset 0 1px 0 rgba(255,255,255,.045),0 12px 28px rgba(0,0,0,.16);overflow:hidden}.cw239-mc-tab{min-width:0;min-height:42px;padding:9px 2px;border:0;border-radius:12px;background:transparent;color:var(--mc-muted);font:inherit;font-size:9.5px;font-weight:850;cursor:pointer;white-space:nowrap;transition:background .18s ease,color .18s ease,box-shadow .18s ease,transform .18s ease}.cw239-mc-tab:not(.is-active):not([aria-disabled="true"]):active{background:rgba(255,255,255,.045);transform:scale(.985)}.cw239-mc-tab.is-active{background:linear-gradient(135deg,var(--mc-accent),var(--mc-accent-2));color:#fff;box-shadow:0 7px 20px rgba(0,0,0,.24),0 0 22px var(--mc-accent-soft),inset 0 1px 0 rgba(255,255,255,.2),inset 0 -1px 0 rgba(0,0,0,.12)}.cw239-mc-tab[aria-disabled="true"]{opacity:.42}
    .cw233-mc-section-heading{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:center;gap:10px;margin:0 0 10px}.cw233-mc-section-heading span{min-width:0;color:var(--mc-text);font-size:11px;font-weight:900;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.cw233-mc-section-heading span:last-child{text-align:right}.cw233-mc-section-heading b{color:var(--mc-muted);font-size:9px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;text-align:center}
    .cw239-mc-detail{position:relative;z-index:1;min-height:126px;border:1px solid var(--mc-border);border-radius:20px;background:linear-gradient(160deg,var(--mc-surface),rgba(255,255,255,.018));padding:12px;overflow:hidden;box-shadow:inset 0 1px 0 rgba(255,255,255,.035),0 16px 34px rgba(0,0,0,.13)}.cw239-mc-message{min-height:100px;display:grid;place-items:center;align-content:center;gap:7px;text-align:center;color:var(--mc-muted);font-size:12px}.cw239-mc-message b{color:var(--mc-text);font-size:13px}.cw239-mc-message button{margin-top:4px;border:1px solid var(--mc-border);border-radius:10px;padding:8px 13px;background:var(--mc-surface-raised);color:var(--mc-text);font:inherit;font-weight:800}.cw239-mc-spinner{width:18px;height:18px;border:2px solid var(--mc-border);border-top-color:var(--mc-accent-2);border-radius:50%}
    .cw239-mc-notice{position:relative;z-index:1;margin-top:10px;padding:10px 12px;border:1px solid var(--mc-border);border-radius:12px;background:var(--mc-surface);font-size:11px;color:var(--mc-muted)}
    .cw239-mc-loading-board{min-height:132px}.cw239-mc-loading-copy{align-self:center;min-height:54px;display:grid;place-items:center;color:var(--mc-muted);font-size:12px;font-weight:800}
    @media(max-width:339px){.cw239-mc{padding-left:10px;padding-right:10px}.cw239-mc-board{grid-template-columns:minmax(0,1fr) 72px minmax(0,1fr);gap:4px;padding-left:7px;padding-right:7px}.cw239-mc-crest{width:50px;height:50px}.cw239-mc-team> b{font-size:11px}.cw239-mc-scorebox strong{font-size:25px}.cw239-mc-scorebox span{font-size:8px}.cw239-mc-scorer{gap:2px}.cw239-mc-scorer b{font-size:8px}.cw239-mc-scorer small{font-size:7px}.cw239-mc-tab{font-size:8px;padding-left:1px;padding-right:1px}}
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
        <div class="cw239-mc-team">${crest(match.homeTeam, 'home')}<b>${esc(match.homeTeam?.name || '—')}</b>${scorerList(match.goals?.home, 'home')}</div>
        <div class="cw239-mc-scorebox"><strong data-cw239-score>${esc(scoreText(match))}</strong><span data-cw239-status>${esc(statusText(match))}</span></div>
        <div class="cw239-mc-team">${crest(match.awayTeam, 'away')}<b>${esc(match.awayTeam?.name || '—')}</b>${scorerList(match.goals?.away, 'away')}</div>
      </div>`
    : `<div class="cw239-mc-board cw239-mc-loading-board" data-cw239-board><div class="cw239-mc-team"><span class="cw239-mc-crest is-empty"><i></i></span><b>&nbsp;</b></div><div class="cw239-mc-loading-copy">${baseError ? 'Не удалось загрузить матч' : 'Загружаем матч'}</div><div class="cw239-mc-team"><span class="cw239-mc-crest is-empty"><i></i></span><b>&nbsp;</b></div></div>`;

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

export { goalClock, goalQualifier, scorerList };
