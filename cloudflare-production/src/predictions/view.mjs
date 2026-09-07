import { COMPETITION_KEYS, getCompetitionConfig } from '../matches/competition-config.mjs';
import {
  groupPredictionMatches,
  isStageLocked,
  pointsLabel,
  predictionCardView,
  previousLeagueRoundLabel,
  stageShortLabel,
} from './model.mjs';

const esc = value => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

function competitionList(snapshot) {
  if (Array.isArray(snapshot?.competitions) && snapshot.competitions.length) return snapshot.competitions;
  return COMPETITION_KEYS.map(key => getCompetitionConfig(key));
}

function formatDateTime(value) {
  const time = Date.parse(String(value ?? ''));
  if (!Number.isFinite(time)) return 'Дата уточняется';
  try {
    const parts = new Intl.DateTimeFormat('ru-RU', {
      day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit',
    }).formatToParts(new Date(time));
    const get = type => parts.find(part => part.type === type)?.value || '';
    return `${get('day')}.${get('month')} · ${get('hour')}:${get('minute')}`;
  } catch {
    return 'Дата уточняется';
  }
}

function teamView(team, side) {
  const name = String(team?.name ?? '—');
  const crest = String(team?.crestUrl ?? team?.crest_url ?? '').trim();
  return `<div class="cw-pred-native-team cw-pred-native-team--${side}">
    ${crest ? `<img class="cw-pred-native-team-logo" src="${esc(crest)}" alt="" loading="lazy" decoding="async">` : '<span class="cw-pred-native-team-logo cw-pred-native-team-logo--empty" aria-hidden="true"></span>'}
    <strong class="cw-pred-native-team-name">${esc(name)}</strong>
  </div>`;
}

function scoreControls(vm) {
  return `<div class="cw-pred-native-score-controls">
    <div class="cw-pred-native-score-side">
      <button type="button" data-pred-match="${esc(vm.matchId)}" data-pred-delta="h:-1" aria-label="Уменьшить голы хозяев">−</button>
      <strong>${vm.homeScore}</strong>
      <button type="button" data-pred-match="${esc(vm.matchId)}" data-pred-delta="h:1" aria-label="Увеличить голы хозяев">+</button>
    </div>
    <span class="cw-pred-native-colon">:</span>
    <div class="cw-pred-native-score-side">
      <button type="button" data-pred-match="${esc(vm.matchId)}" data-pred-delta="a:-1" aria-label="Уменьшить голы гостей">−</button>
      <strong>${vm.awayScore}</strong>
      <button type="button" data-pred-match="${esc(vm.matchId)}" data-pred-delta="a:1" aria-label="Увеличить голы гостей">+</button>
    </div>
  </div>`;
}

function minePrediction(vm) {
  return `<div class="cw-pred-native-prediction${vm.predictionMissing ? ' cw-pred-native-prediction--missing' : ''}">
    <small>Ваш прогноз</small>
    <strong>${esc(vm.predictionText)}</strong>
    ${vm.predictionMissing ? `<span>${esc(vm.predictionMissingLabel)}</span>` : ''}
  </div>`;
}

function statusPill(vm) {
  const live = vm.statusTone === 'live' ? ' cw-pred-native-status--live' : '';
  return `<span class="cw-pred-native-status${live}">${esc(vm.statusText)}</span>`;
}

function lockedCopy(group) {
  if (!isStageLocked(group)) return '';
  const previous = previousLeagueRoundLabel(group.key);
  return `Прогнозы на этот тур откроются после завершения ${previous}`;
}

