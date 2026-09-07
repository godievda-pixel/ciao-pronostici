import {
  competitionById,
  isCoppaVisibleStage,
  isEuropeanCompetition,
} from '../domain/competitions.mjs';
import { canonicalMatchId } from '../domain/match.mjs';
import { predictionDeadlineIso, predictionIsOpen } from '../domain/scoring.mjs';

const EXTERNAL = new Set(['coppa_italia','ucl','uel','uecl']);
const COPPA_VISIBLE_RU = new Set(['1/8 финала','1/4 финала','1/2 финала','Финал']);
const text = value => String(value ?? '').trim();

function queryData(query) {
  if (query?.error) throw query.error;
  return query?.data ?? [];
}

function userIdOf(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new Error('user_required');
  return id;
}

function scoreOf(value) {
  const score = Number(value);
  if (!Number.isInteger(score) || score < 0 || score > 20) throw new Error('invalid_score');
  return score;
}

function resultTypeFromPoints(points) {
  if (points === null || points === undefined) return null;
  const value = Number(points);
  if (value === 5) return 'exact';
  if (value === 3) return 'goal_difference';
  if (value === 2) return 'outcome';
  if (value === 0) return 'miss';
  return null;
}

function deadlineOrNull(kickoffAt) {
  try {
    return predictionDeadlineIso(kickoffAt);
  } catch {
    return null;
  }
}

function sourceId(competition, matchId) {
  const canonical = canonicalMatchId(competition, matchId);
  return canonical.slice(competition.length + 1);
}

function assertCanonicalMatch(match) {
  if (!match || typeof match !== 'object') throw new Error('match_required');
  const competition = competitionById(match.competition).id;
  const id = text(match.id);
  if (!id || canonicalMatchId(competition, id) !== id) throw new Error('match_id_not_canonical');
  return {competition,id};
}

function assertExternalEligible(match, competition) {
  if (!EXTERNAL.has(competition)) throw new Error(`invalid_external_competition:${competition}`);
  if (isEuropeanCompetition(competition)) {
    if (match?.isQualification || match?.isItalianRelevant !== true) throw new Error('match_not_eligible');
    return;
  }

  const stage = text(match?.stage);
  if (!COPPA_VISIBLE_RU.has(stage) && !isCoppaVisibleStage(stage)) throw new Error('match_not_eligible');
}

function seasonOf(match) {
  const explicit = text(match?.season);
  if (explicit) return explicit;
  const kickoff = Date.parse(text(match?.kickoffAt));
  if (!Number.isFinite(kickoff)) throw new Error('invalid_kickoff');
  return String(new Date(kickoff).getUTCFullYear());
}

