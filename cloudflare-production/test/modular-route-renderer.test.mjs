import test from 'node:test';
import assert from 'node:assert/strict';
import { renderModularRoute } from '../src/modular/core/route-renderer.mjs';

const serieARow = { position:1, team:{ id:'10', name:'Inter' }, played:1, wins:1, draws:0, losses:0, goalDifference:2, points:3 };
const uclMatch = { id:'ucl:7', competition:'ucl', kickoffAt:'2026-09-20T19:00:00Z', status:'scheduled', home:{ id:'10', name:'Inter' }, away:{ id:'20', name:'Arsenal' }, score:{ home:null, away:null }, stage:'League Phase', isQualification:false };

function service() {
  const calls = [];
  return {
    calls,
    async loadFavoriteClub(){ calls.push(['favorite']); return { id:'10', name:'Inter' }; },
    async loadAllMatches(){ calls.push(['all-matches']); return { matches:[uclMatch], errors:[] }; },
    async loadPredictions({ mode }){ calls.push(['predictions', mode]); return { items:[{ title:mode === 'mine' ? 'Inter 1:0 Arsenal' : 'Inter — Arsenal' }] }; },
    async loadRanking({ scope }){ calls.push(['ranking', scope]); return { rows:[{ rank:1, id:1, display_name:'Danya', points:12 }] }; },
    async loadStandings(competition){ calls.push(['standings', competition]); return { rows:competition === 'serie_a' ? [serieARow] : [{ ...serieARow, team:{ id:'20', name:'Arsenal' } }] }; },
    async loadMatchCenter({ competition, matchId, section }){ calls.push(['mc', competition, matchId, section]); return { title:'Inter — Arsenal', note:section }; },
  };
}

test('route renderer owns predictions subviews and ranking scopes through the Core data service', async () => {
  const dataService = service();
  const predictions = await renderModularRoute({ screen:'predictions', subview:'mine' }, { dataService });
  const ranking = await renderModularRoute({ screen:'ranking', subview:'europe' }, { dataService });

  assert.match(predictions, /Мои прогнозы/);
  assert.match(predictions, /Inter 1:0 Arsenal/);
  assert.match(ranking, /Еврокубки/);
  assert.match(ranking, /Danya/);
  assert.deepEqual(dataService.calls.slice(0, 2), [['predictions','mine'], ['ranking','europe']]);
});

test('route renderer builds tournament-first matches and shared tables from normalized data', async () => {
  const dataService = service();
  const matches = await renderModularRoute({ screen:'matches', tournament:'ucl' }, { dataService });
  const tables = await renderModularRoute({ screen:'tables', tournament:'uel' }, { dataService });

  assert.match(matches, /Inter/);
  assert.match(matches, /Arsenal/);
  assert.match(matches, /data-ciao-match-id="ucl:7"/);
  assert.match(tables, /Таблицы/);
  assert.match(tables, /Arsenal/);
  assert.ok(dataService.calls.some(call => call[0] === 'standings' && call[1] === 'serie_a'));
  assert.ok(dataService.calls.some(call => call[0] === 'standings' && call[1] === 'uel'));
});

test('favorite, calcio and Match Center all render from the same five-tournament data layer', async () => {
  const dataService = service();
  const favorite = await renderModularRoute({ screen:'favorite' }, { dataService, now:new Date('2026-09-10T12:00:00Z') });
  const calcio = await renderModularRoute({ screen:'calcio' }, { dataService, now:new Date('2026-09-20T12:00:00Z') });
  const matchCenter = await renderModularRoute({ screen:'match-center', tournament:'ucl', matchId:'ucl:7', subview:'stats' }, { dataService });

  assert.match(favorite, /Предстоящий матч/);
  assert.match(calcio, /Кальчо сегодня/);
  assert.match(matchCenter, /Статистика/);
  assert.match(matchCenter, /data-ciao-mc-section="stats"/);
});
