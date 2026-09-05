import { COMPETITION_KEYS, getCompetitionConfig } from '../v23.2/competition-config.mjs';
import { loadCompetitionMatches } from '../v23.2/data-client.mjs';
import {
  flattenCompetitionFeeds,
  loadAllCompetitionMatches,
  selectHomeMatches,
} from './competition-data.mjs';
import { installCanonicalMatchLinks } from './match-center-links.mjs';
import { rememberMatchBootstrap } from './match-bootstrap-cache.mjs';

const DEFAULT_TTL_MS = 60_000;
const HOME_SETTLED_EVENT = 'ciao-v233-home-settled';

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function validDate(value) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('Invalid Home time');
  return date;
}

function seasonRange(value = new Date()) {
  const date = validDate(value);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const startYear = month >= 6 ? year : year - 1;
  return { from:`${startYear}-07-01`, to:`${startYear + 1}-06-30` };
}

function kickoffText(value, timeZone) {
  const date = validDate(value);
  return new Intl.DateTimeFormat('ru-RU', {
    day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit',
    ...(timeZone ? { timeZone } : {}),
  }).format(date);
}

function statusText(match) {
  const status = String(match?.status || '').toLowerCase();
  if (status === 'live') {
    const minute = Number(match?.minute);
    return Number.isFinite(minute) ? `LIVE · ${minute}′` : 'LIVE';
  }
  if (status === 'finished') return 'Завершён';
  if (status === 'postponed') return 'Перенесён';
  if (status === 'cancelled') return 'Отменён';
  return 'Скоро';
}

function scoreText(match) {
  const home = Number(match?.homeScore);
  const away = Number(match?.awayScore);
  if (!Number.isFinite(home) || !Number.isFinite(away)) return '—';
  return `${home}:${away}`;
}

function crest(team) {
  const src = String(team?.crestUrl || '').trim();
  if (!src) return '<span class="cw231-today-logo-placeholder" aria-hidden="true"></span>';
  return `<img class="logo" src="${esc(src)}" alt="" loading="eager" decoding="sync">`;
}

function renderCard(match, timeZone) {
  const config = getCompetitionConfig(match.competition);
  const status = String(match?.status || 'scheduled').toLowerCase();
  const liveOrFinished = ['live','finished'].includes(status);
  const action = status === 'scheduled' ? 'predict' : 'match-center';
  const round = String(match?.roundLabel || match?.stage || config.title || '—');
  return `<article class="cw231-today-card ${esc(status)}" data-cw231-match="${esc(match.matchId)}" data-cw233-competition="${esc(match.competition)}" data-cw233-match="${esc(match.matchId)}" role="button" tabindex="0">
    <div class="cw231-today-card-top"><span class="cw231-today-competition">${esc(config.title)}</span><time datetime="${esc(match.kickoffAt)}">${esc(kickoffText(match.kickoffAt, timeZone))}</time></div>
    <div class="cw231-today-match">
      <div class="cw231-today-team">${crest(match.homeTeam)}<b>${esc(match?.homeTeam?.name || '—')}</b></div>
      <div class="cw231-today-score"><strong class="cw231-today-score-value">${liveOrFinished ? esc(scoreText(match)) : '—'}</strong><span class="cw231-today-score-status">${esc(statusText(match))}</span></div>
      <div class="cw231-today-team away"><b>${esc(match?.awayTeam?.name || '—')}</b>${crest(match.awayTeam)}</div>
    </div>
    <div class="cw231-today-bottom"><span>${esc(round)}</span><button type="button" data-cw231-action="${action}">${action === 'predict' ? 'Дать прогноз' : 'Матч-центр'}</button></div>
  </article>`;
}

export function renderHomeBootstrapSection({ failed = false } = {}) {
  return `<section class="cw231-today cw231-today-premium cw233-home-view cw233-home-bootstrap" data-cw233-home aria-busy="${failed ? 'false' : 'true'}">
    <div class="cw231-today-glow" aria-hidden="true"></div>
    <div class="cw231-today-head">
      <div class="cw231-today-heading"><h2>Кальчо сегодня</h2><p class="cw231-today-subtitle">Матчи и события дня · все турниры</p></div>
      <time aria-hidden="true"></time>
    </div>
    ${failed ? '<div class="cw231-empty"><div class="cw231-empty__title">Данные матчей временно недоступны</div></div>' : '<div class="cw233-home-wait" aria-hidden="true"></div>'}
  </section>`;
}

