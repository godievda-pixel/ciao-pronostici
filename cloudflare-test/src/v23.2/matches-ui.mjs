import { COMPETITION_KEYS, getCompetitionConfig } from './competition-config.mjs';
import { loadCompetitionMatches } from './data-client.mjs';
import { groupForCompetition, sortChronologically } from './tournament-engine.mjs';
import { buildCoppaBracket } from './coppa-bracket.mjs';

const OVERLAY_ID = 'ciao-v232-matches-overlay';
const STYLE_ID = 'ciao-v232-matches-style';
const UEFA_COMPETITIONS = new Set(['ucl','uel','uecl']);
const COPPA_STAGE_ORDER = Object.freeze([
  'Preliminary','Preliminary Round','Round of 64','Round of 32','Round of 16',
  'Quarter-finals','Quarter Finals','Quarterfinals','Semi-finals','Semi Finals','Semifinals','Final',
]);
const COPPA_STAGE_LABELS = Object.freeze({
  Preliminary:'Предварительный раунд','Preliminary Round':'Предварительный раунд',
  'Round of 64':'1/32 финала','Round of 32':'1/16 финала','Round of 16':'1/8 финала',
  'Quarter-finals':'1/4 финала','Quarter Finals':'1/4 финала',Quarterfinals:'1/4 финала',
  'Semi-finals':'1/2 финала','Semi Finals':'1/2 финала',Semifinals:'1/2 финала',Final:'Финал',
});

