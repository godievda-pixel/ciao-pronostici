import test from 'node:test';
import assert from 'node:assert/strict';
import { renderPredictionsScreen } from '../src/modular/screens/predictions.mjs';

test('mine prediction with null points does not render a fake +0 score', () => {
  const html = renderPredictionsScreen({
    mode:'mine',
    data:{ items:[{
      competition:'ucl',
      match_id:'ucl:601024',
      home_score:2,
      away_score:1,
      points:null,
      match:{ home:{name:'Milan'}, away:{name:'Real Madrid'} },
    }] },
  });

  assert.match(html, /2\s*:\s*1/);
  assert.doesNotMatch(html, /ciao-predictions-points[^>]*>\+0</);
});
