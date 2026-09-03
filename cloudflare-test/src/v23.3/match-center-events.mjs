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
    period:'•',
  })[type] || '•';
}

function score(event) {
  const home = finite(event?.homeScore ?? event?.home_score);
  const away = finite(event?.awayScore ?? event?.away_score);
  return home === null || away === null ? '' : `${home}:${away}`;
}

function eventBody(event, type) {
  const player = String(event?.player || '').trim();
  const assist = String(event?.assist || '').trim();
  const reason = String(event?.reason || '').trim();
  const text = String(event?.text || '').trim();
  const playerIn = String(event?.playerIn ?? event?.player_in ?? '').trim();
  const playerOut = String(event?.playerOut ?? event?.player_out ?? '').trim();
  const result = score(event);
  const lines = [];

  if (type === 'substitution') {
    if (playerIn) lines.push(`<strong>${esc(playerIn)}</strong>`);
    if (playerOut) lines.push(`<span>Вместо: ${esc(playerOut)}</span>`);
  } else if (type === 'period') {
    lines.push(`<strong>${esc(text || typeLabel(type))}</strong>`);
  } else {
    lines.push(`<strong>${esc(player || text || typeLabel(type))}${result ? `<em>${esc(result)}</em>` : ''}</strong>`);
    if (assist) lines.push(`<span>Ассист: ${esc(assist)}</span>`);
    if (reason) lines.push(`<span>${esc(reason)}</span>`);
  }
  return lines.join('');
}

function renderEvent(event) {
  const type = String(event?.type || '').trim().toLowerCase() || 'event';
  const side = String(event?.side || '').trim().toLowerCase();
  const sideClass = side === 'home' ? 'is-home' : side === 'away' ? 'is-away' : 'is-neutral';
  const clock = eventClock(event);
  return `<article class="cw233-mc-event ${sideClass}" data-cw233-mc-event="${esc(type)}">
    <time>${esc(clock)}</time>
    <span class="cw233-mc-event-icon" aria-hidden="true">${esc(eventIcon(type))}</span>
    <div class="cw233-mc-event-copy"><small>${esc(typeLabel(type))}</small>${eventBody(event, type)}</div>
  </article>`;
}

export function renderMatchCenterEvents(section = [], context = {}) {
  const events = sortEvents(section);
  const homeName = String(context?.match?.homeTeam?.name || 'Хозяева');
  const awayName = String(context?.match?.awayTeam?.name || 'Гости');
  const content = events.length
    ? events.map(renderEvent).join('')
    : '<div class="cw233-mc-events-empty">Событий матча пока нет.</div>';

  return `<section class="cw233-mc-events" data-cw233-mc-events>
    <header class="cw233-mc-section-heading"><span>${esc(homeName)}</span><b>Хронология</b><span>${esc(awayName)}</span></header>
    <div class="cw233-mc-events-timeline">${content}</div>
  </section>`;
}

export { eventClock, sortEvents };
