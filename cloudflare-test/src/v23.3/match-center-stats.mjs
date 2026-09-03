const STAT_DEFINITIONS = Object.freeze([
  ['xg', 'xG', false],
  ['possession', 'Владение', true],
  ['shots', 'Удары', false],
  ['shotsOnTarget', 'В створ', false],
  ['bigChances', 'Большие моменты', false],
  ['corners', 'Угловые', false],
  ['fouls', 'Фолы', false],
  ['offsides', 'Офсайды', false],
  ['yellowCards', 'Жёлтые карточки', false],
  ['redCards', 'Красные карточки', false],
  ['saves', 'Сейвы', false],
  ['passAccuracy', 'Точность передач', true],
  ['interceptions', 'Перехваты', false],
  ['tackles', 'Отборы', false],
]);

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function finite(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function display(value, percent) {
  const number = finite(value);
  if (number === null) return '—';
  return percent ? `${number}%` : String(number);
}

function shares(homeValue, awayValue) {
  const home = Math.max(0, finite(homeValue) ?? 0);
  const away = Math.max(0, finite(awayValue) ?? 0);
  const total = home + away;
  if (!total) return [50, 50];
  const homeShare = Math.max(0, Math.min(100, (home / total) * 100));
  return [homeShare, 100 - homeShare];
}

function statRow(key, label, percent, home, away) {
  const [homeShare, awayShare] = shares(home?.[key], away?.[key]);
  return `<div class="cw233-mc-stat-card" data-cw233-mc-stat="${key}" style="--mc-stat-home:${homeShare.toFixed(2)}%;--mc-stat-away:${awayShare.toFixed(2)}%">
    <div class="cw233-mc-stat-values"><strong>${esc(display(home?.[key], percent))}</strong><span>${esc(label)}</span><strong>${esc(display(away?.[key], percent))}</strong></div>
    <div class="cw233-mc-stat-track" aria-hidden="true"><i class="home"></i><i class="away"></i></div>
  </div>`;
}

export function renderMatchCenterStats(section = {}, context = {}) {
  const source = section && typeof section === 'object' ? section : {};
  const home = source.home && typeof source.home === 'object' ? source.home : {};
  const away = source.away && typeof source.away === 'object' ? source.away : {};
  const homeName = String(context?.match?.homeTeam?.name || 'Хозяева');
  const awayName = String(context?.match?.awayTeam?.name || 'Гости');

  return `<section class="cw233-mc-stats" data-cw233-mc-stats>
    <header class="cw233-mc-section-heading"><span>${esc(homeName)}</span><b>Статистика</b><span>${esc(awayName)}</span></header>
    <div class="cw233-mc-stats-grid">${STAT_DEFINITIONS.map(([key, label, percent]) => statRow(key, label, percent, home, away)).join('')}</div>
  </section>`;
}

export { STAT_DEFINITIONS };
