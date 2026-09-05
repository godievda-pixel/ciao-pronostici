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
  return Number.isInteger(number) ? String(number) : number.toFixed(digits).replace(/0+$/, '').replace(/\.$/, '');
}

function overviewStyles() {
  return `<style data-cw233-mc-overview-parity-style>
    .cw233-mc-overview-title{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin:0 0 10px}.cw233-mc-overview-title span{color:var(--mc-text);font-size:13px;font-weight:900}.cw233-mc-overview-title b{color:var(--mc-muted);font-size:9px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;text-align:right}
    .cw233-mc-context-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
    .cw233-mc-context-card{min-width:0;padding:13px 12px;border:1px solid var(--mc-border);border-radius:13px;background:linear-gradient(145deg,var(--mc-surface),rgba(255,255,255,.025))}
    .cw233-mc-context-card span{display:block;margin-bottom:6px;color:var(--mc-muted);font-size:9px;font-weight:800;letter-spacing:.07em;text-transform:uppercase}
    .cw233-mc-context-card strong{display:block;color:var(--mc-text);font-size:12px;line-height:1.3;font-weight:900;overflow-wrap:anywhere}
    .cw233-mc-context-card small{display:block;margin-top:5px;color:var(--mc-muted);font-size:10px;line-height:1.3}
    .cw233-mc-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.cw233-mc-form-side{min-width:0;padding:12px;border:1px solid var(--mc-border);border-radius:13px;background:rgba(255,255,255,.025)}.cw233-mc-form-side>strong{display:block;margin-bottom:9px;color:var(--mc-text);font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.cw233-mc-form-run{display:flex;gap:5px;flex-wrap:wrap}.cw233-mc-form-chip{width:22px;height:22px;display:grid;place-items:center;border-radius:7px;background:rgba(255,255,255,.065);color:var(--mc-muted);font-size:9px;font-weight:950}.cw233-mc-form-chip.is-win{background:rgba(52,211,153,.16);color:#8ff0c8}.cw233-mc-form-chip.is-draw{background:rgba(255,255,255,.09);color:var(--mc-text)}.cw233-mc-form-chip.is-loss{background:rgba(248,113,113,.15);color:#ffb0b0}
    .cw233-mc-prediction-score{display:grid;place-items:center;gap:4px;padding:12px 8px 14px}.cw233-mc-prediction-score strong{font-size:27px;line-height:1;font-weight:950;letter-spacing:-.04em;color:var(--mc-text)}.cw233-mc-prediction-score span{font-size:9px;color:var(--mc-muted);font-weight:800;text-transform:uppercase;letter-spacing:.05em}.cw233-mc-prediction-split{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.cw233-mc-prediction-outcome{padding:9px 5px;border-radius:10px;background:rgba(255,255,255,.045);text-align:center}.cw233-mc-prediction-outcome strong{display:block;color:var(--mc-text);font-size:13px}.cw233-mc-prediction-outcome span{display:block;margin-top:4px;color:var(--mc-muted);font-size:8px;font-weight:800;text-transform:uppercase}
    .cw233-mc-overview-empty{min-height:100px;display:grid;place-items:center;align-content:center;gap:7px;text-align:center;color:var(--mc-muted);font-size:11px;line-height:1.35}
    .cw233-mc-overview-empty b{color:var(--mc-text);font-size:13px}
    .cw233-mc-key-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
    .cw233-mc-key{min-width:0;padding:13px 8px;border-radius:13px;background:rgba(255,255,255,.045);text-align:center}
    .cw233-mc-key strong{display:block;font-size:18px;line-height:1;color:var(--mc-text);font-weight:900}
    .cw233-mc-key span{display:block;margin-top:6px;font-size:9px;line-height:1.2;color:var(--mc-muted);font-weight:700}
    .cw233-mc-chart-pad{padding:0 3px 2px}
    .cw233-mc-momentum-chart{height:96px;display:flex;align-items:center;gap:1px;position:relative;padding:7px 0}
    .cw233-mc-momentum-chart::after{content:'';position:absolute;left:0;right:0;top:50%;height:1px;background:rgba(255,255,255,.12)}
    .cw233-mc-momentum-bar{flex:1;height:100%;position:relative;min-width:1px}
    .cw233-mc-momentum-bar i{position:absolute;left:0;right:0;height:var(--mc-momentum-height);max-height:45%;min-height:2px;border-radius:2px;opacity:.88;background:var(--mc-accent)}
    .cw233-mc-momentum-bar.is-home i{bottom:50%}
    .cw233-mc-momentum-bar.is-away i{top:50%;background:var(--mc-accent-2);opacity:.68}
    @media (max-width:380px){.cw233-mc-context-grid,.cw233-mc-form-grid{grid-template-columns:1fr}}
  </style>`;
}

