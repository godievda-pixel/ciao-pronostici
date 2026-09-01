import { COMPETITION_KEYS, getCompetitionConfig } from './competition-config.mjs';
import { loadCompetitionMatches } from './data-client.mjs';
import { groupForCompetition, sortChronologically } from './tournament-engine.mjs';

const OVERLAY_ID = 'ciao-v232-matches-overlay';
const STYLE_ID = 'ciao-v232-matches-style';

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isoDate(year, month, day) {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function seasonDateRange(now = new Date()) {
  const date = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(date.getTime())) throw new Error('Invalid season date');

  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const startYear = month >= 7 ? year : year - 1;

  return Object.freeze({
    from: isoDate(startYear, 7, 1),
    to: isoDate(startYear + 1, 6, 30),
  });
}

function competitionCard(key) {
  const config = getCompetitionConfig(key);
  const hint = key === 'serie_a'
    ? 'Все матчи чемпионата'
    : key === 'coppa_italia'
      ? 'Все стадии кубка'
      : 'Матчи итальянских клубов';

  return `<button type="button" class="cw232-tournament-card" data-cw232-competition="${esc(key)}" data-cw232-theme="${esc(config.theme)}">
    <span class="cw232-tournament-card__eyebrow">Турнир</span>
    <strong>${esc(config.title)}</strong>
    <span class="cw232-tournament-card__hint">${esc(hint)}</span>
    <span class="cw232-tournament-card__arrow" aria-hidden="true">→</span>
  </button>`;
}

export function renderMatchesHub() {
  return `<section class="cw232-matches-hub" data-cw232-view="hub">
    <header class="cw232-matches-head">
      <span class="cw232-matches-kicker">Ciao, Web!</span>
      <h2>Матчи</h2>
      <p>Выбери турнир</p>
    </header>
    <div class="cw232-tournament-grid">
      ${COMPETITION_KEYS.map(competitionCard).join('')}
    </div>
  </section>`;
}

function formatKickoff(value) {
  const time = Date.parse(value || '');
  if (!Number.isFinite(time)) return 'Время уточняется';
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Rome',
  }).format(new Date(time));
}

function scoreText(match) {
  const home = match?.homeScore;
  const away = match?.awayScore;
  if (home === null || home === undefined || away === null || away === undefined) return '';
  return `${home}:${away}`;
}

function matchStatus(match) {
  if (match?.status === 'live') {
    const score = scoreText(match) || 'LIVE';
    const minute = Number(match?.minute);
    return Number.isFinite(minute) ? `${score} · ${minute}′` : `${score} · LIVE`;
  }
  if (match?.status === 'finished') return scoreText(match) || 'Матч завершён';
  if (match?.status === 'postponed') return 'Матч перенесён';
  if (match?.status === 'cancelled') return 'Матч отменён';
  return formatKickoff(match?.kickoffAt);
}

function teamLogo(team) {
  const url = String(team?.crestUrl || '').trim();
  if (!url) return '<span class="cw232-team-logo cw232-team-logo--empty" aria-hidden="true"></span>';
  return `<img class="cw232-team-logo" src="${esc(url)}" alt="" loading="lazy" decoding="async">`;
}

function matchCard(match) {
  return `<article class="cw232-match-card" data-cw232-match="${esc(match?.matchId || '')}">
    <div class="cw232-match-card__teams">
      <div class="cw232-match-team cw232-match-team--home">
        ${teamLogo(match?.homeTeam)}
        <strong>${esc(match?.homeTeam?.name || '—')}</strong>
      </div>
      <div class="cw232-match-card__center">
        <span class="cw232-match-card__score">${esc(scoreText(match) || '—')}</span>
        <small>${esc(matchStatus(match))}</small>
      </div>
      <div class="cw232-match-team cw232-match-team--away">
        ${teamLogo(match?.awayTeam)}
        <strong>${esc(match?.awayTeam?.name || '—')}</strong>
      </div>
    </div>
  </article>`;
}

function groupTitle(group) {
  const value = String(group?.key || '').trim();
  return value || 'Матчи';
}

