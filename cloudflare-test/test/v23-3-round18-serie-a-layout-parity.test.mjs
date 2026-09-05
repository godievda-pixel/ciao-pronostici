import test from 'node:test';
import assert from 'node:assert/strict';
import { MATCH_CENTER_TAB_LABELS } from '../src/v23.3/match-center-core.mjs';
import { renderMatchCenterOverview } from '../src/v23.3/match-center-overview.mjs';
import { renderMatchCenterStats } from '../src/v23.3/match-center-stats.mjs';
import { renderMatchCenterEvents } from '../src/v23.3/match-center-events.mjs';
import { renderMatchCenterLineups } from '../src/v23.3/match-center-lineups.mjs';
import { renderMatchCenterPlayers } from '../src/v23.3/match-center-players.mjs';
import { adaptBsdMatchCenterSections } from '../src/v23.3/bsd-match-center-adapter.mjs';

function match() {
  return {
    competition:'coppa_italia',
    matchId:'coppa_italia:600982',
    status:'finished',
    homeTeam:{ name:'Палермо' },
    awayTeam:{ name:'Мантова' },
    coverage:{ overview:true, stats:true, events:true, lineups:true, players:true, momentum:true, shotmap:true },
  };
}

test('Round 18 external Match Center uses the approved short Stats tab label', () => {
  assert.equal(MATCH_CENTER_TAB_LABELS.stats, 'Статы');
});

test('Round 18 BSD overview carries the already-fetched key stats into the canonical overview', () => {
  const sections = adaptBsdMatchCenterSections({
    stats:{
      home:{ expected_goals:2.41, total_shots:18 },
      away:{ expected_goals:0.86, total_shots:9 },
    },
    momentum:[{ m:1, v:42 }, { m:2, v:-18 }],
    shotmap:[{ pos:{ x:70, y:40 }, home:true, xg:0.31 }],
  });

  assert.equal(sections.overview.summaryStats.home.xg, 2.41);
  assert.equal(sections.overview.summaryStats.home.shots, 18);
  assert.equal(sections.overview.summaryStats.away.xg, 0.86);
  assert.equal(sections.overview.summaryStats.away.shots, 9);
});

test('Round 18 overview feeds the Round 50 key-indicator hierarchy and leaves pressure analytics to Stats', () => {
  const html = renderMatchCenterOverview({
    summaryStats:{
      home:{ xg:2.41, shots:18 },
      away:{ xg:0.86, shots:9 },
    },
    momentum:[
      { minute:1, home:71, away:29 },
      { minute:2, home:41, away:59 },
      { minute:3, home:64, away:36 },
    ],
    shotmap:[{ side:'home', x:70, y:40, xg:0.31 }],
  }, { match:match(), coverage:match().coverage });

  assert.match(html, /data-cw250-key-indicators/);
  assert.match(html, /Ключевые показатели/);
  assert.match(html, /<span>xG<\/span>/);
  assert.match(html, /<strong>2\.41<\/strong>/);
  assert.match(html, /<strong>0\.86<\/strong>/);
  assert.match(html, /<span>Удары<\/span>/);
  assert.match(html, /<strong>18<\/strong>/);
  assert.match(html, /<strong>9<\/strong>/);
  assert.doesNotMatch(html, /data-cw233-mc-overview-region="momentum"/);
  assert.doesNotMatch(html, /data-cw233-mc-overview-region="shotmap"/);
  assert.doesNotMatch(html, /cw233-mc-momentum-chart/);
  assert.doesNotMatch(html, /data-cw233-mc-overview-region="match-info"/);
});

