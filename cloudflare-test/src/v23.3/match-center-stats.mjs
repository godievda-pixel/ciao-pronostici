const PRIMARY_STAT_DEFINITIONS = Object.freeze([
  ['xg', 'xG', false],
  ['possession', 'Владение', true],
  ['shots', 'Удары', false],
  ['shotsOnTarget', 'В створ', false],
  ['bigChances', 'Большие моменты', false],
  ['corners', 'Угловые', false],
]);

const SECONDARY_STAT_DEFINITIONS = Object.freeze([
  ['fouls', 'Фолы', false],
  ['offsides', 'Офсайды', false],
  ['yellowCards', 'Жёлтые карточки', false],
  ['redCards', 'Красные карточки', false],
  ['saves', 'Сейвы', false],
  ['passAccuracy', 'Точность передач', true],
  ['interceptions', 'Перехваты', false],
  ['tackles', 'Отборы', false],
]);

const EXTENDED_STAT_DEFINITIONS = SECONDARY_STAT_DEFINITIONS;

const STAT_DEFINITIONS = Object.freeze([
  ...PRIMARY_STAT_DEFINITIONS,
  ...SECONDARY_STAT_DEFINITIONS,
]);

const OUTCOME_LABELS = Object.freeze({
  goal:'Гол',
  saved:'В створ · сейв',
  off_target:'Мимо',
  blocked:'Заблокирован',
  post:'Штанга / перекладина',
  unknown:'Удар',
});

const SITUATION_LABELS = Object.freeze({
  penalty:'Пенальти',
  free_kick:'Штрафной',
  corner:'После углового',
  set_piece:'Стандарт',
  open_play:'С игры',
  unknown:'',
});

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

function display(value, percent) {
  const number = finite(value);
  if (number === null) return '—';
  return percent ? `${number}%` : String(number);
}

function shares(homeValue, awayValue) {
  const home = Math.max(0, finite(homeValue) ?? 0);
  const away = Math.max(0, finite(awayValue) ?? 0);
  const total = home + away;
  if (!total) return [50, 50];
  const homeShare = Math.max(0, Math.min(100, (home / total) * 100));
  return [homeShare, 100 - homeShare];
}

function hasStat(key, home, away) {
  return finite(home?.[key]) !== null || finite(away?.[key]) !== null;
}

function statRow(key, label, percent, home, away, secondary = false) {
  if (!hasStat(key, home, away)) return '';
  const [homeShare, awayShare] = shares(home?.[key], away?.[key]);
  const secondaryMarker = secondary ? ` data-cw250-mc-secondary-stat="${key}"` : '';
  return `<div class="cw233-mc-stat-row" data-cw233-mc-stat="${key}"${secondaryMarker} style="--mc-stat-home:${homeShare.toFixed(2)}%;--mc-stat-away:${awayShare.toFixed(2)}%">
    <div class="cw233-mc-stat-row-values"><strong>${esc(display(home?.[key], percent))}</strong><span>${esc(label)}</span><strong>${esc(display(away?.[key], percent))}</strong></div>
    <div class="cw233-mc-stat-bars" aria-hidden="true"><i class="home"></i><i class="away"></i></div>
  </div>`;
}

function statGroup(kind, definitions, home, away) {
  const secondary = kind === 'extended';
  const rows = definitions.map(([key, label, percent]) => statRow(key, label, percent, home, away, secondary)).filter(Boolean);
  if (!rows.length) return '';
  const title = secondary ? '<div class="cw233-mc-stat-group-title">Другие показатели</div>' : '';
  return `<div class="cw233-mc-stat-group" data-cw233-mc-stats-section="${kind}">${title}${rows.join('')}</div>`;
}

function pressurePoint(point, index) {
  if (!point || typeof point !== 'object') return '';
  const home = finite(point.home);
  const away = finite(point.away);
  if (home === null || away === null) return '';
  const [homeShare, awayShare] = shares(home, away);
  const minute = finite(point.minute ?? point.m);
  return `<div class="cw250-mc-pressure-row" data-cw250-mc-pressure-point="${index}" style="--mc-pressure-home:${homeShare.toFixed(2)}%;--mc-pressure-away:${awayShare.toFixed(2)}%">
    <span class="cw250-mc-pressure-value home">${esc(home)}</span>
    <div class="cw250-mc-pressure-bars" aria-hidden="true"><i class="home"></i><i class="away"></i></div>
    <span class="cw250-mc-pressure-minute">${minute === null ? '' : `${esc(minute)}′`}</span>
    <span class="cw250-mc-pressure-value away">${esc(away)}</span>
  </div>`;
}

