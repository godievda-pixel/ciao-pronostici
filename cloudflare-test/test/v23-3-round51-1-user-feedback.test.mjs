import test from 'node:test';
import assert from 'node:assert/strict';

import { renderMatchCenterOverview } from '../src/v23.3/match-center-overview.mjs';
import { enhanceRound51MatchCenterView } from '../src/v23.3/round51-match-center-view.mjs';

test('Round 51.1 team form keeps all five results in one equal-width row', () => {
  const base = renderMatchCenterOverview({
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
  const html = enhanceRound51MatchCenterView(base, { activeTab:'overview' }, { activeViewTab:'overview' });

  assert.match(html, /data-cw511-feedback-style/);
  assert.match(html, /\.cw233-mc-form-run\{display:grid;grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
  assert.match(html, /\.cw233-mc-form-chip\{min-width:0;width:100%;height:24px/);
});
