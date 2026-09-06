import { getTournament } from '../core/tournament-registry.mjs';

function text(value) { return String(value ?? '').trim(); }
function normalizedName(value) {
  return text(value).toLocaleLowerCase('it-IT').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

function identityTokens(value = {}) {
  const tokens = [];
  const id = value?.id ?? value?.team_id ?? value?.teamId;
  if (id !== undefined && id !== null && text(id)) tokens.push(`id:${text(id)}`);
  for (const name of [value?.name, value?.team_name, value?.teamName, ...(Array.isArray(value?.aliases) ? value.aliases : [])]) {
    const normalized = normalizedName(name);
    if (normalized) tokens.push(`name:${normalized}`);
  }
  return tokens;
}

export function createSerieAClubIndex(standings = []) {
  const index = new Set();
  for (const row of Array.isArray(standings) ? standings : []) {
    const source = row?.team || row;
    for (const token of identityTokens(source)) index.add(token);
  }
  return index;
}

function teamInIndex(team, index) {
  return identityTokens(team).some(token => index?.has?.(token));
}

export function involvesSerieAClub(match, clubIndex) {
  return teamInIndex(match?.home, clubIndex) || teamInIndex(match?.away, clubIndex);
}

function matchesIdentity(team, identity = {}) {
  const wanted = new Set(identityTokens(identity));
  return identityTokens(team).some(token => wanted.has(token));
}

function kickoffTime(match) {
  const value = Date.parse(match?.kickoffAt || '');
  return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
}

function chronological(matches) {
  return [...matches].sort((a, b) => kickoffTime(a) - kickoffTime(b) || text(a?.id).localeCompare(text(b?.id)));
}

export function selectNearestClubMatch(matches = [], clubIdentity = {}, now = new Date()) {
  const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime();
  return chronological((Array.isArray(matches) ? matches : []).filter(match => (
    kickoffTime(match) >= nowMs && (matchesIdentity(match?.home, clubIdentity) || matchesIdentity(match?.away, clubIdentity))
  )))[0] || null;
}

function localDateKey(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(d.getTime())) return '';
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
}

export function selectCalcioToday(matches = [], clubIndex, now = new Date()) {
  const today = localDateKey(now);
  return chronological((Array.isArray(matches) ? matches : []).filter(match => (
    localDateKey(match?.kickoffAt) === today && involvesSerieAClub(match, clubIndex) && !match?.isQualification
  )));
}

export function isCoppaRoundOf16OrLater(match = {}) {
  const value = `${text(match?.stage)} ${text(match?.round)}`.toLowerCase();
  if (!value) return false;
  if (/round\s*of\s*32|1\s*\/\s*16|sedicesimi|round\s*32/.test(value)) return false;
  return /round\s*of\s*16|1\s*\/\s*8|ottavi|quarter|quarti|semi|final|finale/.test(value);
}

export function selectCompetitionFixtures(matches = [], competitionId, clubIndex) {
  const competition = getTournament(competitionId).id;
  let filtered = (Array.isArray(matches) ? matches : []).filter(match => match?.competition === competition);
  if (competition === 'coppa_italia') {
    filtered = filtered.filter(isCoppaRoundOf16OrLater);
  } else if (['ucl','uel','uecl'].includes(competition)) {
    filtered = filtered.filter(match => !match?.isQualification && involvesSerieAClub(match, clubIndex));
  }
  return chronological(filtered);
}
