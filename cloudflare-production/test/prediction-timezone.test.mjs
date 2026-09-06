import test from 'node:test';
import assert from 'node:assert/strict';
import { renderPredictionsScreen } from '../src/modular/screens/predictions.mjs';

test('prediction kickoff and deadline use the user timezone like stable v22.5', () => {
  const previous = process.env.TZ;
  process.env.TZ = 'Europe/Rome';
  try {
    const html = renderPredictionsScreen({
      mode:'predictions',
      data:{
        items:[{
          competition:'ucl',
          match_id:'ucl:timezone',
          match:{
            competition:'ucl',
            id:'ucl:timezone',
            kickoffAt:'2026-09-06T20:00:00Z',
            home:{name:'Milan'},
            away:{name:'Real Madrid'},
          },
          deadline_at:'2026-09-06T19:45:00Z',
          prediction:{home_score:null,away_score:null},
        }],
      },
    });

    assert.match(html, /22:00/);
    assert.match(html, /21:45/);
    assert.doesNotMatch(html, /20:00/);
    assert.doesNotMatch(html, /19:45/);
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});
