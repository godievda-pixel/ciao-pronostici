const PRIMARY_STAT_DEFINITIONS = Object.freeze([
  ['xg', 'xG', false],
  ['possession', 'Владение', true],
  ['shots', 'Удары', false],
  ['shotsOnTarget', 'В створ', false],
  ['bigChances', 'Большие моменты', false],
  ['corners', 'Угловые', false],
  ['fouls', 'Фолы', false],
  ['yellowCards', 'Жёлтые карточки', false],
  ['offsides', 'Офсайды', false],
  ['tackles', 'Отборы', false],
]);

const EXTENDED_STAT_DEFINITIONS = Object.freeze([
  ['redCards', 'Красные карточки', false],
  ['saves', 'Сейвы', false],
  ['passAccuracy', 'Точность передач', true],
  ['interceptions', 'Перехваты', false],
]);

const STAT_DEFINITIONS = Object.freeze([
  ...PRIMARY_STAT_DEFINITIONS,
  ...EXTENDED_STAT_DEFINITIONS,
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

function hasStat(key, home, away) {
  return finite(home?.[key]) !== null || finite(away?.[key]) !== null;
}

function statRow(key, label, percent, home, away) {
  if (!hasStat(key, home, away)) return '';
  const [homeShare, awayShare] = shares(home?.[key], away?.[key]);
  return `<div class="cw233-mc-stat-row" data-cw233-mc-stat="${key}" style="--mc-stat-home:${homeShare.toFixed(2)}%;--mc-stat-away:${awayShare.toFixed(2)}%">
    <div class="cw233-mc-stat-row-values"><strong>${esc(display(home?.[key], percent))}</strong><span>${esc(label)}</span><strong>${esc(display(away?.[key], percent))}</strong></div>
    <div class="cw233-mc-stat-bars" aria-hidden="true"><i class="home"></i><i class="away"></i></div>
  </div>`;
}

function statGroup(kind, definitions, home, away) {
  const rows = definitions.map(([key, label, percent]) => statRow(key, label, percent, home, away)).filter(Boolean);
  if (!rows.length) return '';
  const title = kind === 'extended' ? '<div class="cw233-mc-stat-group-title">Другие показатели</div>' : '';
  return `<div class="cw233-mc-stat-group" data-cw233-mc-stats-section="${kind}">${title}${rows.join('')}</div>`;
}

function statsStyles() {
  return `<style data-cw233-mc-stats-parity-style>
    .cw233-mc-stats{display:grid;gap:9px}
    .cw233-mc-stats .cw233-mc-section-heading{margin-bottom:0}
    .cw233-mc-stat-group{padding:2px 14px 8px;border:1px solid var(--mc-border);border-radius:17px;background:rgba(255,255,255,.025)}
    .cw233-mc-stat-group-title{padding:11px 0 5px;font-size:9px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:var(--mc-muted)}
    .cw233-mc-stat-row{padding:9px 0;border-bottom:1px solid rgba(255,255,255,.06)}
    .cw233-mc-stat-row:last-child{border-bottom:0}
    .cw233-mc-stat-row-values{display:grid;grid-template-columns:52px minmax(0,1fr) 52px;align-items:center;gap:8px}
    .cw233-mc-stat-row-values strong{font-size:11px;font-weight:900;color:var(--mc-text)}
    .cw233-mc-stat-row-values strong:last-child{text-align:right}
    .cw233-mc-stat-row-values span{text-align:center;font-size:10px;font-weight:700;line-height:1.15;color:var(--mc-muted)}
    .cw233-mc-stat-bars{display:grid;grid-template-columns:1fr 1fr;gap:4px;height:3px;margin-top:7px}
    .cw233-mc-stat-bars i{display:block;position:relative;overflow:hidden;border-radius:99px;background:rgba(255,255,255,.07)}
    .cw233-mc-stat-bars i::before{content:'';position:absolute;top:0;bottom:0;border-radius:99px;background:var(--mc-accent)}
    .cw233-mc-stat-bars i.home::before{right:0;width:var(--mc-stat-home)}
    .cw233-mc-stat-bars i.away::before{left:0;width:var(--mc-stat-away);background:var(--mc-accent-2)}
  </style>`;
}

export function renderMatchCenterStats(section = {}, context = {}) {
  const source = section && typeof section === 'object' ? section : {};
  const home = source.home && typeof source.home === 'object' ? source.home : {};
  const away = source.away && typeof source.away === 'object' ? source.away : {};
  const homeName = String(context?.match?.homeTeam?.name || 'Хозяева');
  const awayName = String(context?.match?.awayTeam?.name || 'Гости');
  const primary = statGroup('primary', PRIMARY_STAT_DEFINITIONS, home, away);
  const extended = statGroup('extended', EXTENDED_STAT_DEFINITIONS, home, away);

  return `${statsStyles()}<section class="cw233-mc-stats" data-cw233-mc-stats>
    <header class="cw233-mc-section-heading"><span>${esc(homeName)}</span><b>Статы</b><span>${esc(awayName)}</span></header>
    ${primary}${extended}
  </section>`;
}

export { STAT_DEFINITIONS, PRIMARY_STAT_DEFINITIONS, EXTENDED_STAT_DEFINITIONS };
