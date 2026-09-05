function text(value) {
  return String(value ?? '').trim();
}

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

function list(value) {
  return Array.isArray(value) ? value.filter(item => item && typeof item === 'object') : [];
}

export function crestInitials(value) {
  const letters = Array.from(text(value).toLocaleUpperCase('ru-RU')).filter(char => /[\p{L}\p{N}]/u.test(char));
  return letters.slice(0, 3).join('') || '—';
}

function openingTagStart(html, markerPosition) {
  return html.lastIndexOf('<', markerPosition);
}

function findBalancedElement(html, marker, from = 0) {
  const markerPosition = html.indexOf(marker, from);
  if (markerPosition < 0) return null;
  const start = openingTagStart(html, markerPosition);
  if (start < 0) return null;
  const openingEnd = html.indexOf('>', start);
  if (openingEnd < 0) return null;
  const opening = html.slice(start + 1, openingEnd);
  const tagMatch = opening.match(/^([a-z][a-z0-9-]*)\b/i);
  if (!tagMatch) return null;
  const tag = tagMatch[1];
  const token = new RegExp(`<\\/?${tag}\\b`, 'gi');
  token.lastIndex = openingEnd + 1;
  let depth = 1;
  let match;
  while ((match = token.exec(html))) {
    const closing = html[match.index + 1] === '/';
    if (closing) depth -= 1;
    else depth += 1;
    if (depth !== 0) continue;
    const closeEnd = html.indexOf('>', match.index);
    if (closeEnd < 0) return null;
    return { start, openingEnd, end:closeEnd + 1, tag };
  }
  return null;
}

function removeMarkedElement(html, marker) {
  const block = findBalancedElement(html, marker);
  return block ? `${html.slice(0, block.start)}${html.slice(block.end)}` : html;
}

function replaceMarkedElement(html, marker, replacement) {
  const block = findBalancedElement(html, marker);
  return block ? `${html.slice(0, block.start)}${replacement}${html.slice(block.end)}` : html;
}

function insertAfterMarkedElement(html, marker, insertion) {
  if (!insertion) return html;
  const block = findBalancedElement(html, marker);
  return block ? `${html.slice(0, block.end)}${insertion}${html.slice(block.end)}` : `${html}${insertion}`;
}

function transformDetail(html, activeTab, transform) {
  const marker = `data-cw239-active-section="${activeTab}"`;
  const block = findBalancedElement(html, marker);
  if (!block) return html;
  const closingStart = html.lastIndexOf(`</${block.tag}>`, block.end);
  if (closingStart < 0) return html;
  const inner = html.slice(block.openingEnd + 1, closingStart);
  return `${html.slice(0, block.openingEnd + 1)}${transform(inner)}${html.slice(closingStart)}`;
}

