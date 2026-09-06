import { toUiMatch } from '../data/selectors.mjs';
import { goalsLabel } from '../locale/ru.mjs';
import { escapeHtml } from '../ui/html.mjs';

export const MATCH_CENTER_TABS = Object.freeze([
  Object.freeze(['overview','Обзор']),
  Object.freeze(['stats','Статистика']),
  Object.freeze(['events','События']),
  Object.freeze(['lineups','Составы']),
  Object.freeze(['players','Игроки']),
]);

const COMPETITIONS = new Set(['serie_a','coppa_italia','ucl','uel','uecl']);
const SECTIONS = new Set(MATCH_CENTER_TABS.map(([id]) => id));

const STAT_LABELS = new Map([
  ['ball possession','Владение мячом'],
  ['possession','Владение мячом'],
  ['total shots','Удары'],
  ['shots','Удары'],
  ['shots on target','Удары в створ'],
  ['shots on goal','Удары в створ'],
  ['corner kicks','Угловые'],
  ['corners','Угловые'],
  ['fouls','Фолы'],
  ['fouls committed','Фолы'],
  ['yellow cards','Жёлтые карточки'],
  ['red cards','Красные карточки'],
  ['offsides','Офсайды'],
  ['expected goals','Ожидаемые голы (xG)'],
  ['xg','Ожидаемые голы (xG)'],
  ['passes','Передачи'],
  ['accurate passes','Точные передачи'],
  ['saves','Сейвы'],
  ['goalkeeper saves','Сейвы'],
  ['blocked shots','Заблокированные удары'],
  ['shots inside box','Удары из штрафной'],
  ['shots outside box','Удары из-за штрафной'],
]);

const EVENT_LABELS = new Map([
  ['goal','Гол'],
  ['owngoal','Автогол'],
  ['own_goal','Автогол'],
  ['penalty','Пенальти'],
  ['penaltygoal','Гол с пенальти'],
  ['yellowcard','Жёлтая карточка'],
  ['yellow_card','Жёлтая карточка'],
  ['redcard','Красная карточка'],
  ['red_card','Красная карточка'],
  ['substitution','Замена'],
  ['var','VAR'],
]);

function text(value) {
  return String(value ?? '').trim();
}

function key(value) {
  return text(value).toLowerCase().replace(/[\s-]+/g,'').replaceAll('_','');
}

function validCompetition(value) {
  const competition = text(value);
  if (!COMPETITIONS.has(competition)) throw new Error('match_center_competition_invalid');
  return competition;
}

function validSection(value) {
  const section = text(value) || 'overview';
  if (!SECTIONS.has(section)) throw new Error('match_center_section_invalid');
  return section;
}

function normalizeMatch(match, {now,timeZone}) {
  if (!match) return null;
  if (match.homeTeam && match.awayTeam) return match;
  return toUiMatch(match,{now,timeZone});
}

export async function loadMatchCenterSection({api,competition,matchId,section='overview',now=new Date(),timeZone=Intl.DateTimeFormat().resolvedOptions().timeZone}={}) {
  if (!api?.call) throw new Error('match_center_api_required');
  const selectedCompetition = validCompetition(competition);
  const selectedSection = validSection(section);
  const canonicalMatchId = text(matchId);
  if (!canonicalMatchId) throw new Error('match_center_match_id_required');
  const result = await api.call('match_center',{
    competition:selectedCompetition,
    match_id:canonicalMatchId,
    section:selectedSection,
  });
  if (!result?.match) throw new Error('match_center_match_missing');
  return {
    match:normalizeMatch(result.match,{now,timeZone}),
    data:result.data ?? {},
    section:selectedSection,
  };
}

function valuePresent(value) {
  return value !== null && value !== undefined && value !== '';
}

function scoreText(match) {
  const home = match?.score?.home;
  const away = match?.score?.away;
  return valuePresent(home) && valuePresent(away) ? `${home} — ${away}` : '—';
}

function renderHeader(match) {
  if (!match) return '<div class="status-state" data-state="loading">Загрузка матча…</div>';
  const meta = [match.competitionNameRu,match.stageNameRu,match.timeLabel].filter(Boolean).map(escapeHtml).join(' · ');
  return `<div class="match-center__hero"><div class="match-center__meta">${meta}</div><div class="match-center__scoreboard"><div class="match-center__team"><strong>${escapeHtml(match.homeTeam?.nameRu)}</strong></div><div class="match-center__score"><strong>${escapeHtml(scoreText(match))}</strong><span>${escapeHtml(match.statusRu || '')}</span></div><div class="match-center__team match-center__team--away"><strong>${escapeHtml(match.awayTeam?.nameRu)}</strong></div></div></div>`;
}

function renderTabs(active) {
  return `<div class="match-center__tabs" role="tablist">${MATCH_CENTER_TABS.map(([id,label])=>`<button type="button" class="match-center__tab${id===active?' is-active':''}" data-action="match-tab" data-section="${id}" role="tab" aria-selected="${id===active?'true':'false'}">${escapeHtml(label)}</button>`).join('')}</div>`;
}

