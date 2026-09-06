import { competitionById, rankingCompetitionIds } from './domain/competitions.mjs';

export const API_VERSION = 23;

const ACTIONS = Object.freeze([
  'bootstrap',
  'matches',
  'calcio_today',
  'favorite_next_match',
  'standings',
  'match_center',
  'predictions_available',
  'predictions_mine',
  'prediction_save',
  'ranking',
  'profile',
  'favorite_set',
  'settings_update',
]);

const MATCH_CENTER_SECTIONS = new Set(['overview','stats','events','lineups','players']);
const SETTINGS_KEYS = Object.freeze([
  'deadlineReminders',
  'lineupNotifications',
  'kickoffNotifications',
  'resultNotifications',
]);

const ERROR_MESSAGES = Object.freeze({
  prediction_closed:'Прогноз уже закрыт',
  match_not_eligible:'Матч недоступен',
  match_not_found:'Матч не найден',
  user_not_found:'Пользователь не найден',
  team_not_found:'Команда не найдена',
  favorite_team_not_eligible:'Эту команду нельзя выбрать',
  subscription_required:'Требуется подписка на канал',
  test_access_required:'Нет доступа к тестовой версии',
  invalid_telegram_signature:'Ошибка авторизации Telegram',
  telegram_auth_required:'Требуется авторизация Telegram',
  telegram_auth_expired:'Сессия Telegram истекла',
  api_error:'Ошибка API',
});

const text = value => String(value ?? '').trim();

function httpError(code, status = 400) {
  const error = new Error(code);
  error.status = status;
  return error;
}

function requireContextUser(context = {}) {
  const id = Number(context.userId);
  if (!Number.isInteger(id) || id <= 0) throw httpError('user_required');
  return id;
}

function requireCompetition(value) {
  const raw = text(value);
  if (!raw) throw httpError('competition_required');
  try {
    return competitionById(raw).id;
  } catch {
    throw httpError(`invalid_competition:${raw.toLowerCase()}`);
  }
}

function requireRankingScope(value) {
  const scope = text(value) || 'all';
  try {
    rankingCompetitionIds(scope);
    return scope;
  } catch {
    throw httpError(`invalid_ranking_scope:${scope}`);
  }
}

function requireMatchId(value) {
  const id = text(value);
  if (!id) throw httpError('match_id_required');
  return id;
}

function requireSection(value) {
  const section = text(value) || 'overview';
  if (!MATCH_CENTER_SECTIONS.has(section)) throw httpError(`invalid_match_center_section:${section}`);
  return section;
}

function requireScore(value) {
  const score = Number(value);
  if (!Number.isInteger(score) || score < 0 || score > 20) throw httpError('invalid_score');
  return score;
}

function requireIso(value, code) {
  const raw = text(value);
  if (!raw || !Number.isFinite(Date.parse(raw))) throw httpError(code);
  return raw;
}

function optionalIso(value, code) {
  if (value === undefined || value === null || text(value) === '') return '';
  return requireIso(value, code);
}

function requireFavoriteTeamId(payload = {}) {
  if (!Object.prototype.hasOwnProperty.call(payload,'team_id')) throw httpError('team_id_required');
  if (payload.team_id === null) return null;
  const id = Number(payload.team_id);
  if (!Number.isInteger(id) || id <= 0) throw httpError('invalid_team_id');
  return id;
}

function settingsPatch(payload = {}) {
  const patch = {};
  for (const key of SETTINGS_KEYS) {
    if (Object.prototype.hasOwnProperty.call(payload,key)) patch[key] = payload[key] === true;
  }
  if (!Object.keys(patch).length) throw httpError('settings_required');
  return patch;
}

function providerTeamId(value) {
  const id = text(value);
  if (!id) throw httpError('favorite_team_provider_id_required');
  return id;
}

export function successEnvelope(data, nowMs = Date.now()) {
  const timestamp = Number(nowMs);
  return {
    ok:true,
    data,
    meta:{
      serverTime:new Date(Number.isFinite(timestamp) ? timestamp : Date.now()).toISOString(),
      apiVersion:API_VERSION,
    },
  };
}

