import test from 'node:test';
import assert from 'node:assert/strict';

import { canonicalStatsSection } from '../src/v23.3/match-center-sections.mjs';
import { adaptBsdMatchCenterSections } from '../src/v23.3/bsd-match-center-adapter.mjs';
import { adaptSerieALegacyMatchCenter } from '../src/v23.3/serie-a-match-center-adapter.mjs';
import { SERIE_A_SECTION_REQUESTS } from '../src/v23.3/serie-a-match-center-provider.mjs';
import { renderMatchCenterStats } from '../src/v23.3/match-center-stats.mjs';

const momentum = [
  { minute:12, home:64, away:36 },
  { minute:27, home:42, away:58 },
  { minute:44, home:71, away:29 },
];

const fullStats = {
  home:{
    xg:1.8, possession:57, shots:15, shotsOnTarget:7, bigChances:4, corners:6,
    fouls:11, offsides:2, yellowCards:3, redCards:0, saves:4, passAccuracy:88,
    interceptions:9, tackles:13,
  },
  away:{
    xg:1.1, possession:43, shots:9, shotsOnTarget:4, bigChances:2, corners:3,
    fouls:14, offsides:1, yellowCards:2, redCards:1, saves:5, passAccuracy:82,
    interceptions:11, tackles:15,
  },
  shots:[
    { side:'home', x:42, y:78, minute:31, player:'Лаутаро', xg:.32, outcome:'saved' },
  ],
  momentum,
};

test('Round 50 canonical Stats keeps real pressure/momentum data additively', () => {
  const canonical = canonicalStatsSection(fullStats);
  assert.deepEqual(canonical.momentum, momentum);
  assert.equal(canonical.home.bigChances, 4);
  assert.equal(canonical.away.passAccuracy, 82);
});

test('Round 50 both provider adapters carry real momentum into the canonical Stats section', () => {
  const bsd = adaptBsdMatchCenterSections({
    stats:{ home:fullStats.home, away:fullStats.away },
    overview_meta:{ momentum },
    shots:fullStats.shots,
  });
  assert.deepEqual(bsd.stats.momentum, momentum);

  const serieA = adaptSerieALegacyMatchCenter({
    match:{ id:77, status:'finished', home:{ id:1, name:'Интер' }, away:{ id:2, name:'Ювентус' } },
    stats:{ stats:{ home:fullStats.home, away:fullStats.away }, shots:fullStats.shots },
    overview_meta:{ momentum },
  });
  assert.deepEqual(serieA.stats.momentum, momentum);
  assert.deepEqual(SERIE_A_SECTION_REQUESTS.stats, ['stats','overview_meta']);
});

test('Round 50 Stats redraw follows primary -> secondary -> pressure -> shot analysis hierarchy', () => {
  const html = renderMatchCenterStats(fullStats, {
    match:{ homeTeam:{ name:'Интер' }, awayTeam:{ name:'Ювентус' } },
  });

  assert.match(html, /data-cw250-mc-stats-primary/);
  assert.match(html, /data-cw250-mc-stats-secondary/);
  assert.match(html, /data-cw250-mc-pressure/);
  assert.match(html, /Давление матча/);
  assert.match(html, /data-cw233-mc-shotmap/);
  assert.match(html, /data-cw233-mc-shot-list/);

  const primaryIndex = html.indexOf('data-cw250-mc-stats-primary');
  const secondaryIndex = html.indexOf('data-cw250-mc-stats-secondary');
  const pressureIndex = html.indexOf('data-cw250-mc-pressure');
  const shotMapIndex = html.indexOf('data-cw233-mc-shotmap');
  assert.ok(primaryIndex >= 0 && primaryIndex < secondaryIndex);
  assert.ok(secondaryIndex < pressureIndex);
  assert.ok(pressureIndex < shotMapIndex);

  const primaryHtml = html.slice(primaryIndex, secondaryIndex);
  for (const key of ['xg','possession','shots','shotsOnTarget','bigChances','corners']) {
    assert.match(primaryHtml, new RegExp(`data-cw233-mc-stat="${key}"`));
  }
  for (const key of ['fouls','offsides','yellowCards','redCards','saves','passAccuracy','interceptions','tackles']) {
    assert.doesNotMatch(primaryHtml, new RegExp(`data-cw233-mc-stat="${key}"`));
    assert.match(html, new RegExp(`data-cw250-mc-secondary-stat="${key}"`));
  }
});

test('Round 50 Stats hides pressure locally when momentum is unavailable', () => {
  const html = renderMatchCenterStats({ ...fullStats, momentum:[] }, {
    match:{ homeTeam:{ name:'Интер' }, awayTeam:{ name:'Ювентус' } },
  });
  assert.doesNotMatch(html, /data-cw250-mc-pressure/);
  assert.match(html, /data-cw233-mc-shotmap/);
});