test('Round 18 stats follow Serie A compact primary and extended groups and omit empty metrics', () => {
  const html = renderMatchCenterStats({
    home:{
      xg:2.41, possession:57, shots:18, shotsOnTarget:8, bigChances:5,
      corners:6, fouls:11, offsides:2, yellowCards:2, redCards:null,
      saves:3, passAccuracy:88, interceptions:null, tackles:14,
    },
    away:{
      xg:0.86, possession:43, shots:9, shotsOnTarget:4, bigChances:2,
      corners:2, fouls:14, offsides:1, yellowCards:3, redCards:null,
      saves:5, passAccuracy:81, interceptions:null, tackles:17,
    },
  }, { match:match() });

  assert.match(html, /data-cw233-mc-stats-section="primary"/);
  assert.match(html, /data-cw233-mc-stats-section="extended"/);
  assert.match(html, /cw233-mc-stat-row/);
  assert.doesNotMatch(html, /cw233-mc-stat-card/);
  assert.match(html, /data-cw233-mc-stat="xg"/);
  assert.match(html, /data-cw233-mc-stat="tackles"/);
  assert.match(html, /data-cw233-mc-stat="saves"/);
  assert.match(html, /data-cw233-mc-stat="passAccuracy"/);
  assert.doesNotMatch(html, /data-cw233-mc-stat="redCards"/);
  assert.doesNotMatch(html, /data-cw233-mc-stat="interceptions"/);
});

test('Round 18 events follow premium chronological top-to-bottom order', () => {
  const html = renderMatchCenterEvents([
    { type:'goal', minute:12, side:'home', player:'Первый', homeScore:1, awayScore:0 },
    { type:'yellow_card', minute:44, side:'away', player:'Второй' },
    { type:'goal', minute:70, side:'home', player:'Последний', homeScore:2, awayScore:0 },
  ], { match:match() });

  assert.ok(html.indexOf('12′') < html.indexOf('44′'));
  assert.ok(html.indexOf('44′') < html.indexOf('70′'));
  assert.match(html, /cw233-mc-event-minute/);
  assert.match(html, /cw233-mc-event-text/);
});

test('Round 18 lineups keep authoritative lists alongside the premium pitch diagram', () => {
  const html = renderMatchCenterLineups({
    home:{ formation:'3-5-2', starters:[{ name:'Sommer', shirtNumber:1 }, { name:'Lautaro', shirtNumber:10 }], substitutes:[{ name:'Frattesi', shirtNumber:16 }] },
    away:{ formation:'4-3-3', starters:[{ name:'Raya', shirtNumber:22 }, { name:'Saka', shirtNumber:7 }], substitutes:[{ name:'Trossard', shirtNumber:19 }] },
  }, { match:match() });

  assert.match(html, /cw233-mc-lineup-list/);
  assert.match(html, /cw233-mc-lineup-player/);
  assert.match(html, /Запасные/);
  assert.match(html, /Sommer/);
  assert.match(html, /Saka/);
  assert.match(html, /data-cw233-mc-pitch/);
  assert.match(html, /cw233-mc-pitch-player/);
});

test('Round 18 players preserve canonical hooks inside premium cards and expose the full provider metric set', () => {
  const html = renderMatchCenterPlayers([
    { playerId:10, name:'Lautaro', teamName:'Интер', rating:8.4, minutes:90, goals:1, assists:1, xg:0.82, xa:0.34, shots:4, keyPasses:3 },
    { playerId:27, name:'Rice', teamName:'Арсенал', rating:7.2, minutes:90, shots:1, keyPasses:2 },
  ], { match:match() });

  assert.match(html, /cw233-mc-player-card/);
  assert.match(html, /data-cw233-mc-player-rank="1"/);
  assert.match(html, /cw233-mc-rating-row/);
  assert.match(html, /cw233-mc-rating-name/);
  assert.match(html, /cw233-mc-rating-meta/);
  assert.match(html, /cw233-mc-rating/);
  assert.match(html, /Интер/);
  assert.match(html, /90 мин/);
  assert.match(html, /xG 0\.82/);
  assert.match(html, /xA 0\.34/);
  assert.match(html, /4 удара/);
  assert.match(html, /3 ключ\. передачи/);
});
