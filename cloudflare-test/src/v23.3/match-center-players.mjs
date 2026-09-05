const PLAYER_STYLE = `<style data-cw233-mc-players-parity-style>
.cw233-mc-players{display:grid;gap:10px;min-width:0}.cw233-mc-players-list{display:grid;gap:8px;min-width:0}.cw233-mc-player-card{display:grid;grid-template-columns:30px minmax(0,1fr) 46px;align-items:center;gap:10px;min-width:0;min-height:62px;padding:10px;border:1px solid var(--mc-border);border-radius:16px;background:linear-gradient(145deg,var(--mc-surface-raised),rgba(255,255,255,.018));box-shadow:inset 0 1px 0 rgba(255,255,255,.035)}.cw233-mc-player-rank{display:grid;place-items:center;width:28px;height:28px;border:1px solid var(--mc-border);border-radius:10px;background:var(--mc-accent-soft);font-size:9px;font-weight:950;color:var(--mc-text)}.cw233-mc-rating-name{min-width:0}.cw233-mc-rating-name b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;font-weight:950;color:var(--mc-text)}.cw233-mc-player-team{display:block;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:8px;font-weight:800;color:var(--mc-muted)}.cw233-mc-rating-meta{display:block;margin-top:5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:8px;line-height:1.3;color:var(--mc-muted)}.cw233-mc-rating{display:grid;place-items:center;min-width:44px;height:34px;border:1px solid var(--mc-border);border-radius:11px;background:var(--mc-accent-soft);font-size:13px;font-weight:950;color:var(--mc-text);box-shadow:inset 0 1px 0 rgba(255,255,255,.05)}.cw233-mc-players-unavailable{min-height:160px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;padding:20px;border:1px solid var(--mc-border);border-radius:16px;background:var(--mc-surface-raised);text-align:center}.cw233-mc-players-unavailable strong{font-size:11px}.cw233-mc-players-unavailable span{max-width:280px;font-size:9px;line-height:1.45;color:var(--mc-muted)}
@media(max-width:360px){.cw233-mc-player-card{grid-template-columns:26px minmax(0,1fr) 41px;gap:7px;padding:9px 8px}.cw233-mc-player-rank{width:25px;height:25px;border-radius:9px}.cw233-mc-rating{min-width:39px;height:31px;font-size:12px}.cw233-mc-rating-name b{font-size:10px}.cw233-mc-rating-meta{font-size:7.5px}}
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
  const minutes = finite(player.minutes);
  if (minutes !== null) metrics.push(`${minutes} мин`);
  const goals = russianCount(player.goals, ['гол', 'гола', 'голов']);
  if (goals) metrics.push(goals);
  const assists = russianCount(player.assists, ['ассист', 'ассиста', 'ассистов']);
  if (assists) metrics.push(assists);
  const xg = finite(player.xg);
  if (xg !== null) metrics.push(`xG ${xg}`);
  const xa = finite(player.xa);
  if (xa !== null) metrics.push(`xA ${xa}`);
  const shots = russianCount(player.shots, ['удар', 'удара', 'ударов']);
  if (shots) metrics.push(shots);
  const keyPasses = russianCount(player.keyPasses ?? player.key_passes, ['ключ. передача', 'ключ. передачи', 'ключ. передач']);
  if (keyPasses) metrics.push(keyPasses);
  return metrics.join(' · ');
}

function playerId(player = {}, index = 0) {
  const id = finite(player.playerId ?? player.player_id ?? player.id);
  return id === null ? `row-${index}` : String(id);
}

function renderPlayer(player, index) {
  const rating = finite(player.rating);
  const name = text(player.name) || 'Игрок';
  const teamName = text(player.teamName ?? player.team_name);
  const meta = metricText(player);
  const rank = index + 1;
  return `<article class="cw233-mc-player-card cw233-mc-rating-row" data-cw233-mc-player="${esc(playerId(player, index))}" data-cw233-mc-player-rank="${rank}">
    <span class="cw233-mc-player-rank" aria-label="Место ${rank}">${rank}</span>
    <div class="cw233-mc-rating-name"><b>${esc(name)}</b>${teamName ? `<small class="cw233-mc-player-team">${esc(teamName)}</small>` : ''}${meta ? `<small class="cw233-mc-rating-meta">${esc(meta)}</small>` : ''}</div>
    <span class="cw233-mc-rating" data-cw233-mc-player-rating>${rating === null ? '—' : esc(rating.toFixed(1))}</span>
  </article>`;
}

export function renderMatchCenterPlayers(section = [], context = {}) {
  const players = list(section);
  const rated = players
    .map((player, index) => ({ player, index }))
    .filter(({ player }) => finite(player.rating) !== null)
    .sort((a, b) => {
      const ratingDiff = (finite(b.player.rating) ?? 0) - (finite(a.player.rating) ?? 0);
      return ratingDiff || a.index - b.index;
    })
    .map(({ player }) => player);

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