function matchCard(match, draft, mode, group) {
  const vm = predictionCardView(match, draft);
  const locked = isStageLocked(group) || vm.stageLocked;
  const editable = mode === 'edit' && vm.open && !locked;
  const copy = lockedCopy(group);
  const points = pointsLabel(vm.points);

  let center;
  if (mode === 'mine') {
    center = minePrediction(vm);
  } else if (editable) {
    center = `<div class="cw-pred-native-prediction cw-pred-native-prediction--edit">
      <small>Ваш прогноз</small>
      ${scoreControls(vm)}
      <span>${vm.dirty ? 'Не сохранено' : vm.saved ? 'Сохранено' : 'Введите счёт'}</span>
    </div>`;
  } else {
    center = minePrediction(vm);
  }

  const resultStrip = vm.realScoreText || points
    ? `<div class="cw-pred-native-result-strip">
        ${vm.realScoreText ? `<span>Счёт матча <strong>${esc(vm.realScoreText)}</strong></span>` : '<span></span>'}
        ${points ? `<b>${esc(points)}</b>` : ''}
      </div>`
    : '';

  let bottomText = '';
  if (copy) bottomText = copy;
  else if (editable && vm.deadlineAt) bottomText = `Дедлайн · ${formatDateTime(vm.deadlineAt)}`;
  else if (vm.saved) bottomText = 'Прогноз зафиксирован';
  else if (!editable) bottomText = 'Прогноз закрыт';

  return `<article class="cw-pred-native-card" data-pred-card="${esc(vm.matchId)}">
    <div class="cw-pred-native-card-top">
      ${statusPill(vm)}
      <span class="cw-pred-native-kickoff">${esc(formatDateTime(vm.kickoffAt))}</span>
    </div>
    <div class="cw-pred-native-matchline">
      ${teamView(vm.homeTeam, 'home')}
      ${center}
      ${teamView(vm.awayTeam, 'away')}
    </div>
    ${resultStrip}
    ${bottomText ? `<div class="cw-pred-native-card-note">${esc(bottomText)}</div>` : ''}
  </article>`;
}

function renderHub(snapshot) {
  const cards = competitionList(snapshot).map((config, index) => {
    const wide = index === 0 ? ' cw-pred-native-tournament--wide' : '';
    return `<button type="button" class="cw-pred-native-tournament${wide}" data-pred-competition="${esc(config.key)}" data-theme="${esc(config.theme)}">
      <span>${esc(config.title)}</span><i aria-hidden="true">→</i>
    </button>`;
  }).join('');

  return `<section class="cw-pred-native-screen cw-pred-native-screen--hub" data-pred-view="hub">
    <div class="cw-pred-native-section-title"><h2>Прогнозы</h2><span>5 турниров</span></div>
    <div class="cw-pred-native-grid">${cards}</div>
    <div class="cw-pred-native-rules">Система очков: 5 / 3 / 2 / 0 · дедлайн за 15 минут до начала матча</div>
  </section>`;
}

function modeToggle(mode) {
  return `<div class="cw-pred-native-modes" role="tablist" aria-label="Режим прогнозов">
    <button type="button" data-pred-mode="edit" class="${mode === 'edit' ? 'active' : ''}">Прогнозы</button>
    <button type="button" data-pred-mode="mine" class="${mode === 'mine' ? 'active' : ''}">Мои прогнозы</button>
  </div>`;
}

function normalizeSerieMatch(match, round) {
  const rawStatus = String(match?.status ?? '');
  const status = rawStatus || (match?.is_finished ? 'finished' : match?.live ? 'live' : 'scheduled');
  return {
    matchId: String(match?.id ?? match?.match_id ?? ''),
    stageKey: `round-${round}`,
    stageLabel: `${round} тур`,
    stageOrder: round,
    kickoffAt: match?.kickoffAt ?? match?.kickoff_at,
    status,
    minute: match?.minute ?? match?.live_minute ?? null,
    open: match?.open === true,
    stage_locked: false,
    deadline_at: match?.deadline_at ?? null,
    prediction: match?.prediction ?? null,
    homeTeam: match?.homeTeam ?? match?.home_team ?? { name: match?.home_name ?? '—' },
    awayTeam: match?.awayTeam ?? match?.away_team ?? { name: match?.away_name ?? '—' },
    homeScore: match?.homeScore ?? match?.home_score ?? match?.score?.home ?? null,
    awayScore: match?.awayScore ?? match?.away_score ?? match?.score?.away ?? null,
  };
}

