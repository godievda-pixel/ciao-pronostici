import {
  initializePredictionSchema,
  upsertParticipant,
  upsertPrediction,
  listUserPredictions,
  listReconciledMatchIds,
  reconcileMatchPredictions,
  queryRanking,
  queryRankingMe,
  createRankingSnapshot,
  resetPredictionDomain,
} from './prediction-sql.mjs';
import { scorePrediction } from './prediction-scorer.mjs';

function json(payload, status = 200) {
  return Response.json(payload, { status });
}

async function bodyOf(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function nowIso() {
  return new Date().toISOString();
}

function transaction(storage, fn) {
  if (typeof storage?.transactionSync === 'function') {
    return storage.transactionSync(fn);
  }
  return fn();
}

function normalizedParticipantBatch(body, expectedSeason) {
  if (!body || body.season !== expectedSeason || !Array.isArray(body.participants)) return null;
  if (body.participants.length < 1 || body.participants.length > 1000) return null;

  const unique = new Map();
  for (const participant of body.participants) {
    if (!participant || typeof participant !== 'object') return null;
    const userId = String(participant.user_id ?? '').trim();
    if (!userId) return null;
    unique.set(userId, {
      user_id:userId,
      display_name:String(participant.display_name ?? '').trim() || 'Участник',
      username:String(participant.username ?? '').trim() || null,
    });
  }
  return [...unique.values()];
}

export class PredictionLeague {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sql = state.storage.sql;
    this.randomUUID = typeof env.PREDICTION_RANDOM_UUID === 'function'
      ? env.PREDICTION_RANDOM_UUID
      : () => crypto.randomUUID();
    this.ready = state.blockConcurrencyWhile(() => {
      initializePredictionSchema(this.sql, {
        environment: env.CIAO_ENV,
        season: env.PREDICTION_SEASON,
      });
    });
  }

  async fetch(request) {
    await this.ready;
    const url = new URL(request.url);

    try {
      if (url.pathname === '/participant' && request.method === 'POST') {
        const body = await bodyOf(request);
        if (!body || body.season !== this.env.PREDICTION_SEASON || !body.participant) {
          return json({ ok: false, error: 'invalid_participant_payload' }, 400);
        }
        const participant = transaction(this.state.storage, () => (
          upsertParticipant(this.sql, body.participant, nowIso())
        ));
        return json({ ok: true, participant });
      }

      if (url.pathname === '/participants' && request.method === 'POST') {
        const body = await bodyOf(request);
        const participants = normalizedParticipantBatch(body, this.env.PREDICTION_SEASON);
        if (!participants) return json({ ok:false, error:'invalid_participants_payload' }, 400);
        const timestamp = nowIso();
        const saved = transaction(this.state.storage, () => (
          participants.map(participant => upsertParticipant(this.sql, participant, timestamp))
        ));
        return json({ ok:true, participants:saved });
      }

      if (url.pathname === '/write' && request.method === 'POST') {
        const body = await bodyOf(request);
        if (!body || body.season !== this.env.PREDICTION_SEASON || !body.participant || !Array.isArray(body.predictions)) {
          return json({ ok: false, error: 'invalid_write_payload' }, 400);
        }

        const saved = transaction(this.state.storage, () => {
          const participant = upsertParticipant(this.sql, body.participant, nowIso());
          return body.predictions.map(item => upsertPrediction(
            this.sql,
            { ...item, user_id: participant.user_id, season: body.season },
            nowIso(),
            this.randomUUID,
          ));
        });
        return json({ ok: true, predictions: saved });
      }

      if (url.pathname === '/user' && request.method === 'GET') {
        const userId = url.searchParams.get('user_id') || '';
        const competition = url.searchParams.get('competition') || 'all';
        return json({ ok: true, predictions: listUserPredictions(this.sql, { userId, competition }) });
      }

      if (url.pathname === '/reconciled' && request.method === 'GET') {
        const competition = url.searchParams.get('competition') || '';
        return json({ ok:true, match_ids:listReconciledMatchIds(this.sql, { competition }) });
      }

      if (url.pathname === '/rankings' && request.method === 'GET') {
        const scope = url.searchParams.get('scope') || 'overall';
        const competition = url.searchParams.get('competition') || undefined;
        return json({ ok: true, scope, ranking: queryRanking(this.sql, { scope, competition }) });
      }

      if (url.pathname === '/rankings/me' && request.method === 'GET') {
        const userId = url.searchParams.get('user_id') || '';
        return json({ ok: true, ranking: queryRankingMe(this.sql, { userId }) });
      }

      if (url.pathname === '/snapshot' && request.method === 'POST') {
        const body = await bodyOf(request);
        if (!body) return json({ ok: false, error: 'invalid_snapshot_payload' }, 400);
        const snapshot = transaction(this.state.storage, () => createRankingSnapshot(this.sql, {
          ...body,
          nowIso: nowIso(),
          randomUUID: this.randomUUID,
        }));
        return json({ ok: true, snapshot });
      }

      if (url.pathname === '/reconcile' && request.method === 'POST') {
        const body = await bodyOf(request);
        if (!body) return json({ ok: false, error: 'invalid_reconcile_payload' }, 400);
        const result = transaction(this.state.storage, () => reconcileMatchPredictions(this.sql, {
          ...body,
          scorePrediction,
        }));
        return json({ ok: true, ...result });
      }

      if (url.pathname === '/reset' && request.method === 'POST') {
        const body = await bodyOf(request);
        if (!body || body.environment !== 'test' || body.season !== this.env.PREDICTION_SEASON || this.env.CIAO_ENV !== 'test') {
          return json({ ok: false, error: 'reset_forbidden' }, 403);
        }
        const result = transaction(this.state.storage, () => resetPredictionDomain(this.sql));
        return json({
          ok: true,
          stages: {
            predictions: { ok: true, affected: result.predictions },
            points: { ok: true, affected: result.points },
            ranking: { ok: true, affected: result.ranking },
            caches: { ok: true, affected: result.caches },
          },
        });
      }

      return json({ ok: false, error: 'not_found' }, 404);
    } catch (error) {
      return json({ ok: false, error: String(error?.message || error || 'prediction_storage_failed') }, 500);
    }
  }
}
