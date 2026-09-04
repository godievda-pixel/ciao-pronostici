const PLAYER_STYLE = `<style data-cw233-mc-players-parity-style>
.cw233-mc-players{display:grid;gap:9px}.cw233-mc-players-list{overflow:hidden;border:1px solid var(--mc-border);border-radius:17px;background:rgba(255,255,255,.025)}.cw233-mc-rating-row{display:grid;grid-template-columns:minmax(0,1fr) 45px;align-items:center;gap:10px;min-height:50px;padding:8px 12px;border-bottom:1px solid rgba(255,255,255,.06)}.cw233-mc-rating-row:last-child{border-bottom:0}.cw233-mc-rating-name{min-width:0}.cw233-mc-rating-name b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px;font-weight:900;color:var(--mc-text)}.cw233-mc-rating-meta{display:block;margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:8px;line-height:1.25;color:var(--mc-muted)}.cw233-mc-rating{display:grid;place-items:center;min-width:42px;height:31px;border-radius:10px;background:rgba(255,255,255,.055);font-size:12px;font-weight:900;color:var(--mc-text)}.cw233-mc-players-unavailable{min-height:160px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;padding:20px;text-align:center}.cw233-mc-players-unavailable strong{font-size:11px}.cw233-mc-players-unavailable span{max-width:280px;font-size:9px;line-height:1.45;color:var(--mc-muted)}
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

function metricText(player = {}) {
  const metrics = [];
  const goals = russianCount(player.goals, ['гол', 'гола', 'голов']);
  if (goals) metrics.push(goals);
  const assists = russianCount(player.assists, ['ассист', 'ассиста', 'ассистов']);
  if (assists) metrics.push(assists);
  const xg = finite(player.xg);
  if (xg !== null) metrics.push(`xG ${xg}`);
  const xa = finite(player.xa);
  if (xa !== null) metrics.push(`xA ${xa}`);
  const minutes = finite(player.minutes);
  if (minutes !== null) metrics.push(`${minutes} мин`);
  return metrics.join(' · ');
}

function playerId(player = {}, index = 0) {
  const id = finite(player.playerId ?? player.player_id ?? player.id);
  return id === null ? `row-${index}` : String(id);
}

function renderPlayer(player, index) {
  const rating = finite(player.rating);
  const name = text(player.name) || 'Игрок';
  const meta = metricText(player);
  return `<article class="cw233-mc-rating-row" data-cw233-mc-player="${esc(playerId(player, index))}">
    <div class="cw233-mc-rating-name"><b>${esc(name)}</b>${meta ? `<small class="cw233-mc-rating-meta">${esc(meta)}</small>` : ''}</div>
    <span class="cw233-mc-rating" data-cw233-mc-player-rating>${rating === null ? '—' : esc(rating.toFixed(1))}</span>
  </article>`;
}

export function renderMatchCenterPlayers(section = [], context = {}) {
  const players = list(section);
  const rated = players
    .filter(player => finite(player.rating) !== null)
    .sort((a, b) => (finite(b.rating) ?? 0) - (finite(a.rating) ?? 0));

  if (!rated.length) {
    return `${PLAYER_STYLE}<section class="cw233-mc-players" data-cw233-mc-players><div class="cw233-mc-players-unavailable"><strong>Оценки игроков пока недоступны</strong><span>Покажем их, когда провайдер опубликует оценки.</span></div></section>`;
  }

  const homeName = text(context?.match?.homeTeam?.name);
  const awayName = text(context?.match?.awayTeam?.name);
  return `${PLAYER_STYLE}<section class="cw233-mc-players" data-cw233-mc-players>
    <header class="cw233-mc-section-heading"><span>${esc(homeName)}</span><b>Игроки</b><span>${esc(awayName)}</span></header>
    <div class="cw233-mc-players-list">${rated.map(renderPlayer).join('')}</div>
  </section>`;
}

export { russianCount };
