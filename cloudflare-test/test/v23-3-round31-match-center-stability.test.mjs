import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  ROUND31_CSS,
  externalMatchCenterSnapshotSignature,
  isRound31ExternalCompetition,
  renderRound31ExternalOverview,
} from '../src/v23.3/round31-match-center-stability.mjs';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

const externalSnapshot = Object.freeze({
  status:'scheduled',
  competition:'ucl',
  match_id:'ucl:9001',
  match:{
    id:'ucl:9001',
    home:{ name:'Наполи' },
    away:{ name:'Арсенал' },
    kickoff_at:'2026-09-09T19:00:00Z',
  },
  detail:{
    stadium:'Stadio Diego Armando Maradona',
    city:'Napoli',
    referee:'Referee Test',
  },
  stats:{
    stats:{
      home:{ expected_goals:1.25, ball_possession:52, total_shots:11, shots_on_target:5 },
      away:{ expected_goals:1.08, ball_possession:48, total_shots:9, shots_on_target:4 },
    },
  },
  form:{ home:['В','В','Н'], away:['П','В','В'] },
});

test('Round 31 external Overview stays tournament-neutral while preserving useful match blocks', () => {
  for (const competition of ['coppa_italia', 'ucl', 'uel', 'uecl']) {
    assert.equal(isRound31ExternalCompetition(competition), true);
  }
  assert.equal(isRound31ExternalCompetition('serie_a'), false);

  const html = renderRound31ExternalOverview(externalSnapshot);
  assert.match(html, /data-cw233-r31-overview/);
  assert.match(html, /Ключевые показатели/);
  assert.match(html, /mc-section-title[^>]*>\s*Форма\b/i);
  assert.match(html, /Информация о матче/);
  assert.doesNotMatch(html, /Контекст\s+Серии\s*[АA]/i);
  assert.doesNotMatch(html, /Матч не найден/i);
  assert.doesNotMatch(html, /cw14-form-card|cw14-match-info/);
});

test('Round 31 snapshot signature is stable for identical data and changes when visible live/detail values change', () => {
  const first = externalMatchCenterSnapshotSignature(externalSnapshot);
  const same = externalMatchCenterSnapshotSignature(structuredClone(externalSnapshot));
  const changed = externalMatchCenterSnapshotSignature({
    ...structuredClone(externalSnapshot),
    status:'live',
    match:{ ...externalSnapshot.match, home_score:1, away_score:0, live_elapsed:37 },
  });
  const changedDetail = externalMatchCenterSnapshotSignature({
    ...structuredClone(externalSnapshot),
    detail:{ ...externalSnapshot.detail, referee:'Updated Referee' },
  });
  assert.equal(first, same);
  assert.notEqual(first, changed);
  assert.notEqual(first, changedDetail);
});

test('Round 31 viewport ownership hides the outer Matches competition header independently of legacy class timing', () => {
  assert.match(ROUND31_CSS, /html\.cw233-r31-match-center-owned[^\{]*#ciao-v232-matches-overlay\s*\{[^}]*display:none!important/s);
  assert.match(ROUND31_CSS, /match-center-open \.content\s*\{[^}]*overflow-anchor:none!important/s);
  assert.match(ROUND31_CSS, /\[data-mc-tab-content\]\s*\{[^}]*min-height:/s);
});

test('Round 31 runtime is wired after the legacy Match Center modules', async () => {
  const index = await read('../src/v23.3/index.mjs');
  assert.match(index, /import ['"]\.\/round31-match-center-stability\.mjs['"]/);
  assert.ok(
    index.indexOf("./round31-match-center-stability.mjs") > index.indexOf("./home-integration.mjs"),
    'Round 31 must install after the external legacy Match Center bridge exists',
  );
});

test('Round 31 intercepts external Overview before target-level legacy listeners and coalesces refresh rewrites', async () => {
  const source = await read('../src/v23.3/round31-match-center-stability.mjs');
  assert.match(source, /documentRef\.addEventListener\(['"]click['"][\s\S]*?true\)/);
  assert.match(source, /data-mc-tab=['"]overview['"]/);
  assert.match(source, /stopImmediatePropagation/);
  assert.match(source, /MutationObserver/);
  assert.match(source, /data-cw233-r31-overview/);
  assert.match(source, /externalMatchCenterSnapshotSignature/);
  assert.match(source, /if\s*\(signature\s*===\s*lastSnapshotSignature\)\s*return\s+null/);
});
