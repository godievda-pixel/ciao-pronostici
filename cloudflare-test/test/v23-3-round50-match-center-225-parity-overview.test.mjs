import test from 'node:test';
import assert from 'node:assert/strict';
import { renderMatchCenterOverview } from '../src/v23.3/match-center-overview.mjs';

const match = {
  homeTeam:{ name:'Дженоа' },
  awayTeam:{ name:'Комо' },
};

const section = {
  venue:{ name:'Luigi Ferraris', city:'Genova', capacity:33205 },
  referee:{ name:'Marco Guida' },
  form:{ home:['L','L','W','L','L'], away:['W','D','L','D','D'] },
  prediction:{ kind:'user', homeScore:1, awayScore:3, points:2 },
  predictionSplit:{
    home:1,
    draw:11,
    away:88,
    total:65,
    exactScoreProbability:17,
    popularScores:[
      { score:'0:2', percent:34 },
      { score:'1:2', percent:25 },
      { score:'1:3', percent:17 },
      { score:'0:1', percent:8 },
    ],
  },
  summaryStats:{
    home:{ xg:0.67, possession:38, shots:11, shotsOnTarget:2 },
    away:{ xg:1.53, possession:62, shots:20, shotsOnTarget:9 },
  },
  bestPlayer:{ name:'A. Diao', teamName:'Комо', rating:8.5 },
  recentEvents:[
    { type:'goal', minute:84, side:'away', player:'M. Liberali' },
    { type:'substitution', minute:81, side:'home', playerIn:'F. Meichtry' },
  ],
  momentum:{ points:[{ minute:1, home:4, away:2 }] },
  shotmap:{ shots:[{ side:'home', x:50, y:50, xg:0.1 }] },
};

const coverage = { momentum:true, shotmap:true };

test('Round 50 Overview redraw restores the old product hierarchy without copying legacy markup', () => {
  const html = renderMatchCenterOverview(section, { match, coverage });

  assert.match(html, /data-cw250-key-indicators/);
  for (const label of ['xG','Владение','Удары','В створ']) assert.match(html, new RegExp(`>${label}<`));
  assert.match(html, /data-cw250-best-player/);
  assert.match(html, /A\. Diao/);
  assert.match(html, /8\.5/);
  assert.match(html, /data-cw250-recent-events/);
  assert.match(html, /M\. Liberali/);

  const keyIndex = html.indexOf('data-cw250-key-indicators');
  const formIndex = html.indexOf('data-cw233-mc-overview-region="form"');
  const infoIndex = html.indexOf('data-cw233-mc-overview-region="context"');
  const predictionIndex = html.indexOf('data-cw233-mc-overview-region="prediction"');
  assert.ok(keyIndex >= 0 && keyIndex < formIndex, 'key indicators must lead Overview');
  assert.ok(formIndex < infoIndex, 'form must come before match information');
  assert.ok(infoIndex < predictionIndex, 'match information must come before predictions');

  assert.match(html, /data-cw250-prediction-distribution/);
  assert.match(html, />1%<\/b>/);
  assert.match(html, />11%<\/b>/);
  assert.match(html, />88%<\/b>/);
  assert.doesNotMatch(html, />100%<\/b>/);
  assert.match(html, /data-cw250-exact-score/);
  assert.match(html, /17%/);
  assert.match(html, /data-cw250-popular-scores/);
  assert.match(html, /0:2/);
  assert.match(html, /34%/);

  assert.doesNotMatch(html, /data-cw233-mc-overview-region="momentum"/);
  assert.doesNotMatch(html, /data-cw233-mc-overview-region="shotmap"/);
  assert.match(html, /data-cw250-overview-redraw-style/);
});

test('Round 50 Overview scales fractional prediction vectors consistently', () => {
  const html = renderMatchCenterOverview({
    predictionSplit:{ home:0.42, draw:0.43, away:0.15, total:100 },
  }, { match, coverage:{} });

  assert.match(html, />42%<\/b>/);
  assert.match(html, />43%<\/b>/);
  assert.match(html, />15%<\/b>/);
});

test('Round 50 Overview remains additive when optional analytics are unavailable', () => {
  const html = renderMatchCenterOverview({
    venue:section.venue,
    referee:section.referee,
    form:section.form,
    predictionSplit:{ home:42, draw:43, away:15, total:67 },
    summaryStats:{ home:{ xg:0.67 }, away:{ xg:1.53 } },
  }, { match, coverage:{} });

  assert.match(html, /Ключевые показатели/);
  assert.doesNotMatch(html, /data-cw250-best-player/);
  assert.doesNotMatch(html, /data-cw250-recent-events/);
  assert.match(html, /67 прогнозов/);
  assert.doesNotMatch(html, /undefined|null|\[object Object\]/);
});
