const LINEUP_STYLE = `<style data-cw233-mc-lineups-parity-style data-cw250-mc-lineups-redraw-style data-cw251-mc-lineups-polish-style>
.cw233-mc-lineups,.cw250-mc-lineups{display:grid;gap:12px;min-width:0}.cw251-mc-lineups-title{display:flex;align-items:baseline;justify-content:space-between;gap:10px;padding:1px 3px}.cw251-mc-lineups-title strong{font-size:12px;font-weight:950;color:var(--mc-text)}.cw251-mc-lineups-title span{font-size:8px;font-weight:850;letter-spacing:.06em;text-transform:uppercase;color:var(--mc-muted)}.cw233-mc-lineup-stage,.cw250-mc-lineup-stage{display:grid;gap:10px;padding:11px;border:1px solid var(--mc-border);border-radius:20px;background:linear-gradient(155deg,var(--mc-surface-2,rgba(255,255,255,.04)),rgba(255,255,255,.014));box-shadow:inset 0 1px 0 rgba(255,255,255,.04),0 14px 34px rgba(0,0,0,.12)}
.cw233-mc-lineup-switch,.cw250-mc-lineup-switch{display:grid;grid-template-columns:1fr 1fr;gap:4px;padding:3px;border:1px solid var(--mc-border);border-radius:14px;background:rgba(0,0,0,.15)}.cw233-mc-lineup-switch input,.cw250-mc-lineup-switch input{position:absolute;opacity:0;pointer-events:none}.cw233-mc-lineup-switch label,.cw250-mc-lineup-switch label{min-width:0;padding:9px 8px;border-radius:10px;text-align:center;font-size:9px;font-weight:900;color:var(--mc-muted);cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.cw250-mc-lineup-stage:has(#cw233-lineup-home:checked) label[for="cw233-lineup-home"],.cw250-mc-lineup-stage:has(#cw233-lineup-away:checked) label[for="cw233-lineup-away"],.cw233-mc-lineup-stage:has(#cw233-lineup-home:checked) label[for="cw233-lineup-home"],.cw233-mc-lineup-stage:has(#cw233-lineup-away:checked) label[for="cw233-lineup-away"]{background:linear-gradient(135deg,var(--mc-accent),var(--mc-accent-2));color:#fff;box-shadow:0 5px 18px var(--mc-accent-soft,rgba(0,0,0,.16))}
.cw233-mc-pitch-panels,.cw250-mc-pitch-panels{display:grid;min-width:0}.cw250-mc-pitch-panel{display:none;gap:8px}.cw250-mc-lineup-stage:has(#cw233-lineup-home:checked) [data-cw250-mc-pitch-team="home"],.cw250-mc-lineup-stage:has(#cw233-lineup-away:checked) [data-cw250-mc-pitch-team="away"],.cw233-mc-lineup-stage:has(#cw233-lineup-home:checked) [data-cw250-mc-pitch-team="home"],.cw233-mc-lineup-stage:has(#cw233-lineup-away:checked) [data-cw250-mc-pitch-team="away"]{display:grid}
.cw250-mc-pitch-head{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:8px;padding:2px 2px 0}.cw250-mc-pitch-identity{min-width:0}.cw250-mc-pitch-identity strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;font-weight:950;color:var(--mc-text)}.cw250-mc-pitch-identity small{display:block;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:8px;color:var(--mc-muted)}.cw250-mc-formation-badge{padding:5px 8px;border:1px solid var(--mc-border);border-radius:9px;background:var(--mc-accent-soft,rgba(255,255,255,.05));font-size:9px;font-weight:950;color:var(--mc-text)}
.cw233-mc-lineup-pitch,.cw250-mc-lineup-pitch{position:relative;aspect-ratio:68/100;width:min(100%,304px);margin:0 auto;border:1px solid var(--mc-pitch-line,rgba(255,255,255,.2));border-radius:17px;background:linear-gradient(180deg,color-mix(in srgb,var(--mc-pitch,#0b3550) 94%,#fff 6%),var(--mc-pitch,#0b3550));overflow:hidden;box-shadow:inset 0 0 46px rgba(0,0,0,.18),0 14px 28px rgba(0,0,0,.17)}.cw233-mc-lineup-pitch::before,.cw250-mc-lineup-pitch::before{content:'';position:absolute;inset:4%;border:1px solid var(--mc-pitch-line,rgba(255,255,255,.2));border-radius:3px}.cw233-mc-lineup-pitch::after,.cw250-mc-lineup-pitch::after{content:'';position:absolute;left:4%;right:4%;top:50%;height:1px;background:var(--mc-pitch-line,rgba(255,255,255,.2))}.cw233-mc-pitch-circle{position:absolute;left:50%;top:50%;width:24%;aspect-ratio:1;border:1px solid var(--mc-pitch-line,rgba(255,255,255,.2));border-radius:50%;transform:translate(-50%,-50%)}.cw233-mc-pitch-box{position:absolute;left:27%;width:46%;height:14%;border:1px solid var(--mc-pitch-line,rgba(255,255,255,.2))}.cw233-mc-pitch-box.top{top:4%;border-top:0}.cw233-mc-pitch-box.bottom{bottom:4%;border-bottom:0}.cw233-mc-pitch-player,.cw250-mc-pitch-player{position:absolute;left:var(--player-x);bottom:var(--player-y);width:62px;transform:translate(-50%,50%);display:grid;justify-items:center;gap:2px;z-index:2}.cw251-mc-pitch-disc{display:grid;place-items:center!important;width:28px!important;height:28px!important;border:1px solid rgba(255,255,255,.42)!important;border-radius:50%!important;background:linear-gradient(145deg,var(--mc-accent),var(--mc-accent-2))!important;box-shadow:0 4px 13px rgba(0,0,0,.32)!important;font-size:8px!important;font-weight:950!important;color:#fff!important}.cw251-mc-pitch-name{max-width:62px!important;padding:2px 4px!important;border-radius:6px!important;background:rgba(2,8,16,.82)!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;font-size:7.5px!important;font-weight:900!important;color:#fff!important;box-shadow:0 2px 8px rgba(0,0,0,.25)!important}.cw251-mc-pitch-badges{position:absolute;left:50%;top:-5px;display:flex;gap:2px;transform:translateX(-50%);z-index:4}.cw251-mc-pitch-badge{display:grid;place-items:center;min-width:16px;height:12px;padding:0 3px;border:1px solid rgba(255,255,255,.24);border-radius:5px;background:rgba(2,8,16,.88);font-size:6.5px;font-weight:950;color:#fff;line-height:1}.cw251-mc-pitch-badge.is-rating{background:linear-gradient(135deg,var(--mc-accent),var(--mc-accent-2))}.cw251-mc-pitch-badge.is-yellow{color:#ffe06a}.cw251-mc-pitch-badge.is-red{color:#ff8791}.cw233-mc-pitch-unavailable,.cw250-mc-pitch-unavailable{display:grid;place-items:center;align-content:center;gap:5px;aspect-ratio:68/74;width:min(100%,292px);margin:0 auto;border:1px dashed var(--mc-border-strong,var(--mc-border));border-radius:17px;background:rgba(255,255,255,.018);text-align:center;color:var(--mc-muted);font-size:9px}.cw233-mc-pitch-unavailable b,.cw250-mc-pitch-unavailable b{font-size:11px;color:var(--mc-text)}.cw233-mc-lineup-stage-meta,.cw250-mc-lineup-stage-meta{display:flex;align-items:center;justify-content:center;gap:7px;padding-top:1px;font-size:8px;color:var(--mc-muted)}.cw250-mc-lineup-stage-meta i{width:5px;height:5px;border-radius:50%;background:var(--mc-accent);box-shadow:0 0 10px var(--mc-accent-soft)}
.cw233-mc-lineup-text,.cw250-mc-lineup-text{display:grid;gap:10px}.cw233-mc-lineup-side,.cw250-mc-lineup-side{overflow:hidden;border:1px solid var(--mc-border);border-radius:18px;background:linear-gradient(160deg,var(--mc-surface,rgba(255,255,255,.025)),rgba(255,255,255,.012));box-shadow:inset 0 1px 0 rgba(255,255,255,.025)}.cw233-mc-lineup-side>header,.cw250-mc-lineup-side>header{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 13px;border-bottom:1px solid rgba(255,255,255,.06)}.cw233-mc-lineup-side>header span,.cw250-mc-lineup-side>header span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;font-weight:950;color:var(--mc-text)}.cw233-mc-lineup-side>header strong,.cw250-mc-lineup-side>header strong{flex:0 0 auto;padding:4px 7px;border:1px solid var(--mc-border);border-radius:8px;background:var(--mc-accent-soft);font-size:8px;font-weight:900;color:var(--mc-text)}.cw233-mc-lineup-coach,.cw250-mc-lineup-coach{padding:8px 13px;border-bottom:1px solid rgba(255,255,255,.055);font-size:8px;color:var(--mc-muted)}.cw233-mc-lineup-coach b,.cw250-mc-lineup-coach b{margin-left:4px;color:var(--mc-text);font-weight:900}.cw250-mc-list-label{padding:8px 13px 3px;font-size:7.5px;font-weight:950;letter-spacing:.065em;text-transform:uppercase;color:var(--mc-muted)}.cw233-mc-lineup-list{display:grid;padding:2px 13px}.cw233-mc-lineup-player{display:grid;grid-template-columns:30px minmax(0,1fr) auto;align-items:center;gap:9px;min-height:40px;border-bottom:1px solid rgba(255,255,255,.055)}.cw233-mc-lineup-player:last-child{border-bottom:0}.cw233-mc-lineup-number{display:grid;place-items:center;width:25px;height:25px;border-radius:50%;background:rgba(255,255,255,.065);font-size:9px;font-weight:950;color:var(--mc-text)}.cw233-mc-lineup-player span:nth-child(2){min-width:0}.cw233-mc-lineup-player b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px;font-weight:850;color:var(--mc-text)}.cw233-mc-lineup-player small{display:block;margin-top:2px;font-size:8px;color:var(--mc-muted)}.cw251-mc-row-rating{padding:3px 5px;border:1px solid var(--mc-border);border-radius:7px;background:var(--mc-accent-soft);font-size:8px!important;font-weight:950;color:var(--mc-text)!important}.cw233-mc-lineup-subs,.cw250-mc-lineup-subs{padding:8px 13px 10px;border-top:1px solid rgba(255,255,255,.06)}.cw233-mc-lineup-subs>strong,.cw250-mc-lineup-subs>strong{display:block;margin-bottom:3px;font-size:8px;font-weight:950;letter-spacing:.06em;text-transform:uppercase;color:var(--mc-muted)}.cw233-mc-lineup-subs.is-empty>span{display:block;padding:7px 0;font-size:9px;color:var(--mc-muted)}
@media(min-width:540px){.cw233-mc-lineup-text,.cw250-mc-lineup-text{grid-template-columns:repeat(2,minmax(0,1fr));align-items:start}.cw233-mc-lineup-pitch,.cw250-mc-lineup-pitch{width:min(100%,328px)}}@media(max-width:420px){.cw233-mc-lineup-stage,.cw250-mc-lineup-stage{padding:9px}.cw250-mc-pitch-head{padding-inline:1px}.cw233-mc-lineup-pitch,.cw250-mc-lineup-pitch,.cw233-mc-pitch-unavailable,.cw250-mc-pitch-unavailable{width:min(100%,286px)}.cw233-mc-pitch-player,.cw250-mc-pitch-player{width:58px}.cw251-mc-pitch-name{max-width:58px!important;font-size:7px!important}.cw251-mc-pitch-badge{font-size:6px}}@media(max-width:339px){.cw233-mc-lineup-pitch,.cw250-mc-lineup-pitch{width:min(100%,246px)}.cw250-mc-pitch-head{grid-template-columns:minmax(0,1fr) auto}.cw250-mc-formation-badge{padding:4px 6px}.cw233-mc-pitch-player,.cw250-mc-pitch-player{width:52px}.cw251-mc-pitch-name{max-width:52px!important;font-size:7px!important}}
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

function finite(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
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
  if (!rows.every(count => Number.isInteger(count) && count > 0 && count <= 6)) return null;
  return rows.reduce((sum, count) => sum + count, 0) === 10 ? rows : null;
}

function gridPosition(value) {
  const match = text(value).match(/^(\d+):(\d+)$/);
  if (!match) return null;
  const row = Number(match[1]);
  const column = Number(match[2]);
  if (!Number.isInteger(row) || !Number.isInteger(column) || row < 1 || row > 5 || column < 1 || column > 5) return null;
  return Object.freeze({
    x:Math.max(10, Math.min(90, column * 20)),
    y:Math.max(8, Math.min(88, 8 + (row - 1) * 20)),
  });
}

function linePositions(count, y) {
  if (!Number.isInteger(count) || count < 1) return [];
  const step = 100 / (count + 1);
  return Array.from({ length:count }, (_, index) => Object.freeze({ x:Number((step * (index + 1)).toFixed(2)), y }));
}

function formationPositions(formation, starters = []) {
  const rows = parseFormation(formation);
  const players = list(starters);
  if (!rows || players.length < 11) return null;
  const out = [Object.freeze({ x:50, y:8 })];
  const ySlots = rows.length === 2 ? [38,72] : rows.length === 3 ? [28,52,76] : rows.length === 4 ? [24,43,62,81] : [28,52,76];
  rows.forEach((count, index) => out.push(...linePositions(count, ySlots[index] ?? (28 + index * 18))));
  return out.length === 11 ? Object.freeze(out) : null;
}

function explicitPosition(player) {
  const x = finite(player?.x);
  const y = finite(player?.y);
  if (x === null || y === null || x < 0 || x > 100 || y < 0 || y > 100) return null;
  return Object.freeze({ x, y });
}

function resolvePitchPositions(side = {}) {
  const starters = list(side.starters);
  if (starters.length < 11) return null;
  const fallback = formationPositions(side.formation, starters);
  const resolved = starters.slice(0, 11).map((player, index) => explicitPosition(player) || gridPosition(player?.grid) || fallback?.[index] || null);
  return resolved.every(Boolean) ? resolved : null;
}

function compactPitchName(player = {}) {
  const short = text(player.shortName ?? player.short_name);
  if (short) return short;
  const full = text(player.name);
  if (!full) return 'Игрок';
  const parts = full.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0];
  const last = parts.at(-1);
  const firstInitial = parts[0]?.[0] ? `${parts[0][0]}. ` : '';
  return `${firstInitial}${last}`;
}

function playerRow(player = {}) {
  const number = finite(player?.shirtNumber ?? player?.shirt_number ?? player?.number);
  const numberText = number === null ? '—' : String(number);
  const name = text(player?.name) || '—';
  const position = text(player?.position || player?.pos);
  const rating = finite(player?.rating);
  return `<div class="cw233-mc-lineup-player" data-cw233-mc-lineup-player>
    <span class="cw233-mc-lineup-number">${esc(numberText)}</span>
    <span><b>${esc(name)}</b>${position ? `<small>${esc(position)}</small>` : ''}</span>
    ${rating === null ? '' : `<small class="cw251-mc-row-rating">${esc(rating.toFixed(1))}</small>`}
  </div>`;
}

function playerList(players = []) {
  const rows = list(players);
  return `<div class="cw233-mc-lineup-list" data-cw233-mc-lineup-list>${rows.length ? rows.map(playerRow).join('') : '<div class="cw233-mc-lineup-player"><span class="cw233-mc-lineup-number">—</span><span><b>Нет данных</b></span></div>'}</div>`;
}

function renderSubstitutes(side = {}) {
  const substitutes = list(side.substitutes);
  if (!substitutes.length) return '<div class="cw233-mc-lineup-subs cw250-mc-lineup-subs is-empty" data-cw250-mc-bench><strong>Запасные</strong><span>Нет данных</span></div>';
  return `<div class="cw233-mc-lineup-subs cw250-mc-lineup-subs" data-cw233-mc-subs data-cw250-mc-bench><strong>Запасные</strong><div class="cw233-mc-lineup-list" data-cw233-mc-lineup-list>${substitutes.map(playerRow).join('')}</div></div>`;
}

function sideName(sideKey, context = {}) {
  const team = sideKey === 'home' ? context?.match?.homeTeam : context?.match?.awayTeam;
  return text(team?.name) || (sideKey === 'home' ? 'Хозяева' : 'Гости');
}

function pitchBadges(player = {}) {
  const badges = [];
  const rating = finite(player.rating);
  const goals = finite(player.goals);
  const yellow = finite(player.yellowCards ?? player.yellow_cards);
  const red = finite(player.redCards ?? player.red_cards);
  if (rating !== null) badges.push(`<span class="cw251-mc-pitch-badge is-rating" data-cw251-mc-pitch-badge="rating">${esc(rating.toFixed(1))}</span>`);
  if (goals !== null && goals > 0) badges.push(`<span class="cw251-mc-pitch-badge is-goal" data-cw251-mc-pitch-badge="goal">⚽${goals > 1 ? esc(goals) : ''}</span>`);
  if (yellow !== null && yellow > 0) badges.push(`<span class="cw251-mc-pitch-badge is-yellow" data-cw251-mc-pitch-badge="yellow">■</span>`);
  if (red !== null && red > 0) badges.push(`<span class="cw251-mc-pitch-badge is-red" data-cw251-mc-pitch-badge="red">■</span>`);
  return badges.length ? `<span class="cw251-mc-pitch-badges">${badges.join('')}</span>` : '';
}

function pitchPlayer(player, position, index) {
  const number = finite(player?.shirtNumber ?? player?.number);
  const playerId = finite(player?.playerId ?? player?.id) ?? index;
  const name = compactPitchName(player);
  return `<span class="cw233-mc-pitch-player cw250-mc-pitch-player" data-cw233-mc-pitch-player="${esc(playerId)}" style="--player-x:${position.x}%;--player-y:${position.y}%">${pitchBadges(player)}<b class="cw251-mc-pitch-disc">${esc(number ?? '—')}</b><span class="cw251-mc-pitch-name" title="${esc(text(player?.name) || name)}">${esc(name)}</span></span>`;
}

function pitchPanel(sideKey, side = {}, context = {}) {
  const starters = list(side.starters);
  const positions = resolvePitchPositions(side);
  const team = sideName(sideKey, context);
  const formation = text(side.formation);
  const coach = text(side.coach);
  const head = `<div class="cw250-mc-pitch-head" data-cw250-mc-pitch-head><div class="cw250-mc-pitch-identity"><strong>${esc(team)}</strong>${coach ? `<small>Тренер: ${esc(coach)}</small>` : ''}</div><span class="cw250-mc-formation-badge">${esc(formation || '—')}</span></div>`;
  const pitch = positions
    ? `<div class="cw233-mc-lineup-pitch cw250-mc-lineup-pitch" data-cw233-mc-pitch data-cw233-mc-lineup-pitch aria-label="Схема ${esc(team)} ${esc(formation)}"><i class="cw233-mc-pitch-circle" aria-hidden="true"></i><i class="cw233-mc-pitch-box top" aria-hidden="true"></i><i class="cw233-mc-pitch-box bottom" aria-hidden="true"></i>${starters.slice(0,11).map((player,index) => pitchPlayer(player, positions[index], index)).join('')}</div>`
    : `<div class="cw233-mc-pitch-unavailable cw250-mc-pitch-unavailable" data-cw233-mc-lineup-pitch><b>Схема недоступна</b><span>${esc(team)}</span></div>`;
  return `<section class="cw250-mc-pitch-panel" data-cw233-mc-pitch-team="${sideKey}" data-cw250-mc-pitch-team="${sideKey}">${head}${pitch}</section>`;
}

function renderStage(source, context) {
  const homeName = sideName('home', context);
  const awayName = sideName('away', context);
  return `<section class="cw233-mc-lineup-stage cw250-mc-lineup-stage" data-cw233-mc-lineup-stage data-cw250-mc-lineup-stage>
    <div class="cw251-mc-lineups-title" data-cw251-mc-official-lineups><strong>Официальные составы</strong><span>Стартовые XI</span></div>
    <div class="cw233-mc-lineup-switch cw250-mc-lineup-switch" data-cw233-mc-lineup-switch data-cw250-mc-lineup-switch>
      <input id="cw233-lineup-home" type="radio" name="cw233-lineup-team" checked><label for="cw233-lineup-home">${esc(homeName)}</label>
      <input id="cw233-lineup-away" type="radio" name="cw233-lineup-team"><label for="cw233-lineup-away">${esc(awayName)}</label>
    </div>
    <div class="cw233-mc-pitch-panels cw250-mc-pitch-panels">${pitchPanel('home', source.home || {}, context)}${pitchPanel('away', source.away || {}, context)}</div>
    <div class="cw233-mc-lineup-stage-meta cw250-mc-lineup-stage-meta"><i aria-hidden="true"></i><span>Номер, игрок и реальные матчевые отметки</span></div>
  </section>`;
}

function renderSide(sideKey, side = {}, context = {}) {
  const formation = text(side?.formation);
  const coach = text(side?.coach);
  return `<section class="cw233-mc-lineup-side cw250-mc-lineup-side" data-cw233-mc-lineup-side="${sideKey}">
    <header><span>${esc(sideName(sideKey, context))}</span><strong>${esc(formation || 'Состав')}</strong></header>
    ${coach ? `<div class="cw233-mc-lineup-coach cw250-mc-lineup-coach">Тренер:<b>${esc(coach)}</b></div>` : ''}
    <div class="cw250-mc-list-label" data-cw250-mc-starting-xi>Стартовый состав</div>
    ${playerList(side.starters)}
    ${renderSubstitutes(side)}
  </section>`;
}

export function renderMatchCenterLineups(section = {}, context = {}) {
  const source = section && typeof section === 'object' ? section : {};
  return `${LINEUP_STYLE}<section class="cw233-mc-lineups cw250-mc-lineups" data-cw233-mc-lineups>
    ${renderStage(source, context)}
    <div class="cw233-mc-lineup-text cw250-mc-lineup-text">${renderSide('home', source.home || {}, context)}${renderSide('away', source.away || {}, context)}</div>
  </section>`;
}

export { parseFormation, positionKey, gridPosition, formationPositions, resolvePitchPositions, compactPitchName, pitchBadges };
