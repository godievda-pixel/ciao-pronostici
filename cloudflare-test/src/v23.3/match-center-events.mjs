const EVENT_STYLE = `<style data-cw233-mc-events-parity-style data-cw250-mc-events-redraw-style>
.cw233-mc-events,.cw250-mc-events{display:grid;gap:10px}.cw233-mc-events-head,.cw250-mc-events-head{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:10px;padding:3px 4px 7px}.cw233-mc-events-head span,.cw250-mc-events-head span{font-size:9px;font-weight:850;color:var(--mc-muted)}.cw233-mc-events-head span:last-child,.cw250-mc-events-head span:last-child{text-align:right}.cw233-mc-events-head b,.cw250-mc-events-head b{font-size:10px;font-weight:950;letter-spacing:.04em;color:var(--mc-text)}
.cw233-mc-events-timeline,.cw250-mc-events-timeline{position:relative;display:grid;gap:7px;padding:10px 8px;border:1px solid var(--mc-border);border-radius:19px;background:linear-gradient(160deg,var(--mc-surface-2,rgba(255,255,255,.035)),rgba(255,255,255,.016));box-shadow:inset 0 1px 0 rgba(255,255,255,.035)}.cw250-mc-events-timeline::before{content:'';position:absolute;top:16px;bottom:16px;left:50%;width:1px;transform:translateX(-50%);background:linear-gradient(180deg,transparent,var(--mc-border-strong,var(--mc-border)) 8%,var(--mc-border-strong,var(--mc-border)) 92%,transparent);opacity:.72}.cw233-mc-events-timeline::before{content:'';position:absolute;top:16px;bottom:16px;left:50%;width:1px;transform:translateX(-50%);background:linear-gradient(180deg,transparent,var(--mc-border-strong,var(--mc-border)) 8%,var(--mc-border-strong,var(--mc-border)) 92%,transparent);opacity:.72}
.cw250-mc-event{position:relative;z-index:1;display:grid;grid-template-columns:minmax(0,1fr) 34px minmax(0,1fr);align-items:center;gap:7px;min-height:58px}.cw233-mc-event{position:relative}.cw250-mc-event-card{min-width:0;padding:9px 10px;border:1px solid var(--mc-border);border-radius:14px;background:linear-gradient(145deg,var(--mc-surface-raised,rgba(255,255,255,.065)),rgba(255,255,255,.018));box-shadow:inset 0 1px 0 rgba(255,255,255,.035),0 8px 22px rgba(0,0,0,.10)}.cw250-mc-event.is-home .cw250-mc-event-card{grid-column:1;border-right:2px solid color-mix(in srgb,var(--mc-home-marker,var(--mc-accent)) 58%,transparent);text-align:right}.cw250-mc-event.is-away .cw250-mc-event-card{grid-column:3;border-left:2px solid color-mix(in srgb,var(--mc-away-marker,var(--mc-accent-2)) 58%,transparent);text-align:left}.cw250-mc-event.is-neutral .cw250-mc-event-card{grid-column:1 / 4;justify-self:center;width:min(100%,220px);text-align:center}.cw250-mc-event-node,.cw233-mc-event-icon{position:relative;z-index:2;grid-column:2;grid-row:1;place-self:center;display:grid;place-items:center;width:28px;height:28px;border:1px solid var(--mc-border);border-radius:10px;background:var(--mc-surface-raised,var(--mc-bg));font-size:8px;font-weight:950;color:var(--mc-text);box-shadow:0 5px 14px rgba(0,0,0,.28)}.cw250-mc-event.is-home .cw250-mc-event-node{border-color:color-mix(in srgb,var(--mc-home-marker,var(--mc-accent)) 62%,var(--mc-border));color:var(--mc-home-marker,var(--mc-accent))}.cw250-mc-event.is-away .cw250-mc-event-node{border-color:color-mix(in srgb,var(--mc-away-marker,var(--mc-accent-2)) 62%,var(--mc-border));color:var(--mc-away-marker,var(--mc-accent-2))}.cw250-mc-event.kind-goal .cw250-mc-event-node,.cw250-mc-event.kind-penalty .cw250-mc-event-node,.cw250-mc-event.kind-own_goal .cw250-mc-event-node{background:linear-gradient(145deg,var(--mc-accent),var(--mc-accent-2));border-color:rgba(255,255,255,.3);color:#fff;box-shadow:0 0 18px var(--mc-accent-soft,rgba(255,255,255,.09))}.cw250-mc-event.kind-yellow_card .cw250-mc-event-node{color:#ffd44f}.cw250-mc-event.kind-red_card .cw250-mc-event-node{color:#ff6673}.cw250-mc-event.kind-var .cw250-mc-event-node{font-size:6.5px;letter-spacing:-.02em}.cw250-mc-event-spacer{display:block;min-width:0}.cw250-mc-event.is-home .cw250-mc-event-spacer{grid-column:3}.cw250-mc-event.is-away .cw250-mc-event-spacer{grid-column:1;grid-row:1}.cw250-mc-event-meta{display:flex;align-items:center;gap:6px;margin-bottom:3px}.cw250-mc-event.is-home .cw250-mc-event-meta{justify-content:flex-end}.cw250-mc-event.is-away .cw250-mc-event-meta{justify-content:flex-start}.cw233-mc-event-minute,.cw250-mc-event-minute{font-size:8.5px;font-weight:950;color:var(--mc-muted)}.cw250-mc-event-score{padding:2px 5px;border:1px solid var(--mc-border);border-radius:7px;background:rgba(255,255,255,.04);font-size:8px;font-weight:950;color:var(--mc-text)}.cw250-mc-event-card small{display:block;margin-bottom:2px;font-size:7px;font-weight:900;letter-spacing:.045em;text-transform:uppercase;color:var(--mc-muted)}.cw250-mc-event-card strong{display:block;overflow:hidden;text-overflow:ellipsis;font-size:10px;font-weight:950;line-height:1.25;color:var(--mc-text)}.cw250-mc-event-card span{display:block;margin-top:2px;font-size:8px;line-height:1.3;color:var(--mc-muted)}.cw250-mc-event-card .cw250-mc-event-detail{color:var(--mc-text)}.cw233-mc-goal-qualifier{display:inline!important;margin:0!important;color:var(--mc-muted)!important;font-size:8px!important;font-weight:900!important}
.cw233-mc-event-period,.cw250-mc-event-period{position:relative;z-index:3;display:grid;grid-template-columns:auto auto;align-items:center;justify-content:center;gap:6px;padding:7px 0}.cw250-mc-event-period time{padding:4px 7px;border:1px solid var(--mc-border);border-radius:99px;background:var(--mc-bg);font-size:8px;font-weight:950;color:var(--mc-text)}.cw250-mc-event-period span{padding:4px 8px;border:1px solid var(--mc-border);border-radius:99px;background:var(--mc-surface-raised,var(--mc-bg));font-size:8px;font-weight:900;color:var(--mc-muted)}.cw233-mc-events-empty{padding:28px 12px;text-align:center;font-size:10px;color:var(--mc-muted)}
@media(max-width:359px){.cw233-mc-events-timeline,.cw250-mc-events-timeline{padding-left:7px;padding-right:7px}.cw250-mc-events-timeline::before,.cw233-mc-events-timeline::before{left:42px;transform:none}.cw250-mc-event{grid-template-columns:30px 24px minmax(0,1fr);gap:6px;align-items:start}.cw250-mc-event.is-home .cw250-mc-event-card,.cw250-mc-event.is-away .cw250-mc-event-card{grid-column:3;grid-row:1;text-align:left;border-right:0;border-left:2px solid color-mix(in srgb,var(--mc-accent) 48%,transparent)}.cw250-mc-event.is-away .cw250-mc-event-card{border-left-color:color-mix(in srgb,var(--mc-away-marker,var(--mc-accent-2)) 58%,transparent)}.cw250-mc-event-node,.cw233-mc-event-icon{grid-column:2;width:24px;height:24px;margin-top:4px}.cw250-mc-event-spacer{grid-column:1!important;grid-row:1!important}.cw250-mc-event-spacer::before{content:attr(data-clock);display:block;padding-top:10px;text-align:right;font-size:8px;font-weight:950;color:var(--mc-muted)}.cw250-mc-event-card .cw250-mc-event-meta time{display:none}.cw250-mc-event.is-home .cw250-mc-event-meta,.cw250-mc-event.is-away .cw250-mc-event-meta{justify-content:flex-start}.cw233-mc-event-period,.cw250-mc-event-period{grid-template-columns:auto minmax(0,1fr);justify-content:stretch;padding-left:4px}.cw250-mc-event-period time{justify-self:start}.cw250-mc-event-period span{justify-self:start}}
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

function eventKind(event = {}) {
  const type = String(event?.type || '').trim().toLowerCase();
  const goalKind = String(event?.goalKind ?? event?.goal_kind ?? '').trim().toLowerCase();
  if (type === 'goal' && goalKind === 'penalty') return 'penalty';
  if (type === 'goal' && goalKind === 'own_goal') return 'own_goal';
  if (type === 'yellow') return 'yellow_card';
  if (type === 'red') return 'red_card';
  if (type === 'sub') return 'substitution';
  if (type === 'half') return 'period';
  return type || 'event';
}

function typeLabel(value) {
  const kind = typeof value === 'object' ? eventKind(value) : String(value || '').trim().toLowerCase();
  return ({
    goal:'Гол',
    penalty:'Пенальти',
    own_goal:'Автогол',
    yellow_card:'Жёлтая карточка',
    red_card:'Красная карточка',
    substitution:'Замена',
    var:'VAR',
    period:'Период',
  })[kind] || 'Событие';
}

function eventIcon(value) {
  const kind = typeof value === 'object' ? eventKind(value) : String(value || '').trim().toLowerCase();
  return ({
    goal:'●',
    penalty:'P',
    own_goal:'АГ',
    yellow_card:'▰',
    red_card:'▰',
    substitution:'⇄',
    var:'VAR',
    period:'•',
  })[kind] || '•';
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
    penalty_awarded:'Пенальти назначен',
    penalty_cancelled:'Пенальти отменён',
    red_card:'Красная карточка',
  })[key] || '';
}

function eventDetails(event, kind) {
  const player = String(event?.player || '').trim();
  const assist = String(event?.assist || '').trim();
  const reason = String(event?.reason || '').trim();
  const rawText = String(event?.text || '').trim();
  const playerIn = String(event?.playerIn ?? event?.player_in ?? '').trim();
  const playerOut = String(event?.playerOut ?? event?.player_out ?? '').trim();
  const details = [];

  if (kind === 'substitution') {
    if (playerOut) details.push(`Вместо: ${playerOut}`);
    if (reason) details.push(reason);
    return { title:playerIn || player || typeLabel(kind), details };
  }

  if (kind === 'var') {
    const decision = varDecisionLabel(event?.varDecision ?? event?.var_decision) || rawText || reason;
    if (decision) details.push(decision);
    return { title:player || 'VAR', details };
  }

  if (assist) details.push(`Ассист: ${assist}`);
  if (reason) details.push(reason);
  if (rawText && rawText !== player && rawText !== reason) details.push(rawText);
  return { title:player || rawText || typeLabel(kind), details };
}

function renderPeriod(event) {
  const clock = eventClock(event);
  const label = String(event?.text || '').trim() || typeLabel('period');
  return `<div class="cw233-mc-event-period cw250-mc-event-period" data-cw233-mc-event="period" data-cw250-mc-period>
    <time>${esc(clock || '—')}</time><span>${esc(label)}</span>
  </div>`;
}

function renderEvent(event, homeName, awayName) {
  const kind = eventKind(event);
  if (kind === 'period') return renderPeriod(event);

  const rawSide = String(event?.side || '').trim().toLowerCase();
  const side = rawSide === 'away' ? 'away' : rawSide === 'home' ? 'home' : 'neutral';
  const team = side === 'away' ? awayName : side === 'home' ? homeName : '';
  const clock = eventClock(event);
  const result = score(event);
  const qualifier = goalQualifier(event?.goalKind ?? event?.goal_kind);
  const { title, details } = eventDetails(event, kind);
  const semanticClass = kind === 'yellow_card' ? ' is-yellow' : kind === 'red_card' ? ' is-red' : ['goal','penalty','own_goal'].includes(kind) ? ' is-goal' : '';

  return `<article class="cw233-mc-event cw250-mc-event is-${esc(side)} kind-${esc(kind)}${semanticClass}" data-cw233-mc-event="${esc(String(event?.type || kind).toLowerCase())}" data-cw250-mc-side="${esc(side)}" data-cw250-mc-event-kind="${esc(kind)}">
    <div class="cw250-mc-event-card">
      <div class="cw250-mc-event-meta"><time class="cw233-mc-event-minute cw250-mc-event-minute">${esc(clock || '—')}</time>${result ? `<b class="cw250-mc-event-score" data-cw250-mc-score-after>${esc(result)}</b>` : ''}</div>
      <small>${esc(typeLabel(kind))}</small>
      <strong>${esc(title)}${qualifier ? ` <span class="cw233-mc-goal-qualifier">${esc(qualifier)}</span>` : ''}</strong>
      ${team ? `<span>${esc(team)}</span>` : ''}
      ${details.map(detail => `<span class="cw250-mc-event-detail">${esc(detail)}</span>`).join('')}
    </div>
    <span class="cw233-mc-event-icon cw250-mc-event-node" aria-hidden="true">${esc(eventIcon(kind))}</span>
    <span class="cw250-mc-event-spacer" data-clock="${esc(clock || '—')}"></span>
  </article>`;
}

export function renderMatchCenterEvents(section = [], context = {}) {
  const events = sortEvents(section);
  const homeName = String(context?.match?.homeTeam?.name || 'Хозяева');
  const awayName = String(context?.match?.awayTeam?.name || 'Гости');
  const content = events.length
    ? events.map(event => renderEvent(event, homeName, awayName)).join('')
    : '<div class="cw233-mc-events-empty">Событий матча пока нет.</div>';

  return `${EVENT_STYLE}<section class="cw233-mc-events cw250-mc-events" data-cw233-mc-events>
    <header class="cw233-mc-section-heading cw250-mc-events-head"><span>${esc(homeName)}</span><b>События</b><span>${esc(awayName)}</span></header>
    <div class="cw233-mc-events-timeline cw250-mc-events-timeline" data-cw233-mc-events-timeline data-cw250-mc-events-timeline>${content}</div>
  </section>`;
}

export { eventClock, sortEvents, eventKind, goalQualifier, varDecisionLabel };