export function createPredictionRepository({db} = {}) {
  if (!db?.from) throw new Error('db_required');

  async function legacyMatchRows(matchIds) {
    const ids = [...new Set(matchIds.map(Number).filter(Number.isInteger))];
    if (!ids.length) return new Map();
    const query = await db.from('cp_matches')
      .select('id,bsd_event_id,kickoff_at,is_finished')
      .in('id', ids);
    const rows = queryData(query);
    return new Map(rows.map(row => [Number(row.id), row]));
  }

  async function listLegacy(userId) {
    const query = await db.from('cp_predictions')
      .select('user_id,match_id,home_score,away_score,points')
      .eq('user_id', userId);
    const rows = queryData(query);
    const matches = await legacyMatchRows(rows.map(row => row.match_id));

    return rows.map(row => {
      const match = matches.get(Number(row.match_id));
      const identity = match?.bsd_event_id ?? row.match_id;
      return {
        userId:Number(row.user_id),
        matchId:`serie_a:${identity}`,
        competition:'serie_a',
        predictedHome:Number(row.home_score),
        predictedAway:Number(row.away_score),
        points:row.points === null || row.points === undefined ? null : Number(row.points),
        resultType:resultTypeFromPoints(row.points),
        lockedAt:deadlineOrNull(match?.kickoff_at),
      };
    });
  }

  async function listExternal(userId, competition = '') {
    let query = db.from('cp_competition_predictions')
      .select('user_id,match_id,competition,predicted_home,predicted_away,points,result_type,locked_at')
      .eq('user_id', userId);
    if (competition) query = query.eq('competition', competition);
    const rows = queryData(await query);

    return rows.map(row => ({
      userId:Number(row.user_id),
      matchId:text(row.match_id),
      competition:text(row.competition),
      predictedHome:Number(row.predicted_home),
      predictedAway:Number(row.predicted_away),
      points:row.points === null || row.points === undefined ? null : Number(row.points),
      resultType:text(row.result_type) || null,
      lockedAt:text(row.locked_at) || null,
    }));
  }

  async function listByUser(userId, competition = '') {
    const id = userIdOf(userId);
    const competitionId = competition ? competitionById(competition).id : '';
    if (competitionId === 'serie_a') return await listLegacy(id);
    if (competitionId) return await listExternal(id, competitionId);

    const [legacy, external] = await Promise.all([
      listLegacy(id),
      listExternal(id),
    ]);
    return [...legacy, ...external];
  }

  async function resolveSerieAMatch(match) {
    const rawSource = text(match?.providerMatchId) || sourceId('serie_a', match?.id);
    const bsdEventId = Number(rawSource);
    let row = null;

    if (Number.isInteger(bsdEventId) && bsdEventId > 0) {
      const byBsd = await db.from('cp_matches')
        .select('id,bsd_event_id,kickoff_at,is_finished')
        .eq('bsd_event_id', bsdEventId)
        .maybeSingle();
      if (byBsd?.error) throw byBsd.error;
      row = byBsd?.data ?? null;
    }

    if (!row && Number.isInteger(bsdEventId) && bsdEventId > 0) {
      const byId = await db.from('cp_matches')
        .select('id,bsd_event_id,kickoff_at,is_finished')
        .eq('id', bsdEventId)
        .maybeSingle();
      if (byId?.error) throw byId.error;
      row = byId?.data ?? null;
    }

    if (!row) throw new Error('match_not_found');
    return row;
  }

  async function save({userId, match, predictedHome, predictedAway, nowMs = Date.now()} = {}) {
    const id = userIdOf(userId);
    const {competition,id:matchId} = assertCanonicalMatch(match);
    const home = scoreOf(predictedHome);
    const away = scoreOf(predictedAway);

    if (competition === 'serie_a') {
      const legacyMatch = await resolveSerieAMatch(match);
      const kickoffAt = text(legacyMatch.kickoff_at) || text(match.kickoffAt);
      if (legacyMatch.is_finished === true || !predictionIsOpen(kickoffAt, nowMs)) {
        throw new Error('prediction_closed');
      }
      const lockedAt = predictionDeadlineIso(kickoffAt);
      const query = await db.from('cp_predictions').upsert({
        user_id:id,
        match_id:Number(legacyMatch.id),
        home_score:home,
        away_score:away,
        points:null,
        base_points:null,
        updated_at:new Date(Number(nowMs)).toISOString(),
      }, {onConflict:'user_id,match_id'});
      queryData(query);
      return {
        userId:id,
        matchId,
        competition,
        predictedHome:home,
        predictedAway:away,
        points:null,
        resultType:null,
        lockedAt,
      };
    }

    assertExternalEligible(match, competition);
    const kickoffAt = text(match.kickoffAt);
    if (!predictionIsOpen(kickoffAt, nowMs)) throw new Error('prediction_closed');
    const lockedAt = predictionDeadlineIso(kickoffAt);
    const query = await db.from('cp_competition_predictions').upsert({
      user_id:id,
      match_id:matchId,
      competition,
      season:seasonOf(match),
      predicted_home:home,
      predicted_away:away,
      points:null,
      result_type:null,
      updated_at:new Date(Number(nowMs)).toISOString(),
      locked_at:lockedAt,
    }, {onConflict:'user_id,match_id'});
    queryData(query);

    return {
      userId:id,
      matchId,
      competition,
      predictedHome:home,
      predictedAway:away,
      points:null,
      resultType:null,
      lockedAt,
    };
  }

  async function pointsForCompetitions(competitionIds = []) {
    const ids = [...new Set((Array.isArray(competitionIds) ? competitionIds : []).map(value => competitionById(value).id))];
    if (!ids.length) return [];
    const result = [];

    if (ids.includes('serie_a')) {
      const legacy = await db.from('cp_predictions')
        .select('user_id,points')
        .not('points','is',null);
      for (const row of queryData(legacy)) {
        result.push({userId:Number(row.user_id),competition:'serie_a',points:Number(row.points)});
      }
    }

    const externalIds = ids.filter(value => EXTERNAL.has(value));
    if (externalIds.length) {
      const external = await db.from('cp_competition_predictions')
        .select('user_id,competition,points')
        .in('competition', externalIds)
        .not('points','is',null);
      for (const row of queryData(external)) {
        if (!externalIds.includes(text(row.competition))) continue;
        result.push({userId:Number(row.user_id),competition:text(row.competition),points:Number(row.points)});
      }
    }

    return result;
  }

  async function statsForUser(userId) {
    const rows = await listByUser(userId);
    const calculated = rows.filter(row => row.points !== null && row.points !== undefined);
    return {
      points:calculated.reduce((sum,row) => sum + Number(row.points || 0), 0),
      exact:calculated.filter(row => Number(row.points) === 5).length,
      successful:calculated.filter(row => Number(row.points) > 0).length,
      calculated:calculated.length,
    };
  }

  return Object.freeze({
    listByUser,
    save,
    pointsForCompetitions,
    statsForUser,
  });
}
