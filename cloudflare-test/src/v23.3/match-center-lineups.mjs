const LINEUP_STYLE = `<style data-cw233-mc-lineups-parity-style>
.cw233-mc-lineups{display:grid;gap:10px}.cw233-mc-lineup-side{overflow:hidden;border:1px solid var(--mc-border);border-radius:17px;background:rgba(255,255,255,.025)}.cw233-mc-lineup-side>header{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 13px;border-bottom:1px solid rgba(255,255,255,.06)}.cw233-mc-lineup-side>header span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;font-weight:900;color:var(--mc-text)}.cw233-mc-lineup-side>header strong{flex:0 0 auto;font-size:9px;font-weight:850;color:var(--mc-muted)}.cw233-mc-lineup-list{display:grid;padding:2px 13px}.cw233-mc-lineup-player{display:grid;grid-template-columns:28px minmax(0,1fr);align-items:center;gap:9px;min-height:38px;border-bottom:1px solid rgba(255,255,255,.055)}.cw233-mc-lineup-player:last-child{border-bottom:0}.cw233-mc-lineup-number{display:grid;place-items:center;width:24px;height:24px;border-radius:50%;background:rgba(255,255,255,.055);font-size:9px;font-weight:900;color:var(--mc-muted)}.cw233-mc-lineup-player span:last-child{min-width:0}.cw233-mc-lineup-player b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px;font-weight:850;color:var(--mc-text)}.cw233-mc-lineup-player small{display:block;margin-top:2px;font-size:8px;color:var(--mc-muted)}.cw233-mc-lineup-subs{padding:8px 13px 10px;border-top:1px solid rgba(255,255,255,.06)}.cw233-mc-lineup-subs>strong{display:block;margin-bottom:3px;font-size:8px;font-weight:900;letter-spacing:.06em;text-transform:uppercase;color:var(--mc-muted)}.cw233-mc-lineup-subs.is-empty>span{display:block;padding:7px 0;font-size:9px;color:var(--mc-muted)}
@media(min-width:540px){.cw233-mc-lineups{grid-template-columns:repeat(2,minmax(0,1fr));align-items:start}}
</style>`;

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

function parseFormation(value) {
  const formation = text(value);
  if (!/^\d(?:-\d){1,4}$/.test(formation)) return null;
  const rows = formation.split('-').map(Number);
  return rows.every(count => Number.isInteger(count) && count > 0 && count <= 6) ? rows : null;
}

function playerRow(player = {}) {
  const number = player?.shirtNumber ?? player?.shirt_number ?? player?.number;
  const numberText = Number.isFinite(Number(number)) ? String(Number(number)) : '—';
  const name = text(player?.name) || '—';
  const position = text(player?.position || player?.pos);
  return `<div class="cw233-mc-lineup-player" data-cw233-mc-lineup-player>
    <span class="cw233-mc-lineup-number">${esc(numberText)}</span>
    <span><b>${esc(name)}</b>${position ? `<small>${esc(position)}</small>` : ''}</span>
  </div>`;
}

function playerList(players = []) {
  const rows = list(players);
  return `<div class="cw233-mc-lineup-list">${rows.length ? rows.map(playerRow).join('') : '<div class="cw233-mc-lineup-player"><span class="cw233-mc-lineup-number">—</span><span><b>Нет данных</b></span></div>'}</div>`;
}

function renderSubstitutes(side = {}) {
  const substitutes = list(side.substitutes);
  if (!substitutes.length) return '<div class="cw233-mc-lineup-subs is-empty"><strong>Запасные</strong><span>Нет данных</span></div>';
  return `<div class="cw233-mc-lineup-subs" data-cw233-mc-subs><strong>Запасные</strong><div class="cw233-mc-lineup-list">${substitutes.map(playerRow).join('')}</div></div>`;
}

function sideName(sideKey, context = {}) {
  const team = sideKey === 'home' ? context?.match?.homeTeam : context?.match?.awayTeam;
  return text(team?.name) || (sideKey === 'home' ? 'Хозяева' : 'Гости');
}

function renderSide(sideKey, side = {}, context = {}) {
  const formation = text(side?.formation);
  return `<section class="cw233-mc-lineup-side" data-cw233-mc-lineup-side="${sideKey}">
    <header><span>${esc(sideName(sideKey, context))}</span><strong>${esc(formation || 'Состав')}</strong></header>
    ${playerList(side.starters)}
    ${renderSubstitutes(side)}
  </section>`;
}

export function renderMatchCenterLineups(section = {}, context = {}) {
  const source = section && typeof section === 'object' ? section : {};
  return `${LINEUP_STYLE}<section class="cw233-mc-lineups" data-cw233-mc-lineups>
    ${renderSide('home', source.home || {}, context)}
    ${renderSide('away', source.away || {}, context)}
  </section>`;
}

export { parseFormation, positionKey };
