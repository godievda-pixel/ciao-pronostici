import { localDayBoundsUtc, sortLiveFirst, toUiMatch } from '../data/selectors.mjs';
import { escapeHtml, safeHttpUrl } from '../ui/html.mjs';
import { renderMatchCard } from '../ui/match-card.mjs';
import { renderTeamBadge } from '../ui/team-badge.mjs';

function text(value) {
  return String(value ?? '').trim();
}

function safeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function readWithCache({ api, cache, key, action, payload, fallback, required = false, at }) {
  try {
    const data = await api.call(action, payload);
    cache.put(key, data, at);
    return { data, stale:false };
  } catch (error) {
    const previous = cache.get(key);
    cache.markError(key, error);
    if (previous && previous.data !== null && previous.data !== undefined) {
      return { data:previous.data, stale:true };
    }
    if (required) throw error;
    return { data:fallback, stale:true };
  }
}

export async function loadHome(api, cache, clock = () => new Date(), timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone) {
  if (!api?.call) throw new Error('home_api_required');
  if (!cache?.get || !cache?.put || !cache?.markError) throw new Error('home_cache_required');
  if (typeof clock !== 'function') throw new Error('home_clock_required');

  const now = clock();
  const nowDate = now instanceof Date ? new Date(now.getTime()) : new Date(now);
  if (!Number.isFinite(nowDate.getTime())) throw new Error('invalid_now_time');
  const nowIso = nowDate.toISOString();
  const nowMs = nowDate.getTime();
  const bounds = localDayBoundsUtc(nowDate, timeZone);

  const bootstrapResult = await readWithCache({
    api,
    cache,
    key:'home:bootstrap',
    action:'bootstrap',
    payload:{},
    fallback:null,
    required:true,
    at:nowMs,
  });
  const bootstrap = bootstrapResult.data ?? {};
  const favoriteTeam = bootstrap.favoriteTeam ?? null;

  let favoriteResult = { data:null, stale:false };
  if (favoriteTeam?.providerTeamId) {
    favoriteResult = await readWithCache({
      api,
      cache,
      key:`home:favorite:${text(favoriteTeam.providerTeamId)}`,
      action:'favorite_next_match',
      payload:{
        favorite_team_provider_id:text(favoriteTeam.providerTeamId),
        now_iso:nowIso,
      },
      fallback:null,
      at:nowMs,
    });
  }

  const todayResult = await readWithCache({
    api,
    cache,
    key:`home:today:${bounds.start}:${bounds.end}`,
    action:'calcio_today',
    payload:{
      local_date_start_utc:bounds.start,
      local_date_end_utc:bounds.end,
    },
    fallback:[],
    at:nowMs,
  });

  const favoriteNextMatch = favoriteResult.data
    ? toUiMatch(favoriteResult.data, { now:nowDate, timeZone })
    : null;
  const calcioToday = sortLiveFirst(
    (Array.isArray(todayResult.data) ? todayResult.data : []).map(match => toUiMatch(match, { now:nowDate, timeZone })),
  );

  return {
    profile:bootstrap.user ?? {},
    stats:{
      points:safeNumber(bootstrap.stats?.points),
      rank:safeNumber(bootstrap.stats?.rank),
      exact:safeNumber(bootstrap.stats?.exact),
    },
    favoriteTeam,
    favoriteNextMatch,
    calcioToday,
    settings:bootstrap.settings ?? {},
    refreshError:bootstrapResult.stale || favoriteResult.stale || todayResult.stale,
  };
}

function renderAvatar(profile = {}) {
  const photoUrl = safeHttpUrl(profile?.photoUrl);
  if (photoUrl) {
    return `<img class="home-profile__avatar" src="${escapeHtml(photoUrl)}" alt="" loading="eager">`;
  }
  const name = text(profile?.displayName) || 'Ciao';
  return `<span class="home-profile__avatar home-profile__avatar--fallback" aria-hidden="true">${escapeHtml(name.slice(0,1).toUpperCase())}</span>`;
}

function renderProfile(profile = {}) {
  const displayName = text(profile?.displayName) || 'Профиль';
  const username = text(profile?.username);
  return `<button type="button" class="home-profile" data-action="open-settings"><span class="home-profile__identity">${renderAvatar(profile)}<span class="home-profile__copy"><span class="home-profile__name">${escapeHtml(displayName)}</span>${username ? `<span class="home-profile__username">@${escapeHtml(username.replace(/^@/, ''))}</span>` : ''}</span></span><span class="home-profile__chevron" aria-hidden="true">›</span></button>`;
}

function renderMetric(value, label) {
  return `<div class="metric-card"><span class="metric-card__value">${escapeHtml(value)}</span><span class="metric-card__label">${escapeHtml(label)}</span></div>`;
}

function renderFavorite(model) {
  const team = model.favoriteTeam;
  if (!team) {
    return `<section class="screen-section home-favorite"><div class="screen-section__head"><h2 class="screen-section__title">Любимый клуб</h2></div><button type="button" class="home-favorite__choose" data-action="open-settings">Выбрать любимый клуб</button></section>`;
  }
  const badgeTeam = {
    ...team,
    logoUrl:team.logoUrl ?? team.crestUrl,
  };
  const match = model.favoriteNextMatch
    ? renderMatchCard(model.favoriteNextMatch, { timeLabel:model.favoriteNextMatch.timeLabel })
    : '<div class="inline-notice">Ближайший матч пока не найден</div>';
  return `<section class="screen-section home-favorite"><div class="screen-section__head"><h2 class="screen-section__title">Любимый клуб</h2></div><div class="home-favorite__club">${renderTeamBadge(badgeTeam)}</div>${match}</section>`;
}

function renderToday(matches = []) {
  const content = matches.length
    ? `<div class="screen-grid">${matches.map(match => renderMatchCard(match, { timeLabel:match.timeLabel })).join('')}</div>`
    : '<div class="home-today__empty">Кальчо сегодня нет :(</div>';
  return `<section class="screen-section home-today"><div class="screen-section__head"><h2 class="screen-section__title">Кальчо сегодня</h2></div>${content}</section>`;
}

export function renderHome(model = {}) {
  const stats = model.stats ?? {};
  const notice = model.refreshError
    ? '<div class="inline-notice inline-notice--error" role="status">Не удалось обновить</div>'
    : '';

  return `<section class="screen-stack" data-screen="home">${renderProfile(model.profile)}<div class="metric-grid">${renderMetric(safeNumber(stats.points), 'Очки')}${renderMetric(safeNumber(stats.rank), 'Место')}${renderMetric(safeNumber(stats.exact), 'Точные счета')}</div>${notice}${renderFavorite(model)}${renderToday(Array.isArray(model.calcioToday) ? model.calcioToday : [])}</section>`;
}
