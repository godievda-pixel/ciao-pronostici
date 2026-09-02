const STAGES = Object.freeze([
  { key: 'round_of_16', title: '1/8 финала', rank: 10, aliases: ['round of 16', 'round of sixteen', 'ottavi di finale', 'ottavi'] },
  { key: 'quarterfinal', title: '1/4 финала', rank: 20, aliases: ['quarter final', 'quarter finals', 'quarter-final', 'quarter-finals', 'quarterfinal', 'quarterfinals', 'quarti di finale', 'quarti'] },
  { key: 'semifinal', title: '1/2 финала', rank: 30, aliases: ['semi final', 'semi finals', 'semi-final', 'semi-finals', 'semifinal', 'semifinals', 'semifinale', 'semifinali'] },
  { key: 'final', title: 'Финал', rank: 40, aliases: ['final', 'finale'] },
]);

function text(value) {
  return String(value ?? '').trim();
}

function normalized(value) {
  return text(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const STAGE_BY_ALIAS = new Map();
for (const stage of STAGES) {
  STAGE_BY_ALIAS.set(normalized(stage.key), stage);
  STAGE_BY_ALIAS.set(normalized(stage.title), stage);
  for (const alias of stage.aliases) STAGE_BY_ALIAS.set(normalized(alias), stage);
}

export function normalizeCoppaStage(value) {
  const exact = STAGE_BY_ALIAS.get(normalized(value));
  if (exact) return exact;
  const token = normalized(value);
  if (/round 16|1 8/.test(token)) return STAGES[0];
  if (/quarter|quarti|1 4/.test(token)) return STAGES[1];
  if (/semi|1 2/.test(token)) return STAGES[2];
  if (/final|finale/.test(token)) return STAGES[3];
  return null;
}

function teamLabel(team) {
  const name = text(team?.name);
  return name && name !== '—' ? name : '';
}

function sourcePairLabel(source) {
  const home = teamLabel(source?.homeTeam);
  const away = teamLabel(source?.awayTeam);
  if (!home || !away) return '';
  return `Победитель пары ${home} — ${away}`;
}

function sideLabel(match, side, byId) {
  const direct = teamLabel(match?.[`${side}Team`]);
  if (direct) return direct;

  const sourceId = text(match?.[`${side}SourceMatchId`]);
  if (sourceId) {
    const source = byId.get(sourceId) || byId.get(sourceId.includes(':') ? sourceId : `coppa_italia:${sourceId}`);
    const pair = sourcePairLabel(source);
    if (pair) return pair;
  }

  return 'Соперник определяется';
}

function scoreText(match) {
  const home = match?.homeScore;
  const away = match?.awayScore;
  if (home === null || home === undefined || away === null || away === undefined) return '';
  return `${home}:${away}`;
}

export function buildCoppaBracket(matches = []) {
  const source = Array.isArray(matches) ? matches : [];
  const byId = new Map(source.map(match => [text(match?.matchId), match]).filter(([id]) => id));
  const grouped = new Map();

  for (const match of source) {
    if (match?.competition && match.competition !== 'coppa_italia') continue;
    const stage = normalizeCoppaStage(match?.stage);
    if (!stage) continue;
    if (!grouped.has(stage.key)) grouped.set(stage.key, { ...stage, matches: [] });
    grouped.get(stage.key).matches.push(Object.freeze({
      id: text(match?.matchId),
      homeLabel: sideLabel(match, 'home', byId),
      awayLabel: sideLabel(match, 'away', byId),
      kickoffAt: text(match?.kickoffAt),
      status: text(match?.status),
      score: scoreText(match),
      sourceIds: Object.freeze([
        text(match?.homeSourceMatchId),
        text(match?.awaySourceMatchId),
      ].filter(Boolean)),
    }));
  }

  const rounds = [...grouped.values()]
    .sort((a, b) => a.rank - b.rank)
    .map(round => Object.freeze({
      key: round.key,
      title: round.title,
      matches: Object.freeze([...round.matches].sort((a, b) =>
        Date.parse(a.kickoffAt || 0) - Date.parse(b.kickoffAt || 0)
        || a.id.localeCompare(b.id)
      )),
    }));

  return Object.freeze({ rounds: Object.freeze(rounds) });
}