function round502Styles() {
  return `<style data-cw502-match-center-style>
    .cw239-mc-board{min-height:130px;padding:15px 10px 13px}.cw239-mc-team{gap:6px}.cw239-mc-scorebox{padding-top:12px;gap:5px}.cw239-mc-competition{font-size:10px}.cw239-mc-kickoff{margin:5px 0 10px}
    .cw251-mc-pitch-name{font-size:8.5px!important}.cw251-mc-pitch-badge{font-size:8px!important;min-width:17px;height:13px}.cw250-mc-event.kind-var .cw250-mc-event-node{font-size:8.5px}.cw250-mc-event-card small{font-size:8.5px}.cw250-mc-player-metric{font-size:8.5px}
    .cw502-lineup-switch{display:grid;grid-template-columns:1fr 1fr;gap:4px;padding:3px;border:1px solid var(--mc-border);border-radius:14px;background:rgba(0,0,0,.15)}.cw502-lineup-switch button{min-width:0;padding:9px 8px;border:0;border-radius:10px;background:transparent;color:var(--mc-muted);font:inherit;font-size:9px;font-weight:900;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.cw502-lineup-switch button.is-active{background:linear-gradient(135deg,var(--mc-accent),var(--mc-accent-2));color:#fff;box-shadow:0 5px 18px var(--mc-accent-soft,rgba(0,0,0,.16))}
    .cw250-mc-lineup-stage[data-cw502-lineup-team] .cw250-mc-pitch-panel{display:none}.cw250-mc-lineup-stage[data-cw502-lineup-team="home"] [data-cw250-mc-pitch-team="home"],.cw250-mc-lineup-stage[data-cw502-lineup-team="away"] [data-cw250-mc-pitch-team="away"]{display:grid}
    .cw502-lineup-disclosures{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:2px}.cw502-lineup-disclosure{min-width:0;min-height:38px;padding:8px;border:1px solid var(--mc-border);border-radius:12px;background:rgba(255,255,255,.025);color:var(--mc-text);font:inherit;font-size:9px;font-weight:900;cursor:pointer}.cw502-lineup-disclosure[disabled]{opacity:.46;cursor:default}.cw502-lineup-disclosure.is-active{border-color:color-mix(in srgb,var(--mc-accent) 45%,var(--mc-border));background:var(--mc-accent-soft)}
    .cw502-lineup-expanded{overflow:hidden;margin-top:8px;border:1px solid color-mix(in srgb,var(--mc-border) 78%,transparent);border-radius:14px;background:rgba(255,255,255,.018)}.cw502-lineup-row{display:grid;grid-template-columns:30px minmax(0,1fr) auto;align-items:center;gap:8px;min-height:39px;padding:6px 10px;border-top:1px solid rgba(255,255,255,.055)}.cw502-lineup-row:first-child{border-top:0}.cw502-lineup-row>i{display:grid;place-items:center;width:25px;height:25px;border-radius:50%;background:rgba(255,255,255,.065);color:var(--mc-text);font-style:normal;font-size:9px;font-weight:950}.cw502-lineup-row div{min-width:0}.cw502-lineup-row strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--mc-text);font-size:10px}.cw502-lineup-row small{display:block;margin-top:2px;color:var(--mc-muted);font-size:8.5px}.cw502-lineup-row>b{padding:3px 5px;border-radius:7px;background:var(--mc-accent-soft);color:var(--mc-text);font-size:9px}
    .cw233-mc-shot-marker.cw502-shot-marker{appearance:none;padding:0;cursor:pointer}.cw233-mc-shot-marker.cw502-shot-marker.is-cw502-dimmed{opacity:.34}.cw233-mc-shot-marker.cw502-shot-marker.is-cw502-selected{opacity:1;outline:2px solid #fff;outline-offset:2px;z-index:7;transform:translate(-50%,-50%) scale(1.18)}.cw502-selected-shot{display:grid;grid-template-columns:42px minmax(0,1fr) auto;align-items:center;gap:9px;margin-top:8px;padding:10px 11px;border:1px solid color-mix(in srgb,var(--mc-accent) 34%,var(--mc-border));border-radius:14px;background:linear-gradient(145deg,var(--mc-accent-soft),rgba(255,255,255,.022))}.cw502-selected-shot time{color:var(--mc-muted);font-size:9px;font-weight:950}.cw502-selected-shot div{min-width:0}.cw502-selected-shot strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--mc-text);font-size:10px}.cw502-selected-shot span,.cw502-selected-shot small{display:block;margin-top:2px;color:var(--mc-muted);font-size:8.5px;line-height:1.3}.cw502-selected-shot>b{display:grid;text-align:right;color:var(--mc-text);font-size:12px}.cw502-selected-shot>b small{margin:0;font-size:8.5px}
    .cw502-empty-state{display:grid;place-items:center;min-height:88px;padding:18px 12px;text-align:center;color:var(--mc-muted);font-size:9.5px;line-height:1.4}.cw502-empty-state strong{display:block;margin-bottom:4px;color:var(--mc-text);font-size:11px}.cw233-mc-players-unavailable,.cw250-mc-players-unavailable{min-height:105px!important;padding:15px!important}
    .cw250-user-prediction,.cw250-prediction-community{border-color:color-mix(in srgb,var(--mc-border) 58%,transparent)}
    .cw502-mc-crest-fallback{display:grid!important;place-items:center!important;width:58px!important;height:58px!important;border:1px solid var(--mc-border-strong,var(--mc-border))!important;border-radius:17px!important;background:linear-gradient(145deg,var(--mc-surface-raised),var(--mc-surface))!important;color:var(--mc-text)!important;font-size:11px!important;font-weight:950!important;letter-spacing:.04em!important;filter:none!important}
    @media(max-width:339px){.cw239-mc-board{min-height:122px;padding-top:13px;padding-bottom:12px}.cw502-lineup-disclosures{grid-template-columns:1fr}.cw502-selected-shot{grid-template-columns:36px minmax(0,1fr) auto}}
  </style>`;
}

function annotateCrest(html, side, teamName) {
  const initials = crestInitials(teamName);
  const needle = `data-cw239-crest="${side}"`;
  const attrs = `${needle} data-cw502-crest-side="${side}" data-cw502-crest-fallback="${esc(initials)}"`;
  return html.includes(needle) ? html.replace(needle, attrs) : html;
}

