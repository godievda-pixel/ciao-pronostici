function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function list(value) {
  return Array.isArray(value) ? value.filter(item => item && typeof item === 'object') : [];
}

function text(value) {
  return String(value ?? '').trim();
}

function finite(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function russianCount(value, forms) {
  const number = finite(value);
  if (number === null) return '';
  const integer = Math.abs(Math.trunc(number));
  const mod100 = integer % 100;
  const mod10 = integer % 10;
  const form = mod100 >= 11 && mod100 <= 14
    ? forms[2]
    : mod10 === 1
      ? forms[0]
      : mod10 >= 2 && mod10 <= 4
        ? forms[1]
        : forms[2];
  return `${number} ${form}`;
}

function metric(value, label) {
  const number = finite(value);
  return number === null ? '' : `<span>${esc(label)} ${number}</span>`;
}

function playerMetrics(player = {}) {
  const metrics = [];
  const minutes = finite(player.minutes);
  if (minutes !== null) metrics.push(`<span>${minutes} мин</span>`);
  const goals = russianCount(player.goals, ['гол', 'гола', 'голов']);
  if (goals) metrics.push(`<span>${esc(goals)}</span>`);
  const assists = russianCount(player.assists, ['ассист', 'ассиста', 'ассистов']);
  if (assists) metrics.push(`<span>${esc(assists)}</span>`);
  const xg = metric(player.xg, 'xG');
  if (xg) metrics.push(xg);
  const xa = metric(player.xa, 'xA');
  if (xa) metrics.push(xa);
  const shots = russianCount(player.shots, ['удар', 'удара', 'ударов']);
  if (shots) metrics.push(`<span>${esc(shots)}</span>`);
  const keyPasses = russianCount(player.keyPasses, ['ключ. передача', 'ключ. передачи', 'ключ. передач']);
  if (keyPasses) metrics.push(`<span>${esc(keyPasses)}</span>`);
  return metrics.join('');
}

function playerId(player = {}, index = 0) {
  const id = finite(player.playerId ?? player.player_id ?? player.id);
  return id === null ? `row-${index}` : String(id);
}

function renderPlayer(player, index) {
  const rating = finite(player.rating);
  const name = text(player.name) || 'Игрок';
  const team = text(player.teamName ?? player.team_name);
  return `<article class="cw233-mc-player-card" data-cw233-mc-player="${esc(playerId(player, index))}">
    <div class="cw233-mc-player-main"><div><strong>${esc(name)}</strong>${team ? `<span>${esc(team)}</span>` : ''}</div><b data-cw233-mc-player-rating>${rating}</b></div>
    <div class="cw233-mc-player-metrics">${playerMetrics(player)}</div>
  </article>`;
}

export function renderMatchCenterPlayers(section = [], context = {}) {
  const players = list(section);
  const rated = players
    .filter(player => finite(player.rating) !== null)
    .sort((a, b) => (finite(b.rating) ?? 0) - (finite(a.rating) ?? 0));

  if (!rated.length) {
    return `<section class="cw233-mc-players" data-cw233-mc-players><div class="cw233-mc-players-unavailable"><strong>Оценки игроков пока недоступны</strong><span>Покажем их, когда провайдер опубликует оценки.</span></div></section>`;
  }

  const homeName = text(context?.match?.homeTeam?.name);
  const awayName = text(context?.match?.awayTeam?.name);
  return `<section class="cw233-mc-players" data-cw233-mc-players>
    <header class="cw233-mc-section-heading"><span>${esc(homeName)}</span><b>Игроки</b><span>${esc(awayName)}</span></header>
    <div class="cw233-mc-players-list">${rated.map(renderPlayer).join('')}</div>
  </section>`;
}

export { russianCount };
