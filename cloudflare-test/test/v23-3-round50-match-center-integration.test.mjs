import test from 'node:test';
import assert from 'node:assert/strict';

import { renderMatchCenterOverview } from '../src/v23.3/match-center-overview.mjs';
import { renderMatchCenterStats } from '../src/v23.3/match-center-stats.mjs';
import { renderMatchCenterEvents } from '../src/v23.3/match-center-events.mjs';
import { renderMatchCenterLineups } from '../src/v23.3/match-center-lineups.mjs';
import { renderMatchCenterPlayers } from '../src/v23.3/match-center-players.mjs';
import { renderMatchCenterView, MATCH_CENTER_VIEW_TABS } from '../src/v23.3/match-center-view.mjs';
import { matchCenterTheme } from '../src/v23.3/match-center-theme.mjs';
import { createCanonicalMatchCenterRuntime } from '../src/v23.3/match-center-runtime.mjs';

const COMPETITIONS = ['serie_a', 'coppa_italia', 'ucl', 'uel', 'uecl'];
const match = {
  competition:'serie_a',
  matchId:'serie_a:50',
  status:'finished',
  kickoffAt:'2026-09-05T18:00:00Z',
  homeTeam:{ name:'Интер', crestUrl:'' },
  awayTeam:{ name:'Ювентус', crestUrl:'' },
  score:{ home:2, away:1 },
  homeScore:2,
  awayScore:1,
  coverage:{ overview:true, stats:true, events:true, lineups:true, players:true, momentum:true, shotmap:true },
  goals:{ home:[{ player:'Лаутаро', minute:12, kind:'penalty' }], away:[{ player:'Влахович', minute:63 }] },
};

const overview = {
  venue:{ name:'San Siro', city:'Milano', capacity:75817 },
  referee:{ name:'Daniele Orsato' },
  form:{ home:['W','W','D','W','L'], away:['W','D','W','L','W'] },
  prediction:{ kind:'user', homeScore:2, awayScore:1, points:3 },
  predictionSplit:{ home:48, draw:27, away:25, total:126, exactScoreProbability:18, popularScores:[{ score:'2:1', percent:18 }] },
  summaryStats:{ home:{ xg:1.82, possession:56, shots:15, shotsOnTarget:7 }, away:{ xg:1.05, possession:44, shots:10, shotsOnTarget:4 } },
  bestPlayer:{ name:'Лаутаро', teamName:'Интер', rating:8.7 },
  recentEvents:[{ type:'goal', minute:63, side:'away', player:'Влахович' }],
};

const stats = {
  home:{ xg:1.82, possession:56, shots:15, shotsOnTarget:7, bigChances:4, corners:6, fouls:11, offsides:2, yellowCards:3, redCards:0, saves:3, passAccuracy:88, interceptions:9, tackles:13 },
  away:{ xg:1.05, possession:44, shots:10, shotsOnTarget:4, bigChances:2, corners:4, fouls:14, offsides:1, yellowCards:2, redCards:0, saves:5, passAccuracy:82, interceptions:11, tackles:15 },
  momentum:[{ minute:15, home:63, away:37 }, { minute:45, home:47, away:53 }, { minute:75, home:68, away:32 }],
  shots:[{ side:'home', x:78, y:44, minute:12, player:'Лаутаро', xg:.76, outcome:'goal', situation:'penalty' }],
};

const events = [
  { type:'goal', minute:12, side:'home', player:'Лаутаро', goalKind:'penalty', homeScore:1, awayScore:0 },
  { type:'yellow_card', minute:31, side:'away', player:'Локателли' },
  { type:'period', minute:45, text:'Перерыв' },
  { type:'substitution', minute:55, side:'home', playerIn:'Фраттези', playerOut:'Мхитарян' },
  { type:'goal', minute:63, side:'away', player:'Влахович', homeScore:1, awayScore:1 },
  { type:'var', minute:70, side:'home', player:'Лаутаро', varDecision:'goal_disallowed' },
  { type:'period', minute:90, text:'Матч окончен' },
];

const starters = prefix => Array.from({ length:11 }, (_, index) => ({
  playerId:index + 1,
  name:`${prefix} ${index + 1}`,
  shirtNumber:index + 1,
  position:index === 0 ? 'GK' : index < 5 ? 'DF' : index < 9 ? 'MF' : 'FW',
}));

const lineups = {
  home:{ formation:'3-5-2', coach:'Симоне Индзаги', starters:starters('Интер'), substitutes:[{ playerId:31, name:'Фраттези', shirtNumber:16, position:'MF' }] },
  away:{ formation:'4-3-3', coach:'Тиаго Мотта', starters:starters('Юве'), substitutes:[{ playerId:41, name:'Йылдыз', shirtNumber:10, position:'FW' }] },
};

const players = [
  { playerId:10, name:'Лаутаро', teamName:'Интер', rating:8.7, minutes:90, goals:2, assists:1, xg:1.22, xa:.31, shots:5, keyPasses:2 },
  { playerId:9, name:'Тюрам', teamName:'Интер', rating:7.6, minutes:84, goals:1, shots:3 },
  { playerId:5, name:'Локателли', teamName:'Ювентус', rating:7.1, minutes:90, keyPasses:1 },
];

const context = { match };

