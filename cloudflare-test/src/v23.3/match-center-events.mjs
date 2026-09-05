const EVENT_STYLE = `<style data-cw233-mc-events-parity-style>
.cw233-mc-events{display:grid;gap:10px}.cw233-mc-events-timeline{position:relative;display:grid;gap:0;padding:7px 12px;border:1px solid var(--mc-border);border-radius:19px;background:linear-gradient(160deg,var(--mc-surface-2,rgba(255,255,255,.035)),rgba(255,255,255,.016));box-shadow:inset 0 1px 0 rgba(255,255,255,.035)}.cw233-mc-events-timeline::before{content:'';position:absolute;top:15px;bottom:15px;left:49px;width:1px;background:linear-gradient(180deg,transparent,var(--mc-border-strong,var(--mc-border)) 10%,var(--mc-border-strong,var(--mc-border)) 90%,transparent);opacity:.6}.cw233-mc-event{position:relative;display:grid;grid-template-columns:34px 26px minmax(0,1fr);align-items:start;gap:8px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.055)}.cw233-mc-event:last-child{border-bottom:0}.cw233-mc-event-minute{padding-top:5px;font-size:9px;font-weight:900;color:var(--mc-muted);text-align:right}.cw233-mc-event-icon{position:relative;z-index:1;display:grid;place-items:center;width:26px;height:26px;border:1px solid var(--mc-border);border-radius:9px;background:var(--mc-surface-raised,rgba(255,255,255,.07));font-size:9px;font-weight:950;color:var(--mc-text);box-shadow:0 4px 12px rgba(0,0,0,.22)}.cw233-mc-event.is-home .cw233-mc-event-icon{border-color:color-mix(in srgb,var(--mc-home-marker,var(--mc-accent)) 55%,transparent);color:var(--mc-home-marker,var(--mc-accent))}.cw233-mc-event.is-away .cw233-mc-event-icon{border-color:color-mix(in srgb,var(--mc-away-marker,var(--mc-accent-2)) 55%,transparent);color:var(--mc-away-marker,var(--mc-accent-2))}.cw233-mc-event.is-goal .cw233-mc-event-icon{background:linear-gradient(145deg,var(--mc-accent),var(--mc-accent-2));border-color:rgba(255,255,255,.28);color:#fff;box-shadow:0 0 18px var(--mc-accent-soft,rgba(255,255,255,.08))}.cw233-mc-event.is-yellow .cw233-mc-event-icon{color:#ffd44f}.cw233-mc-event.is-red .cw233-mc-event-icon{color:#ff5a62}.cw233-mc-event-text{min-width:0;padding:5px 7px 5px 9px;border-radius:11px;background:rgba(255,255,255,.018);font-size:10px;line-height:1.35;color:var(--mc-text)}.cw233-mc-event.is-home .cw233-mc-event-text{border-left:2px solid color-mix(in srgb,var(--mc-home-marker,var(--mc-accent)) 54%,transparent)}.cw233-mc-event.is-away .cw233-mc-event-text{border-left:2px solid color-mix(in srgb,var(--mc-away-marker,var(--mc-accent-2)) 54%,transparent)}.cw233-mc-event-text small{display:block;margin-bottom:2px;font-size:7.5px;font-weight:850;letter-spacing:.035em;text-transform:uppercase;color:var(--mc-muted)}.cw233-mc-event-text strong{display:flex;align-items:baseline;gap:7px;min-width:0;font-size:10px;font-weight:900}.cw233-mc-event-text strong em{margin-left:auto;font-style:normal;color:var(--mc-text);font-size:10px;font-weight:950}.cw233-mc-event-text span{display:block;margin-top:2px;font-size:8.5px;color:var(--mc-muted)}.cw233-mc-goal-qualifier{display:inline!important;margin:0!important;color:var(--mc-muted)!important;font-size:8px!important;font-weight:900!important}.cw233-mc-event-period{grid-template-columns:1fr;justify-items:center;padding:9px 0}.cw233-mc-event-period .cw233-mc-event-minute{display:none}.cw233-mc-event-period .cw233-mc-event-icon{display:none}.cw233-mc-event-period .cw233-mc-event-text{position:relative;z-index:1;min-width:44%;padding:6px 11px;border:1px solid var(--mc-border);border-radius:99px;background:var(--mc-surface-raised,rgba(255,255,255,.06));text-align:center}.cw233-mc-event-period .cw233-mc-event-text small{display:none}.cw233-mc-event-period .cw233-mc-event-text strong{display:block;text-align:center;font-size:8px;color:var(--mc-muted)}.cw233-mc-events-empty{padding:28px 12px;text-align:center;font-size:10px;color:var(--mc-muted)}
@media(max-width:339px){.cw233-mc-events-timeline{padding-left:8px;padding-right:8px}.cw233-mc-events-timeline::before{left:42px}.cw233-mc-event{grid-template-columns:30px 24px minmax(0,1fr);gap:6px}.cw233-mc-event-icon{width:24px;height:24px}.cw233-mc-event-text{padding-left:7px;padding-right:5px}}
</style>`;

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

function eventClock(event = {}) {
  const minute = finite(event.minute);
  const added = finite(event.addedTime ?? event.added_time);
  if (minute === null) return '';
  return `${minute}${added !== null && added > 0 ? `+${added}` : ''}′`;
}

