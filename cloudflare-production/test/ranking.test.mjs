import test from 'node:test';
import assert from 'node:assert/strict';
import { RANKING_SCOPES, aggregateRankingEntries } from '../src/modular/data/ranking-aggregator.mjs';
import { renderRankingScreen } from '../src/modular/screens/ranking.mjs';

test('ranking scopes partition competitions without changing scored point values', () => {
  assert.deepEqual(RANKING_SCOPES, {
    all:['serie_a','coppa_italia','ucl','uel','uecl'],
    italy:['serie_a','coppa_italia'],
    europe:['ucl','uel','uecl'],
  });
  const entries = [
    { userId:'u1', displayName:'Dani', competition:'serie_a', points:5 },
    { userId:'u1', displayName:'Dani', competition:'coppa_italia', points:3 },
    { userId:'u1', displayName:'Dani', competition:'ucl', points:2 },
    { userId:'u2', displayName:'Max', competition:'serie_a', points:2 },
    { userId:'u2', displayName:'Max', competition:'uel', points:5 },
  ];
  const all = aggregateRankingEntries(entries, 'all');
  const italy = aggregateRankingEntries(entries, 'italy');
  const europe = aggregateRankingEntries(entries, 'europe');
  assert.deepEqual(all.map(x => [x.userId,x.points]), [['u1',10],['u2',7]]);
  assert.deepEqual(italy.map(x => [x.userId,x.points]), [['u1',8],['u2',2]]);
  assert.deepEqual(europe.map(x => [x.userId,x.points]), [['u2',5],['u1',2]]);
  assert.equal(entries[0].points, 5);
});

test('premium Rating screen exposes Все / Италия / Еврокубки and highlights top three/current user', () => {
  const html = renderRankingScreen({
    scope:'all',
    currentUserId:'u4',
    rows:[
      {userId:'u1',displayName:'A',points:20},
      {userId:'u2',displayName:'B',points:18},
      {userId:'u3',displayName:'C',points:17},
      {userId:'u4',displayName:'Me',points:15},
    ],
  });
  assert.match(html, /<h2>Рейтинг<\/h2>/);
  assert.match(html, /data-ranking-scope="all"[^>]*>Все/);
  assert.match(html, /data-ranking-scope="italy"[^>]*>Италия/);
  assert.match(html, /data-ranking-scope="europe"[^>]*>Еврокубки/);
  assert.match(html, /class="[^"]*is-podium[^"]*"[^>]*data-rank="1"/);
  assert.match(html, /class="[^"]*is-podium[^"]*"[^>]*data-rank="2"/);
  assert.match(html, /class="[^"]*is-podium[^"]*"[^>]*data-rank="3"/);
  assert.match(html, /class="[^"]*is-current[^"]*"[^>]*data-rank="4"[^>]*data-user-id="u4"/);
});
