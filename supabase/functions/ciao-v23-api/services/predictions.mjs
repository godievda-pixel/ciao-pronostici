import { competitionById } from '../domain/competitions.mjs';
import { predictionDeadlineIso, predictionIsOpen } from '../domain/scoring.mjs';

const text = value => String(value ?? '').trim();

function requireUserId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new Error('user_required');
  return id;
}

function currentMatchIsOpen(match, nowMs) {
  const status = text(match?.status).toLowerCase();
  if (['finished','cancelled','canceled'].includes(status)) return false;
  try {
    return predictionIsOpen(match?.kickoffAt, nowMs);
  } catch {
    return false;
  }
}

export function createPredictionService({matchService, predictionRepository} = {}) {
  if (!matchService?.listMatches || !matchService?.getMatchCenter) {
    throw new Error('match_service_required');
  }
  if (!predictionRepository?.listByUser || !predictionRepository?.save) {
    throw new Error('prediction_repository_required');
  }

  async function available({userId, competition, nowMs = Date.now()} = {}) {
    const id = requireUserId(userId);
    const competitionId = competitionById(competition).id;
    const [matches, saved] = await Promise.all([
      matchService.listMatches({competition:competitionId}),
      predictionRepository.listByUser(id, competitionId),
    ]);
    const savedByMatch = new Map((Array.isArray(saved) ? saved : []).map(item => [text(item?.matchId), item]));

    return (Array.isArray(matches) ? matches : [])
      .filter(match => currentMatchIsOpen(match, nowMs))
      .map(match => ({
        match,
        prediction:savedByMatch.get(text(match?.id)) ?? null,
        deadlineAt:predictionDeadlineIso(match.kickoffAt),
      }))
      .sort((a,b) => Date.parse(a.match?.kickoffAt || 0) - Date.parse(b.match?.kickoffAt || 0));
  }

  async function mine({userId, competition} = {}) {
    const id = requireUserId(userId);
    const competitionId = competitionById(competition).id;
    const saved = await predictionRepository.listByUser(id, competitionId);
    let matches = [];
    try {
      const current = await matchService.listMatches({competition:competitionId});
      matches = Array.isArray(current) ? current : [];
    } catch {
      matches = [];
    }
    const byId = new Map(matches.map(match => [text(match?.id), match]).filter(([matchId]) => matchId));

    return (Array.isArray(saved) ? saved : []).map(prediction => ({
      prediction,
      match:byId.get(text(prediction?.matchId)) ?? null,
    }));
  }

  async function save({userId, competition, matchId, home, away, nowMs = Date.now()} = {}) {
    const id = requireUserId(userId);
    const competitionId = competitionById(competition).id;
    const canonicalId = text(matchId);
    if (!canonicalId) throw new Error('match_id_required');

    const result = await matchService.getMatchCenter({
      competition:competitionId,
      matchId:canonicalId,
      section:'overview',
    });
    if (!result?.match) throw new Error('match_not_found');

    return await predictionRepository.save({
      userId:id,
      match:result.match,
      predictedHome:home,
      predictedAway:away,
      nowMs,
    });
  }

  return Object.freeze({available, mine, save});
}
