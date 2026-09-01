import test from 'node:test';
import assert from 'node:assert/strict';
import { extractSourceHints } from '../src/v23.2/api-contract-observer.mjs';

test('captures source immediately after the legacy club calendar POST call', () => {
  const source = `
    const __CW208_CLUB_CALENDAR='/api/ciao-club-calendar-fast-v1';
    async function loadClubSections(){
      const r=await __cw9Post(__CW208_CLUB_CALENDAR,{team_id:Number(clubViewId)});
      clubView.matches=r.matches;
      clubView.competitions=r.competitions;
    }
  `;
  const hints = extractSourceHints(source);
  const hint = hints.find(item => item.marker === '__cw9Post(__CW208_CLUB_CALENDAR');
  assert.ok(hint);
  assert.match(hint.snippet, /r\.matches/);
  assert.match(hint.snippet, /r\.competitions/);
});
