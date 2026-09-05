function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function text(value) {
  return String(value ?? '').trim();
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

function finite(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function fmt(value, digits = 2) {
  const number = finite(value);
  if (number === null) return '—';
  if (Number.isInteger(number)) return String(number);
  return number.toFixed(digits).replace(/0+$/, '').replace(/\.$/, '');
}

function percentage(value) {
  const number = finite(value);
  if (number === null) return null;
  const normalized = Math.abs(number) <= 1 ? number * 100 : number;
  return Math.max(0, Math.min(100, normalized));
}

function predictionPercentages(distribution = {}) {
  const raw = [
    finite(distribution.home ?? distribution.prob_home ?? distribution.probHome),
    finite(distribution.draw ?? distribution.prob_draw ?? distribution.probDraw),
    finite(distribution.away ?? distribution.prob_away ?? distribution.probAway),
  ];
  const present = raw.filter(value => value !== null);
  const fractional = present.length > 0 && present.every(value => Math.abs(value) <= 1);
  return raw.map(value => {
    if (value === null) return null;
    const normalized = fractional ? value * 100 : value;
    return Math.max(0, Math.min(100, normalized));
  });
}

function overviewStyles() {
  return `<style data-cw233-mc-overview-parity-style data-cw250-overview-redraw-style>
    .cw233-mc-overview{display:grid;gap:12px}
    .cw233-mc-overview-card{position:relative;overflow:hidden;padding:14px;border:1px solid var(--mc-border);border-radius:20px;background:linear-gradient(155deg,var(--mc-surface),color-mix(in srgb,var(--mc-surface-2) 78%,transparent));box-shadow:inset 0 1px 0 rgba(255,255,255,.045),0 12px 28px rgba(0,0,0,.13)}
    .cw233-mc-overview-card::after{content:'';pointer-events:none;position:absolute;inset:0;background:radial-gradient(circle at 94% -22%,var(--mc-accent-soft),transparent 38%);opacity:.5}
    .cw233-mc-overview-card>*{position:relative;z-index:1}
    .cw233-mc-overview-title{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin:0 0 12px}.cw233-mc-overview-title span{color:var(--mc-text);font-size:12px;font-weight:950;letter-spacing:.01em}.cw233-mc-overview-title b{color:var(--mc-muted);font-size:8px;font-weight:850;letter-spacing:.065em;text-transform:uppercase;text-align:right}

    .cw250-key-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px}.cw250-key-metric{min-width:0;padding:10px 6px;border:1px solid color-mix(in srgb,var(--mc-border) 78%,transparent);border-radius:13px;background:linear-gradient(150deg,var(--mc-surface-raised),rgba(255,255,255,.022));text-align:center}.cw250-key-metric span{display:block;margin-bottom:7px;color:var(--mc-muted);font-size:7px;font-weight:850;letter-spacing:.04em;text-transform:uppercase;white-space:nowrap}.cw250-key-values{display:flex;align-items:center;justify-content:center;gap:5px}.cw250-key-values strong{min-width:0;color:var(--mc-text);font-size:11px;line-height:1;font-weight:950}.cw250-key-values i{width:3px;height:3px;border-radius:50%;background:var(--mc-accent);box-shadow:0 0 8px var(--mc-accent-soft)}
    .cw250-best-player{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:10px;margin-top:8px;padding:11px 12px;border:1px solid color-mix(in srgb,var(--mc-accent) 26%,var(--mc-border));border-radius:14px;background:linear-gradient(145deg,color-mix(in srgb,var(--mc-accent-soft) 38%,var(--mc-surface-raised)),var(--mc-surface));box-shadow:inset 0 1px 0 rgba(255,255,255,.045)}.cw250-best-player small{display:block;margin-bottom:5px;color:var(--mc-muted);font-size:7px;font-weight:850;text-transform:uppercase;letter-spacing:.06em}.cw250-best-player strong{display:block;color:var(--mc-text);font-size:11px;font-weight:950}.cw250-best-player span{display:block;margin-top:3px;color:var(--mc-muted);font-size:8px}.cw250-best-player b{min-width:47px;padding:9px 7px;border-radius:12px;background:linear-gradient(145deg,var(--mc-accent),var(--mc-accent-2));color:#fff;font-size:15px;font-weight:950;text-align:center;box-shadow:0 8px 18px var(--mc-accent-soft)}
    .cw250-recent-events{display:flex;gap:6px;overflow-x:auto;margin-top:8px;padding-bottom:1px;scrollbar-width:none}.cw250-recent-events::-webkit-scrollbar{display:none}.cw250-event-chip{flex:0 0 auto;max-width:180px;padding:7px 9px;border:1px solid var(--mc-border);border-radius:999px;background:rgba(255,255,255,.035);color:var(--mc-muted);font-size:8px;line-height:1.15;white-space:nowrap}.cw250-event-chip b{color:var(--mc-text);font-weight:900}

    .cw233-mc-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.cw233-mc-form-side{min-width:0;padding:12px;border:1px solid var(--mc-border);border-radius:14px;background:linear-gradient(145deg,var(--mc-surface-raised),rgba(255,255,255,.018))}.cw233-mc-form-side>strong{display:block;margin-bottom:10px;color:var(--mc-text);font-size:11px;font-weight:900;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.cw233-mc-form-run{display:flex;gap:6px;flex-wrap:wrap}.cw233-mc-form-chip{width:24px;height:24px;display:grid;place-items:center;border-radius:8px;border:1px solid rgba(255,255,255,.035);background:rgba(255,255,255,.065);color:var(--mc-muted);font-size:9px;font-weight:950}.cw233-mc-form-chip.is-win{background:rgba(24,186,139,.19);border-color:rgba(57,218,170,.22);color:#8ff0c8}.cw233-mc-form-chip.is-draw{background:rgba(111,132,166,.17);color:#dce6f7}.cw233-mc-form-chip.is-loss{background:rgba(225,75,96,.17);border-color:rgba(248,113,113,.18);color:#ffafb9}

    .cw250-match-info-main{padding:13px;border:1px solid var(--mc-border);border-radius:15px;background:linear-gradient(145deg,var(--mc-surface-raised),rgba(255,255,255,.018))}.cw250-match-info-main small,.cw250-match-info-card small{display:block;margin-bottom:6px;color:var(--mc-muted);font-size:8px}.cw250-match-info-main strong,.cw250-match-info-card strong{display:block;color:var(--mc-text);font-size:11px;line-height:1.3;font-weight:950}.cw250-match-info-main span{display:block;margin-top:4px;color:var(--mc-muted);font-size:9px}.cw250-match-info-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:8px}.cw250-match-info-card{min-width:0;padding:12px;border:1px solid var(--mc-border);border-radius:14px;background:rgba(255,255,255,.025)}

    .cw250-user-prediction{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:10px;padding:12px 13px;border:1px solid color-mix(in srgb,var(--mc-accent) 24%,var(--mc-border));border-radius:15px;background:linear-gradient(145deg,color-mix(in srgb,var(--mc-accent-soft) 28%,var(--mc-surface-raised)),var(--mc-surface))}.cw250-user-prediction small{display:block;margin-bottom:4px;color:var(--mc-accent-2);font-size:8px;font-weight:850;text-transform:uppercase}.cw250-user-prediction strong{display:block;color:var(--mc-text);font-size:11px;font-weight:950}.cw250-user-prediction span{display:block;margin-top:4px;color:var(--mc-muted);font-size:8px}.cw250-user-prediction b{min-width:64px;padding:12px 10px;border:1px solid color-mix(in srgb,var(--mc-accent) 55%,transparent);border-radius:14px;background:linear-gradient(145deg,var(--mc-accent-soft),color-mix(in srgb,var(--mc-accent) 26%,var(--mc-surface)));color:#fff;font-size:20px;line-height:1;font-weight:950;text-align:center}
    .cw250-prediction-community{margin-top:9px;padding:12px;border:1px solid var(--mc-border);border-radius:15px;background:rgba(255,255,255,.022)}.cw250-prediction-community-head{display:flex;align-items:baseline;justify-content:space-between;gap:10px}.cw250-prediction-community-head strong{font-size:10px;color:var(--mc-text)}.cw250-prediction-community-head span{font-size:8px;color:var(--mc-muted)}.cw250-prediction-bar{display:flex;height:7px;margin:10px 0 9px;border-radius:999px;overflow:hidden;background:rgba(255,255,255,.055)}.cw250-prediction-bar i{display:block;height:100%}.cw250-prediction-bar .home{background:var(--mc-accent)}.cw250-prediction-bar .draw{background:color-mix(in srgb,var(--mc-muted) 72%,transparent)}.cw250-prediction-bar .away{background:var(--mc-accent-2)}.cw250-prediction-labels{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}.cw250-prediction-label{display:flex;align-items:center;justify-content:center;gap:5px;color:var(--mc-muted);font-size:8px}.cw250-prediction-label i{width:7px;height:7px;border-radius:50%;background:var(--mc-accent)}.cw250-prediction-label:nth-child(2) i{background:color-mix(in srgb,var(--mc-muted) 72%,transparent)}.cw250-prediction-label:nth-child(3) i{background:var(--mc-accent-2)}.cw250-prediction-label b{color:var(--mc-text);font-size:12px}.cw250-prediction-extras{display:grid;gap:8px;margin-top:9px}.cw250-exact-score{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 11px;border:1px solid var(--mc-border);border-radius:13px;background:rgba(255,255,255,.02);color:var(--mc-muted);font-size:8px}.cw250-exact-score strong{color:var(--mc-text);font-size:10px}.cw250-popular-scores{padding:10px 11px;border:1px solid var(--mc-border);border-radius:13px;background:rgba(255,255,255,.02)}.cw250-popular-scores>span{display:block;margin-bottom:8px;color:var(--mc-muted);font-size:8px}.cw250-popular-score-list{display:flex;gap:6px;flex-wrap:wrap}.cw250-popular-score{padding:6px 8px;border:1px solid color-mix(in srgb,var(--mc-accent) 30%,var(--mc-border));border-radius:999px;background:var(--mc-accent-soft);color:var(--mc-text);font-size:8px;font-weight:850}

    .cw233-mc-overview-empty{min-height:100px;display:grid;place-items:center;align-content:center;gap:7px;text-align:center;color:var(--mc-muted);font-size:11px;line-height:1.35}.cw233-mc-overview-empty b{color:var(--mc-text);font-size:13px}
    @media(max-width:380px){.cw250-key-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}}
    @media(max-width:339px){.cw233-mc-overview-card{padding:12px}.cw233-mc-form-grid,.cw250-match-info-grid{grid-template-columns:1fr}.cw250-user-prediction{grid-template-columns:1fr}.cw250-user-prediction b{justify-self:start}.cw250-prediction-label{gap:3px}.cw250-prediction-label b{font-size:11px}}
  </style>`;
}

function formToken(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const candidate of [value.result, value.outcome, value.code, value.value, value.status, value.form]) {
      const token = formToken(candidate);
      if (token) return token;
    }
    return '';
  }
  return text(value).toUpperCase();
}

