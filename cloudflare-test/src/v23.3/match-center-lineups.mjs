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

function positionKey(value) {
  const normalized = text(value).toUpperCase();
  if (['GK', 'G', 'GOALKEEPER', 'ВР'].includes(normalized)) return 'GK';
  if (['DF', 'D', 'DEF', 'DEFENDER', 'ЗЩ'].includes(normalized)) return 'DF';
  if (['MF', 'M', 'MID', 'MIDFIELDER', 'ПЗ'].includes(normalized)) return 'MF';
  if (['FW', 'F', 'ST', 'ATT', 'FORWARD', 'НАП'].includes(normalized)) return 'FW';
  return 'OTHER';
}

function playerLabel(player = {}) {
  const number = player?.shirtNumber ?? player?.shirt_number ?? player?.number;
  const numberText = Number.isFinite(Number(number)) ? `<span>${Number(number)}</span>` : '';
  const name = text(player?.name) || '—';
  return `<span class="cw233-mc-pitch-player" data-cw233-mc-pitch-player>${numberText}<b>${esc(name)}</b></span>`;
}

function parseFormation(value) {
  const formation = text(value);
  if (!/^\d(?:-\d){1,4}$/.test(formation)) return null;
  const rows = formation.split('-').map(Number);
  return rows.every(count => Number.isInteger(count) && count > 0 && count <= 6) ? rows : null;
}

function pitchRows(side = {}) {
  const starters = list(side.starters);
  const formation = parseFormation(side.formation);
  if (!formation || !starters.length) return null;

  const keeperIndex = starters.findIndex(player => positionKey(player.position) === 'GK');
  const keeper = keeperIndex >= 0 ? starters[keeperIndex] : starters[0];
  const field = starters.filter((_, index) => index !== (keeperIndex >= 0 ? keeperIndex : 0));
  const expected = formation.reduce((sum, count) => sum + count, 0);
  if (field.length < Math.min(expected, 1)) return null;

  const rows = [];
  let cursor = 0;
  rows.push([keeper]);
  for (const count of formation) {
    const row = field.slice(cursor, cursor + count);
    cursor += count;
    if (row.length) rows.push(row);
  }
  if (cursor < field.length) rows.push(field.slice(cursor));
  return rows;
}

function fallbackGroups(side = {}) {
  const groups = new Map([
    ['GK', []],
    ['DF', []],
    ['MF', []],
    ['FW', []],
    ['OTHER', []],
  ]);
  for (const player of list(side.starters)) groups.get(positionKey(player.position)).push(player);
  return [...groups.entries()].filter(([, players]) => players.length);
}

function renderPitch(side = {}) {
  const rows = pitchRows(side);
  if (!rows) return '';
  return `<div class="cw233-mc-pitch" data-cw233-mc-pitch>${rows.map((row, index) => `<div class="cw233-mc-pitch-row" data-cw233-mc-pitch-row="${index}">${row.map(playerLabel).join('')}</div>`).join('')}</div>`;
}

function renderFallback(side = {}) {
  const labels = { GK:'Вратари', DF:'Защитники', MF:'Полузащитники', FW:'Нападающие', OTHER:'Игроки' };
  const groups = fallbackGroups(side);
  return `<div class="cw233-mc-lineup-groups" data-cw233-mc-lineup-groups>${groups.map(([key, players]) => `<div><small>${labels[key]}</small><div>${players.map(playerLabel).join('')}</div></div>`).join('')}</div>`;
}

function renderSubstitutes(side = {}) {
  const substitutes = list(side.substitutes);
  if (!substitutes.length) return '<div class="cw233-mc-lineup-subs is-empty"><small>Запасные</small><span>Нет данных</span></div>';
  return `<div class="cw233-mc-lineup-subs" data-cw233-mc-subs><small>Запасные</small><div>${substitutes.map(playerLabel).join('')}</div></div>`;
}

function sideName(sideKey, context = {}) {
  const team = sideKey === 'home' ? context?.match?.homeTeam : context?.match?.awayTeam;
  return text(team?.name) || (sideKey === 'home' ? 'Хозяева' : 'Гости');
}

function renderSide(sideKey, side = {}, context = {}) {
  const formation = text(side?.formation);
  const pitch = renderPitch(side);
  const body = pitch || renderFallback(side);
  return `<section class="cw233-mc-lineup-side" data-cw233-mc-lineup-side="${sideKey}">
    <header><span>${esc(sideName(sideKey, context))}</span><strong>${esc(formation || 'Состав')}</strong></header>
    ${body}
    ${renderSubstitutes(side)}
  </section>`;
}

export function renderMatchCenterLineups(section = {}, context = {}) {
  const source = section && typeof section === 'object' ? section : {};
  return `<section class="cw233-mc-lineups" data-cw233-mc-lineups>
    ${renderSide('home', source.home || {}, context)}
    ${renderSide('away', source.away || {}, context)}
  </section>`;
}

export { parseFormation, positionKey };