function pressureBlock(momentum) {
  const rows = (Array.isArray(momentum) ? momentum : []).map(pressurePoint).filter(Boolean);
  if (!rows.length) return '';
  return `<section class="cw250-mc-pressure" data-cw250-mc-pressure>
    <div class="cw233-mc-subheading"><strong>Давление матча</strong><span>по ходу встречи</span></div>
    <div class="cw250-mc-pressure-list">${rows.join('')}</div>
  </section>`;
}

function shotClock(shot = {}) {
  const minute = finite(shot.minute);
  if (minute === null) return '';
  const added = finite(shot.addedTime ?? shot.added_time);
  return `${minute}${added !== null && added > 0 ? `+${added}` : ''}′`;
}

function outcomeLabel(value) {
  const key = String(value || '').trim().toLowerCase();
  return OUTCOME_LABELS[key] || OUTCOME_LABELS.unknown;
}

function situationLabel(value) {
  const key = String(value || '').trim().toLowerCase();
  return SITUATION_LABELS[key] ?? '';
}

function shotTeamName(shot, homeName, awayName) {
  return String(shot?.side || '').toLowerCase() === 'away' ? awayName : homeName;
}

function shotAria(shot, homeName, awayName) {
  const parts = [];
  const player = String(shot?.player || '').trim();
  const clock = shotClock(shot);
  if (player) parts.push(player);
  if (clock) parts.push(clock);
  parts.push(outcomeLabel(shot?.outcome));
  const xg = finite(shot?.xg);
  if (xg !== null) parts.push(`xG ${xg}`);
  parts.push(shotTeamName(shot, homeName, awayName));
  return parts.join(', ');
}

function shotMarker(shot, index, homeName, awayName) {
  const x = finite(shot?.x);
  const y = finite(shot?.y);
  if (x === null || y === null || x < 0 || x > 100 || y < 0 || y > 100) return '';
  const side = String(shot?.side || '').toLowerCase() === 'away' ? 'away' : 'home';
  const outcome = String(shot?.outcome || 'unknown').trim().toLowerCase();
  const penalty = String(shot?.situation || '').trim().toLowerCase() === 'penalty' || String(shot?.goalKind || '').trim().toLowerCase() === 'penalty';
  const xg = finite(shot?.xg);
  const size = xg === null ? 10 : Math.max(9, Math.min(18, 9 + xg * 10));
  const classes = ['cw233-mc-shot-marker', `is-${side}`, `is-${outcome}`];
  if (penalty) classes.push('is-penalty');
  return `<span class="${classes.join(' ')}" data-cw233-mc-shot-marker="${index}" role="img" aria-label="${esc(shotAria(shot, homeName, awayName))}" style="--shot-x:${x}%;--shot-y:${y}%;--shot-size:${size.toFixed(1)}px"></span>`;
}

function shotMap(shots, homeName, awayName) {
  const markers = shots.map((shot, index) => shotMarker(shot, index, homeName, awayName)).filter(Boolean).join('');
  if (!markers) return '';
  return `<section class="cw233-mc-shot-analysis" data-cw233-mc-shotmap>
    <div class="cw233-mc-subheading"><strong>Карта ударов</strong><span>${esc(homeName)} · ${esc(awayName)}</span></div>
    <div class="cw233-mc-pitch" role="img" aria-label="Карта ударов матча">
      <i class="cw233-mc-pitch-half" aria-hidden="true"></i><i class="cw233-mc-pitch-circle" aria-hidden="true"></i><i class="cw233-mc-pitch-box home" aria-hidden="true"></i><i class="cw233-mc-pitch-box away" aria-hidden="true"></i>
      ${markers}
    </div>
    <div class="cw233-mc-shot-legend"><span><i class="home"></i>${esc(homeName)}</span><span><i class="away"></i>${esc(awayName)}</span><span><i class="goal"></i>Гол</span></div>
  </section>`;
}