function formChip(value) {
  const raw = formToken(value);
  if (!raw) return '';
  const kind = ['W','WIN','WON','В'].includes(raw) ? 'is-win' : ['D','DRAW','Н'].includes(raw) ? 'is-draw' : ['L','LOSS','LOST','П'].includes(raw) ? 'is-loss' : '';
  const label = kind === 'is-win' ? 'В' : kind === 'is-draw' ? 'Н' : kind === 'is-loss' ? 'П' : raw.slice(0, 1);
  return `<span class="cw233-mc-form-chip ${kind}" title="${esc(raw)}">${esc(label)}</span>`;
}

function sectionTitle(title, note) {
  return `<div class="cw233-mc-overview-title"><span>${esc(title)}</span><b>${esc(note)}</b></div>`;
}

function metricValue(value, percent = false) {
  const number = finite(value);
  if (number === null) return '—';
  return percent ? `${fmt(number, 1)}%` : fmt(number);
}

function keyIndicatorsHtml(source = {}) {
  const summary = source?.summaryStats && typeof source.summaryStats === 'object' ? source.summaryStats : {};
  const home = summary.home && typeof summary.home === 'object' ? summary.home : {};
  const away = summary.away && typeof summary.away === 'object' ? summary.away : {};
  const definitions = [
    ['xg','xG',false],
    ['possession','Владение',true],
    ['shots','Удары',false],
    ['shotsOnTarget','В створ',false],
  ];
  const metrics = definitions.filter(([key]) => finite(home[key]) !== null || finite(away[key]) !== null);
  const best = source?.bestPlayer && typeof source.bestPlayer === 'object' ? source.bestPlayer : null;
  const recent = list(source?.recentEvents).slice(-4).reverse();
  if (!metrics.length && !best && !recent.length) return '';

  const metricHtml = metrics.length ? `<div class="cw250-key-metrics">${metrics.map(([key,label,pct]) => `<div class="cw250-key-metric"><span>${esc(label)}</span><div class="cw250-key-values"><strong>${esc(metricValue(home[key], pct))}</strong><i></i><strong>${esc(metricValue(away[key], pct))}</strong></div></div>`).join('')}</div>` : '';
  const rating = finite(best?.rating);
  const bestHtml = best && (text(best.name) || rating !== null) ? `<div class="cw250-best-player" data-cw250-best-player><div><small>Лучший игрок</small><strong>${esc(text(best.name) || 'Игрок')}</strong>${text(best.teamName) ? `<span>${esc(best.teamName)}</span>` : ''}</div><b>${rating === null ? '—' : esc(rating.toFixed(1))}</b></div>` : '';
  const recentHtml = recent.length ? `<div class="cw250-recent-events" data-cw250-recent-events>${recent.map(eventChip).join('')}</div>` : '';

  return `<section class="cw233-mc-overview-card" data-cw250-key-indicators>${sectionTitle('Ключевые показатели','Матч в цифрах')}${metricHtml}${bestHtml}${recentHtml}</section>`;
}

