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

test('captures the legacy club calendar renderer where match metadata is consumed', () => {
  const source = `
    __cw16MatchesHtml=function(d){
      const m=d?.matches||{};
      const all=Array.isArray(m?.all)?m.all:[];
      return all.map(x => x.competition_name + x.home.name + x.away.name).join('');
    };
  `;
  const hints = extractSourceHints(source);
  const hint = hints.find(item => item.marker === '__cw16MatchesHtml=function');
  assert.ok(hint);
  assert.match(hint.snippet, /competition_name/);
  assert.match(hint.snippet, /m\?\.all/);
});

test('captures source after club calendar rows are selected for rendering', () => {
  const source = `
    const rows=all.filter(x=>Number(x.round_number)===selected);
    const cards=rows.map(x=>x.competition_name + x.status + x.home.name + x.away.name);
  `;
  const hints = extractSourceHints(source);
  const hint = hints.find(item => item.marker === 'const rows=all.filter');
  assert.ok(hint);
  assert.match(hint.snippet, /round_number/);
  assert.match(hint.snippet, /competition_name/);
});