test('Round 50 integration keeps the five canonical tabs and five distinct tournament identities', () => {
  assert.deepEqual(MATCH_CENTER_VIEW_TABS, ['overview','stats','events','lineups','players']);
  const accents = new Set();
  const keys = new Set();

  for (const competition of COMPETITIONS) {
    const themedMatch = { ...match, competition, matchId:`${competition}:50` };
    const theme = matchCenterTheme(competition);
    const html = renderMatchCenterView({
      open:true,
      phase:'ready',
      competition,
      matchId:themedMatch.matchId,
      activeTab:'overview',
      match:themedMatch,
      sections:{ overview, stats, events, lineups, players },
      sectionState:{
        overview:{ status:'ready', error:'' },
        stats:{ status:'ready', error:'' },
        events:{ status:'ready', error:'' },
        lineups:{ status:'ready', error:'' },
        players:{ status:'ready', error:'' },
      },
    });
    accents.add(theme.vars['--mc-accent']);
    keys.add(theme.key);
    assert.match(html, new RegExp(`data-cw239-competition="${competition}"`));
    assert.match(html, new RegExp(`data-cw239-theme="${theme.key}"`));
    assert.equal((html.match(/data-cw239-tab=/g) || []).length, 5);
  }

  assert.equal(accents.size, 5);
  assert.equal(keys.size, 5);
});

test('Round 50 integration preserves Overview product hierarchy and rich optional data', () => {
  const html = renderMatchCenterOverview(overview, context);
  const key = html.indexOf('data-cw250-key-indicators');
  const form = html.indexOf('data-cw233-mc-overview-region="form"');
  const info = html.indexOf('data-cw233-mc-overview-region="context"');
  const prediction = html.indexOf('data-cw233-mc-overview-region="prediction"');
  assert.ok(key >= 0 && key < form && form < info && info < prediction);
  for (const marker of ['data-cw250-best-player','data-cw250-recent-events','data-cw250-prediction-distribution','data-cw250-exact-score','data-cw250-popular-scores']) {
    assert.match(html, new RegExp(marker));
  }
  assert.doesNotMatch(html, /data-cw233-mc-overview-region="momentum"|data-cw233-mc-overview-region="shotmap"/);
});

test('Round 50 integration keeps Stats comparisons, pressure and shot analysis in one hierarchy', () => {
  const html = renderMatchCenterStats(stats, context);
  const primary = html.indexOf('data-cw250-mc-stats-primary');
  const secondary = html.indexOf('data-cw250-mc-stats-secondary');
  const pressure = html.indexOf('data-cw250-mc-pressure');
  const shotmap = html.indexOf('data-cw233-mc-shotmap');
  assert.ok(primary >= 0 && primary < secondary && secondary < pressure && pressure < shotmap);
  assert.match(html, /data-cw233-mc-shot-list/);
});

test('Round 50 integration keeps chronological home-away Events with period and score semantics', () => {
  const html = renderMatchCenterEvents(events, context);
  assert.match(html, /data-cw250-mc-events-timeline/);
  assert.match(html, /data-cw250-mc-side="home"/);
  assert.match(html, /data-cw250-mc-side="away"/);
  assert.match(html, /data-cw250-mc-period/);
  assert.match(html, /data-cw250-mc-score-after>1:0</);
  assert.ok(html.indexOf('>12′<') < html.indexOf('>90′<'));
});

test('Round 50 integration keeps lineup selector, pitch, official text fallback and Players metric cards', () => {
  const lineupHtml = renderMatchCenterLineups(lineups, context);
  assert.match(lineupHtml, /data-cw250-mc-lineup-stage/);
  assert.match(lineupHtml, /data-cw250-mc-lineup-switch/);
  assert.match(lineupHtml, /data-cw233-mc-pitch/);
  assert.match(lineupHtml, /data-cw250-mc-starting-xi/);
  assert.match(lineupHtml, /data-cw250-mc-bench/);

  const playerHtml = renderMatchCenterPlayers(players, context);
  assert.match(playerHtml, /data-cw250-mc-player-card/);
  assert.match(playerHtml, /is-top-player/);
  for (const metric of ['minutes','goals','assists','xg','xa','shots','keyPasses']) {
    assert.match(playerHtml, new RegExp(`data-cw250-mc-player-metric="${metric}"`));
  }
});

test('Round 50 integration keeps runtime Back source restoration and hidden native overlay scrollbar contract', async () => {
  const restored = [];
  const suspended = [];
  const source = Object.freeze({ surface:'matches', tab:'calendar', competition:'ucl', scrollTop:371, matchesOverlayScrollTop:84 });
  const host = { bind(){}, render(){}, hide(){}, scrollToTop(){}, destroy(){} };
  const store = {
    subscribe(listener){ this.listener = listener; return () => {}; },
    async open(payload){ return payload; },
    close(){ return { open:false }; },
    setActiveTab(){},
  };
  const runtime = createCanonicalMatchCenterRuntime({
    store,
    host,
    renderView:() => '',
    suspendSource:value => suspended.push(value),
    restoreSource:value => restored.push(value),
  });

  await runtime.open({ competition:'ucl', matchId:'ucl:50', source });
  runtime.back();
  assert.deepEqual(suspended, [source]);
  assert.deepEqual(restored, [source]);

  const html = renderMatchCenterView({
    open:true,
    phase:'ready',
    competition:'ucl',
    matchId:'ucl:50',
    activeTab:'overview',
    match:{ ...match, competition:'ucl', matchId:'ucl:50' },
    sections:{ overview, stats, events, lineups, players },
    sectionState:{ overview:{ status:'ready', error:'' }, stats:{ status:'ready', error:'' }, events:{ status:'ready', error:'' }, lineups:{ status:'ready', error:'' }, players:{ status:'ready', error:'' } },
  });
  assert.match(html, /scrollbar-width:none/);
  assert.match(html, /\.cw239-mc::-webkit-scrollbar\{display:none/);
});