function shotRow(shot, index, homeName, awayName) {
  const clock = shotClock(shot);
  const player = String(shot?.player || '').trim() || 'Удар';
  const team = shotTeamName(shot, homeName, awayName);
  const outcome = outcomeLabel(shot?.outcome);
  const situation = situationLabel(shot?.situation);
  const assist = String(shot?.assist || '').trim();
  const xg = finite(shot?.xg);
  const meta = [team, outcome, situation].filter(Boolean);
  return `<article class="cw233-mc-shot-row is-${String(shot?.side || '').toLowerCase() === 'away' ? 'away' : 'home'}" data-cw233-mc-shot-row="${index}">
    <time>${esc(clock || '—')}</time>
    <div class="cw233-mc-shot-row-main"><strong>${esc(player)}</strong><span>${esc(meta.join(' · '))}</span>${assist ? `<small>Ассист: ${esc(assist)}</small>` : ''}</div>
    ${xg !== null ? `<b class="cw233-mc-shot-xg"><small>xG</small>${esc(xg)}</b>` : '<span class="cw233-mc-shot-xg is-empty" aria-hidden="true"></span>'}
  </article>`;
}

function shotList(shots, homeName, awayName) {
  if (!shots.length) return '';
  return `<section class="cw233-mc-shot-list-wrap" data-cw233-mc-shot-list>
    <div class="cw233-mc-subheading"><strong>Все удары</strong><span>${shots.length}</span></div>
    <div class="cw233-mc-shot-list">${shots.map((shot, index) => shotRow(shot, index, homeName, awayName)).join('')}</div>
  </section>`;
}

function keyMetric(home, away, key, label, percent = false) {
  if (!hasStat(key, home, away)) return '';
  return `<div class="cw233-mc-key-metric"><strong>${esc(display(home?.[key], percent))}</strong><span>${esc(label)}</span><strong>${esc(display(away?.[key], percent))}</strong></div>`;
}

function keyMetrics(home, away) {
  const metrics = [
    keyMetric(home, away, 'xg', 'xG'),
    keyMetric(home, away, 'shots', 'Удары'),
    keyMetric(home, away, 'shotsOnTarget', 'В створ'),
  ].filter(Boolean);
  return metrics.length ? `<div class="cw233-mc-key-metrics">${metrics.join('')}</div>` : '';
}

