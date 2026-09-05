const PLAYER_STYLE = `<style data-cw233-mc-players-parity-style data-cw250-mc-players-redraw-style>
.cw233-mc-players,.cw250-mc-players{display:grid;gap:11px;min-width:0}.cw233-mc-players-list,.cw250-mc-players-list{display:grid;gap:8px;min-width:0}.cw233-mc-player-card,.cw250-mc-player-card{position:relative;display:grid;grid-template-columns:32px minmax(0,1fr) 50px;align-items:center;gap:10px;min-width:0;min-height:68px;padding:11px;border:1px solid var(--mc-border);border-radius:17px;background:linear-gradient(145deg,var(--mc-surface-raised),rgba(255,255,255,.016));box-shadow:inset 0 1px 0 rgba(255,255,255,.035),0 8px 22px rgba(0,0,0,.08);overflow:hidden}.cw250-mc-player-card::before{content:'';position:absolute;inset:0 auto 0 0;width:2px;background:linear-gradient(180deg,var(--mc-accent),var(--mc-accent-2));opacity:.45}.cw250-mc-player-card.is-top-player{min-height:78px;border-color:var(--mc-border-strong,var(--mc-border));background:linear-gradient(135deg,var(--mc-accent-soft),var(--mc-surface-raised) 46%,rgba(255,255,255,.018));box-shadow:inset 0 1px 0 rgba(255,255,255,.05),0 12px 30px rgba(0,0,0,.14)}.cw250-mc-player-card.is-top-player::before{width:3px;opacity:1}.cw233-mc-player-rank,.cw250-mc-player-rank{display:grid;place-items:center;width:30px;height:30px;border:1px solid var(--mc-border);border-radius:10px;background:var(--mc-accent-soft);font-size:9px;font-weight:950;color:var(--mc-text)}.cw250-mc-player-card.is-top-player .cw250-mc-player-rank{border-color:color-mix(in srgb,var(--mc-accent) 45%,var(--mc-border));background:linear-gradient(145deg,var(--mc-accent),var(--mc-accent-2));color:#fff;box-shadow:0 0 16px var(--mc-accent-soft)}.cw233-mc-rating-name,.cw250-mc-rating-name{min-width:0}.cw233-mc-rating-name b,.cw250-mc-rating-name b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;font-weight:950;color:var(--mc-text)}.cw250-mc-player-card.is-top-player .cw250-mc-rating-name b{font-size:12px}.cw233-mc-player-team,.cw250-mc-player-team{display:block;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:8px;font-weight:800;color:var(--mc-muted)}.cw233-mc-rating-meta,.cw250-mc-rating-meta{display:flex;flex-wrap:wrap;gap:4px;margin-top:7px;min-width:0}.cw250-mc-player-metric{display:inline-flex;align-items:center;min-height:20px;padding:3px 6px;border:1px solid var(--mc-border);border-radius:7px;background:rgba(255,255,255,.035);font-size:7.5px;font-weight:850;line-height:1;color:var(--mc-muted);white-space:nowrap}.cw250-mc-player-card.is-top-player .cw250-mc-player-metric{background:rgba(255,255,255,.05);color:var(--mc-text)}.cw233-mc-rating,.cw250-mc-rating{display:grid;place-items:center;min-width:46px;height:36px;border:1px solid var(--mc-border);border-radius:11px;background:var(--mc-accent-soft);font-size:13px;font-weight:950;color:var(--mc-text);box-shadow:inset 0 1px 0 rgba(255,255,255,.05)}.cw250-mc-player-card.is-top-player .cw250-mc-rating{height:40px;border-color:color-mix(in srgb,var(--mc-accent) 55%,var(--mc-border));background:linear-gradient(145deg,var(--mc-accent),var(--mc-accent-2));font-size:15px;color:#fff;box-shadow:0 0 18px var(--mc-accent-soft)}.cw233-mc-players-unavailable,.cw250-mc-players-unavailable{min-height:160px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;padding:20px;border:1px solid var(--mc-border);border-radius:17px;background:linear-gradient(145deg,var(--mc-surface-raised),rgba(255,255,255,.014));text-align:center}.cw233-mc-players-unavailable strong,.cw250-mc-players-unavailable strong{font-size:11px;color:var(--mc-text)}.cw233-mc-players-unavailable span,.cw250-mc-players-unavailable span{max-width:280px;font-size:9px;line-height:1.45;color:var(--mc-muted)}
@media(max-width:420px){.cw233-mc-player-card,.cw250-mc-player-card{grid-template-columns:28px minmax(0,1fr) 44px;gap:8px;padding:10px 9px}.cw233-mc-player-rank,.cw250-mc-player-rank{width:27px;height:27px}.cw233-mc-rating,.cw250-mc-rating{min-width:42px;height:33px;font-size:12px}.cw250-mc-player-card.is-top-player .cw250-mc-rating{height:36px;font-size:14px}.cw233-mc-rating-name b,.cw250-mc-rating-name b{font-size:10px}.cw250-mc-player-card.is-top-player .cw250-mc-rating-name b{font-size:11px}.cw250-mc-player-metric{font-size:7px;padding:3px 5px}}@media(max-width:340px){.cw233-mc-player-card,.cw250-mc-player-card{grid-template-columns:26px minmax(0,1fr) 40px;gap:6px;padding-inline:8px}.cw250-mc-player-metric{min-height:18px}.cw233-mc-rating,.cw250-mc-rating{min-width:38px}}
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

function metricItems(player = {}) {
  const items = [];
  const add = (key, value) => { if (value) items.push({ key, value }); };
  const minutes = finite(player.minutes);
  if (minutes !== null) add('minutes', `${minutes} мин`);
  add('goals', russianCount(player.goals, ['гол', 'гола', 'голов']));
  add('assists', russianCount(player.assists, ['ассист', 'ассиста', 'ассистов']));
  const xg = finite(player.xg);
  if (xg !== null) add('xg', `xG ${xg}`);
  const xa = finite(player.xa);
  if (xa !== null) add('xa', `xA ${xa}`);
  add('shots', russianCount(player.shots, ['удар', 'удара', 'ударов']));
  add('keyPasses', russianCount(player.keyPasses ?? player.key_passes, ['ключ. передача', 'ключ. передачи', 'ключ. передач']));
  return items;
}

function metricText(player = {}) {
  return metricItems(player).map(item => item.value).join(' · ');
}

function metricChips(player = {}) {
  return metricItems(player)
    .map(item => `<span class="cw250-mc-player-metric" data-cw250-mc-player-metric="${esc(item.key)}">${esc(item.value)}</span>`)
    .join('');
}

function playerId(player = {}, index = 0) {
  const id = finite(player.playerId ?? player.player_id ?? player.id);
  return id === null ? `row-${index}` : String(id);
}

function renderPlayer(player, index) {
  const rating = finite(player.rating);
  const name = text(player.name) || 'Игрок';
  const teamName = text(player.teamName ?? player.team_name);
  const chips = metricChips(player);
  const rank = index + 1;
  const topClass = rank === 1 ? ' is-top-player' : '';
  return `<article class="cw233-mc-player-card cw233-mc-rating-row cw250-mc-player-card${topClass}" data-cw233-mc-player="${esc(playerId(player, index))}" data-cw233-mc-player-rank="${rank}" data-cw250-mc-player-card data-cw250-mc-player-rank="${rank}">
    <span class="cw233-mc-player-rank cw250-mc-player-rank" aria-label="Место ${rank}">${rank}</span>
    <div class="cw233-mc-rating-name cw250-mc-rating-name"><b>${esc(name)}</b>${teamName ? `<small class="cw233-mc-player-team cw250-mc-player-team">${esc(teamName)}</small>` : ''}${chips ? `<div class="cw233-mc-rating-meta cw250-mc-rating-meta">${chips}</div>` : ''}</div>
    <span class="cw233-mc-rating cw250-mc-rating" data-cw233-mc-player-rating>${rating === null ? '—' : esc(rating.toFixed(1))}</span>
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
    return `${PLAYER_STYLE}<section class="cw233-mc-players cw250-mc-players" data-cw233-mc-players><div class="cw233-mc-players-unavailable cw250-mc-players-unavailable"><strong>Оценки игроков пока недоступны</strong><span>Покажем их, когда провайдер опубликует оценки.</span></div></section>`;
  }

  const homeName = text(context?.match?.homeTeam?.name);
  const awayName = text(context?.match?.awayTeam?.name);
  return `${PLAYER_STYLE}<section class="cw233-mc-players cw250-mc-players" data-cw233-mc-players>
    <header class="cw233-mc-section-heading"><span>${esc(homeName)}</span><b>Игроки</b><span>${esc(awayName)}</span></header>
    <div class="cw233-mc-players-list cw250-mc-players-list">${rated.map(renderPlayer).join('')}</div>
  </section>`;
}

export { russianCount, metricText, metricItems };
