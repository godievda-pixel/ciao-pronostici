import { COMPETITION_KEYS, getCompetitionConfig } from '../v23.2/competition-config.mjs';
import { loadCompetitionMatches } from '../v23.2/data-client.mjs';
import {
  flattenCompetitionFeeds,
  loadAllCompetitionMatches,
  selectHomeMatches,
} from './competition-data.mjs';
import { installCanonicalMatchCenter } from './match-center.mjs';
import { installCanonicalMatchLinks } from './match-center-links.mjs';

const DEFAULT_TTL_MS = 60_000;

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
  return {
    from: `${startYear}-07-01`,
    to: `${startYear + 1}-06-30`,
  };
}

function kickoffText(value, timeZone) {
  const date = validDate(value);
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
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
  if (!src) return '<span class="cw233-home-logo-placeholder" aria-hidden="true"></span>';
  return `<img class="cw233-home-logo" src="${esc(src)}" alt="" width="40" height="40" loading="eager" decoding="async">`;
}

function renderCard(match, timeZone) {
  const config = getCompetitionConfig(match.competition);
  const liveOrFinished = ['live', 'finished'].includes(String(match?.status || '').toLowerCase());
  return `<article class="cw233-home-card ${esc(match?.status || 'scheduled')}" data-cw233-competition="${esc(match.competition)}" data-cw233-match="${esc(match.matchId)}" role="button" tabindex="0">
    <div class="cw233-home-card-top">
      <span class="cw233-home-competition">${esc(config.title)}</span>
      <time datetime="${esc(match.kickoffAt)}">${esc(kickoffText(match.kickoffAt, timeZone))}</time>
    </div>
    <div class="cw233-home-card-main">
      <div class="cw233-home-team">${crest(match.homeTeam)}<b>${esc(match?.homeTeam?.name || '—')}</b></div>
      <div class="cw233-home-score"><strong>${liveOrFinished ? esc(scoreText(match)) : '—'}</strong><span>${esc(statusText(match))}</span></div>
      <div class="cw233-home-team away"><b>${esc(match?.awayTeam?.name || '—')}</b>${crest(match.awayTeam)}</div>
    </div>
  </article>`;
}

export function renderHomeTodaySection(matches = [], {
  now = new Date(),
  timeZone,
} = {}) {
  const selected = selectHomeMatches(matches, { now, timeZone });
  const cards = selected.map(match => renderCard(match, timeZone)).join('');
  const body = cards
    ? `<div class="cw233-home-list">${cards}</div>`
    : '<div class="cw233-home-empty">Сегодня и в ближайшем календаре матчей пока нет</div>';

  return `<section class="cw231-today cw233-home-view" data-cw233-home>
    <div class="cw231-today-head cw233-home-head">
      <div><div class="cw233-home-eyebrow">Все турниры</div><h2>Кальчо сегодня</h2></div>
      <span>${selected.length ? `${selected.length} матч${selected.length === 1 ? '' : 'ей'}` : 'Нет матчей'}</span>
    </div>
    ${body}
  </section>`;
}

function dispatchUpdated(target) {
  if (typeof target?.dispatchEvent !== 'function') return;
  try {
    const EventCtor = target?.Event || globalThis.Event;
    if (typeof EventCtor === 'function') target.dispatchEvent(new EventCtor('ciao-v233-home-updated'));
  } catch {}
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
  let loadedAt = 0;
  let pending = null;

  const snapshot = () => {
    const matches = flattenCompetitionFeeds(feeds);
    return Object.freeze({
      hydrated,
      loading: Boolean(pending),
      loadedAt,
      data: Object.freeze({ ...feeds }),
      errors: Object.freeze({ ...errors }),
      matches: Object.freeze(matches),
      selected: Object.freeze(selectHomeMatches(matches, { now: validDate(now()), timeZone })),
    });
  };

  const ensure = ({ force = false } = {}) => {
    if (pending) return pending;
    const current = validDate(now());
    const currentMs = current.getTime();
    if (hydrated && !force && currentMs - loadedAt < Math.max(0, Number(ttlMs) || 0)) {
      return Promise.resolve(snapshot());
    }

    const { from, to } = seasonRange(current);
    pending = loadAllCompetitionMatches({ loadMatches, from, to })
      .then(result => {
        const nextFeeds = { ...feeds };
        for (const competition of COMPETITION_KEYS) {
          if (Object.prototype.hasOwnProperty.call(result.data, competition)) {
            nextFeeds[competition] = result.data[competition];
          }
        }
        feeds = nextFeeds;
        errors = { ...result.errors };
        hydrated = true;
        loadedAt = currentMs;
        return snapshot();
      })
      .finally(() => {
        pending = null;
        dispatchUpdated(dispatchTarget);
      });
    return pending;
  };

  const state = () => snapshot();
  const html = () => {
    if (!hydrated) return '';
    return renderHomeTodaySection(flattenCompetitionFeeds(feeds), {
      now: validDate(now()),
      timeZone,
    });
  };

  return Object.freeze({ ensure, html, state });
}

const runtime = createHomeRuntime();
globalThis.CiaoV233Home = Object.freeze({
  ensure: runtime.ensure,
  html: runtime.html,
  state: runtime.state,
});

if (typeof globalThis.document !== 'undefined') {
  installCanonicalMatchCenter(globalThis.document);
  installCanonicalMatchLinks(globalThis.document);
}

try {
  if (typeof globalThis.dispatchEvent === 'function' && typeof globalThis.Event === 'function') {
    globalThis.dispatchEvent(new globalThis.Event('ciao-v233-home-ready'));
  }
} catch {}
