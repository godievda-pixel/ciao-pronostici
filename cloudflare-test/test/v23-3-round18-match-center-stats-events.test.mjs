import test from 'node:test';
import assert from 'node:assert/strict';
import { renderMatchCenterStats } from '../src/v23.3/match-center-stats.mjs';
import { renderMatchCenterEvents } from '../src/v23.3/match-center-events.mjs';
import { createMatchCenterController } from '../src/v23.3/match-center-core.mjs';

const REQUIRED_STATS = [
  'xg',
  'possession',
  'shots',
  'shotsOnTarget',
  'bigChances',
  'corners',
  'fouls',
  'offsides',
  'yellowCards',
  'redCards',
  'saves',
  'passAccuracy',
  'interceptions',
  'tackles',
];

function match() {
  return {
    competition:'ucl',
    matchId:'ucl:77',
    status:'live',
    minute:67,
    homeScore:2,
    awayScore:1,
    homeTeam:{ name:'Интер' },
    awayTeam:{ name:'Арсенал' },
    coverage:{
      overview:true,
      stats:true,
      events:true,
      lineups:true,
      players:true,
      momentum:false,
      shotmap:false,
    },
  };
}

function statsSection() {
  return {
    home:{
      xg:1.83,
      possession:54,
      shots:14,
      shotsOnTarget:6,
      bigChances:4,
      corners:5,
      fouls:9,
      offsides:2,
      yellowCards:2,
      redCards:0,
      saves:3,
      passAccuracy:89,
      interceptions:7,
      tackles:11,
    },
    away:{
      xg:0.91,
      possession:46,
      shots:9,
      shotsOnTarget:4,
      bigChances:2,
      corners:3,
      fouls:12,
      offsides:1,
      yellowCards:3,
      redCards:1,
      saves:4,
      passAccuracy:84,
      interceptions:9,
      tackles:14,
    },
  };
}

test('Round 18 statistics renderer restores every required legacy metric', () => {
  const html = renderMatchCenterStats(statsSection(), { match:match() });

  assert.match(html, /data-cw233-mc-stats/);
  for (const key of REQUIRED_STATS) {
    assert.match(html, new RegExp(`data-cw233-mc-stat="${key}"`));
  }
  assert.match(html, />1\.83</);
  assert.match(html, />0\.91</);
  assert.match(html, /--mc-stat-home:/);
  assert.match(html, /--mc-stat-away:/);
});

test('Round 18 event timeline follows Serie A latest-first chronology and preserves event semantics', () => {
  const html = renderMatchCenterEvents([
    { type:'substitution', minute:61, side:'away', playerIn:'Trossard', playerOut:'Martinelli' },
    { type:'period', minute:45, addedTime:2, text:'Перерыв' },
    { type:'goal', minute:52, side:'home', player:'Lautaro', assist:'Barella', homeScore:2, awayScore:1 },
    { type:'yellow_card', minute:18, side:'away', player:'Rice', reason:'Фол' },
    { type:'goal', minute:11, side:'home', player:'Thuram', homeScore:1, awayScore:0 },
    { type:'var', minute:54, side:'home', player:'Lautaro', reason:'Проверка гола' },
    { type:'red_card', minute:66, side:'away', player:'Saliba' },
  ], { match:match() });

  assert.match(html, /data-cw233-mc-events/);
  assert.ok(html.indexOf('66′') < html.indexOf('61′'));
  assert.ok(html.indexOf('61′') < html.indexOf('54′'));
  assert.ok(html.indexOf('54′') < html.indexOf('52′'));
  assert.ok(html.indexOf('52′') < html.indexOf('45+2′'));
  assert.ok(html.indexOf('45+2′') < html.indexOf('18′'));
  assert.ok(html.indexOf('18′') < html.indexOf('11′'));
  assert.match(html, /cw233-mc-event-minute/);
  assert.match(html, /cw233-mc-event-text/);
  assert.match(html, /data-cw233-mc-event="goal"/);
  assert.match(html, /data-cw233-mc-event="yellow_card"/);
  assert.match(html, /data-cw233-mc-event="red_card"/);
  assert.match(html, /data-cw233-mc-event="substitution"/);
  assert.match(html, /data-cw233-mc-event="var"/);
  assert.match(html, /data-cw233-mc-event="period"/);
  assert.match(html, /is-home/);
  assert.match(html, /is-away/);
  assert.match(html, /2:1/);
  assert.match(html, /Ассист: Barella/);
  assert.match(html, /Trossard/);
  assert.match(html, /Martinelli/);
  assert.match(html, /Проверка гола/);
});

test('Round 18 keeps stats failure section-local and allows events to load', async () => {
  const controller = createMatchCenterController({
    loadSnapshot:async () => ({ match:match() }),
    loadSection:async (competition, matchId, section) => {
      if (section === 'stats') throw new Error('stats_provider_failed');
      return {
        competition,
        matchId,
        section,
        coverage:match().coverage,
        data:section === 'events'
          ? [{ type:'goal', minute:11, side:'home', player:'Thuram', homeScore:1, awayScore:0 }]
          : {},
      };
    },
    documentRef:{ hidden:false, addEventListener(){} },
  });

  await controller.open({ competition:'ucl', matchId:'ucl:77', initialMatch:match() });
  await controller.refreshSection('stats');
  let state = controller.getState();
  assert.equal(state.open, true);
  assert.equal(state.match.matchId, 'ucl:77');
  assert.equal(state.sectionState.stats.status, 'error');
  assert.equal(state.sectionState.events.status, 'idle');

  await controller.refreshSection('events');
  state = controller.getState();
  assert.equal(state.sectionState.stats.status, 'error');
  assert.equal(state.sectionState.events.status, 'ready');
  assert.equal(state.sections.events[0].player, 'Thuram');
  controller.close();
});