function eventClock(event = {}) {
  const minute = finite(event.minute);
  if (minute === null) return '';
  const added = finite(event.addedTime ?? event.added_time);
  return `${minute}${added !== null && added > 0 ? `+${added}` : ''}′`;
}

function eventChip(event = {}) {
  const type = text(event.type).toLowerCase();
  const clock = eventClock(event);
  let label = text(event.player || event.playerIn || event.player_in || event.text) || 'Событие';
  let glyph = '•';
  if (type.includes('goal')) glyph = '⚽';
  else if (type.includes('sub')) glyph = '↕';
  else if (type.includes('card')) glyph = text(event.cardKind || event.card_kind).includes('red') ? '■' : '◆';
  else if (type.includes('var')) glyph = 'VAR';
  return `<span class="cw250-event-chip"><b>${esc(glyph)}</b> ${esc(label)}${clock ? ` · ${esc(clock)}` : ''}</span>`;
}

function formHtml(value, match = {}) {
  const source = value && typeof value === 'object' ? value : {};
  const home = list(source.home).map(formChip).filter(Boolean);
  const away = list(source.away).map(formChip).filter(Boolean);
  if (!home.length && !away.length) return '';
  const homeName = text(match?.homeTeam?.name) || 'Хозяева';
  const awayName = text(match?.awayTeam?.name) || 'Гости';
  return `<section class="cw233-mc-overview-card" data-cw233-mc-overview-region="form">${sectionTitle('Форма','Последние 5 матчей')}<div class="cw233-mc-form-grid"><div class="cw233-mc-form-side"><strong>${esc(homeName)}</strong><div class="cw233-mc-form-run">${home.join('')}</div></div><div class="cw233-mc-form-side"><strong>${esc(awayName)}</strong><div class="cw233-mc-form-run">${away.join('')}</div></div></div></section>`;
}

