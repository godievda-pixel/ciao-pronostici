import test from 'node:test';
import assert from 'node:assert/strict';
import { renderMatchCenterOverview } from '../src/v23.3/match-center-overview.mjs';
import { createMatchCenterController } from '../src/v23.3/match-center-core.mjs';

function baseMatch() {
  return {
    competition:'ucl',
    matchId:'ucl:77',
    status:'scheduled',
    kickoffAt:'2026-09-20T18:00:00Z',
    homeTeam:{ name:'Интер' },
    awayTeam:{ name:'Арсенал' },
    coverage:{
      overview:true,
      stats:true,
      events:true,
      lineups:true,
      players:true,
      momentum:true,
      shotmap:true,
    },
  };
}

function overviewSection() {
  return {
    venue:{ name:'San Siro', city:'Milano', capacity:75817 },
    referee:{ name:'Daniele Orsato' },
    form:{ home:['W', 'W', 'D', 'L', 'W'], away:['D', 'W', 'W', 'L', 'D'] },
    prediction:{ homeScore:2, awayScore:1 },
    predictionSplit:{ home:48, draw:27, away:25 },
    summaryStats:{
      home:{ xg:1.83, possession:55, shots:14, shotsOnTarget:6 },
      away:{ xg:0.91, possession:45, shots:9, shotsOnTarget:3 },
    },
    momentum:[
      { minute:15, home:62, away:38 },
      { minute:30, home:44, away:56 },
    ],
    shotmap:[
      { side:'home', x:72, y:45, xg:0.31 },
      { side:'away', x:28, y:59, xg:0.12 },
    ],
  };
}

test('Round 18 legacy coverage remains compatible with the Round 50 Overview product hierarchy', () => {
  const html = renderMatchCenterOverview(overviewSection(), {
    match:baseMatch(),
    coverage:baseMatch().coverage,
  });

  assert.match(html, /data-cw233-mc-overview/);
  assert.match(html, /data-cw250-key-indicators/);
  assert.match(html, /Ключевые показатели/);
  assert.match(html, />xG</);
  assert.match(html, />Владение</);
  assert.match(html, />Удары</);
  assert.match(html, />В створ</);
  assert.match(html, /data-cw233-mc-overview-region="form"/);
  assert.match(html, /data-cw233-mc-overview-region="context"/);
  assert.match(html, /data-cw233-mc-overview-region="prediction"/);

  // Round 50 deliberately owns these analytics in the Stats tab, not Overview.
  assert.doesNotMatch(html, /data-cw233-mc-overview-region="momentum"/);
  assert.doesNotMatch(html, /data-cw233-mc-overview-region="shotmap"/);
});

test('Round 18 overview still avoids fabricating analytics and keeps real match context', () => {
  const html = renderMatchCenterOverview({
    ...overviewSection(),
    momentum:null,
    shotmap:null,
  }, {
    match:baseMatch(),
    coverage:{ ...baseMatch().coverage, momentum:false, shotmap:false },
  });

  assert.match(html, /data-cw250-key-indicators/);
  assert.match(html, /San Siro/);
  assert.match(html, /Daniele Orsato/);
  assert.doesNotMatch(html, /data-cw233-mc-overview-region="momentum"/);
  assert.doesNotMatch(html, /data-cw233-mc-overview-region="shotmap"/);
});

test('Round 18 opens the stable hero before starting the lazy overview request', async () => {
  const order = [];
  const states = [];
  const controller = createMatchCenterController({
    loadSnapshot:async () => ({ match:baseMatch() }),
    loadSection:async (competition, matchId, section) => {
      order.push(`request:${competition}:${matchId}:${section}`);
      return {
        competition,
        matchId,
        section,
        coverage:baseMatch().coverage,
        data:overviewSection(),
      };
    },
    documentRef:{ hidden:false, addEventListener(){} },
    onStateChange:state => {
      states.push(state);
      if (states.length === 1) order.push('shell-open');
    },
  });

  await controller.open({
    competition:'ucl',
    matchId:'ucl:77',
    initialMatch:baseMatch(),
  });
  await Promise.resolve();

  assert.equal(order[0], 'shell-open');
  assert.equal(order[1], 'request:ucl:ucl:77:overview');
  assert.equal(controller.getState().sectionState.overview.status, 'ready');
  assert.equal(controller.getState().sections.overview.venue.name, 'San Siro');
});
