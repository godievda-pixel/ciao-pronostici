import test from 'node:test';
import assert from 'node:assert/strict';
import { renderMatchCenterEvents, sortEvents } from '../src/v23.3/match-center-events.mjs';

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
