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

function scoreOf(prediction = {}) {
  const home = finite(prediction?.homeScore ?? prediction?.home_score ?? prediction?.pred_home_score);
  const away = finite(prediction?.awayScore ?? prediction?.away_score ?? prediction?.pred_away_score);
  return home === null || away === null ? '' : `${home}:${away}`;
}

function formHtml(form = {}, match = {}) {
  const home = list(form?.home).map(text).filter(Boolean);
  const away = list(form?.away).map(text).filter(Boolean);
  if (!home.length && !away.length) return '';
  const chips = values => values.map(value => {
    const result = value.slice(0, 1).toUpperCase();
    const key = result === 'W' ? 'win' : result === 'L' ? 'loss' : 'draw';
    return `<span class="cw233-mc-form-chip is-${key}">${esc(result || '—')}</span>`;
  }).join('');
  return `<section class="cw233-mc-overview-card" data-cw233-mc-overview-region="form">
    <div class="cw233-mc-overview-title"><span>Форма команд</span><b>Последние матчи</b></div>
    <div class="cw233-mc-form-row"><strong>${esc(match?.homeTeam?.name || 'Хозяева')}</strong><div>${chips(home)}</div></div>
    <div class="cw233-mc-form-row"><strong>${esc(match?.awayTeam?.name || 'Гости')}</strong><div>${chips(away)}</div></div>
  </section>`;
}

function matchInfoHtml(section = {}) {
  const venue = section?.venue && typeof section.venue === 'object' ? section.venue : {};
  const referee = section?.referee && typeof section.referee === 'object' ? section.referee : null;
  const venueName = text(venue?.name);
  const city = text(venue?.city);
  const capacity = finite(venue?.capacity);
  const refereeName = text(referee?.name);
  if (!venueName && !city && capacity === null && !refereeName) return '';
  const venueLine = [venueName, city].filter(Boolean).join(' · ');
  return `<section class="cw233-mc-overview-card" data-cw233-mc-overview-region="match-info">
    <div class="cw233-mc-overview-title"><span>О матче</span><b>Детали встречи</b></div>
    <div class="cw233-mc-info-grid">
      ${venueLine ? `<div><span>Стадион</span><strong>${esc(venueLine)}</strong></div>` : ''}
      ${capacity !== null ? `<div><span>Вместимость</span><strong>${esc(new Intl.NumberFormat('ru-RU').format(capacity))}</strong></div>` : ''}
      ${refereeName ? `<div><span>Судья</span><strong>${esc(refereeName)}</strong></div>` : ''}
    </div>
  </section>`;
}

function predictionSplitEntries(split) {
  if (!split || typeof split !== 'object') return [];
  const home = finite(split.home ?? split.homeWin ?? split.home_win);
  const draw = finite(split.draw);
  const away = finite(split.away ?? split.awayWin ?? split.away_win);
  return [
    ['П1', home],
    ['X', draw],
    ['П2', away],
  ].filter(([, value]) => value !== null);
}

function predictionsHtml(section = {}) {
  const prediction = section?.prediction && typeof section.prediction === 'object' ? section.prediction : null;
  const score = prediction ? scoreOf(prediction) : '';
  const split = predictionSplitEntries(section?.predictionSplit);
  if (!prediction && !split.length) return '';
  return `<section class="cw233-mc-overview-card" data-cw233-mc-overview-region="predictions">
    <div class="cw233-mc-overview-title"><span>Прогнозы</span><b>Перед матчем</b></div>
    ${prediction ? `<div class="cw233-mc-user-prediction"><span>Ваш прогноз</span><strong>${esc(score || 'Сохранён')}</strong></div>` : ''}
    ${split.length ? `<div class="cw233-mc-prediction-split">${split.map(([label, value]) => `<div><span>${label}</span><div class="cw233-mc-share-track"><i style="--mc-share:${Math.max(0, Math.min(100, value))}%"></i></div><b>${esc(value)}%</b></div>`).join('')}</div>` : ''}
  </section>`;
}

function momentumPoints(value) {
  const source = Array.isArray(value) ? value : list(value?.points);
  return source.map(point => {
    const minute = finite(point?.minute);
    const home = finite(point?.home);
    const away = finite(point?.away);
    if (home === null || away === null) return null;
    return { minute, home:Math.max(0, home), away:Math.max(0, away) };
  }).filter(Boolean);
}

function momentumHtml(value, covered) {
  const points = covered ? momentumPoints(value) : [];
  if (!points.length) return '';
  return `<section class="cw233-mc-overview-card" data-cw233-mc-overview-region="momentum">
    <div class="cw233-mc-overview-title"><span>Давление</span><b>Ход матча</b></div>
    <div class="cw233-mc-momentum">${points.map(point => {
      const total = point.home + point.away || 1;
      const home = Math.round(point.home / total * 100);
      const away = 100 - home;
      return `<div class="cw233-mc-momentum-row"><span>${point.minute === null ? '—' : `${point.minute}′`}</span><div><i class="home" style="--mc-momentum:${home}%"></i><i class="away" style="--mc-momentum:${away}%"></i></div></div>`;
    }).join('')}</div>
  </section>`;
}

function shotPoints(value) {
  const source = Array.isArray(value) ? value : list(value?.shots);
  return source.map(shot => {
    const x = finite(shot?.x);
    const y = finite(shot?.y);
    if (x === null || y === null) return null;
    const side = text(shot?.side).toLowerCase() === 'away' ? 'away' : 'home';
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
    <div class="cw233-mc-overview-title"><span>Карта ударов</span><b>${shots.length} ${shots.length === 1 ? 'удар' : 'ударов'}</b></div>
    <div class="cw233-mc-shotmap" aria-label="Карта ударов">${shots.map(shot => `<i class="${shot.side}" style="--mc-shot-x:${shot.x}%;--mc-shot-y:${shot.y}%;--mc-shot-size:${shot.xg === null ? 8 : Math.max(7, Math.min(18, 7 + shot.xg * 22))}px" title="${shot.xg === null ? '' : `xG ${esc(shot.xg)}`}"></i>`).join('')}</div>
  </section>`;
}

export function renderMatchCenterOverview(section = {}, context = {}) {
  const source = section && typeof section === 'object' ? section : {};
  const coverage = context?.coverage && typeof context.coverage === 'object' ? context.coverage : {};
  const blocks = [
    formHtml(source.form, context?.match || {}),
    matchInfoHtml(source),
    predictionsHtml(source),
    momentumHtml(source.momentum, coverage.momentum === true),
    shotmapHtml(source.shotmap, coverage.shotmap === true),
  ].filter(Boolean);

  return `<div class="cw233-mc-overview" data-cw233-mc-overview>${blocks.join('')}</div>`;
}
