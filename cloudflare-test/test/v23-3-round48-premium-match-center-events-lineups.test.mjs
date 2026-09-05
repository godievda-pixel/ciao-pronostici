import test from 'node:test';
import assert from 'node:assert/strict';
import { renderMatchCenterEvents, sortEvents } from '../src/v23.3/match-center-events.mjs';
import { renderMatchCenterLineups, parseFormation, gridPosition } from '../src/v23.3/match-center-lineups.mjs';

const context = { match:{ homeTeam:{ name:'Home United' }, awayTeam:{ name:'Away City' } } };

const events = [
  { type:'period', minute:90, text:'Матч завершён' },
  { type:'goal', side:'away', minute:61, player:'Paolo Neri', homeScore:2, awayScore:2, goalKind:'own_goal' },
  { type:'var', side:'home', minute:55, player:'Marco Rossi', varDecision:'goal_confirmed', text:'Гол подтверждён' },
  { type:'substitution', side:'away', minute:50, playerIn:'Fresh Player', playerOut:'Tired Player' },
  { type:'yellow_card', side:'home', minute:47, player:'Card Man', reason:'Грубая игра' },
  { type:'period', minute:45, text:'Перерыв' },
  { type:'goal', side:'home', minute:34, player:'Marco Rossi', assist:'Luca Assist', homeScore:1, awayScore:0, goalKind:'penalty' },
  { type:'unknown', side:'away', minute:20, text:'Неизвестное событие' },
];

test('premium Events sorts timeline chronologically top-to-bottom', () => {
  const sorted = sortEvents(events);
  assert.deepEqual(sorted.map(event => event.minute), [20,34,45,47,50,55,61,90]);
});

test('premium Events renders semantic timeline for goals, cards, substitutions, VAR and periods', () => {
  const html = renderMatchCenterEvents(events, context);
  assert.match(html, /data-cw233-mc-events-timeline/);
  assert.match(html, /Marco Rossi/);
  assert.match(html, /34′/);
  assert.match(html, /\(П\)/);
  assert.match(html, /1:0/);
  assert.match(html, /Ассист: Luca Assist/);
  assert.match(html, /Paolo Neri/);
  assert.match(html, /\(АГ\)/);
  assert.match(html, /Жёлтая карточка/);
  assert.match(html, /Fresh Player/);
  assert.match(html, /VAR/);
  assert.match(html, /Гол подтверждён/);
  assert.match(html, /cw233-mc-event-period/);
  assert.match(html, /Неизвестное событие/);
});

const starters433 = [
  { playerId:1, name:'Keeper', position:'GK', shirtNumber:1, x:50, y:8, starter:true },
  { playerId:2, name:'RB', position:'DF', shirtNumber:2, grid:'2:1', starter:true },
  { playerId:3, name:'CB1', position:'DF', shirtNumber:3, starter:true },
  { playerId:4, name:'CB2', position:'DF', shirtNumber:4, starter:true },
  { playerId:5, name:'LB', position:'DF', shirtNumber:5, starter:true },
  { playerId:6, name:'M1', position:'MF', shirtNumber:6, starter:true },
  { playerId:7, name:'M2', position:'MF', shirtNumber:7, starter:true },
  { playerId:8, name:'M3', position:'MF', shirtNumber:8, starter:true },
  { playerId:9, name:'F1', position:'FW', shirtNumber:9, starter:true },
  { playerId:10, name:'F2', position:'FW', shirtNumber:10, starter:true },
  { playerId:11, name:'F3', position:'FW', shirtNumber:11, starter:true },
];

const lineups = {
  home:{ formation:'4-3-3', coach:'Home Coach', starters:starters433, substitutes:[{ playerId:12, name:'Home Bench', position:'MF', shirtNumber:12 }] },
  away:{ formation:'4-4-2', coach:'Away Coach', starters:starters433.map((player,index)=>({ ...player, playerId:100+index, name:`Away ${index+1}`, x:null, y:null, grid:'' })), substitutes:[] },
};

test('lineup helpers understand valid formations and grid positions', () => {
  assert.deepEqual(parseFormation('4-3-3'), [4,3,3]);
  assert.deepEqual(gridPosition('2:1'), { x:20, y:28 });
  assert.equal(parseFormation('nonsense'), null);
});

test('premium Lineups renders one mobile pitch with home/away switch and authoritative text', () => {
  const html = renderMatchCenterLineups(lineups, context);
  assert.match(html, /data-cw233-mc-lineup-switch/);
  assert.match(html, /data-cw233-mc-lineup-pitch/);
  assert.match(html, /data-cw233-mc-pitch-team="home"/);
  assert.match(html, /data-cw233-mc-pitch-team="away"/);
  assert.match(html, /data-cw233-mc-pitch-player="1"/);
  assert.match(html, /--player-x:50%;--player-y:8%/);
  assert.match(html, /Home Coach/);
  assert.match(html, /Home Bench/);
  assert.match(html, /4-3-3/);
  assert.match(html, /4-4-2/);
  assert.match(html, /data-cw233-mc-lineup-list/);
});

test('formation fallback produces pitch markers when explicit coordinates are missing', () => {
  const html = renderMatchCenterLineups(lineups, context);
  assert.match(html, /data-cw233-mc-pitch-player="100"/);
});

test('invalid or incomplete lineup keeps text list and shows tactical unavailable state', () => {
  const html = renderMatchCenterLineups({
    home:{ formation:'?', coach:'Coach', starters:[{ name:'Only Player', shirtNumber:1 }], substitutes:[] },
    away:{ formation:'', starters:[], substitutes:[] },
  }, context);
  assert.match(html, /Схема недоступна/);
  assert.match(html, /Only Player/);
  assert.match(html, /data-cw233-mc-lineup-list/);
});
