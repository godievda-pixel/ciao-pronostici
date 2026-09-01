import { COMPETITION_KEYS, getCompetitionConfig } from './competition-config.mjs';
import { loadCompetitionMatches } from './data-client.mjs';
import { groupForCompetition, sortChronologically } from './tournament-engine.mjs';

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

  return Object.freeze({
    openHub,
    openCompetition,
    close,
  });
}
