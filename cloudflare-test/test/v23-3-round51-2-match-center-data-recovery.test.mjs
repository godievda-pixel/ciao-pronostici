import test from 'node:test';
import assert from 'node:assert/strict';

import { round512NeedsCanonicalSectionRecovery } from '../src/v23.3/round51-2-serie-a-provider-recovery.mjs';

function lineupSide(prefix, startId) {
  return {
    starters:Array.from({ length:11 }, (_, index) => ({
      playerId:startId + index,
      name:`${prefix} ${index + 1}`,
      starter:true,
    })),
    substitutes:[],
  };
}

test('Round 51.2 recovery gate detects exactly 11+11 starters with no substitutes', () => {
  const sectionPayload = {
    section:'lineups',
    available:true,
    data:{
      home:lineupSide('Home', 1),
      away:lineupSide('Away', 101),
    },
  };

  assert.equal(round512NeedsCanonicalSectionRecovery(sectionPayload, 'lineups'), true);
  assert.equal(round512NeedsCanonicalSectionRecovery(sectionPayload, 'players'), false);
});
