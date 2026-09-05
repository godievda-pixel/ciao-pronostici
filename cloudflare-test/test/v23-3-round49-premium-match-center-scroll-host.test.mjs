import test from 'node:test';
import assert from 'node:assert/strict';
import { renderMatchCenterView } from '../src/v23.3/match-center-view.mjs';

test('Premium Match Center hides scrollbar on runtime overlay host', () => {
  const html = renderMatchCenterView({
    open:true,
    phase:'ready',
    competition:'serie_a',
    matchId:'serie_a:77',
    activeTab:'overview',
    match:{ competition:'serie_a', matchId:'serie_a:77', status:'finished', kickoffAt:'2026-09-20T18:00:00Z', homeTeam:{ name:'Интер' }, awayTeam:{ name:'Ювентус' }, score:{ home:2, away:1 }, coverage:{} },
    sections:{ overview:null, stats:null, events:null, lineups:null, players:null },
    sectionState:{ overview:{ status:'idle' }, stats:{ status:'idle' }, events:{ status:'idle' }, lineups:{ status:'idle' }, players:{ status:'idle' } },
  });
  assert.match(html, /#ciao-v239-match-center-overlay\{[^}]*scrollbar-width:none[^}]*-ms-overflow-style:none/s);
  assert.match(html, /#ciao-v239-match-center-overlay::-webkit-scrollbar\{[^}]*display:none[^}]*width:0[^}]*height:0/s);
});
