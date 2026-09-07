function safeTime(value) {
  const time = Date.parse(String(value ?? ''));
  return Number.isFinite(time) ? time : Number.POSITIVE_INFINITY;
}

export function groupPredictionMatches(matches = []) {
  const groups = new Map();
  for (const match of Array.isArray(matches) ? matches : []) {
    const key = String(match?.stageKey ?? match?.stage_key ?? match?.roundKey ?? 'matches');
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        label: String(match?.stageLabel ?? match?.stage_label ?? 'Матчи'),
        order: Number(match?.stageOrder ?? match?.stage_order ?? 900),
        matches: [],
      });
    }
    const group = groups.get(key);
    group.order = Math.min(group.order, Number(match?.stageOrder ?? match?.stage_order ?? 900));
    group.matches.push(match);
  }

  const firstKickoff = group => group.matches.reduce(
    (min, match) => Math.min(min, safeTime(match?.kickoffAt ?? match?.kickoff_at)),
    Number.POSITIVE_INFINITY,
  );

  return [...groups.values()]
    .map(group => ({
      ...group,
      matches: [...group.matches].sort((a, b) => {
        const time = safeTime(a?.kickoffAt ?? a?.kickoff_at) - safeTime(b?.kickoffAt ?? b?.kickoff_at);
        if (time) return time;
        return String(a?.matchId ?? a?.id ?? '').localeCompare(String(b?.matchId ?? b?.id ?? ''));
      }),
    }))
    .sort((a, b) => firstKickoff(a) - firstKickoff(b) || a.order - b.order || a.label.localeCompare(b.label, 'ru'));
}

export function previousLeagueRoundLabel(stageKey) {
  const match = String(stageKey ?? '').match(/^league-(\d+)$/);
  const round = match ? Number(match[1]) : NaN;
  return Number.isFinite(round) && round > 1 ? `${round - 1}-го тура` : 'предыдущего тура';
}

export function stageShortLabel(group) {
  const key = String(group?.key ?? '');
  const league = key.match(/^league-(\d+)$/);
  if (league) return league[1];
  if (key === 'playoff') return 'Стыки';
  if (key === 'r32') return '1/16';
  if (key === 'r16') return '1/8';
  if (key === 'qf') return '1/4';
  if (key === 'sf') return '1/2';
  if (key === 'final') return 'Финал';
  return String(group?.label ?? 'Матчи');
}

export function isStageLocked(group) {
  const matches = Array.isArray(group?.matches) ? group.matches : [];
  return matches.length > 0 && matches.every(match => match?.stage_locked === true);
}

export function predictionStatus(match) {
  switch (String(match?.status ?? 'scheduled')) {
    case 'live': {
      const minute = Number(match?.minute);
      return { text: `LIVE${Number.isFinite(minute) ? ` · ${minute}′` : ''}`, tone: 'live' };
    }
    case 'halftime': return { text: 'ПЕРЕРЫВ', tone: 'neutral' };
    case 'extra_time': return { text: 'ДОП. ВРЕМЯ', tone: 'neutral' };
    case 'penalties': return { text: 'ПЕНАЛЬТИ', tone: 'neutral' };
    case 'finished': return { text: 'МАТЧ ЗАВЕРШЁН', tone: 'neutral' };
    case 'postponed': return { text: 'МАТЧ ПЕРЕНЕСЁН', tone: 'neutral' };
    case 'cancelled': return { text: 'МАТЧ ОТМЕНЁН', tone: 'neutral' };
    default: return { text: 'МАТЧ НЕ НАЧАЛСЯ', tone: 'neutral' };
  }
}

function finiteScore(value, fallback = 0) {
  const score = Number(value);
  return Number.isInteger(score) && score >= 0 && score <= 20 ? score : fallback;
}

export function predictionCardView(match = {}, draft = null) {
  const saved = match?.prediction ?? null;
  const hasDraft = draft && Number.isInteger(Number(draft.h)) && Number.isInteger(Number(draft.a));
  const hasSaved = saved && Number.isInteger(Number(saved.home_score)) && Number.isInteger(Number(saved.away_score));
  const homeScore = hasDraft ? finiteScore(draft.h) : hasSaved ? finiteScore(saved.home_score) : 0;
  const awayScore = hasDraft ? finiteScore(draft.a) : hasSaved ? finiteScore(saved.away_score) : 0;
  const predictionMissing = !hasDraft && !hasSaved;
  const status = predictionStatus(match);
  const activeScore = ['live', 'halftime', 'extra_time', 'penalties', 'finished'].includes(String(match?.status ?? ''));
  const realHome = Number(match?.homeScore ?? match?.home_score);
  const realAway = Number(match?.awayScore ?? match?.away_score);
  const hasRealScore = activeScore && Number.isInteger(realHome) && Number.isInteger(realAway);
  const points = Number(saved?.points);

  return Object.freeze({
    matchId: String(match?.matchId ?? match?.id ?? ''),
    homeTeam: match?.homeTeam ?? match?.home_team ?? null,
    awayTeam: match?.awayTeam ?? match?.away_team ?? null,
    kickoffAt: match?.kickoffAt ?? match?.kickoff_at ?? null,
    open: match?.open === true,
    stageLocked: match?.stage_locked === true,
    statusText: status.text,
    statusTone: status.tone,
    homeScore,
    awayScore,
    predictionText: predictionMissing ? '— : —' : `${homeScore} : ${awayScore}`,
    predictionMissing,
    predictionMissingLabel: predictionMissing ? 'Прогноз не сделан' : '',
    saved: hasSaved,
    dirty: hasDraft,
    deadlineAt: match?.deadline_at ?? null,
    realScoreText: hasRealScore ? `${realHome} : ${realAway}` : '',
    points: Number.isFinite(points) ? points : null,
  });
}

export function pointsLabel(points) {
  const value = Number(points);
  if (!Number.isFinite(value)) return '';
  if (value === 5) return '+5 очков';
  if (value === 3) return '+3 очка';
  if (value === 2) return '+2 очка';
  return '0 очков';
}
