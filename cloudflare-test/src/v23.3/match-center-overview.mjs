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
    .cw233-mc-context-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
    .cw233-mc-context-card{min-width:0;padding:13px 12px;border:1px solid var(--mc-border);border-radius:13px;background:linear-gradient(145deg,var(--mc-surface),rgba(255,255,255,.025))}
    .cw233-mc-context-card span{display:block;margin-bottom:6px;color:var(--mc-muted);font-size:9px;font-weight:800;letter-spacing:.07em;text-transform:uppercase}
    .cw233-mc-context-card strong{display:block;color:var(--mc-text);font-size:12px;line-height:1.3;font-weight:900;overflow-wrap:anywhere}
    .cw233-mc-context-card small{display:block;margin-top:5px;color:var(--mc-muted);font-size:10px;line-height:1.3}
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
    @media (max-width:380px){.cw233-mc-context-grid{grid-template-columns:1fr}}
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
    summaryStatsHtml(source.summaryStats),
    momentumHtml(source.momentum, coverage.momentum === true),
    shotmapHtml(source.shotmap, coverage.shotmap === true),
  ].filter(Boolean);

  return `${overviewStyles()}<div class="cw233-mc-overview" data-cw233-mc-overview>${blocks.length ? blocks.join('') : emptyHtml()}</div>`;
}
