import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scorePrediction } from '../src/v23.3/prediction-scorer.mjs';

const TEST_ORIGIN = 'https://ciao-web-app-test.ciao-web.workers.dev';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const defaultOutputPath = resolve(root, 'artifacts/v23-3-prediction-authenticated-smoke.json');

function text(value) {
  return String(value ?? '').trim();
}

export function assertSmokeOrigin(origin, { allowLocal = false } = {}) {
  let url;
  try {
    url = new URL(text(origin));
  } catch {
    throw new Error('Prediction smoke requires the TEST origin');
  }

  if (url.origin === TEST_ORIGIN) {
    return Object.freeze({ origin: url.origin, local: false });
  }

  const localHost = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
  if (allowLocal && localHost && ['http:', 'https:'].includes(url.protocol)) {
    return Object.freeze({ origin: url.origin, local: true });
  }

  throw new Error('Prediction smoke requires the TEST origin');
}

function legacyScorePrediction({ predictedHome, predictedAway, finalHome, finalAway }) {
  if (predictedHome === finalHome && predictedAway === finalAway) {
    return { points: 5, resultType: 'exact' };
  }
  const predictedDiff = predictedHome - predictedAway;
  const finalDiff = finalHome - finalAway;
  if (Math.sign(predictedDiff) === Math.sign(finalDiff) && predictedDiff === finalDiff) {
    return { points: 3, resultType: 'goal_difference' };
  }
  if (Math.sign(predictedDiff) === Math.sign(finalDiff)) {
    return { points: 2, resultType: 'outcome' };
  }
  return { points: 0, resultType: 'miss' };
}

export function proveScoringParity() {
  for (let ph = 0; ph <= 8; ph += 1) {
    for (let pa = 0; pa <= 8; pa += 1) {
      for (let fh = 0; fh <= 8; fh += 1) {
        for (let fa = 0; fa <= 8; fa += 1) {
          const actual = scorePrediction({
            predictedHome: ph,
            predictedAway: pa,
            finalHome: fh,
            finalAway: fa,
          });
          const expected = legacyScorePrediction({
            predictedHome: ph,
            predictedAway: pa,
            finalHome: fh,
            finalAway: fa,
          });
          if (actual.points !== expected.points || actual.resultType !== expected.resultType) return false;
        }
      }
    }
  }
  return true;
}

function competitionOf(matchId) {
  const id = text(matchId);
  const colon = id.indexOf(':');
  if (colon <= 0 || !id.slice(colon + 1)) throw new Error('Prediction smoke fixture requires a canonical match id');
  return id.slice(0, colon);
}

async function jsonRequest({ base, path, initData, fetchImpl, method = 'GET', body, authenticated = true, origins }) {
  const url = new URL(path, base.origin);
  origins.push(url.origin);
  const headers = new Headers();
  if (authenticated) headers.set('x-telegram-init-data', initData);
  if (body !== undefined) headers.set('content-type', 'application/json');

  const response = await fetchImpl(new Request(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  }));
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`Prediction smoke received invalid JSON from ${url.pathname}`);
  }
  return { response, payload };
}

function requireHealth(payload) {
  if (
    payload?.ok !== true
    || payload?.service !== 'ciao-web-app-test'
    || payload?.prediction_backend !== 'durable-object-sqlite'
    || payload?.prediction_environment !== 'test'
    || payload?.prediction_season !== '2026-27'
    || payload?.prediction_do_configured !== true
  ) {
    throw new Error('Prediction smoke TEST health markers are not ready');
  }
  return payload;
}

function rowFor(rows, matchId) {
  return (Array.isArray(rows) ? rows : []).find(row => row?.match_id === matchId) || null;
}

