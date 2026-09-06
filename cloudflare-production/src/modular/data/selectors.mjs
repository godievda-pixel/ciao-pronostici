function text(value){return String(value??'').trim();}
function normalizeName(value){return text(value).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9а-яё]+/gi,' ').trim();}
function teamKeys(team={}){
  const keys=[];
  const id=Number(team?.id ?? team?.team_id);
  if(Number.isFinite(id)&&id>0)keys.push(`id:${id}`);
  const name=normalizeName(team?.name ?? team?.team_name);
  if(name)keys.push(`name:${name}`);
  return keys;
}
function hasIdentity(team,identity={}){
  const offered=new Set(teamKeys(team));
  const wanted=teamKeys(identity);
  return wanted.some(key=>offered.has(key));
}
function kickoffMs(match){const value=Date.parse(match?.kickoffAt||'');return Number.isFinite(value)?value:Number.MAX_SAFE_INTEGER;}
function chronological(rows){return [...rows].sort((a,b)=>kickoffMs(a)-kickoffMs(b)||text(a?.id).localeCompare(text(b?.id)));}
function localDateKey(value){const d=value instanceof Date?value:new Date(value);if(Number.isNaN(d.getTime()))return '';return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function isFinished(match){return match?.status==='finished'||match?.isFinished===true;}
function coppaRoundOf16OrLater(match){
  const stage=normalizeName(match?.stage);
  if(!stage)return false;
  if(/round of 32|1 16|trentaduesimi|sedicesimi/.test(stage))return false;
  return /round of 16|1 8|ottavi|quarter|quarti|semi|final/.test(stage);
}

export function createSerieAClubIndex(standings=[]){
  const index=new Set();
  for(const row of Array.isArray(standings)?standings:[]){
    for(const key of teamKeys({id:row?.team_id ?? row?.id,name:row?.team_name ?? row?.name ?? row?.team?.name}))index.add(key);
  }
  return index;
}

export function involvesSerieAClub(match,index=new Set()){
  return [...teamKeys(match?.home),...teamKeys(match?.away)].some(key=>index.has(key));
}

export function selectNearestClubMatch(matches=[],clubIdentity={},now=new Date()){
  const threshold=now instanceof Date?now.getTime():new Date(now).getTime();
  return chronological((Array.isArray(matches)?matches:[]).filter(match=>{
    const time=kickoffMs(match);
    return !isFinished(match)&&time>=threshold&&(hasIdentity(match?.home,clubIdentity)||hasIdentity(match?.away,clubIdentity));
  }))[0]??null;
}

export function selectCalcioToday(matches=[],clubIndex=new Set(),now=new Date()){
  const today=localDateKey(now);
  return chronological((Array.isArray(matches)?matches:[]).filter(match=>localDateKey(match?.kickoffAt)===today&&involvesSerieAClub(match,clubIndex)));
}

export function selectCompetitionFixtures(matches=[],competition,clubIndex=new Set()){
  const key=text(competition).toLowerCase();
  return chronological((Array.isArray(matches)?matches:[]).filter(match=>{
    if(text(match?.competition).toLowerCase()!==key)return false;
    if(key==='coppa_italia')return coppaRoundOf16OrLater(match);
    if(['ucl','uel','uecl'].includes(key))return !match?.isQualification&&involvesSerieAClub(match,clubIndex);
    return key==='serie_a';
  }));
}
