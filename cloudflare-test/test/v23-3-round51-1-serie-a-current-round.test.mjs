import test from 'node:test';
import assert from 'node:assert/strict';

import { currentCompetitionGroupKey } from '../src/v23.3/round51-1-current-round.mjs';

test('Round 51.1 selects the round containing the nearest still-playable Serie A match', () => {
  const groups = [
    { key:'round:2', matches:[{ kickoffAt:'2026-09-01T18:00:00Z', status:'finished' }] },
    { key:'round:3', matches:[
      { kickoffAt:'2026-09-05T18:00:00Z', status:'finished' },
      { kickoffAt:'2026-09-07T18:00:00Z', status:'scheduled' },
    ] },
    { key:'round:4', matches:[{ kickoffAt:'2026-09-14T18:00:00Z', status:'scheduled' }] },
    { key:'round:5', matches:[{ kickoffAt:'2026-09-18T18:00:00Z', status:'scheduled' }] },
  ];

  assert.equal(currentCompetitionGroupKey(groups, new Date('2026-09-06T12:00:00Z')), 'round:3');
});

test('Round 51.1 prefers a live round over later scheduled rounds', () => {
  const groups = [
    { key:'round:3', matches:[{ kickoffAt:'2026-09-06T12:00:00Z', status:'live' }] },
    { key:'round:4', matches:[{ kickoffAt:'2026-09-07T18:00:00Z', status:'scheduled' }] },
  ];

  assert.equal(currentCompetitionGroupKey(groups, new Date('2026-09-06T12:30:00Z')), 'round:3');
});
