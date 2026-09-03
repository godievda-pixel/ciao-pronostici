import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createMatchCenterController,
  renderMatchCenter,
} from '../src/v23.3/match-center.mjs';

const basicMatch = (competition, id = '1') => ({
  competition,
  matchId:`${competition}:${id}`,
  kickoffAt:'2026-09-10T19:00:00Z',
  status:'scheduled',
  homeTeam:{ name:'Интер', crestUrl:'inter.png' },
  awayTeam:{ name:'Арсенал', crestUrl:'arsenal.png' },
});

test('Round 17 canonical Match Center renders one shell with tournament-specific themes', () => {
  const expected = {
    serie_a:'serie-a',
    coppa_italia:'coppa',
    ucl:'champions',
    uel:'europa',
    uecl:'conference',
  };
  for (const [competition, theme] of Object.entries(expected)) {
    const html = renderMatchCenter({ competition, match:basicMatch(competition) });
    assert.match(html, new RegExp(`data-cw233-mc-theme="${theme}"`));
  }
});

test('Round 17 Match Center renders only available detail sections', () => {
  const full = renderMatchCenter({
    competition:'uel',
    match:{
      ...basicMatch('uel'),
      venue:'Олимпико',
      events:[{ type:'goal', minute:31 }],
      statistics:[{ name:'Удары', home:8, away:6 }],
      lineups:[{ team:'Рома', formation:'3-4-2-1' }],
      prediction:{ homeScore:2, awayScore:1 },
    },
  });
  assert.match(full, /data-cw233-mc-detail="venue"/);
  assert.match(full, /data-cw233-mc-detail="events"/);
  assert.match(full, /data-cw233-mc-detail="statistics"/);
  assert.match(full, /data-cw233-mc-detail="lineups"/);
  assert.match(full, /data-cw233-mc-detail="prediction"/);

  const empty = renderMatchCenter({ competition:'uel', match:basicMatch('uel') });
  assert.doesNotMatch(empty, /data-cw233-mc-detail="events"/);
  assert.doesNotMatch(empty, /data-cw233-mc-detail="statistics"/);
  assert.doesNotMatch(empty, /data-cw233-mc-detail="lineups"/);
});

test('Round 17 Match Center emits bootstrap state before the authoritative request resolves', async () => {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const states = [];
  const controller = createMatchCenterController({
    documentRef:{ hidden:false, addEventListener(){} },
    loadSnapshot:async () => {
      await pending;
      return { match:{ ...basicMatch('ucl'), status:'finished', homeScore:1, awayScore:0 } };
    },
    onStateChange:state => states.push(state),
  });
  const opening = controller.open({
    competition:'ucl',
    matchId:'ucl:1',
    initialMatch:basicMatch('ucl'),
  });
  assert.equal(states.length, 1);
  assert.equal(states[0].match.homeTeam.name, 'Интер');
  assert.equal(states[0].loading, true);
  release();
  await opening;
  assert.equal(states.at(-1).match.status, 'finished');
});