function lineupSwitch(match, selected) {
  const homeName = text(match?.homeTeam?.name) || 'Хозяева';
  const awayName = text(match?.awayTeam?.name) || 'Гости';
  return `<div class="cw502-lineup-switch" data-cw502-lineup-switch>
    <button type="button" class="${selected === 'home' ? 'is-active' : ''}" data-cw502-action="lineup-team" data-cw502-lineup-team="home" aria-pressed="${selected === 'home'}">${esc(homeName)}</button>
    <button type="button" class="${selected === 'away' ? 'is-active' : ''}" data-cw502-action="lineup-team" data-cw502-lineup-team="away" aria-pressed="${selected === 'away'}">${esc(awayName)}</button>
  </div>`;
}

function lineupRows(side, kind) {
  return list(side?.[kind]);
}

function playerRow(player) {
  const number = finite(player?.shirtNumber ?? player?.shirt_number ?? player?.number);
  const name = text(player?.name) || 'Игрок';
  const position = text(player?.position);
  const rating = finite(player?.rating);
  return `<div class="cw502-lineup-row"><i>${number === null ? '—' : esc(Math.trunc(number))}</i><div><strong>${esc(name)}</strong>${position ? `<small>${esc(position)}</small>` : ''}</div>${rating === null ? '' : `<b>${esc(rating.toFixed(1))}</b>`}</div>`;
}

function lineupDisclosures(lineups, viewState) {
  const selected = viewState.selectedLineupTeam === 'away' ? 'away' : 'home';
  const side = lineups?.[selected] && typeof lineups[selected] === 'object' ? lineups[selected] : {};
  const starters = lineupRows(side, 'starters');
  const substitutes = lineupRows(side, 'substitutes');
  const expanded = ['starters','substitutes'].includes(viewState.expandedLineupDisclosure)
    ? viewState.expandedLineupDisclosure
    : null;
  const expandedRows = expanded ? (expanded === 'starters' ? starters : substitutes) : [];
  const expandedHtml = expanded && expandedRows.length
    ? `<div class="cw502-lineup-expanded" data-cw502-lineup-expanded="${expanded}">${expandedRows.map(playerRow).join('')}</div>`
    : '';
  return `<div class="cw502-lineup-disclosures">
    <button type="button" class="cw502-lineup-disclosure${expanded === 'starters' ? ' is-active' : ''}" data-cw502-action="lineup-disclosure" data-cw502-lineup-disclosure="starters" aria-expanded="${expanded === 'starters'}">Стартовый состав · ${starters.length}</button>
    <button type="button" class="cw502-lineup-disclosure${expanded === 'substitutes' ? ' is-active' : ''}" data-cw502-action="lineup-disclosure" data-cw502-lineup-disclosure="substitutes" aria-expanded="${expanded === 'substitutes'}"${substitutes.length ? '' : ' disabled'}>Запасные · ${substitutes.length}</button>
  </div>${expandedHtml}`;
}

function enhanceLineups(inner, state, viewState) {
  const lineups = state?.sections?.lineups && typeof state.sections.lineups === 'object' ? state.sections.lineups : {};
  const selected = viewState.selectedLineupTeam === 'away' ? 'away' : 'home';
  let output = removeMarkedElement(inner, 'class="cw233-mc-lineup-text');
  output = replaceMarkedElement(output, 'data-cw250-mc-lineup-switch', lineupSwitch(state?.match, selected));
  output = output.replace('data-cw250-mc-lineup-stage>', `data-cw250-mc-lineup-stage data-cw502-lineup-team="${selected}">`);
  return `${output}${lineupDisclosures(lineups, viewState)}`;
}

function meaningfulStats(stats) {
  if (!stats || typeof stats !== 'object') return false;
  const home = stats.home && typeof stats.home === 'object' ? stats.home : {};
  const away = stats.away && typeof stats.away === 'object' ? stats.away : {};
  const values = [...Object.values(home), ...Object.values(away)];
  return values.some(value => finite(value) !== null) || list(stats.shots).length > 0 || list(stats.momentum).length > 0;
}

function shotClock(shot = {}) {
  const minute = finite(shot.minute);
  if (minute === null) return '—';
  const added = finite(shot.addedTime ?? shot.added_time);
  return `${Math.trunc(minute)}${added !== null && added > 0 ? `+${Math.trunc(added)}` : ''}′`;
}