export function renderHomeTodaySection(matches = [], { now = new Date(), timeZone } = {}) {
  const selected = selectHomeMatches(matches, { now, timeZone });
  const cards = selected.map(match => {
    rememberMatchBootstrap(match);
    return renderCard(match, timeZone);
  }).join('');
  const body = cards
    ? `<div class="cw231-today-list">${cards}</div>`
    : '<div class="cw231-empty"><div class="cw231-empty__title">Сегодня и в ближайшем календаре матчей пока нет</div></div>';
  const count = selected.length;

  return `<section class="cw231-today cw231-today-premium cw233-home-view" data-cw233-home>
    <div class="cw231-today-glow" aria-hidden="true"></div>
    <div class="cw231-today-head">
      <div class="cw231-today-heading"><h2>Кальчо сегодня</h2><p class="cw231-today-subtitle">Матчи и события дня · все турниры</p></div>
      <time>${count ? `${count} ${count === 1 ? 'матч' : count < 5 ? 'матча' : 'матчей'}` : 'Нет матчей'}</time>
    </div>
    ${body}
  </section>`;
}

function dispatchEvent(target, name) {
  if (typeof target?.dispatchEvent !== 'function') return false;
  try {
    const EventCtor = target?.Event || globalThis.Event;
    if (typeof EventCtor !== 'function') return false;
    target.dispatchEvent(new EventCtor(name));
    return true;
  } catch {
    return false;
  }
}

function dispatchUpdated(target) {
  dispatchEvent(target, 'ciao-v233-home-updated');
}

function dispatchSettled(target) {
  dispatchEvent(target, HOME_SETTLED_EVENT);
}

export function createHomeRuntime({
  loadMatches = loadCompetitionMatches,
  now = () => new Date(),
  timeZone,
  ttlMs = DEFAULT_TTL_MS,
  dispatchTarget = globalThis,
} = {}) {
  if (typeof loadMatches !== 'function') throw new Error('Home loadMatches is required');
  if (typeof now !== 'function') throw new Error('Home now is required');

  let feeds = {};
  let errors = {};
  let hydrated = false;
  let settled = false;
  let failed = false;
  let loadedAt = 0;
  let pending = null;

  const snapshot = () => {
    const matches = flattenCompetitionFeeds(feeds);
    return Object.freeze({
      hydrated,
      settled,
      failed,
      loading:Boolean(pending),
      loadedAt,
      data:Object.freeze({ ...feeds }),
      errors:Object.freeze({ ...errors }),
      matches:Object.freeze(matches),
      selected:Object.freeze(selectHomeMatches(matches, { now:validDate(now()), timeZone })),
    });
  };

  const markSettled = () => {
    if (settled) return;
    settled = true;
    dispatchSettled(dispatchTarget);
  };

  const ensure = ({ force = false } = {}) => {
    if (pending) return pending;
    const current = validDate(now());
    const currentMs = current.getTime();
    if (hydrated && !force && currentMs - loadedAt < Math.max(0, Number(ttlMs) || 0)) {
      markSettled();
      return Promise.resolve(snapshot());
    }

    const { from, to } = seasonRange(current);
    failed = false;
    pending = loadAllCompetitionMatches({ loadMatches, from, to })
      .then(result => {
        const nextFeeds = { ...feeds };
        for (const competition of COMPETITION_KEYS) {
          if (Object.prototype.hasOwnProperty.call(result.data, competition)) nextFeeds[competition] = result.data[competition];
        }
        feeds = nextFeeds;
        errors = { ...result.errors };
        hydrated = true;
        loadedAt = currentMs;
        return snapshot();
      })
      .catch(error => {
        failed = true;
        errors = { ...errors, home:String(error?.message || error || 'home_load_failed') };
        throw error;
      })
      .finally(() => {
        pending = null;
        markSettled();
        dispatchUpdated(dispatchTarget);
      });
    return pending;
  };

  const state = () => snapshot();
  const html = () => {
    if (!hydrated) return renderHomeBootstrapSection({ failed:settled && failed });
    return renderHomeTodaySection(flattenCompetitionFeeds(feeds), { now:validDate(now()), timeZone });
  };

  return Object.freeze({ ensure, html, state });
}

const runtime = createHomeRuntime();
globalThis.CiaoV233Home = Object.freeze({ ensure:runtime.ensure, html:runtime.html, state:runtime.state });

if (typeof globalThis.document !== 'undefined') installCanonicalMatchLinks(globalThis.document);

try {
  if (typeof globalThis.dispatchEvent === 'function' && typeof globalThis.Event === 'function') globalThis.dispatchEvent(new globalThis.Event('ciao-v233-home-ready'));
} catch {}
