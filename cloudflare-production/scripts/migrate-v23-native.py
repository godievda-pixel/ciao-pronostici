from pathlib import Path
import re

SOURCE = Path(__file__).resolve().parents[1] / 'src' / 'v23' / 'index.html'
html = SOURCE.read_text(encoding='utf-8')

PRED_MARKER = 'ciao-v23-native-predictions-20260908'
HOME_END = '  /* /ciao-v23-native-home-20260908 */'

if PRED_MARKER in html:
    print('v23 native predictions already applied')
    raise SystemExit(0)


def remove_marked_block_if_present(text: str, marker: str) -> str:
    pattern = re.compile(
        r'\n?\s*/\*\s*' + re.escape(marker) + r'\s*\*/[\s\S]*?/\*\s*/' + re.escape(marker) + r'\s*\*/\s*\n?',
        re.M,
    )
    matches = list(pattern.finditer(text))
    if len(matches) > 1:
        raise SystemExit(f'expected at most one {marker} block, found {len(matches)}')
    return pattern.sub('\n', text, count=1) if matches else text


for obsolete in [
    'ciao-prod-prediction-stage-lock-ui-20260907',
    'ciao-prod-prediction-mine-stage-polish-20260907',
]:
    html = remove_marked_block_if_present(html, obsolete)

if html.count(HOME_END) != 1:
    raise SystemExit(f'expected one native Home anchor, found {html.count(HOME_END)}')

