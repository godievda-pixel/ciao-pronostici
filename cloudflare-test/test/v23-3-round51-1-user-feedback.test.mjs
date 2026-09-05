import test from 'node:test';
import assert from 'node:assert/strict';

import { renderMatchCenterOverview } from '../src/v23.3/match-center-overview.mjs';

test('Round 51.1 team form keeps all five results in one equal-width row', () => {
  const html = renderMatchCenterOverview({
    form:{
      home:['W','L','D','W','L'],
      away:['L','W','D','L','W'],
    },
  }, {
    match:{
      homeTeam:{ name:'Парма' },
      awayTeam:{ name:'Монца' },
    },
  });

  assert.match(html, /\.cw233-mc-form-run\{display:grid;grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
});
