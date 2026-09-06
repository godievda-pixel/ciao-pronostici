import { getTournament } from '../core/tournament-registry.mjs';

function text(value){return String(value??'').trim()}
function esc(value){return text(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function logo(team){return team?.crestUrl?`<img class="ciao-match-logo" src="${esc(team.crestUrl)}" alt="" loading="lazy" decoding="async">`:`<span class="ciao-match-logo ciao-match-logo--empty">⚽</span>`}
function isLive(match){return /live|in_play|playing/.test(text(match?.status).toLowerCase())}
function isFinished(match){return /finished|full.?time|ft/.test(text(match?.status).toLowerCase())}
function kickoffLabel(value){const d=new Date(value);if(!Number.isFinite(d.getTime()))return 'Время уточняется';return new Intl.DateTimeFormat('ru-RU',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).format(d).replace(',',' ·')}

export function renderMatchCard(match,{variant='default'}={}){
  const tournament=getTournament(match?.competition);
  const live=isLive(match),finished=isFinished(match);
  const h=match?.score?.home,a=match?.score?.away;
  const score=(live||finished)&&h!=null&&a!=null?`${h} : ${a}`:'— : —';
  const status=live?`LIVE${match?.minute!=null?` · ${match.minute}′`:''}`:finished?'Матч завершён':kickoffLabel(match?.kickoffAt);
  return `<button type="button" class="ciao-match-card ciao-match-card--${esc(variant)} theme-${esc(tournament.theme)}${live?' is-live':''}" data-ciao-match-id="${esc(match?.id)}" data-ciao-competition="${esc(match?.competition)}" style="--ciao-card-accent:${esc(tournament.colors.accent)};--ciao-card-surface:${esc(tournament.colors.surface)}">
    <div class="ciao-match-card-top"><span>${esc(tournament.shortLabel)}</span><b>${esc(status)}</b></div>
    <div class="ciao-match-card-main"><div class="ciao-match-team">${logo(match?.home)}<strong>${esc(match?.home?.name||'Хозяева')}</strong></div><div class="ciao-match-score">${esc(score)}</div><div class="ciao-match-team is-away">${logo(match?.away)}<strong>${esc(match?.away?.name||'Гости')}</strong></div></div>
  </button>`;
}