export async function runAuthenticatedPredictionSmoke({
  origin = TEST_ORIGIN,
  initData,
  fixtureA,
  fixtureB,
  fetchImpl = fetch,
  allowLocal = false,
  now = () => new Date(),
} = {}) {
  const base = assertSmokeOrigin(origin, { allowLocal });
  const signedInitData = text(initData);
  if (!signedInitData) throw new Error('Authenticated TEST Telegram init data is required');
  if (typeof fetchImpl !== 'function') throw new Error('Prediction smoke fetch implementation is required');

  const matchA = text(fixtureA);
  const matchB = text(fixtureB);
  const competitionA = competitionOf(matchA);
  const competitionB = competitionOf(matchB);
  if (competitionA === competitionB) throw new Error('Prediction smoke fixtures must use different competitions');

  const origins = [];
  const healthResult = await jsonRequest({
    base,
    path: '/healthz',
    initData: signedInitData,
    fetchImpl,
    authenticated: false,
    origins,
  });
  if (!healthResult.response.ok) throw new Error('Prediction smoke TEST health request failed');
  const health = requireHealth(healthResult.payload);

  const availableResult = await jsonRequest({
    base,
    path: '/api/v23.3/predictions/available?competition=all',
    initData: signedInitData,
    fetchImpl,
    origins,
  });
  if (!availableResult.response.ok || availableResult.payload?.ok !== true) {
    throw new Error('Prediction smoke available predictions request failed');
  }
  const available = Array.isArray(availableResult.payload?.data?.matches)
    ? availableResult.payload.data.matches
    : [];
  const canonicalA = available.find(match => match?.matchId === matchA) || null;
  const canonicalB = available.find(match => match?.matchId === matchB) || null;
  const locked = available.find(match => match?.state === 'locked') || null;

  const isolatedFixture = Boolean(
    canonicalA
    && canonicalB
    && canonicalA.state === 'open'
    && canonicalB.state === 'open'
    && canonicalA.competition === competitionA
    && canonicalB.competition === competitionB
    && matchA.startsWith(`${competitionA}:`)
    && matchB.startsWith(`${competitionB}:`)
    && competitionA !== competitionB
  );
  if (!isolatedFixture) throw new Error('Prediction smoke isolated fixtures are not currently writable');
  if (!locked?.matchId) throw new Error('Prediction smoke requires one canonical locked fixture');

  const save = async (matchId, competition, homeScore, awayScore) => {
    const result = await jsonRequest({
      base,
      path: '/api/v23.3/predictions',
      initData: signedInitData,
      fetchImpl,
      method: 'POST',
      body: {
        competition_key: competition,
        predictions: [{ match_id: matchId, home_score: homeScore, away_score: awayScore }],
      },
      origins,
    });
    if (!result.response.ok || result.payload?.ok !== true) {
      const code = text(result.payload?.error) || `http_${result.response.status}`;
      const error = new Error(code);
      error.code = code;
      error.status = result.response.status;
      throw error;
    }
    return Array.isArray(result.payload?.data) ? result.payload.data[0] || null : null;
  };

  const list = async competition => {
    const result = await jsonRequest({
      base,
      path: `/api/v23.3/predictions?competition=${encodeURIComponent(competition)}`,
      initData: signedInitData,
      fetchImpl,
      origins,
    });
    if (!result.response.ok || result.payload?.ok !== true) {
      throw new Error('Prediction smoke prediction read failed');
    }
    return Array.isArray(result.payload?.data) ? result.payload.data : [];
  };

  const firstSaved = await save(matchA, competitionA, 1, 0);
  const firstRead = rowFor(await list(competitionA), matchA);
  const edited = await save(matchA, competitionA, 2, 1);
  const editedRead = rowFor(await list(competitionA), matchA);

  const persistenceRoundTrip = Boolean(
    firstSaved?.prediction_id
    && firstSaved.prediction_id === firstRead?.prediction_id
    && firstSaved.prediction_id === edited?.prediction_id
    && firstSaved.prediction_id === editedRead?.prediction_id
    && Number(editedRead?.predicted_home) === 2
    && Number(editedRead?.predicted_away) === 1
  );

  await save(matchB, competitionB, 0, 0);
  const competitionARows = await list(competitionA);
  const competitionBRows = await list(competitionB);
  const crossCompetitionIsolation = Boolean(
    rowFor(competitionARows, matchA)
    && !rowFor(competitionARows, matchB)
    && rowFor(competitionBRows, matchB)
    && !rowFor(competitionBRows, matchA)
  );

  let deadlineBoundaryRejected = false;
  const lockedCompetition = competitionOf(locked.matchId);
  const lockedResult = await jsonRequest({
    base,
    path: '/api/v23.3/predictions',
    initData: signedInitData,
    fetchImpl,
    method: 'POST',
    body: {
      competition_key: lockedCompetition,
      predictions: [{ match_id: locked.matchId, home_score: 0, away_score: 0 }],
    },
    origins,
  });
  deadlineBoundaryRejected = lockedResult.response.status === 409
    && lockedResult.payload?.ok === false
    && lockedResult.payload?.error === 'prediction_locked';

  const scoringParity = proveScoringParity();
  const productionDataUntouched = origins.length > 0
    && origins.every(value => value === base.origin)
    && (base.origin === TEST_ORIGIN || base.local === true);

  return Object.freeze({
    performed: true,
    isolatedFixture,
    persistenceRoundTrip,
    crossCompetitionIsolation,
    deadlineBoundaryRejected,
    scoringParity,
    productionDataUntouched,
    fixtureA: matchA,
    fixtureB: matchB,
    lockedFixture: locked.matchId,
    checkedAt: (now() instanceof Date ? now() : new Date(now())).toISOString(),
    build: text(health.build),
  });
}

export async function main({
  origin = process.env.PREDICTION_SMOKE_ORIGIN || TEST_ORIGIN,
  initData = process.env.TEST_TELEGRAM_INIT_DATA || '',
  fixtureA = process.env.TEST_PREDICTION_MATCH_A || '',
  fixtureB = process.env.TEST_PREDICTION_MATCH_B || '',
  outputPath = process.env.PREDICTION_AUTH_SMOKE_OUTPUT || defaultOutputPath,
} = {}) {
  const report = await runAuthenticatedPredictionSmoke({ origin, initData, fixtureA, fixtureB });
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({
    ok: true,
    performed: report.performed,
    persistenceRoundTrip: report.persistenceRoundTrip,
    crossCompetitionIsolation: report.crossCompetitionIsolation,
    deadlineBoundaryRejected: report.deadlineBoundaryRejected,
    scoringParity: report.scoringParity,
    productionDataUntouched: report.productionDataUntouched,
    output: outputPath,
  }));
  return report;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