function serieRoundChips(snapshot) {
  const current = Number(snapshot?.serieRound ?? snapshot?.payload?.selected_round ?? 1) || 1;
  const rounds = Array.isArray(snapshot?.payload?.rounds)
    ? snapshot.payload.rounds.map(item => Number(item?.number ?? item)).filter(value => Number.isInteger(value) && value > 0)
    : Array.from({ length: 38 }, (_, index) => index + 1);
  return `<div class="cw-pred-native-stages">${rounds.map(round => `<button type="button" data-pred-serie-round="${round}" class="${round === current ? 'active' : ''}">${round}</button>`).join('')}</div>`;
}

function externalGroups(snapshot) {
  return groupPredictionMatches(snapshot?.payload?.matches ?? []);
}

function externalStageChips(snapshot, groups) {
  return `<div class="cw-pred-native-stages">${groups.map(group => {
    const locked = isStageLocked(group);
    const active = group.key === snapshot.stageKey;
    return `<button type="button" data-pred-stage="${esc(group.key)}" class="${active ? 'active' : ''}${locked ? ' muted' : ''}"${locked ? ' disabled aria-disabled="true"' : ''} title="${esc(group.label)}">${esc(stageShortLabel(group))}</button>`;
  }).join('')}</div>`;
}

function renderCompetition(snapshot) {
  const config = getCompetitionConfig(snapshot.competition);
  const isSerie = snapshot.competition === 'serie_a';
  const groups = isSerie ? [] : externalGroups(snapshot);
  const selectedGroup = isSerie
    ? {
        key:`round-${Number(snapshot?.serieRound ?? snapshot?.payload?.selected_round ?? 1) || 1}`,
        label:`${Number(snapshot?.serieRound ?? snapshot?.payload?.selected_round ?? 1) || 1} тур`,
        matches:(snapshot?.payload?.round?.matches ?? []).map(match => normalizeSerieMatch(match, Number(snapshot?.serieRound ?? snapshot?.payload?.selected_round ?? 1) || 1)),
      }
    : groups.find(group => group.key === snapshot.stageKey) || groups[0] || null;

  const stageHeading = selectedGroup?.label || 'Матчи';
  const stageCopy = selectedGroup ? lockedCopy(selectedGroup) : '';
  const cards = selectedGroup?.matches?.length
    ? selectedGroup.matches.map(match => matchCard(match, snapshot.drafts?.get?.(String(match?.matchId ?? '')) ?? null, snapshot.mode, selectedGroup)).join('')
    : '<div class="cw-pred-native-empty">Матчей на этой стадии пока нет</div>';
  const canSave = snapshot.mode === 'edit' && selectedGroup?.matches?.some(match => match?.open === true && !match?.stage_locked);

  return `<section class="cw-pred-native-screen" data-pred-view="competition" data-pred-competition="${esc(snapshot.competition)}" data-theme="${esc(config.theme)}">
    <header class="cw-pred-native-header">
      <button type="button" class="cw-pred-native-back" data-pred-action="hub" aria-label="Назад к турнирам">←</button>
      <h2>${esc(config.title)}</h2>
    </header>
    ${modeToggle(snapshot.mode)}
    ${isSerie ? serieRoundChips(snapshot) : externalStageChips(snapshot, groups)}
    <div class="cw-pred-native-stage-heading"><h3>${esc(stageHeading)}</h3>${stageCopy ? `<p>${esc(stageCopy)}</p>` : ''}</div>
    ${snapshot.error ? `<div class="cw-pred-native-error">${esc(snapshot.error)}<button type="button" data-pred-action="retry">Повторить</button></div>` : ''}
    ${snapshot.loading && !snapshot.payload ? '<div class="cw-pred-native-loading">Загружаем прогнозы…</div>' : `<div class="cw-pred-native-cards">${cards}</div>`}
    ${canSave ? `<div class="cw-pred-native-savebar"><button type="button" data-pred-action="save"${snapshot.saving ? ' disabled' : ''}>${snapshot.saving ? 'Сохраняем…' : 'Сохранить прогнозы'}</button></div>` : ''}
  </section>`;
}

export function renderPredictionsView(snapshot = {}) {
  if (snapshot?.open === false) return '';
  if (snapshot?.view === 'competition' && snapshot?.competition) return renderCompetition(snapshot);
  return renderHub(snapshot);
}
