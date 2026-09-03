import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as BsdAdapter from '../src/v23.3/bsd-serie-a-legacy-adapter.mjs';
import { loadExternalLegacyMatchCenter } from '../src/v23.3/match-center.mjs';
import { applyHomeV233SourcePatch } from '../scripts/home-v23-3-source-patch.mjs';

const base = Object.freeze({
  competition:'coppa_italia',
  matchId:'coppa_italia:600982',
  kickoffAt:'2026-09-03T16:00:00Z',
  status:'finished',
  minute:null,
  homeScore:5,
  awayScore:2,
  homeTeam:{ id:1104, name:'Палермо', crestUrl:'https://example.test/palermo.png' },
  awayTeam:{ id:4121, name:'Мантова', crestUrl:'https://example.test/mantova.png' },
  coverage:{ overview:true, stats:true, events:true, lineups:true, players:true, momentum:true, shotmap:true },
});

const sections = Object.freeze({
  overview:{
    venue:{ name:'Renzo Barbera', city:'Palermo', capacity:36349 },
    referee:{ name:'Marco Guida' },
    form:{ home:['В','В','П','В','Н'], away:['П','Н','В','П','П'] },
    summaryStats:{
      home:{ xg:2.57, possession:61, shots:17, shotsOnTarget:8, bigChances:5, corners:6, fouls:11, offsides:1, yellowCards:2, redCards:0, saves:2, passAccuracy:87.4, interceptions:4, tackles:20 },
      away:{ xg:0.87, possession:39, shots:9, shotsOnTarget:3, bigChances:1, corners:2, fouls:14, offsides:3, yellowCards:4, redCards:0, saves:3, passAccuracy:82.9, interceptions:6, tackles:24 },
    },
    momentum:[{ minute:1, home:70, away:30 }, { minute:2, home:35, away:65 }],
    shotmap:[{ side:'home', x:72, y:64, xg:0.31 }, { side:'away', x:31, y:47, xg:0.08 }],
  },
  stats:{
    home:{ xg:2.57, possession:61, shots:17, shotsOnTarget:8, bigChances:5, corners:6, fouls:11, offsides:1, yellowCards:2, redCards:0, saves:2, passAccuracy:87.4, interceptions:4, tackles:20 },
    away:{ xg:0.87, possession:39, shots:9, shotsOnTarget:3, bigChances:1, corners:2, fouls:14, offsides:3, yellowCards:4, redCards:0, saves:3, passAccuracy:82.9, interceptions:6, tackles:24 },
  },
  events:[{ type:'goal', minute:12, side:'home', player:'J. Pohjanpalo', homeScore:1, awayScore:0 }],
  lineups:{
    home:{ formation:'4-3-3', starters:[{ playerId:10, name:'J. Pohjanpalo', shirtNumber:20 }], substitutes:[{ playerId:11, name:'F. Ranocchia', shirtNumber:14 }] },
    away:{ formation:'3-5-2', starters:[{ playerId:20, name:'D. Mensah', shirtNumber:7 }], substitutes:[] },
  },
  players:[{ playerId:10, name:'J. Pohjanpalo', teamName:'Палермо', rating:8.8, goals:2, assists:1, xg:1.3, xa:0.2, minutes:90 }],
});

test('Round 19 external Match Center exposes a Serie A legacy-compatible data adapter', () => {
  assert.equal(typeof BsdAdapter.toSerieALegacyMatchCenterData, 'function');
  const legacy = BsdAdapter.toSerieALegacyMatchCenterData(base, sections);
  assert.equal(legacy.status, 'finished');
  assert.equal(legacy.match.home.name, 'Палермо');
  assert.equal(legacy.match.away.name, 'Мантова');
  assert.equal(legacy.match.home_score, 5);
  assert.equal(legacy.match.away_score, 2);
  assert.equal(legacy.match.is_finished, true);
  assert.equal(legacy.match.home.logo, 'https://example.test/palermo.png');
  assert.equal(legacy.match.away.logo, 'https://example.test/mantova.png');
  assert.equal(legacy.stats.stats.home.expected_goals, 2.57);
  assert.equal(legacy.stats.stats.away.ball_possession, 39);
  assert.deepEqual(legacy.stats.momentum[0], { m:1, v:40 });
  assert.equal(legacy.stats.shotmap[0].pos.x, 72);
  assert.equal(legacy.stats.shotmap[0].home, true);
  assert.equal(legacy.incidents.incidents[0].player_name, 'J. Pohjanpalo');
  assert.equal(legacy.lineups.lineups.home.players[0].name, 'J. Pohjanpalo');
  assert.equal(legacy.lineups.lineups.home.substitutes[0].name, 'F. Ranocchia');
  assert.equal(legacy.player_stats.player_stats[0].expected_goals, 1.3);
  assert.equal(legacy.player_stats.player_stats[0].minutes_played, 90);
});

test('Round 19 loader fetches all canonical sections then returns one legacy snapshot', async () => {
  const seen = [];
  const legacy = await loadExternalLegacyMatchCenter('coppa_italia', 'coppa_italia:600982', {
    loadBase:async () => ({ match:base }),
    loadSection:async (_competition, _matchId, section) => {
      seen.push(section);
      return { data:sections[section] };
    },
  });
  assert.deepEqual(seen.sort(), ['events','lineups','overview','players','stats']);
  assert.equal(legacy.match.home_score, 5);
  assert.equal(legacy.stats.momentum.length, 2);
  assert.equal(legacy.incidents.incidents.length, 1);
});

test('Round 19 build patch installs an external event bridge into the real legacy renderer', () => {
  const fixture = `
const __cw231HomeHtml = () => '';
let predict;
function matchCenterHtml(d){ return String(d); }
function bindMatchCenter(){}
function closeMatchCenter(){}
function patchMatchCenter(){}
async function refreshMatchCenter(){}
predict = __cw231HomeHtml;
`;
  const patched = applyHomeV233SourcePatch(fixture);
  assert.match(patched, /ciao-v233-open-external-legacy-match/);
  assert.match(patched, /matchCenterHtml\(matchData\)/);
  assert.match(patched, /bindMatchCenter\(\)/);
  assert.match(patched, /__cw233ExternalMatchContext/);
  assert.match(patched, /textContent = 'Статы'/);
});

test('Round 19 production-shaped source patch owns external refresh and close lifecycle', () => {
  const fixture = `
const __cw231HomeHtml = () => '';
let predict;
function closeMatchCenter(){matchViewId=null;matchData=null;matchCenterTab='overview';root.classList.remove('match-center-open');tab=matchReturnTab;render()}
async function refreshMatchCenter(){if(!matchViewId||matchLoading||document.hidden||String(matchData?.status??'').toLowerCase()==='finished')return;try{const next=await matchApi(matchViewId);patchMatchCenter(next)}catch(e){}}
predict = __cw231HomeHtml;
`;
  const patched = applyHomeV233SourcePatch(fixture);
  assert.match(patched, /function closeMatchCenter\(\)\{__cw233ExternalMatchContext=null;/);
  assert.match(patched, /CiaoV233ExternalLegacyMatchCenter\?\.refresh/);
});

test('Round 19 wrapper must not suppress core click listeners', async () => {
  const source = await readFile(new URL('../src/v23.3/match-center.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /if \(type === 'click'\) return undefined/);
  assert.match(source, /Core\.installCanonicalMatchCenter\(documentRef, options\)/);
});