function statsStyles() {
  return `<style data-cw233-mc-stats-parity-style>
    .cw233-mc-stats{display:grid;gap:10px}.cw233-mc-stats .cw233-mc-section-heading{margin-bottom:0}
    .cw233-mc-key-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}.cw233-mc-key-metric{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:4px;padding:10px 7px;border:1px solid var(--mc-border);border-radius:14px;background:linear-gradient(145deg,var(--mc-surface-2,rgba(255,255,255,.035)),rgba(255,255,255,.018))}.cw233-mc-key-metric strong{font-size:11px;font-weight:950;color:var(--mc-text)}.cw233-mc-key-metric strong:last-child{text-align:right}.cw233-mc-key-metric span{font-size:8px;font-weight:850;color:var(--mc-muted);text-align:center}
    .cw233-mc-stat-group{padding:2px 14px 8px;border:1px solid var(--mc-border);border-radius:17px;background:linear-gradient(160deg,var(--mc-surface,rgba(255,255,255,.025)),rgba(255,255,255,.016))}.cw233-mc-stat-group-title{padding:11px 0 5px;font-size:9px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:var(--mc-muted)}.cw233-mc-stat-row{padding:9px 0;border-bottom:1px solid rgba(255,255,255,.06)}.cw233-mc-stat-row:last-child{border-bottom:0}.cw233-mc-stat-row-values{display:grid;grid-template-columns:52px minmax(0,1fr) 52px;align-items:center;gap:8px}.cw233-mc-stat-row-values strong{font-size:11px;font-weight:900;color:var(--mc-text)}.cw233-mc-stat-row-values strong:last-child{text-align:right}.cw233-mc-stat-row-values span{text-align:center;font-size:10px;font-weight:700;line-height:1.15;color:var(--mc-muted)}.cw233-mc-stat-bars{display:grid;grid-template-columns:1fr 1fr;gap:4px;height:3px;margin-top:7px}.cw233-mc-stat-bars i{display:block;position:relative;overflow:hidden;border-radius:99px;background:rgba(255,255,255,.07)}.cw233-mc-stat-bars i::before{content:'';position:absolute;top:0;bottom:0;border-radius:99px;background:var(--mc-accent)}.cw233-mc-stat-bars i.home::before{right:0;width:var(--mc-stat-home)}.cw233-mc-stat-bars i.away::before{left:0;width:var(--mc-stat-away);background:var(--mc-accent-2)}
    .cw250-mc-stats-primary,.cw250-mc-stats-secondary{display:grid}.cw250-mc-stats-secondary .cw233-mc-stat-group{background:linear-gradient(160deg,var(--mc-surface-2,rgba(255,255,255,.035)),rgba(255,255,255,.012))}
    .cw250-mc-pressure{display:grid;gap:9px;padding:11px;border:1px solid var(--mc-border);border-radius:18px;background:linear-gradient(160deg,var(--mc-surface-2,rgba(255,255,255,.035)),rgba(255,255,255,.016));box-shadow:inset 0 1px 0 rgba(255,255,255,.035)}.cw250-mc-pressure-list{display:grid;gap:7px}.cw250-mc-pressure-row{display:grid;grid-template-columns:30px minmax(0,1fr) 30px 30px;align-items:center;gap:6px}.cw250-mc-pressure-value{font-size:9px;font-weight:900;color:var(--mc-text)}.cw250-mc-pressure-value.away{text-align:right}.cw250-mc-pressure-minute{text-align:center;font-size:8px;font-weight:850;color:var(--mc-muted)}.cw250-mc-pressure-bars{display:grid;grid-template-columns:1fr 1fr;gap:3px;height:5px}.cw250-mc-pressure-bars i{position:relative;overflow:hidden;border-radius:99px;background:rgba(255,255,255,.07)}.cw250-mc-pressure-bars i::before{content:'';position:absolute;inset-block:0;border-radius:99px}.cw250-mc-pressure-bars i.home::before{right:0;width:var(--mc-pressure-home);background:var(--mc-accent)}.cw250-mc-pressure-bars i.away::before{left:0;width:var(--mc-pressure-away);background:var(--mc-accent-2)}
    .cw233-mc-shot-analysis,.cw233-mc-shot-list-wrap{display:grid;gap:8px;padding:11px;border:1px solid var(--mc-border);border-radius:18px;background:linear-gradient(160deg,var(--mc-surface-2,rgba(255,255,255,.035)),rgba(255,255,255,.016));box-shadow:inset 0 1px 0 rgba(255,255,255,.035)}.cw233-mc-subheading{display:flex;align-items:center;justify-content:space-between;gap:10px}.cw233-mc-subheading strong{font-size:11px;font-weight:950;color:var(--mc-text)}.cw233-mc-subheading span{font-size:8px;font-weight:800;color:var(--mc-muted);text-align:right}
    .cw233-mc-pitch{position:relative;aspect-ratio:68/100;max-height:390px;width:min(100%,266px);margin:0 auto;border:1px solid var(--mc-pitch-line,rgba(255,255,255,.18));border-radius:15px;background:linear-gradient(180deg,color-mix(in srgb,var(--mc-pitch,#0b3550) 93%,#fff 7%),var(--mc-pitch,#0b3550));overflow:hidden;box-shadow:inset 0 0 38px rgba(0,0,0,.17)}.cw233-mc-pitch::before{content:'';position:absolute;inset:4%;border:1px solid var(--mc-pitch-line,rgba(255,255,255,.18));border-radius:3px}.cw233-mc-pitch-half{position:absolute;left:4%;right:4%;top:50%;height:1px;background:var(--mc-pitch-line,rgba(255,255,255,.18))}.cw233-mc-pitch-circle{position:absolute;left:50%;top:50%;width:25%;aspect-ratio:1;border:1px solid var(--mc-pitch-line,rgba(255,255,255,.18));border-radius:50%;transform:translate(-50%,-50%)}.cw233-mc-pitch-box{position:absolute;left:27%;width:46%;height:14%;border:1px solid var(--mc-pitch-line,rgba(255,255,255,.18))}.cw233-mc-pitch-box.home{bottom:4%;border-bottom:0}.cw233-mc-pitch-box.away{top:4%;border-top:0}.cw233-mc-shot-marker{position:absolute;left:var(--shot-x);bottom:var(--shot-y);width:var(--shot-size);height:var(--shot-size);border:2px solid rgba(255,255,255,.72);border-radius:50%;transform:translate(-50%,50%);background:var(--mc-home-marker,var(--mc-accent));box-shadow:0 3px 10px rgba(0,0,0,.32);z-index:2}.cw233-mc-shot-marker.is-away{background:var(--mc-away-marker,var(--mc-accent-2))}.cw233-mc-shot-marker.is-saved{border-radius:35%}.cw233-mc-shot-marker.is-blocked{opacity:.72}.cw233-mc-shot-marker.is-goal{border-color:#fff;box-shadow:0 0 0 3px color-mix(in srgb,var(--mc-accent) 30%,transparent),0 4px 13px rgba(0,0,0,.38)}.cw233-mc-shot-marker.is-penalty::after{content:'P';position:absolute;inset:50% auto auto 50%;transform:translate(-50%,-50%);font-size:6px;font-weight:950;color:#07101d}.cw233-mc-shot-legend{display:flex;flex-wrap:wrap;gap:7px 12px;justify-content:center}.cw233-mc-shot-legend span{display:flex;align-items:center;gap:4px;font-size:8px;color:var(--mc-muted)}.cw233-mc-shot-legend i{width:7px;height:7px;border-radius:50%;background:var(--mc-home-marker,var(--mc-accent))}.cw233-mc-shot-legend i.away{background:var(--mc-away-marker,var(--mc-accent-2))}.cw233-mc-shot-legend i.goal{border:1px solid #fff;background:var(--mc-accent)}
    .cw233-mc-shot-list{display:grid}.cw233-mc-shot-row{display:grid;grid-template-columns:38px minmax(0,1fr) 42px;align-items:center;gap:8px;min-height:54px;padding:8px 2px;border-top:1px solid rgba(255,255,255,.06)}.cw233-mc-shot-row:first-child{border-top:0}.cw233-mc-shot-row time{font-size:9px;font-weight:900;color:var(--mc-muted)}.cw233-mc-shot-row-main{min-width:0}.cw233-mc-shot-row-main strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px;font-weight:900;color:var(--mc-text)}.cw233-mc-shot-row-main span,.cw233-mc-shot-row-main small{display:block;margin-top:2px;font-size:8px;line-height:1.25;color:var(--mc-muted)}.cw233-mc-shot-xg{justify-self:end;display:grid;text-align:right;font-size:10px;font-weight:950;color:var(--mc-text)}.cw233-mc-shot-xg small{font-size:7px;color:var(--mc-muted)}.cw233-mc-shot-xg.is-empty{min-width:1px}
    @media(max-width:339px){.cw233-mc-key-metrics{gap:4px}.cw233-mc-key-metric{padding-left:4px;padding-right:4px}.cw233-mc-pitch{width:min(100%,232px)}.cw233-mc-shot-row{grid-template-columns:32px minmax(0,1fr) 36px;gap:6px}.cw250-mc-pressure-row{grid-template-columns:26px minmax(0,1fr) 28px 26px;gap:4px}}
  </style>`;
}