export function renderCompetitionScreen(competition, data = {}) {
  const config = getCompetitionConfig(competition);
  const matches = sortChronologically(Array.isArray(data?.matches) ? data.matches : []);
  const groups = groupForCompetition(matches, competition);

  const body = groups.length
    ? groups.map(group => `<section class="cw232-stage" data-cw232-stage="${esc(group.key)}">
        <div class="cw232-stage__title"><h3>${esc(groupTitle(group))}</h3><span>${group.matches.length}</span></div>
        <div class="cw232-match-list">${group.matches.map(matchCard).join('')}</div>
      </section>`).join('')
    : '<div class="cw232-matches-empty">Матчей в выбранном сезоне пока нет</div>';

  return `<section class="cw232-competition" data-cw232-view="competition" data-cw232-competition="${esc(competition)}" data-cw232-theme="${esc(config.theme)}">
    <header class="cw232-competition__head">
      <button type="button" class="cw232-back" data-cw232-action="hub" aria-label="Назад к турнирам">←</button>
      <div>
        <span class="cw232-matches-kicker">Матчи</span>
        <h2>${esc(config.title)}</h2>
        <p>${competition === 'serie_a' || competition === 'coppa_italia' ? 'Италия' : 'Итальянские клубы'}</p>
      </div>
    </header>
    ${body}
  </section>`;
}

export async function loadCompetitionScreen(
  competition,
  {
    now = new Date(),
    loadMatches = loadCompetitionMatches,
  } = {},
) {
  const range = seasonDateRange(now);
  const data = await loadMatches(competition, range);
  return renderCompetitionScreen(competition, data);
}

function renderLoading(competition) {
  const config = getCompetitionConfig(competition);
  return `<section class="cw232-competition cw232-loading" data-cw232-view="competition" data-cw232-competition="${esc(competition)}" data-cw232-theme="${esc(config.theme)}">
    <header class="cw232-competition__head">
      <button type="button" class="cw232-back" data-cw232-action="hub" aria-label="Назад к турнирам">←</button>
      <div><span class="cw232-matches-kicker">Матчи</span><h2>${esc(config.title)}</h2><p>Загружаем календарь…</p></div>
    </header>
    <div class="cw232-loading-card" aria-hidden="true"></div>
    <div class="cw232-loading-card" aria-hidden="true"></div>
  </section>`;
}

function renderLoadError(competition) {
  const config = getCompetitionConfig(competition);
  return `<section class="cw232-competition" data-cw232-view="competition" data-cw232-competition="${esc(competition)}" data-cw232-theme="${esc(config.theme)}">
    <header class="cw232-competition__head">
      <button type="button" class="cw232-back" data-cw232-action="hub" aria-label="Назад к турнирам">←</button>
      <div><span class="cw232-matches-kicker">Матчи</span><h2>${esc(config.title)}</h2><p>Не удалось загрузить календарь</p></div>
    </header>
    <button type="button" class="cw232-retry" data-cw232-action="retry" data-cw232-competition="${esc(competition)}">Повторить</button>
  </section>`;
}

export function createMatchesUiController({
  show,
  hide,
  loadScreen = loadCompetitionScreen,
} = {}) {
  if (typeof show !== 'function' || typeof hide !== 'function') {
    throw new Error('Matches UI controller requires show and hide');
  }

  let requestVersion = 0;
  let activeCompetition = '';

  function openHub() {
    requestVersion += 1;
    activeCompetition = '';
    show(renderMatchesHub());
  }

  function close() {
    requestVersion += 1;
    activeCompetition = '';
    hide();
  }

  async function openCompetition(competition) {
    getCompetitionConfig(competition);
    if (competition === 'serie_a') {
      close();
      return 'legacy';
    }

    const version = ++requestVersion;
    activeCompetition = competition;
    show(renderLoading(competition));

    try {
      const html = await loadScreen(competition);
      if (version !== requestVersion || activeCompetition !== competition) return 'stale';
      show(html);
      return 'loaded';
    } catch {
      if (version !== requestVersion || activeCompetition !== competition) return 'stale';
      show(renderLoadError(competition));
      return 'error';
    }
  }

  return Object.freeze({ openHub, openCompetition, close });
}

