import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MULTITOURNAMENT_PATCH_MARKER,
  multitournamentRuntimeSource,
  injectMultitournamentPatch,
  validateMultitournamentPatchedHtml,
} from '../scripts/multitournament-runtime.mjs';

const source = () => multitournamentRuntimeSource();

test('runtime patch renames only the three approved bottom navigation labels', () => {
  const s = source();
  assert.match(s, /data-tab="mine"[\s\S]*Прогнозы/);
  assert.match(s, /data-tab="table"[\s\S]*Рейтинг/);
  assert.match(s, /data-tab="seriea"[\s\S]*Таблицы/);
  assert.doesNotMatch(s, /data-tab="predict"[\s\S]*Прогнозы/);
});

test('hub has exactly five tournament buttons and no explanatory subtitles', () => {
  const s = source();
  const matches = s.match(/data-cwmt-competition=/g) || [];
  assert.equal(matches.length, 5);
  assert.match(s, /data-cwmt-competition="serie_a"[^>]*cwmt-tournament-card--wide/);
  for (const key of ['coppa_italia','ucl','uel','uecl']) {
    assert.match(s, new RegExp(`data-cwmt-competition="${key}"`));
  }
  assert.doesNotMatch(s, /cwmt-tournament-card__hint|cwmt-tournament-card__subtitle/);
});

test('all competitions share one match-card renderer and have distinct cover themes', () => {
  const s = source();
  for (const theme of ['serie-a','coppa','champions','europa','conference']) {
    assert.match(s, new RegExp(`data-cwmt-theme="${theme}"`));
  }
  assert.match(s, /function __cwMtMatchCardHtml\(/);
  assert.equal((s.match(/function __cwMtMatchCardHtml\(/g) || []).length, 1);
});

test('external match cards cannot invoke Match Center and only mapped Italian clubs are interactive', () => {
  const s = source();
  assert.doesNotMatch(s, /data-cwmt-match[^\n]*data-mid=/);
  assert.doesNotMatch(s, /data-cwmt-match[^\n]*openMatchCenter/);
  assert.match(s, /data-cwmt-local-club=/);
  assert.match(s, /"77":8/);
  assert.match(s, /"63":12/);
  assert.match(s, /"62":14/);
});

test('patch injection is idempotent and validated inside the final v22.5 IIFE', () => {
  const html = '<html><script>\n(function(){\n  const app=true;\n  /* ===== /Ciao, Web! v22.5 product polish layer ===== */\n\n})();\n</script></html>';
  const once = injectMultitournamentPatch(html);
  const twice = injectMultitournamentPatch(once);
  assert.equal(once, twice);
  assert.match(once, new RegExp(MULTITOURNAMENT_PATCH_MARKER));
  assert.equal(validateMultitournamentPatchedHtml(once), true);
});
