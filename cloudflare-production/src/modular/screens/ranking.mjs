const SCOPE_LABELS=Object.freeze({all:'Все',italy:'Италия',europe:'Еврокубки'});
function text(value){return String(value??'').trim()}
function esc(value){return text(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function avatar(row){const url=text(row?.favoriteTeam?.crestUrl||row?.favoriteTeam?.crest_url||row?.favorite_team?.crestUrl||row?.favorite_team?.crest_url);return url?`<img class="ciao-rank-logo" src="${esc(url)}" alt="">`:'<span class="ciao-rank-logo ciao-rank-logo--empty">•</span>'}

export function renderRankingScreen({scope='all',rows=[],currentUserId=''}={}){
  const active=SCOPE_LABELS[scope]?scope:'all';
  const normalized=(Array.isArray(rows)?rows:[]).map((row,index)=>({...row,rank:Number(row?.rank)||index+1}));
  return `<section class="ciao-ranking-screen"><div class="ciao-ranking-head"><span>Турнир прогнозистов</span><h2>Рейтинг</h2></div><div class="ciao-ranking-scopes">${Object.entries(SCOPE_LABELS).map(([id,label])=>`<button type="button" data-ranking-scope="${id}" class="ciao-ranking-scope${id===active?' is-active':''}">${label}</button>`).join('')}</div><div class="ciao-ranking-list">${normalized.map(row=>{const rank=Number(row.rank)||0;const userId=text(row.userId||row.user_id||row.id);const current=row.isCurrent===true||row.is_current===true||(currentUserId&&userId===text(currentUserId));return `<div class="ciao-ranking-row${rank<=3?' is-podium':''}${current?' is-current':''}" data-rank="${rank}" data-user-id="${esc(userId)}"><div class="ciao-ranking-position">${rank}</div>${avatar(row)}<div class="ciao-ranking-person"><b>${esc(row.displayName||row.display_name||row.name||'Участник')}</b>${row.username?`<span>@${esc(String(row.username).replace(/^@/,''))}</span>`:''}</div><strong class="ciao-ranking-points">${Number(row.points)||0}</strong></div>`}).join('')}</div></section>`;
}
