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
  events:[
    { type:'goal', minute:12, side:'home', player:'J. Pohjanpalo', assist:'D. Johnsen', homeScore:1, awayScore:0 },
    { type:'substitution', minute:61, side:'home', playerIn:'Hernani', playerOut:'A. Palumbo' },
  ],
  lineups:{
    home:{ formation:'4-3-3', starters:[{ playerId:10, name:'J. Pohjanpalo', shirtNumber:20 }], substitutes:[{ playerId:11, name:'F. Ranocchia', shirtNumber:14 }] },
    away:{ formation:'3-5-2', starters:[{ playerId:20, name:'D. Mensah', shirtNumber:7 }], substitutes:[] },
  },
  players:[{ playerId:10, name:'J. Pohjanpalo', teamName:'Палермо', rating:8.8, goals:2, assists:1, xg:1.3, xa:0.2, minutes:90 }],
});

test('Round 19 external data matches the exact proven Serie A legacy contract', () => {
  const legacy = BsdAdapter.toSerieALegacyMatchCenterData(base, sections);
  assert.equal(legacy.match.home.name, 'Палермо');
  assert.equal(legacy.match.away.name, 'Мантова');
  assert.equal(legacy.match.home_score, 5);
  assert.equal(legacy.match.away_score, 2);
  assert.equal(legacy.match.is_finished, true);
  assert.equal(legacy.stats.stats.home.expected_goals, 2.57);
  assert.equal(legacy.stats.stats.away.ball_possession, 39);
  assert.deepEqual(legacy.stats.momentum[0], { m:1, v:40 });
  assert.equal(legacy.stats.shotmap[0].pos.x, 72);
  assert.equal(legacy.stats.shotmap[0].home, true);
  assert.equal(legacy.incidents.incidents[0].player.name, 'J. Pohjanpalo');
  assert.equal(legacy.incidents.incidents[0].player_name, 'J. Pohjanpalo');
  assert.equal(legacy.incidents.incidents[0].assist.name, 'D. Johnsen');
  assert.equal(legacy.incidents.incidents[0].assist_name, 'D. Johnsen');
  assert.equal(legacy.incidents.incidents[1].player_in.name, 'Hernani');
  assert.equal(legacy.incidents.incidents[1].player_in_name, 'Hernani');
  assert.equal(legacy.incidents.incidents[1].player_out.name, 'A. Palumbo');
  assert.equal(legacy.incidents.incidents[1].player_out_name, 'A. Palumbo');
  assert.equal(legacy.lineups.lineups.home.players[0].name, 'J. Pohjanpalo');
  assert.equal(legacy.lineups.lineups.home.substitutes[0].name, 'F. Ranocchia');
  assert.equal(legacy.player_stats.player_stats[0].expected_goals, 1.3);
  assert.equal(legacy.player_stats.player_stats[0].minutes_played, 90);
});

test('Round 19 loader fetches all five BSD sections then returns one Serie A legacy snapshot', async () => {
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
  assert.equal(legacy.incidents.incidents.length, 2);
});

test('Round 19 installs only the canonical match-link router, never the second Match Center overlay', async () => {
  const homeSource = await readFile(new URL('../src/v23.3/home-integration.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(homeSource, /installCanonicalMatchCenter/);
  assert.match(homeSource, /installCanonicalMatchLinks\(globalThis\.document\)/);

  const matchCenterSource = await readFile(new URL('../src/v23.3/match-center.mjs', import.meta.url), 'utf8');
  assert.match(matchCenterSource, /if \(payload\?\.competition === 'serie_a'\) return Core\.openCanonicalMatchCenter\(payload\)/);
  assert.match(matchCenterSource, /return openExternalLegacyMatchCenter\(payload\)/);
});

test('Round 19 source patch opens external matches with the real Serie A matchCenterHtml and bindMatchCenter', () => {
  const fixture = `
const __cw231HomeHtml = () => '';
let predict;
const root = document.body;
const main = document.body;
let matchReturnTab='predict',matchViewId=null,matchCenterTab='overview',matchData=null,matchLoading=false,tab='predict';
function matchCenterHtml(d){ return String(d); }
function matchTabContent(){ return ''; }
function bindMatchCenter(){}
function closeMatchCenter(){}
function patchMatchCenter(){}
async function refreshMatchCenter(){}
function render(){}
predict = __cw231HomeHtml;
`;
  const patched = applyHomeV233SourcePatch(fixture);
  assert.match(patched, /ciao-v233-open-external-legacy-match/);
  assert.match(patched, /main\.innerHTML = matchCenterHtml\(matchData\)/);
  assert.match(patched, /bindMatchCenter\(\)/);
  assert.match(patched, /root\.dataset\.cw233McCompetition/);
  assert.match(patched, /textContent = 'Статы'/);
});

test('Round 19 external lifecycle wraps the final legacy refresh and close functions after all cw20 overrides', () => {
  const lateMarker = '/* ===== /Ciao, Web! v20.15 stable match center live patch ===== */';
  const fixture = `
const __cw231HomeHtml = () => '';
let predict;
const root = document.body;
const main = document.body;
let matchReturnTab='predict',matchViewId=null,matchCenterTab='overview',matchData=null,matchLoading=false,tab='predict';
function matchCenterHtml(d){ return String(d); }
function matchTabContent(){ return ''; }
function bindMatchCenter(){}
function closeMatchCenter(){}
function patchMatchCenter(){}
async function refreshMatchCenter(){}
function render(){}
predict = __cw231HomeHtml;
refreshMatchCenter=async function(){ return 'cw20-final'; };
${lateMarker}
`;
  const patched = applyHomeV233SourcePatch(fixture);
  const late = patched.indexOf(lateMarker);
  const finalBridge = patched.indexOf('cw233-single-legacy-match-center-r20');
  assert.ok(late >= 0);
  assert.ok(finalBridge > late);
  assert.match(patched.slice(finalBridge), /CiaoV233ExternalLegacyMatchCenter\?\.refresh/);
  assert.match(patched.slice(finalBridge), /delete root\.dataset\.cw233McCompetition/);
});

test('Round 19 legacy tournament theme module styles the existing mc-* classes instead of creating a new layout', async () => {
  const source = await readFile(new URL('../src/v23.3/legacy-match-center-theme.mjs', import.meta.url), 'utf8');
  assert.match(source, /data-cw233-mc-competition/);
  assert.match(source, /\.mc-hero/);
  assert.match(source, /\.mc-tab\.active/);
  assert.match(source, /\.mc-section/);
  assert.match(source, /coppa_italia/);
  assert.match(source, /ucl/);
  assert.match(source, /uel/);
  assert.match(source, /uecl/);
  assert.doesNotMatch(source, /cw233-mc-shell/);
});