const MATCHES_CSS = `
#${OVERLAY_ID}{position:fixed;inset:0 0 calc(78px + env(safe-area-inset-bottom,0px)) 0;z-index:42;overflow-y:auto;overscroll-behavior:contain;background:#07101f;color:#fff;padding:calc(18px + env(safe-area-inset-top,0px)) 16px 28px;font-family:inherit;-webkit-overflow-scrolling:touch}
#${OVERLAY_ID}[hidden]{display:none!important}
#${OVERLAY_ID} *{box-sizing:border-box}
.cw232-matches-hub,.cw232-competition{width:min(100%,760px);margin:0 auto}
.cw232-matches-head{padding:8px 2px 20px}.cw232-matches-kicker{display:block;font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;opacity:.58;margin-bottom:7px}.cw232-matches-head h2,.cw232-competition__head h2{margin:0;font-size:30px;line-height:1.05;letter-spacing:-.04em}.cw232-matches-head p,.cw232-competition__head p{margin:7px 0 0;color:rgba(255,255,255,.6);font-size:13px}
.cw232-tournament-grid{display:grid;gap:12px}.cw232-tournament-card{position:relative;display:grid;grid-template-columns:1fr auto;grid-template-areas:'eye arrow' 'title arrow' 'hint arrow';gap:4px 12px;width:100%;min-height:116px;padding:18px;border:1px solid rgba(255,255,255,.12);border-radius:22px;text-align:left;color:#fff;background:linear-gradient(135deg,#102a69,#07152e);box-shadow:0 14px 32px rgba(0,0,0,.2);font:inherit;overflow:hidden}.cw232-tournament-card:active{transform:scale(.985)}.cw232-tournament-card__eyebrow{grid-area:eye;font-size:10px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;opacity:.58}.cw232-tournament-card strong{grid-area:title;font-size:20px;line-height:1.08;letter-spacing:-.025em}.cw232-tournament-card__hint{grid-area:hint;font-size:12px;opacity:.68}.cw232-tournament-card__arrow{grid-area:arrow;align-self:center;font-size:25px;opacity:.72}
.cw232-tournament-card[data-cw232-theme='serie-a']{background:radial-gradient(circle at 90% 0%,rgba(76,155,255,.45),transparent 40%),linear-gradient(135deg,#064ecf,#052963)}.cw232-tournament-card[data-cw232-theme='coppa']{background:linear-gradient(120deg,rgba(0,146,70,.28),transparent 28%),linear-gradient(240deg,rgba(206,43,55,.34),transparent 30%),#11151d}.cw232-tournament-card[data-cw232-theme='champions']{background:radial-gradient(circle at 82% 12%,rgba(104,127,255,.5),transparent 25%),linear-gradient(145deg,#111a55,#05091e 70%)}.cw232-tournament-card[data-cw232-theme='europa']{background:radial-gradient(circle at 90% 10%,rgba(255,118,0,.5),transparent 32%),linear-gradient(145deg,#2b1606,#0d0d0f 72%)}.cw232-tournament-card[data-cw232-theme='conference']{background:radial-gradient(circle at 88% 10%,rgba(54,211,123,.42),transparent 32%),linear-gradient(145deg,#08291a,#07130e 72%)}
.cw232-competition__head{display:flex;gap:14px;align-items:center;padding:7px 0 20px}.cw232-back{flex:0 0 44px;width:44px;height:44px;border:1px solid rgba(255,255,255,.14);border-radius:15px;background:rgba(255,255,255,.07);color:#fff;font:700 21px/1 inherit}.cw232-stage{margin:0 0 22px}.cw232-stage__title{display:flex;justify-content:space-between;align-items:center;margin:0 2px 9px}.cw232-stage__title h3{margin:0;font-size:13px;letter-spacing:.02em}.cw232-stage__title span{font-size:11px;opacity:.5}.cw232-match-list{display:grid;gap:9px}.cw232-match-card{border:1px solid rgba(255,255,255,.1);border-radius:19px;background:rgba(255,255,255,.065);padding:14px 12px;backdrop-filter:blur(12px)}.cw232-match-card__teams{display:grid;grid-template-columns:minmax(0,1fr) 78px minmax(0,1fr);align-items:center;gap:8px}.cw232-match-team{display:flex;min-width:0;align-items:center;gap:8px}.cw232-match-team--away{flex-direction:row-reverse;text-align:right}.cw232-match-team strong{font-size:12px;line-height:1.2;overflow-wrap:anywhere}.cw232-team-logo{width:34px;height:34px;object-fit:contain;flex:0 0 34px}.cw232-team-logo--empty{border-radius:50%;background:rgba(255,255,255,.08)}.cw232-match-card__center{text-align:center;min-width:0}.cw232-match-card__score{display:block;font-size:17px;font-weight:850;letter-spacing:-.02em}.cw232-match-card__center small{display:block;margin-top:3px;font-size:9px;line-height:1.2;color:rgba(255,255,255,.55)}
.cw232-competition[data-cw232-theme='champions'] .cw232-match-card{background:linear-gradient(135deg,rgba(38,50,126,.42),rgba(10,13,37,.76))}.cw232-competition[data-cw232-theme='europa'] .cw232-match-card{background:linear-gradient(135deg,rgba(116,53,4,.35),rgba(16,14,13,.78))}.cw232-competition[data-cw232-theme='conference'] .cw232-match-card{background:linear-gradient(135deg,rgba(13,89,50,.34),rgba(8,21,15,.78))}.cw232-competition[data-cw232-theme='coppa'] .cw232-match-card{background:linear-gradient(135deg,rgba(22,59,42,.24),rgba(73,22,28,.23)),rgba(255,255,255,.045)}
.cw232-loading-card{height:95px;border-radius:19px;background:linear-gradient(90deg,rgba(255,255,255,.04),rgba(255,255,255,.1),rgba(255,255,255,.04));background-size:220% 100%;animation:cw232pulse 1.25s linear infinite;margin:0 0 9px}.cw232-matches-empty{padding:26px 18px;border:1px solid rgba(255,255,255,.09);border-radius:19px;color:rgba(255,255,255,.62);text-align:center}.cw232-retry{width:100%;border:0;border-radius:16px;padding:14px 16px;background:#fff;color:#07101f;font:800 13px/1 inherit}@keyframes cw232pulse{to{background-position:-220% 0}}
@media(max-width:390px){#${OVERLAY_ID}{padding-left:12px;padding-right:12px}.cw232-match-card__teams{grid-template-columns:minmax(0,1fr) 66px minmax(0,1fr)}.cw232-team-logo{width:30px;height:30px;flex-basis:30px}.cw232-match-team strong{font-size:11px}.cw232-matches-head h2,.cw232-competition__head h2{font-size:27px}}
`;

