export const BSD_CREST_PATCH_MARKER = 'ciao-prod-bsd-crests-20260907';

export const BSD_TEAM_ID_BY_LOCAL_ID = Object.freeze({
  1: 71,
  2: 66,
  3: 67,
  4: 69,
  5: 68,
  6: 1277,
  7: 59,
  8: 77,
  9: 73,
  10: 70,
  11: 60,
  12: 63,
  13: 1286,
  14: 62,
  15: 74,
  16: 65,
  17: 61,
  18: 78,
  19: 75,
  20: 1285,
});

const BSD_TEAM_ID_BY_NAME = Object.freeze({
  'аталанта': 71, 'atalanta': 71,
  'болонья': 66, 'bologna': 66,
  'кальяри': 67, 'cagliari': 67,
  'комо': 69, 'como': 69,
  'фиорентина': 68, 'fiorentina': 68,
  'фрозиноне': 1277, 'frosinone': 1277,
  'дженоа': 59, 'genoa': 59,
  'интер': 77, 'inter': 77,
  'ювентус': 73, 'juventus': 73,
  'лацио': 70, 'lazio': 70,
  'лечче': 60, 'lecce': 60,
  'милан': 63, 'milan': 63,
  'монца': 1286, 'monza': 1286,
  'наполи': 62, 'napoli': 62,
  'парма': 74, 'parma': 74,
  'рома': 65, 'roma': 65,
  'сассуоло': 61, 'sassuolo': 61,
  'торино': 78, 'torino': 78,
  'удинезе': 75, 'udinese': 75,
  'венеция': 1285, 'venezia': 1285,
});

const BSD_TEAM_IDS = new Set(Object.values(BSD_TEAM_ID_BY_LOCAL_ID));
const BSD_CREST_ORIGIN = 'https://sports.bzzoiro.com/img/team';
const FINAL_IIFE_MARKER = '  /* ===== /Ciao, Web! v22.5 product polish layer ===== */\n\n})();\n</script>';

function text(value) { return String(value ?? '').trim(); }

export function bsdTeamIdFor(team = {}) {
  const direct = Number(
    team?.bsd_team_id ??
      team?.bsdTeamId ??
      team?.provider_team_id ??
      team?.providerTeamId ??
      0,
  );
  if (Number.isInteger(direct) && direct > 0) return direct;

  const local = Number(team?.id ?? team?.team_id ?? team?.teamId ?? 0);
  if (Number.isInteger(local) && BSD_TEAM_ID_BY_LOCAL_ID[local]) {
    return BSD_TEAM_ID_BY_LOCAL_ID[local];
  }
  if (Number.isInteger(local) && BSD_TEAM_IDS.has(local)) return local;

  const name = text(team?.name ?? team?.team_name ?? team?.teamName).toLocaleLowerCase('ru-RU');
  return Number(BSD_TEAM_ID_BY_NAME[name]) || 0;
}

