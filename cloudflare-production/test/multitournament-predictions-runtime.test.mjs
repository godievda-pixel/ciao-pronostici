import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MULTITOURNAMENT_PREDICTIONS_MARKER,
  multitournamentPredictionsRuntimeSource,
  injectMultitournamentPredictionsPatch,
  validateMultitournamentPredictionsPatchedHtml,
} from '../scripts/multitournament-predictions-runtime.mjs';

const source = () => multitournamentPredictionsRuntimeSource();

const competitionKeys = ['serie_a','coppa_italia','ucl','uel','uecl'];

test('prediction hub defines exactly the five approved competitions and one persistent mode switch', () => {
  const s = source();
  for (const key of competitionKeys) assert.match(s, new RegExp(`data-cwpred-competition=\\"${key}\\"`));
  assert.equal((s.match(/data-cwpred-competition=/g) || []).length, 5);
  assert.match(s, /data-cwpred-mode=\"edit\"[^>]*>Прогнозы</);
  assert.match(s, /data-cwpred-mode=\"mine\"[^>]*>Мои прогнозы</);
  assert.match(s, /let __cwPredMode='edit'/);
  assert.match(s, /let __cwPredCompetition=''/);
  assert.match(s, /let __cwPredStageKey=''/);
});

test('switching prediction mode preserves selected competition and stage', () => {
  const s = source();
  const modeHandler = s.match(/function __cwPredSetMode\(mode\)\{([\s\S]*?)\n  \}/)?.[1] || '';
  assert.match(modeHandler, /__cwPredMode=/);
  assert.match(modeHandler, /render\(\)/);
  assert.doesNotMatch(modeHandler, /__cwPredCompetition\s*=/);
  assert.doesNotMatch(modeHandler, /__cwPredStageKey\s*=/);
  assert.doesNotMatch(modeHandler, /\.clear\(/);
});

test('external predictions use canonical string ids and never coerce match ids through Number', () => {
  const s = source();
  assert.match(s, /String\(match\?\.matchId/);
  assert.match(s, /match_id:String\(/);
  assert.doesNotMatch(s, /Number\([^\n)]*match_id/);
  assert.doesNotMatch(s, /Number\([^\n)]*matchId/);
  assert.match(s, /__cwPredExternalDraft=new Map\(\)/);
});

test('edit and mine cards expose approved copy, live states and no x2 surface', () => {
  const s = source();
  assert.match(s, /Сохранить прогнозы/);
  assert.match(s, /Прогноз не сделан/);
  assert.match(s, /15 минут/);
  assert.match(s, /ПЕРЕРЫВ/);
  assert.match(s, /ДОП\. ВРЕМЯ/);
  assert.match(s, /ПЕНАЛЬТИ/);
  assert.match(s, /\+5 очков/);
  assert.match(s, /\+3 очка/);
  assert.match(s, /\+2 очка/);
  assert.match(s, /0 очков/);
  assert.doesNotMatch(s, /\bx2\b/i);
  assert.doesNotMatch(s, /bonus_multiplier/);
  assert.doesNotMatch(s, /set_round_bonus/);
});

test('external cards never open Match Center but Italian clubs keep local profile bridge', () => {
  const s = source();
  assert.match(s, /data-cwpred-local-club/);
  assert.match(s, /openClubProfile/);
  const externalBind = s.match(/function __cwPredBindExternal\(\)\{([\s\S]*?)\n  \}/)?.[1] || '';
  assert.doesNotMatch(externalBind, /openMatchCenter/);
  assert.doesNotMatch(externalBind, /Number\([^\n)]*match/);
});

test('quiet refresh exists and preserves both external and Serie A drafts', () => {
  const s = source();
  assert.match(s, /async function __cwPredRefreshVisible\(/);
  assert.match(s, /__cwPredLoadExternal\(__cwPredCompetition,\{quiet:true\}\)/);
  assert.match(s, /const keptDraft=new Map\(draft\)/);
  assert.match(s, /draft\.clear\(\);for\(const \[k,v\] of keptDraft\)draft\.set\(k,v\)/);
  const refresh = s.match(/async function __cwPredRefreshVisible\([^)]*\)\{([\s\S]*?)\n  \}/)?.[1] || '';
  assert.doesNotMatch(refresh, /__cwPredExternalDraft\.clear\(/);
});

test('prediction patch injects exactly once after approved Matches card-theme layer', () => {
  const html = '<html><script>\n(function(){\n/* ciao-prod-multitournament-matches-20260907 */\n/* ciao-prod-multitournament-card-theme-20260907 */\n  /* ===== /Ciao, Web! v22.5 product polish layer ===== */\n\n})();\n</script></html>';
  const once = injectMultitournamentPredictionsPatch(html);
  const twice = injectMultitournamentPredictionsPatch(once);
  assert.equal(once, twice);
  assert.equal(validateMultitournamentPredictionsPatchedHtml(once), true);
  assert.match(once, new RegExp(MULTITOURNAMENT_PREDICTIONS_MARKER));
  assert.ok(once.indexOf('ciao-prod-multitournament-card-theme-20260907') < once.indexOf(MULTITOURNAMENT_PREDICTIONS_MARKER));
});
