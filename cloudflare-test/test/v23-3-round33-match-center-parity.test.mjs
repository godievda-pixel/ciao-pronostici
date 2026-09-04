import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  externalMatchCenterSnapshotSignature,
  renderRound31ExternalOverview,
} from '../src/v23.3/round31-match-center-stability.mjs';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

const richExternalSnapshot = Object.freeze({
  status:'scheduled',
  match_id:'ucl:9001',
  match:Object.freeze({
    id:'ucl:9001',
    home:Object.freeze({ name:'Реал Мадрид' }),
    away:Object.freeze({ name:'Интер' }),
    prediction:Object.freeze({ home_score:2, away_score:1, points:null }),
  }),
  detail:Object.freeze({
    stadium:'Сантьяго Бернабеу',
    city:'Мадрид',
    stadium_capacity:81044,
    referee:'Маурицио Мариани',
  }),
  form:Object.freeze({
    home:Object.freeze(['В','В','Н','В','П']),
    away:Object.freeze(['В','Н','В','В','В']),
  }),
  prediction_split:Object.freeze({ home:46, draw:29, away:25 }),
  stats:Object.freeze({
    stats:Object.freeze({
      home:Object.freeze({ expected_goals:1.82, ball_possession:57, total_shots:14, shots_on_target:6 }),
      away:Object.freeze({ expected_goals:1.21, ball_possession:43, total_shots:10, shots_on_target:4 }),
    }),
    momentum:Object.freeze([{ m:10, v:35 }, { m:20, v:-20 }]),
    shotmap:Object.freeze([
      Object.freeze({ pos:Object.freeze({ x:72, y:55 }), home:true, xg:0.31 }),
      Object.freeze({ pos:Object.freeze({ x:28, y:42 }), home:false, xg:0.14 }),
    ]),
  }),
});

test('Round 33 hides the obsolete Round 9 Serie A tournament header whenever the real legacy Match Center is open', async () => {
  const source = await read('../src/v23.3/round9-regression-fixes.mjs');
  assert.match(
    source,
    /#ciao-miniapp-root\.match-center-open\s+\.cw233-serie-a-competition-head\s*\{[^}]*display\s*:\s*none!important/s,
  );
});

test('Round 33 external Overview restores useful parity blocks instead of the stripped Round 31 two-block view', () => {
  const html = renderRound31ExternalOverview(richExternalSnapshot);

  assert.match(html, /Ключевые показатели/);
  assert.match(html, /Форма/);
  assert.match(html, /Информация о матче/);
  assert.match(html, /Прогнозы/);
  assert.match(html, /Давление/);
  assert.match(html, /Карта ударов/);
  assert.match(html, /Сантьяго Бернабеу/);
  assert.match(html, /81[\s ]?044/);
  assert.match(html, /2\s*:\s*1/);
  assert.doesNotMatch(html, /Контекст\s+Серии\s*[АA]/i);
  assert.doesNotMatch(html, /Матч не найден/i);
});

test('Round 33 external refresh signature includes every Overview surface that can visibly change', () => {
  const base = externalMatchCenterSnapshotSignature(richExternalSnapshot);
  const withForm = externalMatchCenterSnapshotSignature({
    ...richExternalSnapshot,
    form:{ ...richExternalSnapshot.form, home:['В','В','В','В','В'] },
  });
  const withPrediction = externalMatchCenterSnapshotSignature({
    ...richExternalSnapshot,
    match:{ ...richExternalSnapshot.match, prediction:{ home_score:1, away_score:1 } },
  });
  const withMomentum = externalMatchCenterSnapshotSignature({
    ...richExternalSnapshot,
    stats:{ ...richExternalSnapshot.stats, momentum:[{ m:10, v:80 }] },
  });
  const withShotmap = externalMatchCenterSnapshotSignature({
    ...richExternalSnapshot,
    stats:{ ...richExternalSnapshot.stats, shotmap:[{ pos:{ x:50, y:50 }, home:true, xg:0.8 }] },
  });

  assert.notEqual(base, withForm);
  assert.notEqual(base, withPrediction);
  assert.notEqual(base, withMomentum);
  assert.notEqual(base, withShotmap);
});
