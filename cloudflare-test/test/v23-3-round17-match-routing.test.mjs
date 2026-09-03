import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  installCanonicalMatchLinks,
  resolveCanonicalMatchTarget,
} from '../src/v23.3/match-center-links.mjs';
import { rememberMatchBootstrap } from '../src/v23.3/match-bootstrap-cache.mjs';

function targetWith(map = {}) {
  return { closest(selector) { return map[selector] || null; } };
}

test('Round 17 direct canonical card routing carries cached bootstrap into Match Center', () => {
  rememberMatchBootstrap({
    competition:'ucl', matchId:'ucl:500', kickoffAt:'2026-09-10T19:00:00Z',
    homeTeam:{ name:'Интер' }, awayTeam:{ name:'Арсенал' },
  });
  const card = { dataset:{ cw233Competition:'ucl', cw233Match:'ucl:500' } };
  const payload = resolveCanonicalMatchTarget(targetWith({
    '[data-cw233-match][data-cw233-competition]':card,
  }));
  assert.equal(payload.competition, 'ucl');
  assert.equal(payload.matchId, 'ucl:500');
  assert.equal(payload.initialMatch.homeTeam.name, 'Интер');
});

test('Round 17 prediction editing controls never navigate into Match Center', () => {
  const card = { dataset:{ cw233Competition:'uel', cw233Match:'uel:501' } };
  const delta = { dataset:{ cw233Delta:'h:1' } };
  const payload = resolveCanonicalMatchTarget(targetWith({
    '[data-cw233-delta],[data-cw233-save-all],[data-cw231-action="predict"]':delta,
    '[data-cw233-match][data-cw233-competition]':card,
  }));
  assert.equal(payload, null);
});

test('Round 17 one capture router opens canonical target with initialMatch', () => {
  rememberMatchBootstrap({ competition:'uecl', matchId:'uecl:502', homeTeam:{ name:'Фиорентина' }, awayTeam:{ name:'АЗ Алкмар' } });
  const card = { dataset:{ cw233Competition:'uecl', cw233Match:'uecl:502' } };
  const target = targetWith({ '[data-cw233-match][data-cw233-competition]':card });
  let handler = null;
  const documentRef = { addEventListener(type, fn, capture) { assert.equal(type, 'click'); assert.equal(capture, true); handler = fn; } };
  let opened = null;
  installCanonicalMatchLinks(documentRef, { open:payload => { opened = payload; } });
  handler({ target, preventDefault(){}, stopPropagation(){} });
  assert.equal(opened.matchId, 'uecl:502');
  assert.equal(opened.initialMatch.homeTeam.name, 'Фиорентина');
});

test('Round 17 Prediction cards expose canonical competition and match identity', async () => {
  const source = await readFile(new URL('../src/v23.3/predictions-ui.mjs', import.meta.url), 'utf8');
  assert.match(source, /data-cw233-pred-card=.*data-cw233-competition=.*data-cw233-match=/s);
});

test('Round 17 Match Center module no longer owns generic match-card click routing', async () => {
  const source = await readFile(new URL('../src/v23.3/match-center.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /const card = target\.closest\('\[data-cw233-match\]\[data-cw233-competition\]'\)/);
});