native = r'''

  /* ciao-v23-native-predictions-20260908 */
  function __cw23GroupLocked(group){return !!group&&Array.isArray(group.matches)&&group.matches.length>0&&group.matches.every(match=>match?.stage_locked===true)}
  __cwPredUxGroupLocked=__cw23GroupLocked;

  function __cw23SerieRoundBar(){
    return '<div class="rounds">'+(S?.rounds||[]).map(r=>{
      const locked=!r.unlocked;
      const attrs=locked?'disabled aria-disabled="true" tabindex="-1"':'aria-disabled="false"';
      return '<button type="button" class="round-chip '+(r.number===S.selected_round?'active ':'')+(locked?'locked':'')+'" data-round="'+Number(r.number)+'" '+attrs+'>'+Number(r.number)+'</button>';
    }).join('')+'</div>';
  }

  function __cw23ExternalStageBarHtml(){
    const groups=__cwPredExternalGroups();
    if(!groups.length)return '';
    return '<div class="rounds cwpred-rounds">'+groups.map(g=>{
      const locked=__cw23GroupLocked(g);
      const attrs=locked?'disabled aria-disabled="true" tabindex="-1"':'aria-disabled="false"';
      return '<button type="button" class="round-chip '+(g.key===__cwPredStageKey?'active ':'')+(locked?'cwpred-stage-locked':'')+'" data-cwpred-stage="'+__cwPredEsc(g.key)+'" '+attrs+'>'+__cwPredEsc(__cwPredStageShort(g))+'</button>';
    }).join('')+'</div>';
  }

  roundBar=__cw23SerieRoundBar;
  __cwPredStageBarHtml=__cw23ExternalStageBarHtml;

  function __cw23MinePredictionBlock(hasPrediction,prediction){
    return '<div class="cw23-mine-primary"><small>ВАШ ПРОГНОЗ</small><b>'+__cwPredEsc(hasPrediction?prediction:'— : —')+'</b>'+(hasPrediction?'':'<span class="cw23-mine-missing">Прогноз не сделан</span>')+'</div>';
  }

  function __cw23MineBody(homeHtml,awayHtml,hasPrediction,prediction,score,points){
    const result=score?'<div class="cw23-mine-result"><small>СЧЁТ МАТЧА</small><b>'+__cwPredEsc(score)+'</b></div>':'<span class="cw23-mine-await">Матч ещё не начался</span>';
    return '<div class="cw23-mine-matchline">'+homeHtml+__cw23MinePredictionBlock(hasPrediction,prediction)+awayHtml+'</div><div class="cw23-mine-result-strip">'+result+(points?'<div class="cwpred-points">'+__cwPredEsc(points)+'</div>':'')+'</div>';
  }

  function __cw23ExternalMineCard(match){
    const p=match?.prediction,has=!!p,prediction=has?String(p.home_score)+' : '+String(p.away_score):'— : —',score=__cwPredRealScore(match),points=__cwPredPoints(p?.points);
    return '<article class="cwpred-card cwpred-external-card cwpred-mine-card cw23-mine-card" data-cwpred-match="'+__cwPredEsc(String(match?.matchId||''))+'"><div class="cwpred-card-top"><span class="cwpred-status">'+__cwPredEsc(__cwPredStatus(match))+'</span><span class="cwpred-kickoff">'+__cwPredEsc(__cwPredDateTime(match?.kickoffAt))+'</span></div>'+__cw23MineBody(__cwPredExternalTeamHtml(match?.homeTeam,'home'),__cwPredExternalTeamHtml(match?.awayTeam,'away'),has,prediction,score,points)+'</article>';
  }

  function __cw23SerieMineCard(match){
    const p=match?.prediction,has=!!p,prediction=has?String(p.home_score)+' : '+String(p.away_score):'— : —',score=__cwPredSerieRealScore(match),points=__cwPredPoints(p?.points);
    return '<div class="mine-match cwpred-card cwpred-serie-card cwpred-mine-card cw23-mine-card" data-mid="'+Number(match.id)+'"><div class="cwpred-card-top"><span class="cwpred-status">'+__cwPredEsc(__cwPredSerieStatus(match))+'</span><span class="cwpred-kickoff">'+__cwPredEsc(typeof fmt==='function'?fmt(match.kickoff_at):'')+'</span></div>'+__cw23MineBody(__cwPredSerieTeamHtml(match.home,'home'),__cwPredSerieTeamHtml(match.away,'away'),has,prediction,score,points)+'</div>';
  }

  __cwPredExternalMineCard=__cw23ExternalMineCard;
  __cwPredSerieMineCard=__cw23SerieMineCard;

  try{
    const styleId='cw23-native-predictions-style';
    if(!document.getElementById(styleId)){
      const style=document.createElement('style');
      style.id=styleId;
      style.textContent='#ciao-miniapp-root .cwpred-stage-locked::before,#ciao-miniapp-root .cwpred-stage-locked::after,#ciao-miniapp-root .round-chip.locked::before,#ciao-miniapp-root .round-chip.locked::after{display:none!important;content:none!important}#ciao-miniapp-root .round-chip.locked,#ciao-miniapp-root .cwpred-stage-locked{opacity:.40!important;cursor:default!important;pointer-events:none!important}#ciao-miniapp-root .cw23-mine-card{overflow:hidden!important}.cw23-mine-matchline{display:grid;grid-template-columns:minmax(0,1fr) 94px minmax(0,1fr);align-items:center;gap:8px;min-width:0}.cw23-mine-primary{display:flex;flex-direction:column;align-items:center;justify-content:center;min-width:0;max-width:94px;padding:7px 4px;border-radius:13px;background:rgba(255,255,255,.035);overflow:hidden}.cw23-mine-primary small,.cw23-mine-result small{color:rgba(255,255,255,.43);font-size:7px;font-weight:850;letter-spacing:.04em}.cw23-mine-primary b{max-width:100%;color:#fff;font-size:18px;font-weight:950;line-height:1;white-space:nowrap}.cw23-mine-missing{display:block;max-width:100%;margin-top:5px;color:rgba(255,255,255,.42);font-size:7px;font-weight:750;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cw23-mine-result-strip{display:flex;align-items:center;justify-content:center;gap:10px;min-height:32px;margin-top:10px;padding-top:8px;border-top:1px solid rgba(255,255,255,.055)}.cw23-mine-result{display:flex;align-items:baseline;gap:7px}.cw23-mine-result b{font-size:14px;color:#fff}.cw23-mine-await{color:rgba(255,255,255,.42);font-size:9px;font-weight:750}@media(max-width:370px){.cw23-mine-matchline{grid-template-columns:minmax(0,1fr) 84px minmax(0,1fr);gap:5px}.cw23-mine-primary{max-width:84px}.cw23-mine-primary b{font-size:16px}}';
      document.head.appendChild(style);
    }
  }catch(_e){}

  try{if(tab==='predict'||tab==='mine')render()}catch(_e){}
  /* /ciao-v23-native-predictions-20260908 */
'''

html = html.replace(HOME_END, HOME_END + native, 1)
SOURCE.write_text(html, encoding='utf-8')
print(f'v23 native predictions migration complete: bytes={len(html.encode("utf-8"))}')
