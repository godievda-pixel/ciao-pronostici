import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getMatchBootstrap,
  rememberMatchBootstrap,
} from '../src/v23.3/match-bootstrap-cache.mjs';

test('Round 51.2 preserves a known team crest when a later bootstrap for the same match is poorer', () => {
  rememberMatchBootstrap({
    competition:'serie_a',
    matchId:'serie_a:9512',
    homeTeam:{ name:'Рома', crestUrl:'https://img.test/roma.png' },
    awayTeam:{ name:'Аталанта', crestUrl:'https://img.test/atalanta.png' },
    status:'finished',
  });

  rememberMatchBootstrap({
    competition:'serie_a',
    matchId:'serie_a:9512',
    homeTeam:{ name:'Рома', crestUrl:'' },
    awayTeam:{ name:'Аталанта' },
    status:'finished',
    minute:90,
  });

  const cached = getMatchBootstrap('serie_a', 'serie_a:9512');
  assert.equal(cached.homeTeam.crestUrl, 'https://img.test/roma.png');
  assert.equal(cached.awayTeam.crestUrl, 'https://img.test/atalanta.png');
  assert.equal(cached.minute, 90);
});