function ensureStyles(documentRef) {
  if (documentRef.getElementById(STYLE_ID)) return;
  const style = documentRef.createElement('style');
  style.id = STYLE_ID;
  style.textContent = MATCHES_CSS;
  documentRef.head?.appendChild?.(style);
}

function ensureOverlay(documentRef) {
  let overlay = documentRef.getElementById(OVERLAY_ID);
  if (overlay) return overlay;
  overlay = documentRef.createElement('div');
  overlay.id = OVERLAY_ID;
  overlay.className = 'cw232-matches-overlay';
  overlay.hidden = true;
  overlay.setAttribute?.('aria-live', 'polite');
  const mount = documentRef.getElementById('ciao-miniapp-root') || documentRef.body;
  mount?.appendChild?.(overlay);
  return overlay;
}

export function installMatchesUi(
  documentRef = globalThis.document,
  {
    defer = fn => setTimeout(fn, 0),
    loadScreen = loadCompetitionScreen,
  } = {},
) {
  if (!documentRef?.addEventListener || !documentRef?.createElement) return null;

  ensureStyles(documentRef);
  const overlay = ensureOverlay(documentRef);
  const controller = createMatchesUiController({
    show(html) {
      overlay.innerHTML = html;
      overlay.hidden = false;
      if (typeof overlay.scrollTo === 'function') overlay.scrollTo(0, 0);
    },
    hide() {
      overlay.hidden = true;
      overlay.innerHTML = '';
    },
    loadScreen,
  });

  const handleNav = nav => {
    defer(() => {
      if (nav?.dataset?.tab === 'calendar') controller.openHub();
      else controller.close();
    });
  };

  const navButtons = documentRef.querySelectorAll?.('button[data-tab]') || [];
  for (const nav of navButtons) {
    if (!nav?.addEventListener || nav.dataset?.cw232NavBound === '1') continue;
    if (nav.dataset) nav.dataset.cw232NavBound = '1';
    nav.addEventListener('click', () => handleNav(nav));
  }

  documentRef.addEventListener('click', event => {
    const target = event?.target;
    if (!target?.closest) return;

    const nav = target.closest('button[data-tab]');
    if (nav) {
      if (nav.dataset?.cw232NavBound !== '1') handleNav(nav);
      return;
    }

    const action = target.closest('[data-cw232-action]');
    if (action?.dataset?.cw232Action === 'hub') {
      event.preventDefault?.();
      event.stopPropagation?.();
      controller.openHub();
      return;
    }
    if (action?.dataset?.cw232Action === 'retry') {
      event.preventDefault?.();
      event.stopPropagation?.();
      const competition = action.dataset?.cw232Competition;
      if (competition) void controller.openCompetition(competition);
      return;
    }

    const card = target.closest('.cw232-tournament-card[data-cw232-competition]');
    if (card?.dataset?.cw232Competition) {
      event.preventDefault?.();
      event.stopPropagation?.();
      void controller.openCompetition(card.dataset.cw232Competition);
    }
  }, true);

  return controller;
}

if (typeof document !== 'undefined') {
  installMatchesUi(document);
}