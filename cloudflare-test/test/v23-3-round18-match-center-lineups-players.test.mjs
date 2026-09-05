import test from 'node:test';
import assert from 'node:assert/strict';
import { renderMatchCenterLineups } from '../src/v23.3/match-center-lineups.mjs';
import { renderMatchCenterPlayers } from '../src/v23.3/match-center-players.mjs';

function match() {
  return {
    competition:'ucl',
    matchId:'ucl:77',
    homeTeam:{ name:'Интер' },
    awayTeam:{ name:'Арсенал' },
    coverage:{ lineups:true, players:true },
  };
}

function lineups() {
  return {
    home:{
      formation:'3-5-2',
      starters:[
        { playerId:1, name:'Sommer', position:'GK', shirtNumber:1 },
        { playerId:2, name:'Pavard', position:'DF', shirtNumber:28 },
        { playerId:3, name:'Acerbi', position:'DF', shirtNumber:15 },
        { playerId:4, name:'Bastoni', position:'DF', shirtNumber:95 },
        { playerId:5, name:'Dumfries', position:'MF', shirtNumber:2 },
        { playerId:6, name:'Barella', position:'MF', shirtNumber:23 },
        { playerId:7, name:'Calhanoglu', position:'MF', shirtNumber:20 },
        { playerId:8, name:'Mkhitaryan', position:'MF', shirtNumber:22 },
        { playerId:9, name:'Dimarco', position:'MF', shirtNumber:32 },
        { playerId:10, name:'Thuram', position:'FW', shirtNumber:9 },
        { playerId:11, name:'Lautaro', position:'FW', shirtNumber:10 },
      ],
      substitutes:[
        { playerId:12, name:'Frattesi', position:'MF', shirtNumber:16 },
        { playerId:13, name:'Arnautovic', position:'FW', shirtNumber:8 },
      ],
    },
    away:{
      formation:'4-3-3',
      starters:[
        { playerId:21, name:'Raya', position:'GK', shirtNumber:22 },
        { playerId:22, name:'White', position:'DF', shirtNumber:4 },
        { playerId:23, name:'Saliba', position:'DF', shirtNumber:2 },
        { playerId:24, name:'Gabriel', position:'DF', shirtNumber:6 },
        { playerId:25, name:'Timber', position:'DF', shirtNumber:12 },
        { playerId:26, name:'Odegaard', position:'MF', shirtNumber:8 },
        { playerId:27, name:'Rice', position:'MF', shirtNumber:41 },
        { playerId:28, name:'Merino', position:'MF', shirtNumber:23 },
        { playerId:29, name:'Saka', position:'FW', shirtNumber:7 },
        { playerId:30, name:'Havertz', position:'FW', shirtNumber:29 },
        { playerId:31, name:'Martinelli', position:'FW', shirtNumber:11 },
      ],
      substitutes:[
        { playerId:32, name:'Trossard', position:'FW', shirtNumber:19 },
      ],
    },
  };
}

test('Round 18 lineups renderer keeps all players and now includes premium pitch view', () => {
  const html = renderMatchCenterLineups(lineups(), { match:match() });

  assert.match(html, /data-cw233-mc-lineups/);
  assert.match(html, /data-cw233-mc-lineup-side="home"/);
  assert.match(html, /data-cw233-mc-lineup-side="away"/);
  assert.match(html, />3-5-2</);
  assert.match(html, />4-3-3</);
  assert.match(html, /cw233-mc-lineup-list/);
  assert.match(html, /data-cw233-mc-lineup-player/);
  assert.match(html, /data-cw233-mc-lineup-pitch/);
  assert.match(html, /data-cw233-mc-lineup-switch/);
  for (const name of ['Sommer', 'Pavard', 'Barella', 'Lautaro', 'Raya', 'Saliba', 'Odegaard', 'Saka']) {
    assert.match(html, new RegExp(name));
  }
  assert.match(html, /Запасные/);
  assert.match(html, /Frattesi/);
  assert.match(html, /Arnautovic/);
  assert.match(html, /Trossard/);
});

test('Round 18 lineups renderer keeps starters even when formation is unavailable', () => {
  const html = renderMatchCenterLineups({
    home:{
      formation:'',
      starters:[
        { playerId:1, name:'Keeper', position:'GK', shirtNumber:1 },
        { playerId:2, name:'Defender', position:'DF', shirtNumber:4 },
        { playerId:3, name:'Midfielder', position:'MF', shirtNumber:8 },
        { playerId:4, name:'Forward', position:'FW', shirtNumber:9 },
      ],
      substitutes:[],
    },
    away:{ formation:'', starters:[], substitutes:[] },
  }, { match:match() });

  assert.match(html, /cw233-mc-lineup-list/);
  assert.match(html, /Схема недоступна/);
  for (const name of ['Keeper', 'Defender', 'Midfielder', 'Forward']) {
    assert.match(html, new RegExp(name));
  }
  assert.match(html, /Нет данных/);
});

test('Round 18 players renderer keeps canonical rating hooks and adds premium performance cards', () => {
  const html = renderMatchCenterPlayers([
    {
      playerId:10,
      name:'Lautaro',
      teamName:'Интер',
      rating:8.4,
      minutes:90,
      goals:1,
      assists:1,
      xg:0.82,
      xa:0.34,
      shots:4,
      keyPasses:3,
    },
    {
      playerId:27,
      name:'Rice',
      teamName:'Арсенал',
      rating:7.2,
      minutes:90,
      goals:0,
      assists:0,
      xg:0.12,
      xa:0.18,
      shots:1,
      keyPasses:2,
    },
  ], { match:match() });

  assert.match(html, /data-cw233-mc-players/);
  assert.match(html, /data-cw233-mc-player="10"/);
  assert.match(html, /data-cw233-mc-player="27"/);
  assert.match(html, /cw233-mc-player-card/);
  assert.match(html, /data-cw233-mc-player-rank="1"/);
  assert.match(html, /cw233-mc-rating-row/);
  assert.match(html, /cw233-mc-rating-name/);
  assert.match(html, /cw233-mc-rating-meta/);
  assert.match(html, /cw233-mc-rating/);
  assert.match(html, /Интер/);
  assert.match(html, />8\.4</);
  assert.match(html, />7\.2</);
  for (const label of ['90 мин', '1 гол', '1 ассист', 'xG 0.82', 'xA 0.34', '4 удара', '3 ключ. передачи']) {
    assert.match(html, new RegExp(label.replaceAll('.', '\\.')));
  }
});

test('Round 18 players renderer shows stable unavailable state instead of fabricating ratings', () => {
  const html = renderMatchCenterPlayers([
    { playerId:10, name:'Lautaro', teamName:'Интер', rating:null },
  ], { match:match() });

  assert.match(html, /data-cw233-mc-players/);
  assert.match(html, /Оценки игроков пока недоступны/);
  assert.doesNotMatch(html, /data-cw233-mc-player-rating/);
});