function contextHtml(source = {}) {
  const venue = source?.venue && typeof source.venue === 'object' ? source.venue : {};
  const venueName = text(venue.name);
  const venueCity = text(venue.city);
  const capacity = finite(venue.capacity);
  const referee = text(source?.referee?.name);
  if (!venueName && !venueCity && capacity === null && !referee) return '';

  const venueHtml = venueName || venueCity ? `<div class="cw250-match-info-main"><small>Стадион${venueCity ? ' · город' : ''}</small><strong>${esc(venueName || venueCity)}</strong>${venueName && venueCity ? `<span>${esc(venueCity)}</span>` : ''}</div>` : '';
  const secondary = [];
  if (capacity !== null) secondary.push(`<div class="cw250-match-info-card"><small>Вместимость</small><strong>${esc(Math.round(capacity).toLocaleString('ru-RU'))}</strong></div>`);
  if (referee) secondary.push(`<div class="cw250-match-info-card"><small>Судья</small><strong>${esc(referee)}</strong></div>`);
  return `<section class="cw233-mc-overview-card" data-cw233-mc-overview-region="context">${sectionTitle('Информация о матче','Основная информация')}${venueHtml}${secondary.length ? `<div class="cw250-match-info-grid">${secondary.join('')}</div>` : ''}</section>`;
}

function predictionCountLabel(value) {
  const number = Math.max(0, Math.trunc(finite(value) ?? 0));
  const lastTwo = number % 100;
  const last = number % 10;
  const word = lastTwo >= 11 && lastTwo <= 14 ? 'прогнозов' : last === 1 ? 'прогноз' : last >= 2 && last <= 4 ? 'прогноза' : 'прогнозов';
  return `${number} ${word}`;
}