export function bsdCrestUrlFor(team = {}) {
  const direct = text(
    team?.crestUrl ??
      team?.crest_url ??
      team?.logo ??
      team?.logo_url ??
      team?.logoUrl,
  );
  if (/^https:\/\/sports\.bzzoiro\.com\/img\/team\/\d+\/?\?bg=transparent(?:&[^\s<>"']*)?$/i.test(direct)) {
    return direct;
  }

  const id = bsdTeamIdFor(team);
  return id ? `${BSD_CREST_ORIGIN}/${encodeURIComponent(id)}/?bg=transparent` : '';
}

export function runtimePatchSource() {
  const localIds = JSON.stringify(BSD_TEAM_ID_BY_LOCAL_ID);
  const names = JSON.stringify(BSD_TEAM_ID_BY_NAME);
  const bsdIds = JSON.stringify([...BSD_TEAM_IDS]);

  return `
  /* ${BSD_CREST_PATCH_MARKER} */
  const __CW225_BSD_LOCAL_IDS=${localIds};
  const __CW225_BSD_NAMES=${names};
  const __CW225_BSD_IDS=new Set(${bsdIds});
  const __CW225_BSD_CREST_ORIGIN='${BSD_CREST_ORIGIN}';
  const __cw225LegacyAssetNeedle='asset'+'=emoji';

  function __cw225BsdTeamId(team={}){
    const direct=Number(team?.bsd_team_id??team?.bsdTeamId??team?.provider_team_id??team?.providerTeamId??0);
    if(Number.isInteger(direct)&&direct>0)return direct;
    const local=Number(team?.id??team?.team_id??team?.teamId??0);
    if(Number.isInteger(local)&&__CW225_BSD_LOCAL_IDS[local])return Number(__CW225_BSD_LOCAL_IDS[local]);
    if(Number.isInteger(local)&&__CW225_BSD_IDS.has(local))return local;
    const name=String(team?.name??team?.team_name??team?.teamName??'').trim().toLocaleLowerCase('ru-RU');
    return Number(__CW225_BSD_NAMES[name])||0;
  }
  function __cw225BsdCrestUrl(team={}){
    const direct=String(team?.crestUrl??team?.crest_url??team?.logo??team?.logo_url??team?.logoUrl??'').trim();
    try{const parsed=new URL(direct);const parts=parsed.pathname.split('/').filter(Boolean);if(parsed.origin==='https://sports.bzzoiro.com'&&parts.length===3&&parts[0]==='img'&&parts[1]==='team'&&/^[0-9]+$/.test(parts[2])&&parsed.searchParams.get('bg')==='transparent')return direct}catch(_e){}
    const id=__cw225BsdTeamId(team);
    return id?__CW225_BSD_CREST_ORIGIN+'/'+encodeURIComponent(id)+'/?bg=transparent':'';
  }
  function __cw225Attr(value){return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))}
  function __cw225LogoHtml(team,cls='logo'){
    const url=__cw225BsdCrestUrl(team),safeCls=__cw225Attr(cls||'logo');
    return url?'<img class="'+safeCls+'" loading="lazy" decoding="async" src="'+__cw225Attr(url)+'" alt="">':'<span class="'+safeCls+'">⚽</span>';
  }
  function __cw225LegacyClass(tag){const raw=String(tag||'');const quoted=raw.match(/class="([^"]*)"/i);if(quoted)return quoted[1];const single=raw.match(/class='([^']*)'/i);return single?single[1]:'logo'}
  function __cw225RewriteLegacyCrests(html,teams=[]){
    let index=0;const source=String(html??'');
    if(!source.includes(__cw225LegacyAssetNeedle))return source;
    return source.replace(/<img[^>]*>/gi,tag=>{
      if(!tag.includes(__cw225LegacyAssetNeedle))return tag;
      const team=teams[index++]||null;
      return __cw225LogoHtml(team,__cw225LegacyClass(tag));
    });
  }
  function __cw225RoundTeams(){return (Array.isArray(S?.round?.matches)?S.round.matches:[]).flatMap(match=>[match?.home,match?.away])}
  function __cw225SerieTeams(){return (Array.isArray(S?.serie_a_table?.rows)?S.serie_a_table.rows:[]).map(row=>({id:row?.team_id??row?.id,name:row?.team_name??row?.name,bsd_team_id:row?.bsd_team_id,crestUrl:row?.crestUrl??row?.crest_url??row?.logo}))}

  try{const base=predict;predict=function(){return __cw225RewriteLegacyCrests(base(),__cw225RoundTeams())}}catch(_e){}
  try{const base=mine;mine=function(){return __cw225RewriteLegacyCrests(base(),__cw225RoundTeams())}}catch(_e){}
  try{const base=__cw9CalendarCard;__cw9CalendarCard=function(match){return __cw225RewriteLegacyCrests(base(match),[match?.home,match?.away])}}catch(_e){}
  try{const base=serieA;serieA=function(){return __cw225RewriteLegacyCrests(base(),__cw225SerieTeams())}}catch(_e){}
  try{const base=matchCenterHtml;matchCenterHtml=function(data){const match=data?.match||data||{};return __cw225RewriteLegacyCrests(base(data),[match?.home,match?.away])}}catch(_e){}
  try{__cw18Logo=function(team,cls=''){const url=__cw225BsdCrestUrl(team);return url?'<img class="'+__cw225Attr(cls)+'" loading="lazy" decoding="async" src="'+__cw225Attr(url)+'" alt="">':'<span>⚽</span>'}}catch(_e){}
  try{__cw2154EmojiAssetUrl=function(){return ''};__cw2154RepairClubAssets=function(){return 0}}catch(_e){}
  /* /${BSD_CREST_PATCH_MARKER} */
`;
}

export function injectBsdCrestPatch(input) {
  const html = String(input || '');
  if (html.includes(BSD_CREST_PATCH_MARKER)) return html;
  const index = html.lastIndexOf(FINAL_IIFE_MARKER);
  if (index < 0) throw new Error('production v22.5 final IIFE marker missing');
  const patch = runtimePatchSource();
  return `${html.slice(0, index)}${patch}${html.slice(index)}`;
}

export function validateBsdCrestPatchedHtml(input) {
  const html = String(input || '');
  const count = html.split(BSD_CREST_PATCH_MARKER).length - 1;
  if (count !== 2) throw new Error(`production BSD crest patch marker count invalid: ${count}`);
  if (!html.includes(BSD_CREST_ORIGIN)) throw new Error('production BSD crest origin missing');
  if (html.includes('compat-v22-5-emoji.mjs')) throw new Error('legacy emoji compatibility module must not be used');
  return true;
}