export function renderMatchCenterStats(section = {}, context = {}) {
  const source = section && typeof section === 'object' ? section : {};
  const home = source.home && typeof source.home === 'object' ? source.home : {};
  const away = source.away && typeof source.away === 'object' ? source.away : {};
  const shots = Array.isArray(source.shots) ? source.shots.filter(shot => shot && typeof shot === 'object') : [];
  const momentum = Array.isArray(source.momentum) ? source.momentum : [];
  const homeName = String(context?.match?.homeTeam?.name || 'Хозяева');
  const awayName = String(context?.match?.awayTeam?.name || 'Гости');
  const primary = statGroup('primary', PRIMARY_STAT_DEFINITIONS, home, away);
  const secondary = statGroup('extended', SECONDARY_STAT_DEFINITIONS, home, away);
  const primaryBlock = primary ? `<section class="cw250-mc-stats-primary" data-cw250-mc-stats-primary>${primary}</section>` : '';
  const secondaryBlock = secondary ? `<section class="cw250-mc-stats-secondary" data-cw250-mc-stats-secondary>${secondary}</section>` : '';

  return `${statsStyles()}<section class="cw233-mc-stats" data-cw233-mc-stats>
    <header class="cw233-mc-section-heading"><span>${esc(homeName)}</span><b>Статы</b><span>${esc(awayName)}</span></header>
    ${keyMetrics(home, away)}${primaryBlock}${secondaryBlock}${pressureBlock(momentum)}${shotMap(shots, homeName, awayName)}${shotList(shots, homeName, awayName)}
  </section>`;
}

export { STAT_DEFINITIONS, PRIMARY_STAT_DEFINITIONS, SECONDARY_STAT_DEFINITIONS, EXTENDED_STAT_DEFINITIONS, shotClock, shotMarker, outcomeLabel };