function contextHtml(source = {}) {
  const venue = source?.venue && typeof source.venue === 'object' ? source.venue : {};
  const venueName = text(venue.name);
  const venueCity = text(venue.city);
  const venueCapacity = finite(venue.capacity);
  const refereeName = text(source?.referee?.name);
  const cards = [];

  if (venueName || venueCity || venueCapacity !== null) {
    const primary = venueName || venueCity || 'Место проведения';
    const detail = [
      venueName && venueCity ? venueCity : '',
      venueCapacity !== null ? `${Math.round(venueCapacity).toLocaleString('ru-RU')} мест` : '',
    ].filter(Boolean).join(' · ');
    cards.push(`<div class="cw233-mc-context-card"><span>Стадион</span><strong>${esc(primary)}</strong>${detail ? `<small>${esc(detail)}</small>` : ''}</div>`);
  }

  if (refereeName) {
    cards.push(`<div class="cw233-mc-context-card"><span>Судья</span><strong>${esc(refereeName)}</strong></div>`);
  }

  if (!cards.length) return '';
  return `<section class="cw233-mc-overview-card" data-cw233-mc-overview-region="context">
    <div class="cw233-mc-overview-title"><span>О матче</span><b>Основная информация</b></div>
    <div class="cw233-mc-context-grid">${cards.join('')}</div>
  </section>`;
}

