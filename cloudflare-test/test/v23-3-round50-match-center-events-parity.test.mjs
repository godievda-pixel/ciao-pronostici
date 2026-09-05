import test from 'node:test';
import assert from 'node:assert/strict';

import { renderMatchCenterEvents } from '../src/v23.3/match-center-events.mjs';

const context = {
  match:{
    homeTeam:{ name:'Интер' },
    awayTeam:{ name:'Ювентус' },
  },
};

const events = [
  { type:'red_card', minute:82, side:'away', player:'Бремер', reason:'Фол последней надежды' },
  { type:'goal', minute:12, side:'home', player:'Лаутаро', assist:'Барелла', goalKind:'penalty', homeScore:1, awayScore:0 },
  { type:'period', minute:45, text:'Перерыв' },
  { type:'yellow_card', minute:30, side:'away', player:'Локателли' },
  { type:'substitution', minute:55, side:'home', playerIn:'Фраттези', playerOut:'Мхитарян' },
  { type:'goal', minute:63, side:'away', player:'Влахович', goalKind:'own_goal', homeScore:1, awayScore:1 },
  { type:'var', minute:70, side:'home', player:'Лаутаро', varDecision:'goal_disallowed' },
  { type:'period', minute:90, text:'Матч окончен' },
];

test('Round 50 Events redraw uses one centered home/away chronology with narrow-screen fallback', () => {
  const html = renderMatchCenterEvents(events, context);

  assert.match(html, /data-cw250-mc-events-timeline/);
  assert.match(html, /\.cw250-mc-events-timeline::before\{[^}]*left:50%/s);
  assert.match(html, /\.cw250-mc-event\{[^}]*grid-template-columns:minmax\(0,1fr\) 34px minmax\(0,1fr\)/s);
  assert.match(html, /@media\(max-width:359px\)/);
  assert.match(html, /data-cw250-mc-side="home"/);
  assert.match(html, /data-cw250-mc-side="away"/);
});

test('Round 50 Events keeps ascending chronology and period separators', () => {
  const html = renderMatchCenterEvents(events, context);
  const positions = ['12′','30′','45′','55′','63′','70′','82′','90′'].map(clock => html.indexOf(`>${clock}<`));
  assert.ok(positions.every(position => position >= 0));
  for (let index = 1; index < positions.length; index += 1) {
    assert.ok(positions[index - 1] < positions[index]);
  }
  assert.equal((html.match(/data-cw250-mc-period/g) || []).length, 2);
  assert.match(html, />Перерыв</);
  assert.match(html, />Матч окончен</);
});

test('Round 50 Events exposes distinct semantic kinds and score-after-goal only from provider data', () => {
  const html = renderMatchCenterEvents(events, context);

  for (const kind of ['penalty','yellow_card','substitution','own_goal','var','red_card']) {
    assert.match(html, new RegExp(`data-cw250-mc-event-kind="${kind}"`));
  }
  assert.match(html, /data-cw250-mc-score-after>1:0</);
  assert.match(html, /data-cw250-mc-score-after>1:1</);
  assert.doesNotMatch(html, /data-cw250-mc-score-after>0:0</);
  assert.match(html, /Гол отменён/);
  assert.match(html, /Вместо: Мхитарян/);
});