const OUTCOME_LABELS = Object.freeze({ goal:'Гол', saved:'В створ · сейв', off_target:'Мимо', blocked:'Заблокирован', post:'Штанга / перекладина' });
const SITUATION_LABELS = Object.freeze({ penalty:'Пенальти', free_kick:'Штрафной', corner:'После углового', set_piece:'Стандарт', open_play:'С игры' });

function shotTeamName(shot, match) {
  return text(shot?.side).toLowerCase() === 'away'
    ? text(match?.awayTeam?.name) || 'Гости'
    : text(match?.homeTeam?.name) || 'Хозяева';
}

function shotXg(value) {
  const number = finite(value);
  return number === null ? null : number.toFixed(2);
}

function selectedShotCard(shot, index, match) {
  if (!shot) return '';
  const player = text(shot.player) || 'Удар без указанного игрока';
  const team = shotTeamName(shot, match);
  const outcomeKey = text(shot.outcome).toLowerCase();
  const situationKey = text(shot.situation).toLowerCase();
  const outcome = OUTCOME_LABELS[outcomeKey] || 'Удар';
  const situation = SITUATION_LABELS[situationKey] || '';
  const assist = text(shot.assist);
  const meta = [team, outcome, situation].filter(Boolean).join(' · ');
  const xg = shotXg(shot.xg);
  return `<article class="cw502-selected-shot" data-cw502-selected-shot="${index}"><time>${esc(shotClock(shot))}</time><div><strong>${esc(player)}</strong><span>${esc(meta)}</span>${assist ? `<small>Ассист: ${esc(assist)}</small>` : ''}</div>${xg === null ? '' : `<b><small>xG</small>${esc(xg)}</b>`}</article>`;
}

function interactiveShots(inner, stats, selectedIndex, match) {
  const shots = list(stats?.shots);
  const selected = Number.isInteger(selectedIndex) && selectedIndex >= 0 && selectedIndex < shots.length ? selectedIndex : null;
  let output = removeMarkedElement(inner, 'data-cw233-mc-shot-list');
  output = output.replace(/<span class="([^"]*\bcw233-mc-shot-marker\b[^"]*)" data-cw233-mc-shot-marker="(\d+)" data-cw251-mc-shot-display role="img" aria-label="([^"]*)" style="([^"]*)"><\/span>/g, (whole, classes, rawIndex, label, style) => {
    const index = Number(rawIndex);
    const pressed = selected === index;
    const selectionClass = selected === null ? '' : pressed ? ' is-cw502-selected' : ' is-cw502-dimmed';
    const shot = shots[index];
    const xg = shotXg(shot?.xg);
    const aria = xg === null ? label : `${label.replace(/, xG [^,]+/, '')}, xG ${xg}`;
    return `<button type="button" class="${classes} cw502-shot-marker${selectionClass}" data-cw233-mc-shot-marker="${index}" data-cw251-mc-shot-display data-cw502-action="shot" data-cw502-shot-action="${index}" aria-label="${aria}" aria-pressed="${pressed}" style="${style}"></button>`;
  });
  if (selected !== null) {
    output = insertAfterMarkedElement(output, 'data-cw233-mc-shotmap', selectedShotCard(shots[selected], selected, match));
  }
  return output;
}

function emptyState(title, body = '') {
  return `<div class="cw502-empty-state" data-cw502-empty-state><div><strong>${esc(title)}</strong>${body ? `<span>${esc(body)}</span>` : ''}</div></div>`;
}

function eventsEmpty(section) {
  if (Array.isArray(section)) return section.length === 0;
  if (!section || typeof section !== 'object') return true;
  return list(section.events).length === 0;
}

export function enhanceRound502MatchCenterView(html, state = {}, viewState = {}) {
  let output = String(html || '');
  if (!output) return output;
  output = `${round502Styles()}${output}`;
  output = annotateCrest(output, 'home', state?.match?.homeTeam?.name);
  output = annotateCrest(output, 'away', state?.match?.awayTeam?.name);

  const active = text(state?.activeTab) || 'overview';
  if (active === 'lineups') {
    output = transformDetail(output, 'lineups', inner => enhanceLineups(inner, state, viewState));
  } else if (active === 'stats') {
    const stats = state?.sections?.stats;
    output = transformDetail(output, 'stats', inner => meaningfulStats(stats)
      ? interactiveShots(inner, stats, viewState.selectedShotIndex, state?.match)
      : emptyState('Статистика появится после начала матча'));
  } else if (active === 'events' && eventsEmpty(state?.sections?.events)) {
    output = transformDetail(output, 'events', () => emptyState('Событий матча пока нет'));
  }
  return output;
}

export { shotXg, meaningfulStats };
