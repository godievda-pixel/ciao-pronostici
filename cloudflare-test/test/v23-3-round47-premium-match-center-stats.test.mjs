import test from 'node:test';
import assert from 'node:assert/strict';
import { renderMatchCenterStats } from '../src/v23.3/match-center-stats.mjs';

const section = {
  home:{ xg:1.72, shots:12, shotsOnTarget:6, possession:54, corners:5 },
  away:{ xg:0.83, shots:8, shotsOnTarget:3, possession:46, corners:3 },
  shots:[
    { side:'home', x:78, y:44, minute:34, player:'Marco Rossi', assist:'Luca Assist', xg:0.76, outcome:'goal', situation:'penalty', goalKind:'penalty', bodyPart:'right_foot' },
    { side:'away', x:63, y:31, minute:52, player:'Away Shooter', xg:0.18, outcome:'saved', situation:'open_play', goalKind:'unknown', bodyPart:'head' },
    { side:'home', x:70, y:64, minute:67, player:'Block Man', xg:0.11, outcome:'blocked', situation:'open_play', goalKind:'unknown', bodyPart:'left_foot' },
    { side:'away', x:null, y:null, minute:79, player:'Wide Shot', xg:null, outcome:'off_target', situation:'corner', goalKind:'unknown', bodyPart:'' },
  ],
};

const context = { match:{ homeTeam:{ name:'Home United' }, awayTeam:{ name:'Away City' } } };

test('premium Stats renders aggregate comparison, shot map and detailed shot list', () => {
  const html = renderMatchCenterStats(section, context);
  assert.match(html, /data-cw233-mc-stats/);
  assert.match(html, /data-cw233-mc-shotmap/);
  assert.match(html, /data-cw233-mc-shot-list/);
  assert.match(html, /xG/);
  assert.match(html, /Удары/);
  assert.match(html, /Marco Rossi/);
  assert.match(html, /Luca Assist/);
  assert.match(html, /0\.76/);
  assert.match(html, /34′/);
  assert.match(html, /Пенальти/);
});

test('shot map plots only coordinate-valid shots while list keeps every shot', () => {
  const html = renderMatchCenterStats(section, context);
  assert.equal((html.match(/data-cw233-mc-shot-marker=/g) || []).length, 3);
  assert.equal((html.match(/data-cw233-mc-shot-row=/g) || []).length, 4);
  assert.match(html, /Wide Shot/);
  assert.match(html, /Мимо/);
});

test('shot markers carry semantic outcome and penalty classes/accessibility', () => {
  const html = renderMatchCenterStats(section, context);
  assert.match(html, /cw233-mc-shot-marker[^"']*is-goal[^"']*is-penalty/);
  assert.match(html, /cw233-mc-shot-marker[^"']*is-saved/);
  assert.match(html, /cw233-mc-shot-marker[^"']*is-blocked/);
  assert.match(html, /aria-label="[^"]*Marco Rossi[^"]*34′[^"]*xG 0\.76[^"]*"/);
});

test('shot list omits fake xG placeholders when xG is unavailable', () => {
  const html = renderMatchCenterStats(section, context);
  const wide = html.match(/<article[^>]*data-cw233-mc-shot-row="3"[\s\S]*?<\/article>/)?.[0] || '';
  assert.match(wide, /Wide Shot/);
  assert.doesNotMatch(wide, /xG\s*[—-]/);
  assert.doesNotMatch(html, /\[object Object\]|undefined|>null</);
});
