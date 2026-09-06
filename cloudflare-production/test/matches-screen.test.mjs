import test from 'node:test';
import assert from 'node:assert/strict';
import { createSerieAClubIndex } from '../src/modular/data/selectors.mjs';
import * as matchesScreen from '../src/modular/screens/matches.mjs';
import * as tournamentCard from '../src/modular/ui/tournament-card.mjs';

test('matches screen exposes five premium tournament entry cards with distinct registry themes', () => {
  assert.equal(typeof tournamentCard.renderTournamentCard, 'function');
  assert.equal(typeof matchesScreen.renderMatchesScreen, 'function');
  const html = matchesScreen.renderMatchesScreen({matches:[],clubIndex:new Set()});
  for (const id of ['serie_a','coppa_italia','ucl','uel','uecl']) assert.match(html, new RegExp(`data-ciao-tournament="${id}"`));
  for (const theme of ['serie-a','coppa','champions','europa','conference']) assert.match(html, new RegExp(`theme-${theme}`));
  assert.doesNotMatch(html, /class="[^"]*plain-tab/);
});

test('selected tournament fixture view applies Coppa and UEFA inclusion rules', () => {
  const clubIndex = createSerieAClubIndex([{team:{id:1,name:'Juventus'}},{team:{id:2,name:'Inter'}}]);
  const matches = [
    {id:'ci-32',competition:'coppa_italia',stage:'Round of 32',kickoffAt:'2026-12-01T19:00:00Z',home:{id:1,name:'Juventus'},away:{id:7,name:'Bari'},score:{}},
    {id:'ci-16',competition:'coppa_italia',stage:'Round of 16',kickoffAt:'2026-12-10T19:00:00Z',home:{id:1,name:'Juventus'},away:{id:8,name:'Milan'},score:{}},
    {id:'ucl-it',competition:'ucl',stage:'League Phase',kickoffAt:'2026-09-20T19:00:00Z',home:{id:1,name:'Juventus'},away:{id:20,name:'Arsenal'},score:{}},
    {id:'ucl-foreign',competition:'ucl',stage:'League Phase',kickoffAt:'2026-09-21T19:00:00Z',home:{id:21,name:'Bayern'},away:{id:20,name:'Arsenal'},score:{}},
    {id:'ucl-qual',competition:'ucl',stage:'Qualification',isQualification:true,kickoffAt:'2026-08-01T19:00:00Z',home:{id:2,name:'Inter'},away:{id:22,name:'Basel'},score:{}},
  ];
  const coppa = matchesScreen.renderMatchesScreen({tournament:'coppa_italia',matches,clubIndex});
  assert.doesNotMatch(coppa, /ci-32/);
  assert.match(coppa, /ci-16/);
  const ucl = matchesScreen.renderMatchesScreen({tournament:'ucl',matches,clubIndex});
  assert.match(ucl, /ucl-it/);
  assert.doesNotMatch(ucl, /ucl-foreign|ucl-qual/);
});

test('matches screen delegates tournament and full match card clicks to the shared router', () => {
  assert.equal(typeof matchesScreen.handleMatchesScreenClick, 'function');
  const calls=[];
  const router={navigate:r=>calls.push(['navigate',r]),openMatchCenter:r=>calls.push(['match',r])};
  const tournamentTarget={closest:sel=>sel==='[data-ciao-tournament]'?{dataset:{ciaoTournament:'uel'}}:null};
  assert.equal(matchesScreen.handleMatchesScreenClick({target:tournamentTarget},{router}), true);
  const matchTarget={closest:sel=>sel==='[data-ciao-tournament]'?null:sel==='[data-ciao-match-id]'?{dataset:{ciaoMatchId:'uel-1',ciaoCompetition:'uel'}}:null};
  assert.equal(matchesScreen.handleMatchesScreenClick({target:matchTarget},{router}), true);
  assert.deepEqual(calls,[['navigate',{screen:'matches',tournament:'uel'}],['match',{competition:'uel',matchId:'uel-1'}]]);
});