function formToken(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const candidates = [value.result, value.outcome, value.code, value.value, value.status, value.form];
    for (const candidate of candidates) {
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

function formHtml(value, match = {}) {
  const source = value && typeof value === 'object' ? value : {};
  const home = list(source.home).map(formChip).filter(Boolean);
  const away = list(source.away).map(formChip).filter(Boolean);
  if (!home.length && !away.length) return '';
  const homeName = text(match?.homeTeam?.name) || 'Хозяева';
  const awayName = text(match?.awayTeam?.name) || 'Гости';
  return `<section class="cw233-mc-overview-card" data-cw233-mc-overview-region="form">
    <div class="cw233-mc-overview-title"><span>Форма</span><b>Последние матчи</b></div>
    <div class="cw233-mc-form-grid">
      <div class="cw233-mc-form-side"><strong>${esc(homeName)}</strong><div class="cw233-mc-form-run">${home.join('')}</div></div>
      <div class="cw233-mc-form-side"><strong>${esc(awayName)}</strong><div class="cw233-mc-form-run">${away.join('')}</div></div>
    </div>
  </section>`;
}

function percent(value) {
  const number = finite(value);
  if (number === null) return null;
  const normalized = Math.abs(number) <= 1 ? number * 100 : number;
  return Math.max(0, Math.min(100, normalized));
}

function predictionCountLabel(value) {
  const number = Math.max(0, Math.trunc(finite(value) ?? 0));
  const lastTwo = number % 100;
  const last = number % 10;
  const word = lastTwo >= 11 && lastTwo <= 14
    ? 'прогнозов'
    : last === 1
      ? 'прогноз'
      : last >= 2 && last <= 4
        ? 'прогноза'
        : 'прогнозов';
  return `${number} ${word}`;
}

function predictionHtml(prediction, split) {
  const model = prediction && typeof prediction === 'object' ? prediction : {};
  const result = split && typeof split === 'object' ? split : {};
  const homeScore = finite(model.homeScore ?? model.home_score ?? model.pred_home_score);
  const awayScore = finite(model.awayScore ?? model.away_score ?? model.pred_away_score);
  const home = percent(result.home ?? result.prob_home ?? result.probHome);
  const draw = percent(result.draw ?? result.prob_draw ?? result.probDraw);
  const away = percent(result.away ?? result.prob_away ?? result.probAway);
  const total = finite(result.total);
  const points = finite(model.points);
  const userPrediction = text(model.kind).toLowerCase() === 'user' || total !== null;
  const hasScore = homeScore !== null || awayScore !== null;
  const hasSplit = [home, draw, away].some(item => item !== null);
  if (!hasScore && !hasSplit) return '';
  const score = `${homeScore === null ? '—' : Math.round(homeScore)}:${awayScore === null ? '—' : Math.round(awayScore)}`;
  const outcomes = [
    ['П1', home],
    ['Х', draw],
    ['П2', away],
  ];
  const heading = userPrediction ? 'Прогнозы пользователей' : 'Прогноз';
  const headingMeta = userPrediction
    ? (total === null ? 'Распределение' : predictionCountLabel(total))
    : 'Модель матча';
  const scoreLabel = userPrediction
    ? `Твой прогноз${points === null ? '' : ` · ${Math.round(points)} оч.`}`
    : 'ожидаемый счёт';
  return `<section class="cw233-mc-overview-card" data-cw233-mc-overview-region="prediction">
    <div class="cw233-mc-overview-title"><span>${heading}</span><b>${esc(headingMeta)}</b></div>
    ${hasScore ? `<div class="cw233-mc-prediction-score"><strong>${esc(score)}</strong><span>${esc(scoreLabel)}</span></div>` : ''}
    ${hasSplit ? `<div class="cw233-mc-prediction-split">${outcomes.map(([label, value]) => `<div class="cw233-mc-prediction-outcome"><strong>${value === null ? '—' : `${Math.round(value)}%`}</strong><span>${label}</span></div>`).join('')}</div>` : ''}
  </section>`;
}

function summaryStatsHtml(summary = {}) {
  const home = summary?.home && typeof summary.home === 'object' ? summary.home : {};
  const away = summary?.away && typeof summary.away === 'object' ? summary.away : {};
  const homeXg = finite(home.xg);
  const awayXg = finite(away.xg);
  const homeShots = finite(home.shots);
  const awayShots = finite(away.shots);
  const hasAny = [homeXg, awayXg, homeShots, awayShots].some(value => value !== null);
  if (!hasAny) return '';
  const totalShots = homeShots === null && awayShots === null
    ? null
    : (homeShots || 0) + (awayShots || 0);
  return `<section class="cw233-mc-overview-card" data-cw233-mc-overview-region="main">
    <div class="cw233-mc-overview-title"><span>Главное</span><b>Матч в цифрах</b></div>
    <div class="cw233-mc-key-grid">
      <div class="cw233-mc-key"><strong>${esc(fmt(homeXg))}</strong><span>xG хозяев</span></div>
      <div class="cw233-mc-key"><strong>${esc(fmt(totalShots, 0))}</strong><span>ударов</span></div>
      <div class="cw233-mc-key"><strong>${esc(fmt(awayXg))}</strong><span>xG гостей</span></div>
    </div>
  </section>`;
}

function momentumPoints(value) {
  const source = Array.isArray(value) ? value : list(value?.points);
  return source.map(point => {
    const minute = finite(point?.minute);
    const home = finite(point?.home);
    const away = finite(point?.away);
    if (home === null || away === null) return null;
    return { minute, signed:home - away };
  }).filter(Boolean);
}

function momentumHtml(value, covered) {
  const points = covered ? momentumPoints(value) : [];
  if (!points.length) return '';
  const max = Math.max(1, ...points.map(point => Math.abs(point.signed)));
  return `<section class="cw233-mc-overview-card" data-cw233-mc-overview-region="momentum">
    <div class="cw233-mc-overview-title"><span>Давление</span><b>по минутам</b></div>
    <div class="cw233-mc-chart-pad"><div class="cw233-mc-momentum-chart" aria-label="Давление по ходу матча">${points.map(point => {
      const height = Math.max(2, Math.abs(point.signed) / max * 44);
      const side = point.signed >= 0 ? 'is-home' : 'is-away';
      const minute = point.minute === null ? '' : ` data-minute="${esc(point.minute)}"`;
      return `<span class="cw233-mc-momentum-bar ${side}"${minute}><i style="--mc-momentum-height:${height.toFixed(2)}%"></i></span>`;
    }).join('')}</div></div>
  </section>`;
}

function shotPoints(value) {
  const source = Array.isArray(value) ? value : list(value?.shots);
  return source.map(shot => {
    const x = finite(shot?.x);
    const y = finite(shot?.y);
    if (x === null || y === null) return null;
    const side = String(shot?.side ?? '').trim().toLowerCase() === 'away' ? 'away' : 'home';
    const xg = finite(shot?.xg);
    return {
      side,
      x:Math.max(0, Math.min(100, x)),
      y:Math.max(0, Math.min(100, y)),
      xg,
    };
  }).filter(Boolean);
}

function shotmapHtml(value, covered) {
  const shots = covered ? shotPoints(value) : [];
  if (!shots.length) return '';
  return `<section class="cw233-mc-overview-card" data-cw233-mc-overview-region="shotmap">
    <div class="cw233-mc-overview-title"><span>Карта ударов</span><b>точки · xG</b></div>
    <div class="cw233-mc-shotmap" aria-label="Карта ударов">${shots.map(shot => `<i class="${shot.side}" style="--mc-shot-x:${shot.x}%;--mc-shot-y:${shot.y}%;--mc-shot-size:${shot.xg === null ? 8 : Math.max(7, Math.min(18, 7 + shot.xg * 22))}px" title="${shot.xg === null ? '' : `xG ${esc(shot.xg)}`}"></i>`).join('')}</div>
  </section>`;
}

function emptyHtml() {
  return `<div class="cw233-mc-overview-empty" data-cw233-mc-overview-empty>
    <b>Подробности матча пока не опубликованы</b>
    <span>Они появятся здесь, когда провайдер добавит данные.</span>
  </div>`;
}

export function renderMatchCenterOverview(section = {}, context = {}) {
  const source = section && typeof section === 'object' ? section : {};
  const coverage = context?.coverage && typeof context.coverage === 'object' ? context.coverage : {};
  const blocks = [
    contextHtml(source),
    formHtml(source.form, context?.match),
    predictionHtml(source.prediction, source.predictionSplit),
    summaryStatsHtml(source.summaryStats),
    momentumHtml(source.momentum, coverage.momentum === true),
    shotmapHtml(source.shotmap, coverage.shotmap === true),
  ].filter(Boolean);

  return `${overviewStyles()}<div class="cw233-mc-overview" data-cw233-mc-overview>${blocks.length ? blocks.join('') : emptyHtml()}</div>`;
}
