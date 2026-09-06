import test from 'node:test';
import assert from 'node:assert/strict';
import { renderPredictionsScreen } from '../src/modular/screens/predictions.mjs';

test('available predictions keep null scores empty while preserving a real zero score', () => {
  const html = renderPredictionsScreen({
    mode:'predictions',
    data:{ items:[
      {
        competition:'ucl', match_id:'ucl:null-score', prediction:{ home_score:null, away_score:null },
        match:{ competition:'ucl', home:{name:'Milan'}, away:{name:'Real Madrid'} },
      },
      {
        competition:'serie_a', match_id:'serie_a:77', prediction:{ home_score:0, away_score:0 },
        match:{ competition:'serie_a', round:'4', home:{name:'Inter'}, away:{name:'Juventus'} },
      },
    ] },
  });

  assert.match(html, /data-prediction-home value=""/);
  assert.match(html, /data-prediction-away value=""/);
  assert.match(html, /data-prediction-home value="0"/);
  assert.match(html, /data-prediction-away value="0"/);
});
