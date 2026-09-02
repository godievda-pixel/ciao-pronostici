function score(value) {
  if (!Number.isInteger(value) || value < 0 || value > 20) {
    throw new Error('Invalid prediction score');
  }
  return value;
}

export function scorePrediction({ predictedHome, predictedAway, finalHome, finalAway } = {}) {
  const ph = score(predictedHome);
  const pa = score(predictedAway);
  const fh = score(finalHome);
  const fa = score(finalAway);

  if (ph === fh && pa === fa) return Object.freeze({ points: 5, resultType: 'exact' });

  const predictedDiff = ph - pa;
  const finalDiff = fh - fa;
  if (Math.sign(predictedDiff) === Math.sign(finalDiff) && predictedDiff === finalDiff) {
    return Object.freeze({ points: 3, resultType: 'goal_difference' });
  }
  if (Math.sign(predictedDiff) === Math.sign(finalDiff)) {
    return Object.freeze({ points: 2, resultType: 'outcome' });
  }
  return Object.freeze({ points: 0, resultType: 'miss' });
}

export function resultFingerprint({ matchId, finalHome, finalAway, rawVersion = '' } = {}) {
  const id = String(matchId ?? '').trim();
  if (!id) throw new Error('Match id is required');
  const home = score(finalHome);
  const away = score(finalAway);
  return `${id}|${home}:${away}|${String(rawVersion ?? '')}`;
}
