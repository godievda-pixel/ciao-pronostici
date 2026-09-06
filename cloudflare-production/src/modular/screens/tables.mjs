import { TOURNAMENT_IDS, getTournament, isTournamentSupported } from '../core/tournament-registry.mjs';

export const TABLE_TOURNAMENTS = Object.freeze(TOURNAMENT_IDS.filter(id => getTournament(id).tables));

function text(value){return String(value??'').trim()}
function esc(value){return text(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function number(value){const n=Number(value);return Number.isFinite(n)?n:null}
function firstNumber(...values){for(const value of values){const n=number(value);if(n!==null)return n}return null}

export function normalizeStandingRows(value=[]){
  const source=Array.isArray(value)?value:Array.isArray(value?.rows)?value.rows:Array.isArray(value?.standings)?value.standings:[];
  return source.map((row,index)=>{
    const team=row?.team||{};
    return {
      position:firstNumber(row?.position,row?.rank,index+1),
      team:{
        id:team?.id??row?.team_id??row?.teamId??'',
        name:text(team?.name||row?.team_name||row?.teamName)||'Команда',
        crestUrl:text(team?.crestUrl||team?.crest_url||team?.logo_url||team?.logoUrl||row?.crest_url||row?.crestUrl),
      },
      played:firstNumber(row?.played,row?.matches_played,row?.mp),
      wins:firstNumber(row?.wins,row?.w),
      draws:firstNumber(row?.draws,row?.d),
      losses:firstNumber(row?.losses,row?.l),
      goalsFor:firstNumber(row?.goalsFor,row?.goals_for,row?.gf),
      goalsAgainst:firstNumber(row?.goalsAgainst,row?.goals_against,row?.ga),
      goalDifference:firstNumber(row?.goalDifference,row?.goal_difference,row?.gd),
      points:firstNumber(row?.points,row?.pts),
    };
  });
}

function display(value){return value===null||value===undefined?'—':String(value)}
function logo(team){return team?.crestUrl?`<img class="ciao-table-logo" src="${esc(team.crestUrl)}" alt="" loading="lazy" decoding="async">`:'<span class="ciao-table-logo ciao-table-logo--empty">•</span>'}

export function renderTablesScreen({tournament='serie_a',rows=[]}={}){
  const requested=text(tournament).toLowerCase();
  const selected=isTournamentSupported(requested)&&getTournament(requested).tables?requested:'serie_a';
  const config=getTournament(selected);
  const normalized=normalizeStandingRows(rows);
  const buttons=TABLE_TOURNAMENTS.map(id=>{const item=getTournament(id);return `<button type="button" data-ciao-table-tournament="${esc(id)}" class="ciao-table-tournament theme-${esc(item.theme)}${id===selected?' is-active':''}" style="--ciao-table-accent:${esc(item.colors.accent)};--ciao-table-surface:${esc(item.colors.surface)}">${esc(item.shortLabel)}</button>`}).join('');
  const body=normalized.length?normalized.map(row=>`<div class="ciao-standing-row" data-standing-position="${display(row.position)}"><span class="ciao-standing-pos">${display(row.position)}</span><div class="ciao-standing-team">${logo(row.team)}<b>${esc(row.team.name)}</b></div><span>${display(row.played)}</span><span class="ciao-standing-wide">${display(row.wins)}</span><span class="ciao-standing-wide">${display(row.draws)}</span><span class="ciao-standing-wide">${display(row.losses)}</span><span>${display(row.goalDifference)}</span><strong>${display(row.points)}</strong></div>`).join(''):`<div class="ciao-table-empty">Таблица пока недоступна</div>`;
  return `<section class="ciao-tables-screen theme-${esc(config.theme)}" style="--ciao-tables-accent:${esc(config.colors.accent)};--ciao-tables-surface:${esc(config.colors.surface)}"><div class="ciao-tables-head"><span>${esc(config.label)}</span><h2>Таблицы</h2></div><div class="ciao-table-tournaments">${buttons}</div><div class="ciao-standing-card"><div class="ciao-standing-head"><span>#</span><span>Команда</span><span>И</span><span class="ciao-standing-wide">В</span><span class="ciao-standing-wide">Н</span><span class="ciao-standing-wide">П</span><span>РМ</span><span>О</span></div>${body}</div></section>`;
}

export function handleTablesClick(event,{router}={}){
  const button=event?.target?.closest?.('[data-ciao-table-tournament]');
  if(!button)return false;
  const tournament=text(button.dataset?.ciaoTableTournament).toLowerCase();
  if(!TABLE_TOURNAMENTS.includes(tournament))return false;
  router?.navigate?.({screen:'tables',tournament});
  return true;
}

export function bindTablesScreen(root,{router}={}){
  if(!root?.addEventListener)return ()=>{};
  const listener=event=>handleTablesClick(event,{router});
  root.addEventListener('click',listener);
  return ()=>root.removeEventListener?.('click',listener);
}
