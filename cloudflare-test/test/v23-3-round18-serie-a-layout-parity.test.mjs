import test from 'node:test';
import assert from 'node:assert/strict';
import { MATCH_CENTER_TAB_LABELS } from '../src/v23.3/match-center-core.mjs';
import { renderMatchCenterOverview } from '../src/v23.3/match-center-overview.mjs';
import { renderMatchCenterStats } from '../src/v23.3/match-center-stats.mjs';
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

test('Round 18 overview follows the compact Serie A order and pressure chart', () => {
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

  const main = html.indexOf('data-cw233-mc-overview-region="main"');
  const momentum = html.indexOf('data-cw233-mc-overview-region="momentum"');
  const shotmap = html.indexOf('data-cw233-mc-overview-region="shotmap"');
  assert.ok(main >= 0 && main < momentum && momentum < shotmap);
  assert.match(html, /Главное/);
  assert.match(html, /xG хозяев/);
  assert.match(html, />27<\/strong><span>ударов<\/span>/);
  assert.match(html, /cw233-mc-momentum-chart/);
  assert.match(html, /cw233-mc-momentum-bar is-home/);
  assert.match(html, /cw233-mc-momentum-bar is-away/);
  assert.doesNotMatch(html, /cw233-mc-momentum-row/);
  assert.doesNotMatch(html, /data-cw233-mc-overview-region="predictions"/);
  assert.doesNotMatch(html, /data-cw233-mc-overview-region="form"/);
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
