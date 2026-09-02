import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  predictionRowsForMode,
  predictionNavigationGroups,
  defaultPredictionNavigationKey,
} from '../src/v23.3/predictions-ui.mjs';
import { adaptSerieASchedule } from '../src/v23.2/serie-a-adapter.mjs';
import { renderCompetitionScreen } from '../src/v23.2/matches-ui.mjs';

function match(id, competition, extra = {}) {
  return {
    matchId:`${competition}:${id}`,
    competition,
    kickoffAt:'2026-09-10T19:00:00Z',
    status:'scheduled',
    state:'open',
    round:null,
    stage:'',
    prediction:null,
    homeTeam:{ id:`h${id}`, name:`H${id}`, crestUrl:'' },
    awayTeam:{ id:`a${id}`, name:`A${id}`, crestUrl:'' },
    ...extra,
  };
}

test('make mode shows only writable matches while mine keeps played prediction history', () => {
  const rows = [
    match('1','serie_a',{ state:'open' }),
    match('2','serie_a',{ state:'locked' }),
    match('3','serie_a',{ state:'finished', status:'finished', prediction:{ prediction_id:'p3', points:5 } }),
    match('4','serie_a',{ state:'open', prediction:{ prediction_id:'p4', points:null } }),
  ];
  assert.deepEqual(predictionRowsForMode(rows, 'make').map(row => row.matchId), ['serie_a:1','serie_a:4']);
  assert.deepEqual(predictionRowsForMode(rows, 'mine').map(row => row.matchId), ['serie_a:3','serie_a:4']);
});

test('UEFA prediction navigation groups by clickable rounds and defaults to nearest future round', () => {
  const rows = [
    match('1','ucl',{ round:1, kickoffAt:'2026-08-20T19:00:00Z' }),
    match('2','ucl',{ round:2, kickoffAt:'2026-09-17T19:00:00Z' }),
    match('3','ucl',{ round:2, kickoffAt:'2026-09-17T21:00:00Z' }),
    match('4','ucl',{ round:3, kickoffAt:'2026-10-01T19:00:00Z' }),
  ];
  const groups = predictionNavigationGroups(rows, 'ucl');
  assert.deepEqual(groups.map(group => [group.key, group.label, group.matches.length]), [
    ['round:1','Тур 1',1],
    ['round:2','Тур 2',2],
    ['round:3','Тур 3',1],
  ]);
  assert.equal(defaultPredictionNavigationKey(groups, new Date('2026-09-02T18:00:00Z')), 'round:2');
});

test('Coppa prediction navigation groups by clickable stages', () => {
  const rows = [
    match('1','coppa_italia',{ stage:'Round of 32', kickoffAt:'2026-09-24T19:00:00Z' }),
    match('2','coppa_italia',{ stage:'Round of 32', kickoffAt:'2026-09-24T21:00:00Z' }),
    match('3','coppa_italia',{ stage:'Round of 16', kickoffAt:'2026-12-02T20:00:00Z' }),
  ];
  const groups = predictionNavigationGroups(rows, 'coppa_italia');
  assert.deepEqual(groups.map(group => [group.key, group.label]), [
    ['stage:Round of 32','1/16 финала'],
    ['stage:Round of 16','1/8 финала'],
  ]);
});

test('matches screens expose clickable round tabs for UEFA and stage tabs for Coppa', () => {
  const ucl = renderCompetitionScreen('ucl', { matches:[
    match('1','ucl',{ round:1 }),
    match('2','ucl',{ round:2, kickoffAt:'2026-09-18T19:00:00Z' }),
  ] }, { now:new Date('2026-09-02T18:00:00Z') });
  assert.match(ucl, /data-cw232-group-key="round:1"/);
  assert.match(ucl, /data-cw232-group-key="round:2"/);
  assert.match(ucl, />Тур 1</);
  assert.match(ucl, />Тур 2</);

  const coppa = renderCompetitionScreen('coppa_italia', { matches:[
    match('11','coppa_italia',{ stage:'Round of 64' }),
    match('12','coppa_italia',{ stage:'Round of 32', kickoffAt:'2026-09-20T19:00:00Z' }),
  ] }, { now:new Date('2026-09-02T18:00:00Z') });
  assert.match(coppa, /data-cw232-group-key="stage:Round of 64"/);
  assert.match(coppa, /data-cw232-group-key="stage:Round of 32"/);
});

test('ranking initial load uses one ranking request instead of rankings plus rankingMe reconciliation', async () => {
  const source = await readFile(new URL('../src/v23.3/ranking-ui.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /client\.rankingMe\(\)/);
  assert.match(source, /resolveCurrentRankingRow/);
});

test('predictions screen does not start the expensive rankingMe request while loading matches', async () => {
  const source = await readFile(new URL('../src/v23.3/predictions-ui.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /client\.rankingMe\(\)/);
});

test('Home score and status use separate premium blocks so text cannot merge', async () => {
  const source = await readFile(new URL('../src/v23.3/home-integration.mjs', import.meta.url), 'utf8');
  const polish = await readFile(new URL('../src/v23.3/round6-polish-ui.mjs', import.meta.url), 'utf8');
  const index = await readFile(new URL('../src/v23.3/index.mjs', import.meta.url), 'utf8');
  assert.match(source, /cw231-today-score-value/);
  assert.match(source, /cw231-today-score-status/);
  assert.match(polish, /\.cw231-today-score-value/);
  assert.match(polish, /\.cw231-today-score-status/);
  assert.match(index, /\.\/round6-polish-ui\.mjs/);
});

test('Serie A adapter preserves flattened legacy crest fields used by prediction cards', () => {
  const adapted = adaptSerieASchedule({
    current_round:3,
    rounds:[{ number:3, matches:[{
      id:101,
      kickoff_at:'2026-09-10T19:00:00Z',
      home_id:65,
      home_name:'Рома',
      home_logo_url:'https://img.test/roma.png',
      away_team_id:77,
      away_team_name:'Интер',
      away_team_logo:'https://img.test/inter.png',
    }] }],
  });
  assert.equal(adapted.matches[0].homeTeam.crestUrl, 'https://img.test/roma.png');
  assert.equal(adapted.matches[0].awayTeam.crestUrl, 'https://img.test/inter.png');
});

test('Serie A crest bridge also reads flattened legacy crest fields for tables', async () => {
  const { serieAStateCrestLookup, resolveSerieAStateCrest } = await import('../src/v23.3/serie-a-legacy-bridge.mjs');
  const lookup = serieAStateCrestLookup({
    state:{ round:{ matches:[{
      home_id:65, home_name:'Рома', home_logo_url:'https://img.test/roma.png',
      away_id:77, away_name:'Интер', away_logo:'https://img.test/inter.png',
    }] } },
  });
  assert.equal(resolveSerieAStateCrest(lookup, { id:'65', name:'Рома' }), 'https://img.test/roma.png');
  assert.equal(resolveSerieAStateCrest(lookup, { id:'77', name:'Интер' }), 'https://img.test/inter.png');
});