export function errorEnvelope(error) {
  const code = text(error?.message) || 'api_error';
  return {
    ok:false,
    error:{
      code,
      message:ERROR_MESSAGES[code] || 'Не удалось выполнить запрос',
    },
  };
}

export function serviceMetadata(env = {}) {
  return {
    ok:true,
    service:'Ciao v23 API',
    version:API_VERSION,
    environment:text(env?.CIAO_ENVIRONMENT) || 'unknown',
  };
}

export function corsHeaders(origin, allowedOriginsValue = '') {
  const headers = new Headers();
  headers.set('vary','Origin');
  headers.set('access-control-allow-methods','GET,POST,OPTIONS');
  headers.set('access-control-allow-headers','content-type,x-telegram-init-data');
  headers.set('access-control-max-age','86400');
  const allowed = new Set(text(allowedOriginsValue).split(',').map(item => item.trim()).filter(Boolean));
  const candidate = text(origin);
  if (candidate && allowed.has(candidate)) headers.set('access-control-allow-origin', candidate);
  return headers;
}

export function createV23Router({matchService,predictionService,rankingService,profileService} = {}) {
  if (!matchService) throw new Error('match_service_required');
  if (!predictionService) throw new Error('prediction_service_required');
  if (!rankingService) throw new Error('ranking_service_required');
  if (!profileService) throw new Error('profile_service_required');

  async function dispatch(actionValue, payload = {}, context = {}) {
    const action = text(actionValue);
    if (!ACTIONS.includes(action)) throw httpError(`unknown_action:${action || 'missing'}`);
    const userId = requireContextUser(context);

    if (action === 'bootstrap') {
      return await profileService.getBootstrap({userId,tgUser:context.tgUser});
    }

    if (action === 'matches') {
      const competition = requireCompetition(payload.competition);
      const from = optionalIso(payload.from,'invalid_from');
      const to = optionalIso(payload.to,'invalid_to');
      return await matchService.listMatches({competition,from,to});
    }

    if (action === 'calcio_today') {
      const localDateStartUtc = requireIso(payload.local_date_start_utc,'invalid_local_date_start_utc');
      const localDateEndUtc = requireIso(payload.local_date_end_utc,'invalid_local_date_end_utc');
      if (Date.parse(localDateStartUtc) >= Date.parse(localDateEndUtc)) throw httpError('invalid_date_range');
      return await matchService.listCalcioToday({localDateStartUtc,localDateEndUtc});
    }

    if (action === 'favorite_next_match') {
      return await matchService.getFavoriteNextMatch({
        favoriteTeamProviderId:providerTeamId(payload.favorite_team_provider_id),
        nowIso:payload.now_iso ? requireIso(payload.now_iso,'invalid_now_iso') : new Date().toISOString(),
      });
    }

    if (action === 'standings') {
      return await matchService.getStandings({competition:requireCompetition(payload.competition)});
    }

    if (action === 'match_center') {
      return await matchService.getMatchCenter({
        competition:requireCompetition(payload.competition),
        matchId:requireMatchId(payload.match_id),
        section:requireSection(payload.section),
      });
    }

    if (action === 'predictions_available') {
      return await predictionService.available({
        userId,
        competition:requireCompetition(payload.competition),
        nowMs:payload.now_ms === undefined ? undefined : Number(payload.now_ms),
      });
    }

    if (action === 'predictions_mine') {
      return await predictionService.mine({
        userId,
        competition:requireCompetition(payload.competition),
      });
    }

    if (action === 'prediction_save') {
      return await predictionService.save({
        userId,
        competition:requireCompetition(payload.competition),
        matchId:requireMatchId(payload.match_id),
        home:requireScore(payload.home),
        away:requireScore(payload.away),
        nowMs:payload.now_ms === undefined ? undefined : Number(payload.now_ms),
      });
    }

    if (action === 'ranking') {
      return await rankingService.load({scope:requireRankingScope(payload.scope),currentUserId:userId});
    }

    if (action === 'profile') {
      return await profileService.getProfile(userId);
    }

    if (action === 'favorite_set') {
      return await profileService.setFavoriteTeam(userId, requireFavoriteTeamId(payload));
    }

    return await profileService.updateNotificationSettings(userId, settingsPatch(payload));
  }

  return Object.freeze({actions:[...ACTIONS],dispatch});
}