function sortEvents(events) {
  return (Array.isArray(events) ? events : [])
    .map((event, index) => ({ event:event && typeof event === 'object' ? event : {}, index }))
    .sort((a, b) => {
      const minuteA = finite(a.event.minute) ?? Number.MAX_SAFE_INTEGER;
      const minuteB = finite(b.event.minute) ?? Number.MAX_SAFE_INTEGER;
      if (minuteA !== minuteB) return minuteA - minuteB;
      const addedA = finite(a.event.addedTime ?? a.event.added_time) ?? 0;
      const addedB = finite(b.event.addedTime ?? b.event.added_time) ?? 0;
      if (addedA !== addedB) return addedA - addedB;
      return a.index - b.index;
    })
    .map(item => item.event);
}

function typeLabel(type) {
  return ({
    goal:'Гол',
    yellow_card:'Жёлтая карточка',
    red_card:'Красная карточка',
    substitution:'Замена',
    var:'VAR',
    penalty:'Пенальти',
    period:'Период',
  })[type] || 'Событие';
}

function eventIcon(type) {
  return ({
    goal:'●',
    yellow_card:'▰',
    red_card:'▰',
    substitution:'⇄',
    var:'VAR',
    penalty:'P',
    period:'•',
  })[type] || '•';
}

function goalQualifier(kind) {
  const key = String(kind || '').trim().toLowerCase();
  if (key === 'penalty') return '(П)';
  if (key === 'own_goal') return '(АГ)';
  if (key === 'free_kick') return '(ШТ)';
  return '';
}

function score(event) {
  const home = finite(event?.homeScore ?? event?.home_score);
  const away = finite(event?.awayScore ?? event?.away_score);
  return home === null || away === null ? '' : `${home}:${away}`;
}

function varDecisionLabel(value) {
  const key = String(value || '').trim().toLowerCase();
  return ({
    goal_confirmed:'Гол подтверждён',
    goal_disallowed:'Гол отменён',
    penalty_awarded:'Назначен пенальти',
    penalty_cancelled:'Пенальти отменён',
    red_card:'Красная карточка',
  })[key] || '';
}

function eventBody(event, type) {
  const player = String(event?.player || '').trim();
  const assist = String(event?.assist || '').trim();
  const reason = String(event?.reason || '').trim();
  const text = String(event?.text || '').trim();
  const playerIn = String(event?.playerIn ?? event?.player_in ?? '').trim();
  const playerOut = String(event?.playerOut ?? event?.player_out ?? '').trim();
  const result = score(event);
  const qualifier = goalQualifier(event?.goalKind ?? event?.goal_kind);
  const lines = [];

  if (type === 'substitution') {
    lines.push(`<strong>${esc(playerIn || 'Замена')}</strong>`);
    if (playerOut) lines.push(`<span>Вместо: ${esc(playerOut)}</span>`);
  } else if (type === 'period') {
    lines.push(`<strong>${esc(text || 'Период матча')}</strong>`);
  } else if (type === 'var') {
    lines.push(`<strong>${esc(player || 'VAR')}</strong>`);
    const decision = text || varDecisionLabel(event?.varDecision ?? event?.var_decision) || reason;
    if (decision) lines.push(`<span>${esc(decision)}</span>`);
  } else {
    const title = player || text || typeLabel(type);
    lines.push(`<strong><span>${esc(title)}${qualifier ? ` <span class="cw233-mc-goal-qualifier">${esc(qualifier)}</span>` : ''}</span>${result ? `<em>${esc(result)}</em>` : ''}</strong>`);
    if (assist) lines.push(`<span>Ассист: ${esc(assist)}</span>`);
    if (reason && reason !== text) lines.push(`<span>${esc(reason)}</span>`);
    if (text && player) lines.push(`<span>${esc(text)}</span>`);
  }
  return lines.join('');
}

function renderEvent(event) {
  const type = String(event?.type || '').trim().toLowerCase() || 'event';
  const side = String(event?.side || '').trim().toLowerCase();
  const sideClass = side === 'home' ? 'is-home' : side === 'away' ? 'is-away' : 'is-neutral';
  const semanticClass = type === 'goal' ? 'is-goal' : type === 'yellow_card' ? 'is-yellow' : type === 'red_card' ? 'is-red' : '';
  const periodClass = type === 'period' ? ' cw233-mc-event-period' : '';
  const clock = eventClock(event);
  return `<article class="cw233-mc-event ${sideClass}${semanticClass ? ` ${semanticClass}` : ''}${periodClass}" data-cw233-mc-event="${esc(type)}">
    <time class="cw233-mc-event-minute">${esc(clock)}</time>
    <span class="cw233-mc-event-icon" aria-hidden="true">${esc(eventIcon(type))}</span>
    <div class="cw233-mc-event-text"><small>${esc(typeLabel(type))}</small>${eventBody(event, type)}</div>
  </article>`;
}

export function renderMatchCenterEvents(section = [], context = {}) {
  const events = sortEvents(section);
  const homeName = String(context?.match?.homeTeam?.name || 'Хозяева');
  const awayName = String(context?.match?.awayTeam?.name || 'Гости');
  const content = events.length
    ? events.map(renderEvent).join('')
    : '<div class="cw233-mc-events-empty">Событий матча пока нет.</div>';

  return `${EVENT_STYLE}<section class="cw233-mc-events" data-cw233-mc-events>
    <header class="cw233-mc-section-heading"><span>${esc(homeName)}</span><b>События</b><span>${esc(awayName)}</span></header>
    <div class="cw233-mc-events-timeline" data-cw233-mc-events-timeline>${content}</div>
  </section>`;
}

export { eventClock, sortEvents, goalQualifier, varDecisionLabel };