function predictionHtml(prediction, split, match = {}) {
  const model = prediction && typeof prediction === 'object' ? prediction : {};
  const distribution = split && typeof split === 'object' ? split : {};
  const homeScore = finite(model.homeScore ?? model.home_score ?? model.pred_home_score);
  const awayScore = finite(model.awayScore ?? model.away_score ?? model.pred_away_score);
  const points = finite(model.points);
  const [home, draw, away] = predictionPercentages(distribution);
  const total = finite(distribution.total);
  const exact = percentage(distribution.exactScoreProbability ?? distribution.exact_score_probability ?? distribution.scoreProbability);
  const popular = list(distribution.popularScores ?? distribution.popular_scores).map(item => {
    if (!item || typeof item !== 'object') return null;
    const score = text(item.score ?? item.value);
    const percent = percentage(item.percent ?? item.probability ?? item.share);
    return score ? { score, percent } : null;
  }).filter(Boolean).slice(0, 6);
  const hasUserScore = homeScore !== null && awayScore !== null;
  const hasSplit = [home, draw, away].some(value => value !== null);
  if (!hasUserScore && !hasSplit && exact === null && !popular.length) return '';

  const homeName = text(match?.homeTeam?.name) || 'Хозяева';
  const awayName = text(match?.awayTeam?.name) || 'Гости';
  const userHtml = hasUserScore ? `<div class="cw250-user-prediction"><div><small>Твой прогноз</small><strong>${esc(homeName)} — ${esc(awayName)}</strong>${points !== null ? `<span>${points >= 0 ? '+' : ''}${esc(Math.round(points))} оч.</span>` : ''}</div><b>${Math.round(homeScore)}:${Math.round(awayScore)}</b></div>` : '';

  const outcome = [
    ['П1',home,'home'],
    ['Ничья',draw,'draw'],
    ['П2',away,'away'],
  ];
  const homeWidth = home ?? 0;
  const drawWidth = draw ?? 0;
  const awayWidth = away ?? 0;
  const communityHtml = hasSplit ? `<div class="cw250-prediction-community" data-cw250-prediction-distribution><div class="cw250-prediction-community-head"><strong>Прогнозы пользователей</strong><span>${total === null ? 'Распределение' : esc(predictionCountLabel(total))}</span></div><div class="cw250-prediction-bar" aria-label="Распределение прогнозов"><i class="home" style="width:${homeWidth}%"></i><i class="draw" style="width:${drawWidth}%"></i><i class="away" style="width:${awayWidth}%"></i></div><div class="cw250-prediction-labels">${outcome.map(([label,value]) => `<div class="cw250-prediction-label"><i></i><span>${esc(label)}</span><b>${value === null ? '—' : `${Math.round(value)}%`}</b></div>`).join('')}</div></div>` : '';

  const exactHtml = exact !== null ? `<div class="cw250-exact-score" data-cw250-exact-score><span>Такой же счёт</span><strong>${Math.round(exact)}%</strong></div>` : '';
  const popularHtml = popular.length ? `<div class="cw250-popular-scores" data-cw250-popular-scores><span>Популярные счета</span><div class="cw250-popular-score-list">${popular.map(item => `<span class="cw250-popular-score">${esc(item.score)}${item.percent === null ? '' : ` · ${Math.round(item.percent)}%`}</span>`).join('')}</div></div>` : '';
  const extras = exactHtml || popularHtml ? `<div class="cw250-prediction-extras">${exactHtml}${popularHtml}</div>` : '';
  return `<section class="cw233-mc-overview-card" data-cw233-mc-overview-region="prediction">${sectionTitle('Прогнозы',total === null ? 'Матч пользователей' : predictionCountLabel(total))}${userHtml}${communityHtml}${extras}</section>`;
}

function emptyHtml() {
  return `<div class="cw233-mc-overview-empty" data-cw233-mc-overview-empty><b>Подробности матча пока не опубликованы</b><span>Они появятся здесь, когда провайдер добавит данные.</span></div>`;
}

export function renderMatchCenterOverview(section = {}, context = {}) {
  const source = section && typeof section === 'object' ? section : {};
  const blocks = [
    keyIndicatorsHtml(source),
    formHtml(source.form, context?.match),
    contextHtml(source),
    predictionHtml(source.prediction, source.predictionSplit, context?.match),
  ].filter(Boolean);
  return `${overviewStyles()}<div class="cw233-mc-overview" data-cw233-mc-overview>${blocks.length ? blocks.join('') : emptyHtml()}</div>`;
}