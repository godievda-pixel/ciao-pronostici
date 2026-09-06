import test from 'node:test';
import assert from 'node:assert/strict';
import { renderPredictionsScreen } from '../src/modular/screens/predictions.mjs';

test('prediction renderer escapes double quotes with a complete HTML entity', () => {
  const html = renderPredictionsScreen({
    mode:'mine',
    data:{ items:[{
      competition:'ucl',
      home_score:1,
      away_score:0,
      points:0,
      match:{ home:{name:'AC "Milan"'}, away:{name:'Inter'} },
    }] },
  });

  assert.match(html, /AC &quot;Milan&quot;/);
  assert.doesNotMatch(html, /&quotMilan/);
});