function pickVenue(data) {
  return text(data?.venue?.name ?? data?.stadium?.name ?? data?.venue_name ?? data?.stadium);
}

function renderOverview(data,match) {
  const venue = pickVenue(data);
  const rows = [
    ['Статус',match?.statusRu],
    ['Дата и время',match?.timeLabel],
    ['Стадия',match?.stageNameRu],
    ['Стадион',venue],
  ].filter(([,value])=>text(value));
  return rows.length ? `<div class="match-center__facts">${rows.map(([label,value])=>`<div class="match-center__fact"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join('')}</div>` : '<div class="status-state" data-state="empty">Информация о матче пока недоступна</div>';
}

function statName(row) {
  const raw = text(row?.name ?? row?.label ?? row?.statisticName ?? row?.stat_name ?? row?.type);
  if (!raw) return '';
  const mapped = STAT_LABELS.get(raw.toLowerCase());
  if (mapped) return mapped;
  return /[А-Яа-яЁё]/.test(raw) && !/[A-Za-z]/.test(raw) ? raw : '';
}

function statValues(row) {
  return {
    home:row?.home ?? row?.homeValue ?? row?.home_value ?? row?.valueHome ?? row?.homeTeam,
    away:row?.away ?? row?.awayValue ?? row?.away_value ?? row?.valueAway ?? row?.awayTeam,
  };
}

function collectStatRows(node,result=[]) {
  if (Array.isArray(node)) {
    for (const item of node) collectStatRows(item,result);
    return result;
  }
  if (!node || typeof node!=='object') return result;
  const label = statName(node);
  const values = statValues(node);
  if (label && (valuePresent(values.home)||valuePresent(values.away))) result.push({label,...values});
  for (const childKey of ['statistics','stats','results','data','groups','items','statisticsItems','statistics_items']) {
    const child=node[childKey];
    if (child && child!==node) collectStatRows(child,result);
  }
  return result;
}

function renderStats(data) {
  const rows=collectStatRows(data).filter(row=>valuePresent(row.home)||valuePresent(row.away));
  if(!rows.length) return '<div class="status-state" data-state="empty">Статистика пока недоступна</div>';
  return `<div class="match-center__stats">${rows.map(row=>`<div class="match-center__stat"><strong>${escapeHtml(valuePresent(row.home)?row.home:'—')}</strong><span>${escapeHtml(row.label)}</span><strong>${escapeHtml(valuePresent(row.away)?row.away:'—')}</strong></div>`).join('')}</div>`;
}

function eventRows(data) {
  if(Array.isArray(data)) return data;
  for(const name of ['incidents','events','results','data']) if(Array.isArray(data?.[name])) return data[name];
  return [];
}

function eventLabel(event) {
  const raw=text(event?.incidentType ?? event?.incident_type ?? event?.type ?? event?.eventType);
  const normalized=key(raw);
  return EVENT_LABELS.get(normalized) || (/[А-Яа-яЁё]/.test(raw)&&!/[A-Za-z]/.test(raw)?raw:'Событие');
}

function playerName(value) {
  return text(value?.name ?? value?.playerName ?? value?.player_name ?? value);
}

function eventDescription(event) {
  const label=eventLabel(event);
  const main=playerName(event?.player ?? event?.scorer ?? event?.playerIn ?? event?.player_in);
  const outgoing=playerName(event?.playerOut ?? event?.player_out);
  if(label==='Замена'&&main&&outgoing) return `${label}: ${main} вместо ${outgoing}`;
  return main?`${label}: ${main}`:label;
}

function eventMinute(event) {
  const minute=event?.time ?? event?.minute ?? event?.incidentTime ?? event?.incident_time;
  if(!valuePresent(minute)) return '';
  const parsed=Number(minute);
  return Number.isFinite(parsed)?`${Math.trunc(parsed)}'`:text(minute);
}

function renderEvents(data) {
  const rows=eventRows(data);
  if(!rows.length) return '<div class="status-state" data-state="empty">Событий пока нет</div>';
  return `<div class="match-center__events">${rows.map(event=>`<div class="match-center__event"><strong>${escapeHtml(eventMinute(event))}</strong><span>${escapeHtml(eventDescription(event))}</span></div>`).join('')}</div>`;
}

function lineupSide(data,side) {
  const direct=data?.[side];
  if(direct&&typeof direct==='object') return direct;
  const alias=data?.[`${side}Team`] ?? data?.[`${side}_team`];
  return alias&&typeof alias==='object'?alias:{};
}

function lineupPlayers(side) {
  const candidates=side?.players ?? side?.lineup ?? side?.startingXI ?? side?.starting_xi ?? [];
  return Array.isArray(candidates)?candidates:[];
}

function lineupPlayerName(item) {
  return playerName(item?.player ?? item?.athlete ?? item?.name ?? item);
}

function renderLineupColumn(title,side) {
  const players=lineupPlayers(side).filter(item=>item?.starter!==false && item?.substitute!==true);
  const formation=text(side?.formation);
  const names=players.map(lineupPlayerName).filter(Boolean);
  return `<div class="match-center__lineup"><h3>${escapeHtml(title)}</h3>${formation?`<div class="match-center__formation">${escapeHtml(formation)}</div>`:''}<div class="match-center__lineup-label">Стартовый состав</div>${names.length?`<ol>${names.map(name=>`<li>${escapeHtml(name)}</li>`).join('')}</ol>`:'<div class="muted">Состав пока недоступен</div>'}</div>`;
}

