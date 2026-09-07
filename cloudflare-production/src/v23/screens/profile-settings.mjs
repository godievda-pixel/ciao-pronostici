import { escapeHtml, safeHttpUrl } from '../ui/html.mjs';

export const NOTIFICATION_SETTINGS = Object.freeze([
  Object.freeze({key:'deadlineReminders',label:'Дедлайн прогноза',description:'Напомнить до закрытия прогноза'}),
  Object.freeze({key:'lineupNotifications',label:'Стартовые составы',description:'Сообщить после публикации составов'}),
  Object.freeze({key:'kickoffNotifications',label:'Начало матча',description:'Сообщить о стартовом свистке'}),
  Object.freeze({key:'resultNotifications',label:'Итог матча',description:'Сообщить финальный результат'}),
]);

const SETTING_KEYS=new Set(NOTIFICATION_SETTINGS.map(item=>item.key));
const text=value=>String(value??'').trim();

export async function loadProfileSettings({api,timeZone=Intl.DateTimeFormat().resolvedOptions().timeZone}={}){
  if(!api?.call)throw new Error('settings_api_required');
  const data=await api.call('bootstrap',{});
  return {
    profile:data?.user??{},
    favoriteTeam:data?.favoriteTeam??null,
    favoriteChoices:Array.isArray(data?.favoriteChoices)?data.favoriteChoices:[],
    settings:data?.settings??{},
    timeZone:text(timeZone)||'Автоматически',
    feedback:null,
  };
}

export async function saveFavorite({api,teamId}={}){
  if(!api?.call)throw new Error('settings_api_required');
  if(teamId!==null){
    const id=Number(teamId);
    if(!Number.isInteger(id)||id<=0)throw new Error('favorite_team_invalid');
    teamId=id;
  }
  const result=await api.call('favorite_set',{team_id:teamId});
  return {ok:true,message:'Любимый клуб сохранён',data:result};
}

export async function saveNotificationSetting({api,key,value}={}){
  if(!api?.call)throw new Error('settings_api_required');
  const setting=text(key);
  if(!SETTING_KEYS.has(setting))throw new Error('settings_key_invalid');
  const enabled=value===true;
  const result=await api.call('settings_update',{[setting]:enabled});
  return {ok:true,message:'Настройки сохранены',data:result};
}

function avatar(profile={}){
  const url=safeHttpUrl(profile.photoUrl);
  const name=text(profile.displayName)||'Профиль';
  return url
    ? `<img class="settings-profile__avatar" src="${escapeHtml(url)}" alt="" loading="eager">`
    : `<span class="settings-profile__avatar settings-profile__avatar--fallback" aria-hidden="true">${escapeHtml(name.slice(0,1).toUpperCase())}</span>`;
}

function favoriteOptions(choices=[]){
  return choices.map(team=>{
    const id=Number(team?.id);
    const name=text(team?.nameRu);
    if(!Number.isInteger(id)||id<=0||!name)return '';
    return `<option value="${escapeHtml(name)}" data-team-id="${id}"></option>`;
  }).join('');
}

function notificationRows(settings={}){
  return NOTIFICATION_SETTINGS.map(item=>{
    const enabled=settings?.[item.key]===true;
    return `<button type="button" class="settings-toggle" data-action="notification-toggle" data-key="${item.key}" data-value="${enabled?'false':'true'}" role="switch" aria-checked="${enabled?'true':'false'}"><span class="settings-toggle__copy"><strong>${escapeHtml(item.label)}</strong><span>${escapeHtml(item.description)}</span></span><span class="settings-toggle__control${enabled?' is-on':''}" aria-hidden="true"></span></button>`;
  }).join('');
}

export function renderProfileSettings(model={}){
  const profile=model.profile??{};
  const username=text(profile.username).replace(/^@/,'');
  const choices=Array.isArray(model.favoriteChoices)?model.favoriteChoices:[];
  const favoriteName=text(model.favoriteTeam?.nameRu);
  const feedback=model.feedback?.message
    ? `<div class="inline-notice${model.feedback.ok===false?' inline-notice--error':''}" role="status">${escapeHtml(model.feedback.message)}</div>`
    : '';
  return `<section class="screen-stack settings-screen" data-screen="settings"><button type="button" class="match-center__back" data-action="settings-back">← Назад</button><section class="settings-profile">${avatar(profile)}<div><h1>${escapeHtml(text(profile.displayName)||'Профиль')}</h1>${username?`<p>@${escapeHtml(username)}</p>`:''}</div></section>${feedback}<section class="screen-section"><div class="screen-section__head"><h2 class="screen-section__title">Любимый клуб</h2></div><div class="settings-favorite"><label for="favorite-club-search">Клуб Серии А</label><input id="favorite-club-search" class="settings-favorite__search" type="search" list="favorite-club-options" data-action="favorite-search" autocomplete="off" placeholder="Начните вводить название" value="${escapeHtml(favoriteName)}"><datalist id="favorite-club-options">${favoriteOptions(choices)}</datalist><button type="button" class="settings-favorite__save" data-action="save-favorite">Сохранить клуб</button></div></section><section class="screen-section"><div class="screen-section__head"><h2 class="screen-section__title">Уведомления</h2></div><div class="settings-toggles">${notificationRows(model.settings)}</div></section><section class="screen-section"><div class="screen-section__head"><h2 class="screen-section__title">Время матчей</h2></div><div class="settings-readonly"><strong>Автоматически · ${escapeHtml(text(model.timeZone)||'устройство')}</strong><span>Используется часовой пояс устройства</span></div></section></section>`;
}
