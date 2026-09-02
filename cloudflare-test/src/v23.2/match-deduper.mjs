function text(value) {
  return String(value ?? '').trim();
}

function teamIdentity(team = {}) {
  return text(team?.id || team?.name || team?.rawName).toLowerCase();
}

function normalizedStage(value) {
  return text(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isCoppaSingleLeg(match) {
  if (text(match?.competition).toLowerCase() !== 'coppa_italia') return false;
  const stage = normalizedStage(match?.stage);
  if (!stage || /semi/.test(stage)) return false;
  return (
    /preliminary|turno preliminare/.test(stage)
    || /round (of )?64|first round|primo turno/.test(stage)
    || /round (of )?32|second round|secondo turno/.test(stage)
    || /round (of )?16|ottavi|1 8/.test(stage)
    || /quarter|quarti|1 4/.test(stage)
    || /^final$|^finale$/.test(stage)
  );
}

function coppaTieKey(match) {
  if (!isCoppaSingleLeg(match)) return '';
  const teams = [teamIdentity(match?.homeTeam), teamIdentity(match?.awayTeam)].filter(Boolean).sort();
  if (teams.length !== 2) return '';
  return `${normalizedStage(match?.stage)}|${teams[0]}|${teams[1]}`;
}

function statusRank(status) {
  switch (text(status).toLowerCase()) {
    case 'live': return 6;
    case 'finished': return 5;
    case 'scheduled': return 4;
    case 'postponed': return 2;
    case 'cancelled': return 1;
    default: return 3;
  }
}

function sourceRank(match) {
  const raw = text(match?.matchId).split(':').at(-1) || '';
  const value = Number(raw);
  return Number.isFinite(value) ? value : -1;
}

function preferredCoppaRecord(first, second) {
  const statusDelta = statusRank(second?.status) - statusRank(first?.status);
  if (statusDelta > 0) return second;
  if (statusDelta < 0) return first;

  const sourceDelta = sourceRank(second) - sourceRank(first);
  if (sourceDelta > 0) return second;
  if (sourceDelta < 0) return first;

  const firstTime = Date.parse(first?.kickoffAt || '');
  const secondTime = Date.parse(second?.kickoffAt || '');
  if (Number.isFinite(secondTime) && (!Number.isFinite(firstTime) || secondTime > firstTime)) return second;
  return first;
}

export function matchFingerprint(match = {}) {
  return [
    text(match.competition).toLowerCase(),
    text(match.stage).toLowerCase(),
    text(match.kickoffAt),
    teamIdentity(match.homeTeam),
    teamIdentity(match.awayTeam),
  ].join('|');
}

export function dedupeMatches(matches = []) {
  const byId = new Set();
  const byFingerprint = new Set();
  const exactUnique = [];

  for (const match of Array.isArray(matches) ? matches : []) {
    const id = text(match?.matchId);
    const fingerprint = matchFingerprint(match);
    if (id && byId.has(id)) continue;
    if (fingerprint && byFingerprint.has(fingerprint)) continue;
    if (id) byId.add(id);
    if (fingerprint) byFingerprint.add(fingerprint);
    exactUnique.push(match);
  }

  const chosenByTie = new Map();
  for (const match of exactUnique) {
    const tieKey = coppaTieKey(match);
    if (!tieKey) continue;
    const current = chosenByTie.get(tieKey);
    chosenByTie.set(tieKey, current ? preferredCoppaRecord(current, match) : match);
  }

  return exactUnique.filter(match => {
    const tieKey = coppaTieKey(match);
    return !tieKey || chosenByTie.get(tieKey) === match;
  });
}
