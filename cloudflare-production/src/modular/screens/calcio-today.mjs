import { selectCalcioToday } from '../data/selectors.mjs';
import { renderMatchCard } from '../ui/match-card.mjs';
import { renderEmptyState } from '../ui/empty-state.mjs';

export function renderCalcioToday({matches=[],clubIndex,now=new Date()}={}){
  const selected=selectCalcioToday(matches,clubIndex,now);
  return `<section class="ciao-calcio-today"><div class="ciao-screen-title"><div><span>Матчи клубов Серии А</span><h3>Кальчо сегодня</h3></div>${selected.length?`<b>${selected.length}</b>`:''}</div>${selected.length?`<div class="ciao-match-grid">${selected.map(match=>renderMatchCard(match,{variant:'today'})).join('')}</div>`:renderEmptyState('Кальчо сегодня нет :(')}</section>`;
}

function mergeMatches(current,updates){
  const map=new Map((current||[]).map(match=>[match.id,match]));
  for(const match of updates||[])if(match?.id)map.set(match.id,match);
  return [...map.values()];
}

export function createCalcioTodayController({dataService,liveEngine,clubIndex,render,now=()=>new Date()}={}){
  let matches=[];
  let unsubscribe=null;
  function emit(){const html=renderCalcioToday({matches,clubIndex,now:now()});render(html);return html}
  function onLive(snapshot){const updates=snapshot?.data?.matches;if(!Array.isArray(updates))return;matches=mergeMatches(matches,updates);emit()}
  return Object.freeze({
    async start(){
      if(!dataService?.loadAllMatches)throw new Error('calcio_data_service_required');
      if(typeof render!=='function')throw new Error('calcio_render_required');
      if(liveEngine?.subscribe&&!unsubscribe)unsubscribe=liveEngine.subscribe(onLive);
      const result=await dataService.loadAllMatches({});
      matches=Array.isArray(result?.matches)?result.matches:[];
      emit();
      if(liveEngine?.start)await liveEngine.start({screen:'calcio',matchIds:selectCalcioToday(matches,clubIndex,now()).map(x=>x.id)});
      return matches;
    },
    stop(){unsubscribe?.();unsubscribe=null;liveEngine?.stop?.()},
    state(){return Object.freeze({matches:[...matches]})},
  });
}
