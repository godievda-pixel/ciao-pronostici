function score(value) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0 || number > 20) {
    throw new Error('invalid_score');
  }
  return number;
}

function kickoffMs(kickoffAt) {
  const value = Date.parse(String(kickoffAt ?? '').trim());
  if (!Number.isFinite(value)) throw new Error('invalid_kickoff');
  return value;
}

export function scorePrediction({
  predictedHome,
  predictedAway,
  finalHome,
  finalAway,
} = {}) {
  const ph = score(predictedHome);
  const pa = score(predictedAway);
  const fh = score(finalHome);
  const fa = score(finalAway);

  if (ph === fh && pa === fa) {
    return { points: 5, resultType: 'exact' };
  }

  const predictedDiff = ph - pa;
  const finalDiff = fh - fa;
  const sameOutcome = Math.sign(predictedDiff) === Math.sign(finalDiff);

  if (sameOutcome && predictedDiff === finalDiff) {
    return { points: 3, resultType: 'goal_difference' };
  }

  if (sameOutcome) {
    return { points: 2, resultType: 'outcome' };
  }

  return { points: 0, resultType: 'miss' };
}

export function predictionDeadlineIso(kickoffAt) {
  return new Date(kickoffMs(kickoffAt) - 15 * 60 * 1000).toISOString();
}

export function predictionIsOpen(kickoffAt, nowMs = Date.now()) {
  const now = Number(nowMs);
  if (!Number.isFinite(now)) throw new Error('invalid_now');
  return now < kickoffMs(kickoffAt) - 15 * 60 * 1000;
}