function esc(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function isoDate(year, month, day) { return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`; }

export function seasonDateRange(now = new Date()) {
  const date = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(date.getTime())) throw new Error('Invalid season date');
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const startYear = month >= 7 ? year : year - 1;
  return Object.freeze({ from:isoDate(startYear, 7, 1), to:isoDate(startYear + 1, 6, 30) });
}

function competitionCard(key) {
  const config = getCompetitionConfig(key);
  const hint = key === 'serie_a' ? 'Все матчи чемпионата' : key === 'coppa_italia' ? 'Все стадии кубка' : 'Матчи итальянских клубов';
  return `<button type="button" class="cw232-tournament-card" data-cw232-competition="${esc(key)}" data-cw232-theme="${esc(config.theme)}"><span class="cw232-tournament-card__eyebrow">Турнир</span><strong>${esc(config.title)}</strong><span class="cw232-tournament-card__hint">${esc(hint)}</span><span class="cw232-tournament-card__arrow" aria-hidden="true">→</span></button>`;
}

export function renderMatchesHub() {
  return `<section class="cw232-matches-hub" data-cw232-view="hub"><header class="cw232-matches-head"><span class="cw232-matches-kicker">Ciao, Web!</span><h2>Матчи</h2><p>Выбери турнир</p></header><div class="cw232-tournament-grid">${COMPETITION_KEYS.map(competitionCard).join('')}</div></section>`;
}

export function formatKickoff(value, { timeZone } = {}) {
  const time = Date.parse(value || '');
  if (!Number.isFinite(time)) return 'Время уточняется';
  const options = { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' };
  if (timeZone) options.timeZone = timeZone;
  return new Intl.DateTimeFormat('ru-RU', options).format(new Date(time));
}

function formatCardKickoff(value) {
  const time = Date.parse(value || '');
  if (!Number.isFinite(time)) return 'ВРЕМЯ УТОЧНЯЕТСЯ';
  return new Intl.DateTimeFormat('ru-RU', {
    day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit',
  }).format(new Date(time)).replace(',', ' ·');
}

function scoreText(match) {
  const home = match?.homeScore; const away = match?.awayScore;
  if (home === null || home === undefined || away === null || away === undefined) return '';
  return `${home}:${away}`;
}
function matchStatus(match) {
  if (match?.status === 'live') { const score = scoreText(match) || 'LIVE'; const minute = Number(match?.minute); return Number.isFinite(minute) ? `${score} · ${minute}′` : `${score} · LIVE`; }
  if (match?.status === 'finished') return scoreText(match) || 'Матч завершён';
  if (match?.status === 'postponed') return 'Матч перенесён';
  if (match?.status === 'cancelled') return 'Матч отменён';
  return formatKickoff(match?.kickoffAt);
}
function matchCardState(match) {
  const status = String(match?.status || 'scheduled').toLowerCase();
  if (status === 'live') {
    const minute = Number(match?.minute);
    return { badge:'LIVE', note:Number.isFinite(minute) ? `ИДЁТ МАТЧ · ${minute}′` : 'ИДЁТ МАТЧ', tone:'live' };
  }
  if (status === 'finished') return { badge:'МАТЧ ЗАВЕРШЁН', note:'ФИНАЛЬНЫЙ СЧЁТ', tone:'finished' };
  if (status === 'postponed') return { badge:'МАТЧ ПЕРЕНЕСЁН', note:'НОВАЯ ДАТА УТОЧНЯЕТСЯ', tone:'postponed' };
  if (status === 'cancelled') return { badge:'МАТЧ ОТМЕНЁН', note:'МАТЧ НЕ СОСТОИТСЯ', tone:'cancelled' };
  return { badge:'МАТЧ НЕ НАЧАЛСЯ', note:'ОЖИДАЕМ НАЧАЛО', tone:'scheduled' };
}
function matchCardScore(match) {
  const value = scoreText(match);
  if (!value) return '— : —';
  const [home, away] = value.split(':');
  return `${home} : ${away}`;
}
function teamLogo(team) {
  const url = String(team?.crestUrl || '').trim();
  if (!url) return '<span class="cw232-team-logo cw232-team-logo--empty" aria-hidden="true"></span>';
  return `<img class="cw232-team-logo" src="${esc(url)}" alt="" loading="lazy" decoding="async">`;
}
function matchCard(match) {
  const state = matchCardState(match);
  return `<article class="cw232-match-card" data-cw232-match="${esc(match?.matchId || '')}" data-cw232-match-state="${esc(state.tone)}"><div class="cw232-match-card__meta"><span class="cw232-match-card__status">${esc(state.badge)}</span><time class="cw232-match-card__kickoff" datetime="${esc(match?.kickoffAt || '')}">${esc(formatCardKickoff(match?.kickoffAt))}</time></div><div class="cw232-match-card__teams"><div class="cw232-match-team cw232-match-team--home">${teamLogo(match?.homeTeam)}<strong>${esc(match?.homeTeam?.name || '—')}</strong></div><div class="cw232-match-card__center"><span class="cw232-match-card__score">${esc(matchCardScore(match))}</span><small>${esc(state.note)}</small></div><div class="cw232-match-team cw232-match-team--away">${teamLogo(match?.awayTeam)}<strong>${esc(match?.awayTeam?.name || '—')}</strong></div></div></article>`;
}

function groupTitle(group) { const value = String(group?.key || '').trim(); return value || 'Матчи'; }
function renderMatchGroups(matches, competition) {
  const groups = groupForCompetition(matches, competition);
  return groups.length ? groups.map(group => `<section class="cw232-stage" data-cw232-stage="${esc(group.key)}"><div class="cw232-stage__title"><h3>${esc(groupTitle(group))}</h3><span>${group.matches.length}</span></div><div class="cw232-match-list">${group.matches.map(matchCard).join('')}</div></section>`).join('') : '<div class="cw232-matches-empty">Матчей в выбранном сезоне пока нет</div>';
}

function numericRound(match) {
  const direct = Number(match?.round);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const raw = String(match?.stage || '');
  const parsed = raw.match(/(?:round|matchday|тур)\s*[-–—:]?\s*(\d+)/i) || raw.match(/\b(\d+)\b/);
  const value = Number(parsed?.[1]);
  return Number.isFinite(value) && value > 0 ? value : null;
}
function coppaStageLabel(stage) { return COPPA_STAGE_LABELS[String(stage || '')] || String(stage || 'Стадия'); }
function coppaStageOrder(stage) { const index = COPPA_STAGE_ORDER.indexOf(String(stage || '')); return index < 0 ? Number.MAX_SAFE_INTEGER : index; }

export function competitionNavigationGroups(matches = [], competition = '') {
  if (competition !== 'serie_a' && !UEFA_COMPETITIONS.has(competition) && competition !== 'coppa_italia') return Object.freeze([]);
  const groups = new Map();
  for (const match of sortChronologically(Array.isArray(matches) ? matches : [])) {
    let key; let label; let order;
    if (competition === 'serie_a') {
      const round = numericRound(match);
      if (round) { key = `round:${round}`; label = String(round); order = round; }
      else { const stage = String(match?.stage || 'Этап'); key = `stage:${stage}`; label = stage; order = Number.MAX_SAFE_INTEGER; }
    } else if (UEFA_COMPETITIONS.has(competition)) {
      const round = numericRound(match);
      if (round) { key = `round:${round}`; label = `Тур ${round}`; order = round; }
      else { const stage = String(match?.stage || 'Этап'); key = `stage:${stage}`; label = stage; order = Number.MAX_SAFE_INTEGER; }
    } else {
      const stage = String(match?.stage || 'Стадия'); key = `stage:${stage}`; label = coppaStageLabel(stage); order = coppaStageOrder(stage);
    }
    if (!groups.has(key)) groups.set(key, { key, label, order, matches:[] });
    groups.get(key).matches.push(match);
  }
  return Object.freeze([...groups.values()].sort((a,b) => a.order - b.order || Date.parse(a.matches[0]?.kickoffAt || '') - Date.parse(b.matches[0]?.kickoffAt || '')).map(group => Object.freeze({ key:group.key, label:group.label, matches:Object.freeze(sortChronologically(group.matches)) })));
}

export function defaultCompetitionNavigationKey(groups = [], now = new Date()) {
  const rows = Array.isArray(groups) ? groups : [];
  if (!rows.length) return '';
  const nowMs = now instanceof Date ? now.getTime() : Date.parse(now);
  const future = rows.map(group => ({ group, first:Math.min(...group.matches.map(match => Date.parse(match?.kickoffAt || ''))) })).filter(item => Number.isFinite(item.first) && item.first >= nowMs).sort((a,b) => a.first - b.first)[0];
  return future?.group?.key || rows[rows.length - 1].key;
}

function renderNavigableGroups(matches, competition, now) {
  const groups = competitionNavigationGroups(matches, competition);
  if (!groups.length) return '<div class="cw232-matches-empty">Матчей в выбранном сезоне пока нет</div>';
  const selected = defaultCompetitionNavigationKey(groups, now) || groups[0].key;
  const tabs = `<div class="cw232-group-tabs" role="tablist" aria-label="Этапы турнира">${groups.map(group => `<button type="button" data-cw232-action="group-view" data-cw232-group-key="${esc(group.key)}" aria-selected="${group.key === selected}">${esc(group.label)}</button>`).join('')}</div>`;
  const panels = groups.map(group => `<section class="cw232-group-panel" data-cw232-group-panel="${esc(group.key)}" ${group.key === selected ? '' : 'hidden'}><div class="cw232-stage__title"><h3>${esc(group.label)}</h3><span>${group.matches.length}</span></div><div class="cw232-match-list">${group.matches.map(matchCard).join('')}</div></section>`).join('');
  return `${tabs}${panels}`;
}

function bracketMatchStatus(match) { if (match?.score) return match.score; if (match?.status === 'postponed') return 'Матч перенесён'; if (match?.status === 'cancelled') return 'Матч отменён'; return formatKickoff(match?.kickoffAt); }
function renderCoppaBracket(matches) {
  const bracket = buildCoppaBracket(matches);
  if (!bracket.rounds.length) return '<div class="cw232-matches-empty">Сетка появится после формирования 1/8 финала</div>';
  return `<div class="cw232-bracket-viewport"><div class="cw232-bracket">${bracket.rounds.map(round => `<section class="cw232-bracket-round" data-cw232-bracket-round="${esc(round.key)}"><div class="cw232-bracket-round__title">${esc(round.title)}</div><div class="cw232-bracket-round__matches">${round.matches.map(match => `<article class="cw232-bracket-match" data-cw232-match="${esc(match.id)}"><div class="cw232-bracket-team">${esc(match.homeLabel)}</div><div class="cw232-bracket-team">${esc(match.awayLabel)}</div><div class="cw232-bracket-meta">${esc(bracketMatchStatus(match))}</div></article>`).join('')}</div></section>`).join('')}</div></div>`;
}
function renderCoppaTabs() { return `<div class="cw232-coppa-tabs" role="tablist" aria-label="Раздел Кубка Италии"><button type="button" class="cw232-coppa-tab is-active" data-cw232-action="coppa-view" data-cw232-coppa-view="matches" aria-selected="true">Матчи</button><button type="button" class="cw232-coppa-tab" data-cw232-action="coppa-view" data-cw232-coppa-view="bracket" aria-selected="false">Сетка Плей-офф</button></div>`; }

export function renderCompetitionScreen(competition, data = {}, { now = new Date() } = {}) {
  const config = getCompetitionConfig(competition);
  const matches = sortChronologically(Array.isArray(data?.matches) ? data.matches : []);
  const body = competition === 'serie_a' || UEFA_COMPETITIONS.has(competition) || competition === 'coppa_italia'
    ? renderNavigableGroups(matches, competition, now)
    : renderMatchGroups(matches, competition);
  return `<section class="cw232-competition" data-cw232-view="competition" data-cw232-competition="${esc(competition)}" data-cw232-theme="${esc(config.theme)}"><header class="cw232-competition__head"><button type="button" class="cw232-back" data-cw232-action="hub" aria-label="Назад к турнирам">←</button><div><span class="cw232-matches-kicker">Матчи</span><h2>${esc(config.title)}</h2><p>${competition === 'serie_a' || competition === 'coppa_italia' ? 'Италия' : 'Итальянские клубы'}</p></div></header>${body}</section>`;
}

export async function loadCompetitionScreen(competition, { now = new Date(), loadMatches = loadCompetitionMatches } = {}) {
  const range = seasonDateRange(now);
  const data = await loadMatches(competition, range);
  return renderCompetitionScreen(competition, data, { now });
}

function renderLoading(competition) { const config = getCompetitionConfig(competition); return `<section class="cw232-competition cw232-loading" data-cw232-view="competition" data-cw232-competition="${esc(competition)}" data-cw232-theme="${esc(config.theme)}"><header class="cw232-competition__head"><button type="button" class="cw232-back" data-cw232-action="hub" aria-label="Назад к турнирам">←</button><div><span class="cw232-matches-kicker">Матчи</span><h2>${esc(config.title)}</h2><p>Загружаем календарь…</p></div></header><div class="cw232-loading-card" aria-hidden="true"></div><div class="cw232-loading-card" aria-hidden="true"></div></section>`; }
function renderLoadError(competition) { const config = getCompetitionConfig(competition); return `<section class="cw232-competition" data-cw232-view="competition" data-cw232-competition="${esc(competition)}" data-cw232-theme="${esc(config.theme)}"><header class="cw232-competition__head"><button type="button" class="cw232-back" data-cw232-action="hub" aria-label="Назад к турнирам">←</button><div><span class="cw232-matches-kicker">Матчи</span><h2>${esc(config.title)}</h2><p>Не удалось загрузить календарь</p></div></header><button type="button" class="cw232-retry" data-cw232-action="retry" data-cw232-competition="${esc(competition)}">Повторить</button></section>`; }

export function createMatchesUiController({ show, hide, loadScreen = loadCompetitionScreen } = {}) {
  if (typeof show !== 'function' || typeof hide !== 'function') throw new Error('Matches UI controller requires show and hide');
  let requestVersion = 0; let activeCompetition = '';
  function openHub() { requestVersion += 1; activeCompetition = ''; show(renderMatchesHub()); }
  function close() { requestVersion += 1; activeCompetition = ''; hide(); }
  async function openCompetition(competition) {
    getCompetitionConfig(competition);
    const version = ++requestVersion; activeCompetition = competition; show(renderLoading(competition));
    try { const html = await loadScreen(competition); if (version !== requestVersion || activeCompetition !== competition) return 'stale'; show(html); return 'loaded'; }
    catch { if (version !== requestVersion || activeCompetition !== competition) return 'stale'; show(renderLoadError(competition)); return 'error'; }
  }
  return Object.freeze({ openHub, openCompetition, close });
}

const MATCHES_CSS = `
#${OVERLAY_ID}{position:fixed;inset:0 0 calc(78px + env(safe-area-inset-bottom,0px)) 0;z-index:42;overflow-y:auto;overscroll-behavior:contain;background:#07101f;color:#fff;padding:calc(18px + env(safe-area-inset-top,0px)) 16px 28px;font-family:inherit;-webkit-overflow-scrolling:touch}#${OVERLAY_ID}[hidden]{display:none!important}#${OVERLAY_ID} *{box-sizing:border-box}.cw232-matches-hub,.cw232-competition{width:min(100%,760px);margin:0 auto}
.cw232-matches-head{padding:8px 2px 20px}.cw232-matches-kicker{display:block;font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;opacity:.58;margin-bottom:7px}.cw232-matches-head h2,.cw232-competition__head h2{margin:0;font-size:30px;line-height:1.05;letter-spacing:-.04em}.cw232-matches-head p,.cw232-competition__head p{margin:7px 0 0;color:rgba(255,255,255,.6);font-size:13px}
.cw232-tournament-grid{display:grid;gap:12px}.cw232-tournament-card{position:relative;display:grid;grid-template-columns:1fr auto;grid-template-areas:'eye arrow' 'title arrow' 'hint arrow';gap:4px 12px;width:100%;min-height:116px;padding:18px;border:1px solid rgba(255,255,255,.12);border-radius:22px;text-align:left;color:#fff;background:linear-gradient(135deg,#102a69,#07152e);box-shadow:0 14px 32px rgba(0,0,0,.2);font:inherit;overflow:hidden}.cw232-tournament-card:active{transform:scale(.985)}.cw232-tournament-card__eyebrow{grid-area:eye;font-size:10px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;opacity:.58}.cw232-tournament-card strong{grid-area:title;font-size:20px;line-height:1.08;letter-spacing:-.025em}.cw232-tournament-card__hint{grid-area:hint;font-size:12px;opacity:.68}.cw232-tournament-card__arrow{grid-area:arrow;align-self:center;font-size:25px;opacity:.72}
.cw232-tournament-card[data-cw232-theme='serie-a']{background:radial-gradient(circle at 90% 0%,rgba(40,127,199,.34),transparent 40%),linear-gradient(135deg,#0c5aa8,#071626)}.cw232-tournament-card[data-cw232-theme='coppa']{background:linear-gradient(120deg,rgba(0,146,70,.28),transparent 28%),linear-gradient(240deg,rgba(206,43,55,.34),transparent 30%),#11151d}.cw232-tournament-card[data-cw232-theme='champions']{background:radial-gradient(circle at 82% 12%,rgba(104,127,255,.5),transparent 25%),linear-gradient(145deg,#111a55,#05091e 70%)}.cw232-tournament-card[data-cw232-theme='europa']{background:radial-gradient(circle at 90% 10%,rgba(255,118,0,.5),transparent 32%),linear-gradient(145deg,#2b1606,#0d0d0f 72%)}.cw232-tournament-card[data-cw232-theme='conference']{background:radial-gradient(circle at 88% 10%,rgba(54,211,123,.42),transparent 32%),linear-gradient(145deg,#08291a,#07130e 72%)}
.cw232-competition{--cw232-match-accent:#0c5aa8;--cw232-match-accent-2:#287fc7;--cw232-match-bg:#071626;--cw232-match-border:rgba(12,90,168,.34);--cw232-match-glow:rgba(12,90,168,.16)}
.cw232-competition[data-cw232-theme='coppa']{--cw232-match-accent:#ce2b37;--cw232-match-accent-2:#009246;--cw232-match-bg:#130d10;--cw232-match-border:rgba(206,43,55,.34);--cw232-match-glow:rgba(206,43,55,.15)}
.cw232-competition[data-cw232-theme='champions']{--cw232-match-accent:#3157ff;--cw232-match-accent-2:#7b42ff;--cw232-match-bg:#080b29;--cw232-match-border:rgba(79,95,255,.34);--cw232-match-glow:rgba(49,87,255,.17)}
.cw232-competition[data-cw232-theme='europa']{--cw232-match-accent:#f06722;--cw232-match-accent-2:#ff9b32;--cw232-match-bg:#160d08;--cw232-match-border:rgba(240,103,34,.34);--cw232-match-glow:rgba(240,103,34,.16)}
.cw232-competition[data-cw232-theme='conference']{--cw232-match-accent:#22a866;--cw232-match-accent-2:#55d68e;--cw232-match-bg:#06170f;--cw232-match-border:rgba(34,168,102,.34);--cw232-match-glow:rgba(34,168,102,.16)}
.cw232-competition__head{display:flex;gap:14px;align-items:center;padding:7px 0 20px}.cw232-back{flex:0 0 44px;width:44px;height:44px;border:1px solid rgba(255,255,255,.14);border-radius:15px;background:rgba(255,255,255,.07);color:#fff;font:700 21px/1 inherit}.cw232-stage,.cw232-group-panel{margin:0 0 22px}.cw232-stage__title{display:flex;justify-content:space-between;align-items:center;margin:0 2px 9px}.cw232-stage__title h3{margin:0;font-size:13px;letter-spacing:.02em}.cw232-stage__title span{font-size:11px;opacity:.5}.cw232-match-list{display:grid;gap:11px}
.cw232-match-card{position:relative;overflow:hidden;border:1px solid color-mix(in srgb,var(--cw232-match-accent) 38%,rgba(255,255,255,.08));border-radius:22px;background:radial-gradient(circle at 50% -30%,var(--cw232-match-glow),transparent 58%),linear-gradient(145deg,color-mix(in srgb,var(--cw232-match-accent) 12%,var(--cw232-match-bg)),color-mix(in srgb,var(--cw232-match-accent-2) 7%,var(--cw232-match-bg)));padding:13px 14px 17px;box-shadow:0 14px 34px rgba(0,0,0,.18),inset 0 1px 0 rgba(255,255,255,.04);backdrop-filter:blur(14px)}
.cw232-match-card__meta{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:15px}.cw232-match-card__status{display:inline-flex;align-items:center;min-height:24px;padding:0 9px;border:1px solid color-mix(in srgb,var(--cw232-match-accent) 52%,transparent);border-radius:999px;background:color-mix(in srgb,var(--cw232-match-accent) 16%,transparent);color:color-mix(in srgb,var(--cw232-match-accent-2) 45%,white 55%);font-size:8px;font-weight:900;letter-spacing:.07em;white-space:nowrap}.cw232-match-card[data-cw232-match-state='live'] .cw232-match-card__status{background:linear-gradient(135deg,var(--cw232-match-accent),var(--cw232-match-accent-2));color:#fff;border-color:transparent}.cw232-match-card__kickoff{font-size:10px;font-weight:800;color:rgba(235,241,252,.62);font-variant-numeric:tabular-nums;white-space:nowrap}
.cw232-match-card__teams{display:grid;grid-template-columns:minmax(0,1fr) 96px minmax(0,1fr);align-items:center;gap:10px}.cw232-match-team{display:flex;min-width:0;flex-direction:column;align-items:center;justify-content:center;gap:8px;text-align:center}.cw232-match-team--away{flex-direction:column;text-align:center}.cw232-match-team strong{font-size:12px;line-height:1.2;overflow-wrap:anywhere}.cw232-team-logo{width:46px;height:46px;object-fit:contain;flex:0 0 46px;filter:drop-shadow(0 7px 10px rgba(0,0,0,.22))}.cw232-team-logo--empty{border-radius:50%;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.08)}.cw232-match-card__center{text-align:center;min-width:0}.cw232-match-card__score{display:block;font-size:22px;font-weight:900;letter-spacing:-.035em;white-space:nowrap}.cw232-match-card__center small{display:block;margin-top:5px;font-size:8px;font-weight:850;letter-spacing:.065em;line-height:1.25;color:rgba(235,241,252,.52)}
.cw232-group-tabs{display:flex;gap:7px;max-width:100%;overflow-x:auto;scrollbar-width:none;padding:0 0 13px}.cw232-group-tabs::-webkit-scrollbar{display:none}.cw232-group-tabs button{flex:0 0 auto;min-width:52px;min-height:38px;padding:0 13px;border:1px solid var(--cw232-match-border);border-radius:13px;background:rgba(255,255,255,.05);color:rgba(226,233,255,.72);font:800 11px/1 inherit}.cw232-group-tabs button[aria-selected='true']{background:linear-gradient(135deg,var(--cw232-match-accent),var(--cw232-match-accent-2));border-color:color-mix(in srgb,var(--cw232-match-accent) 55%,white 8%);color:#fff;box-shadow:0 7px 20px color-mix(in srgb,var(--cw232-match-accent) 24%,transparent)}.cw232-group-panel[hidden]{display:none!important}
.cw232-coppa-tabs{display:flex;gap:6px;padding:4px;margin:0 0 18px;border:1px solid var(--cw232-match-border);border-radius:16px;background:rgba(255,255,255,.045)}.cw232-coppa-tab{flex:1;min-height:42px;border:0;border-radius:12px;background:transparent;color:rgba(255,255,255,.62);font:800 12px/1.15 inherit;padding:10px}.cw232-coppa-tab.is-active{background:linear-gradient(135deg,var(--cw232-match-accent-2),var(--cw232-match-accent));color:#fff;box-shadow:inset 0 0 0 1px rgba(255,255,255,.08)}.cw232-coppa-panel[hidden]{display:none!important}.cw232-bracket-viewport{width:100%;max-width:100%;overflow-x:auto;overflow-y:hidden;overscroll-behavior-x:contain;-webkit-overflow-scrolling:touch;padding:2px 0 12px}.cw232-bracket{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(220px,260px);gap:16px;min-width:max-content;align-items:start}.cw232-bracket-round{min-width:0}.cw232-bracket-round__title{position:sticky;left:0;margin:0 0 9px;font-size:12px;font-weight:850;letter-spacing:.04em;color:rgba(255,255,255,.72)}.cw232-bracket-round__matches{display:grid;gap:12px}.cw232-bracket-match{border:1px solid var(--cw232-match-border);border-radius:17px;background:linear-gradient(145deg,color-mix(in srgb,var(--cw232-match-accent) 10%,var(--cw232-match-bg)),color-mix(in srgb,var(--cw232-match-accent-2) 6%,var(--cw232-match-bg)));padding:12px}.cw232-bracket-team{min-height:34px;display:flex;align-items:center;padding:7px 9px;border-radius:10px;background:rgba(255,255,255,.055);font-size:11px;font-weight:750;line-height:1.2}.cw232-bracket-team+.cw232-bracket-team{margin-top:5px}.cw232-bracket-meta{margin-top:8px;font-size:9px;color:rgba(255,255,255,.52);text-align:center}
.cw232-loading-card{height:95px;border-radius:19px;background:linear-gradient(90deg,rgba(255,255,255,.04),rgba(255,255,255,.1),rgba(255,255,255,.04));background-size:220% 100%;animation:cw232pulse 1.25s linear infinite;margin:0 0 9px}.cw232-matches-empty{padding:26px 18px;border:1px solid rgba(255,255,255,.09);border-radius:19px;color:rgba(255,255,255,.62);text-align:center}.cw232-retry{width:100%;border:0;border-radius:16px;padding:14px 16px;background:#fff;color:#07101f;font:800 13px/1 inherit}@keyframes cw232pulse{to{background-position:-220% 0}}@media(max-width:390px){#${OVERLAY_ID}{padding-left:12px;padding-right:12px}.cw232-match-card__teams{grid-template-columns:minmax(0,1fr) 82px minmax(0,1fr)}.cw232-team-logo{width:40px;height:40px;flex-basis:40px}.cw232-match-team strong{font-size:11px}.cw232-match-card__score{font-size:19px}.cw232-match-card__status{font-size:7px;padding:0 7px}.cw232-match-card__kickoff{font-size:9px}.cw232-matches-head h2,.cw232-competition__head h2{font-size:27px}.cw232-coppa-tab{font-size:11px}}
`;

function ensureStyles(documentRef) { if (documentRef.getElementById(STYLE_ID)) return; const style = documentRef.createElement('style'); style.id = STYLE_ID; style.textContent = MATCHES_CSS; documentRef.head?.appendChild?.(style); }
function ensureOverlay(documentRef) { let overlay = documentRef.getElementById(OVERLAY_ID); if (overlay) return overlay; overlay = documentRef.createElement('div'); overlay.id = OVERLAY_ID; overlay.className = 'cw232-matches-overlay'; overlay.hidden = true; overlay.setAttribute?.('aria-live', 'polite'); const mount = documentRef.getElementById('ciao-miniapp-root') || documentRef.body; mount?.appendChild?.(overlay); return overlay; }
function clearMatchesAmbientTheme(overlay) { if (!overlay?.dataset) return; delete overlay.dataset.cw233Round10Theme; overlay.removeAttribute?.('data-cw233-round10-theme'); }
function switchCoppaView(overlay, view) { if (!overlay?.querySelectorAll || !['matches','bracket'].includes(view)) return; for (const tab of overlay.querySelectorAll('[data-cw232-coppa-view]')) { const active = tab.dataset?.cw232CoppaView === view; tab.classList?.toggle?.('is-active', active); tab.setAttribute?.('aria-selected', active ? 'true' : 'false'); } for (const panel of overlay.querySelectorAll('[data-cw232-coppa-panel]')) panel.hidden = panel.dataset?.cw232CoppaPanel !== view; }
function switchGroupView(overlay, key) { if (!overlay?.querySelectorAll || !key) return; for (const tab of overlay.querySelectorAll('[data-cw232-group-key]')) tab.setAttribute?.('aria-selected', tab.dataset?.cw232GroupKey === key ? 'true' : 'false'); for (const panel of overlay.querySelectorAll('[data-cw232-group-panel]')) panel.hidden = panel.dataset?.cw232GroupPanel !== key; }
function deferMatchesNav(fn) {
  if (typeof globalThis.queueMicrotask === 'function') globalThis.queueMicrotask(fn);
  else Promise.resolve().then(fn);
}

export function installMatchesUi(documentRef = globalThis.document, { defer = deferMatchesNav, loadScreen = loadCompetitionScreen } = {}) {
  if (!documentRef?.addEventListener || !documentRef?.createElement) return null;
  ensureStyles(documentRef); const overlay = ensureOverlay(documentRef);
  const controller = createMatchesUiController({ show(html){ overlay.innerHTML = html; overlay.hidden = false; if (typeof overlay.scrollTo === 'function') overlay.scrollTo(0,0); }, hide(){ overlay.hidden = true; overlay.innerHTML = ''; }, loadScreen });
  let pendingNavigationTab = '';
  const handleNav = nav => {
    const tab = String(nav?.dataset?.tab || '');
    const opensHub = tab === 'calendar';
    if (opensHub) {
      pendingNavigationTab = '';
      clearMatchesAmbientTheme(overlay);
      defer(() => controller.openHub());
      return;
    }
    if (overlay.hidden !== true) pendingNavigationTab = tab;
  };
  const onNavigationReady = event => {
    const readyTab = String(event?.detail?.tab || '');
    if (!pendingNavigationTab || readyTab !== pendingNavigationTab) return;
    pendingNavigationTab = '';
    controller.close();
  };
  documentRef.addEventListener('ciao-v233-navigation-ready', onNavigationReady);
  const navButtons = documentRef.querySelectorAll?.('button[data-tab]') || [];
  for (const nav of navButtons) { if (!nav?.addEventListener || nav.dataset?.cw232NavBound === '1') continue; if (nav.dataset) nav.dataset.cw232NavBound = '1'; nav.addEventListener('click', () => handleNav(nav)); }
  documentRef.addEventListener('click', event => {
    const target = event?.target; if (!target?.closest) return;
    const nav = target.closest('button[data-tab]'); if (nav) { if (nav.dataset?.cw232NavBound !== '1') handleNav(nav); return; }
    const action = target.closest('[data-cw232-action]');
    if (action?.dataset?.cw232Action === 'hub') { event.preventDefault?.(); event.stopPropagation?.(); clearMatchesAmbientTheme(overlay); controller.openHub(); return; }
    if (action?.dataset?.cw232Action === 'retry') { event.preventDefault?.(); event.stopPropagation?.(); const competition = action.dataset?.cw232Competition; if (competition) void controller.openCompetition(competition); return; }
    if (action?.dataset?.cw232Action === 'coppa-view') { event.preventDefault?.(); event.stopPropagation?.(); switchCoppaView(overlay, action.dataset?.cw232CoppaView || 'matches'); return; }
    if (action?.dataset?.cw232Action === 'group-view') { event.preventDefault?.(); event.stopPropagation?.(); switchGroupView(overlay, action.dataset?.cw232GroupKey || ''); return; }
    const card = target.closest('.cw232-tournament-card[data-cw232-competition]'); if (card?.dataset?.cw232Competition) { event.preventDefault?.(); event.stopPropagation?.(); void controller.openCompetition(card.dataset.cw232Competition); }
  }, true);
  return controller;
}

if (typeof document !== 'undefined') installMatchesUi(document);