function renderLineups(data,match) {
  const home=lineupSide(data,'home');
  const away=lineupSide(data,'away');
  return `<div class="match-center__lineups">${renderLineupColumn(match?.homeTeam?.nameRu||'Хозяева',home)}${renderLineupColumn(match?.awayTeam?.nameRu||'Гости',away)}</div>`;
}

function playerRows(data) {
  if(Array.isArray(data)) return data;
  for(const name of ['players','results','data','playerStats','player_stats']) if(Array.isArray(data?.[name])) return data[name];
  return [];
}

function playerStatName(row) {
  return playerName(row?.player ?? row?.athlete ?? row?.name);
}

function renderPlayers(data) {
  const rows=playerRows(data).map(row=>({
    name:playerStatName(row),
    rating:row?.rating ?? row?.score,
    goals:row?.goals,
  })).filter(row=>row.name);
  if(!rows.length) return '<div class="status-state" data-state="empty">Статистика игроков пока недоступна</div>';
  return `<div class="match-center__players">${rows.map(row=>{const extras=[];if(valuePresent(row.rating))extras.push(`Оценка ${row.rating}`);if(valuePresent(row.goals))extras.push(goalsLabel(Number(row.goals)));return `<div class="match-center__player"><strong>${escapeHtml(row.name)}</strong>${extras.length?`<span>${escapeHtml(extras.join(' · '))}</span>`:''}</div>`;}).join('')}</div>`;
}

function renderSection(section,data,match,error) {
  if(error) return `<div class="status-state status-state--error" data-state="error">${escapeHtml(error.message||'Не удалось загрузить раздел')}</div>`;
  if(data===undefined) return '<div class="status-state" data-state="loading">Загрузка…</div>';
  if(section==='overview') return renderOverview(data,match);
  if(section==='stats') return renderStats(data);
  if(section==='events') return renderEvents(data);
  if(section==='lineups') return renderLineups(data,match);
  if(section==='players') return renderPlayers(data);
  return '';
}

export function renderMatchCenter(view={}) {
  const competition=validCompetition(view.competition);
  const activeTab=validSection(view.activeTab??'overview');
  const now=view.now??new Date();
  const timeZone=view.timeZone??Intl.DateTimeFormat().resolvedOptions().timeZone;
  const match=normalizeMatch(view.match,{now,timeZone});
  const sections=view.sections??{};
  const errors=view.sectionErrors??{};
  return `<section class="screen-stack match-center" data-screen="match-center" data-competition="${escapeHtml(competition)}" data-match-id="${escapeHtml(view.matchId??match?.id??'')}"><button type="button" class="match-center__back" data-action="match-back">← Назад</button>${renderHeader(match)}${renderTabs(activeTab)}<div class="match-center__section" data-match-section="${activeTab}">${renderSection(activeTab,sections[activeTab],match,errors[activeTab])}</div></section>`;
}

function safeError() {
  return {code:'section_unavailable',message:'Не удалось загрузить раздел'};
}

export function createMatchCenterController({api,router,render,clock=()=>new Date(),timeZone=Intl.DateTimeFormat().resolvedOptions().timeZone}={}) {
  if(!api?.call) throw new Error('match_center_api_required');
  if(!router?.back) throw new Error('match_center_router_required');
  if(typeof render!=='function') throw new Error('match_center_render_required');
  let state={competition:null,matchId:null,activeTab:'overview',match:null,sections:{},sectionErrors:{}};

  const emit=()=>render({...state,now:clock(),timeZone});
  const load=async section=>{
    try{
      const result=await loadMatchCenterSection({api,competition:state.competition,matchId:state.matchId,section,now:clock(),timeZone});
      state={...state,match:result.match,sections:{...state.sections,[section]:result.data},sectionErrors:{...state.sectionErrors,[section]:undefined}};
    }catch(error){
      state={...state,sectionErrors:{...state.sectionErrors,[section]:safeError(error)}};
    }
    emit();
  };

  return Object.freeze({
    async open({competition,matchId,section='overview'}={}){
      const selectedCompetition=validCompetition(competition);
      const selectedSection=validSection(section);
      const id=text(matchId);if(!id) throw new Error('match_center_match_id_required');
      state={competition:selectedCompetition,matchId:id,activeTab:selectedSection,match:null,sections:{},sectionErrors:{}};
      await load('overview');
      if(selectedSection!=='overview') await load(selectedSection);
      return state;
    },
    async selectTab(section){
      const selected=validSection(section);
      state={...state,activeTab:selected};
      emit();
      if(state.sections[selected]===undefined) await load(selected);
      return state;
    },
    back(){router.back();},
    state(){return {...state,sections:{...state.sections},sectionErrors:{...state.sectionErrors}};},
    async refresh(section=state.activeTab){
      if(!state.competition||!state.matchId) return state;
      await load(validSection(section));
      return state;
    },
  });
}
