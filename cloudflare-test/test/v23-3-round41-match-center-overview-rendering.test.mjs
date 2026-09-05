import test from 'node:test';
import assert from 'node:assert/strict';

import { renderMatchCenterOverview } from '../src/v23.3/match-center-overview.mjs';
import { renderMatchCenterView } from '../src/v23.3/match-center-view.mjs';

function overviewState(data) {
  return {
    open:true,
    phase:'ready',
    competition:'serie_a',
    matchId:'serie_a:77',
    activeTab:'overview',
    match:{
      competition:'serie_a',
      matchId:'serie_a:77',
      status:'scheduled',
      kickoffAt:'2026-09-04T19:45:00Z',
      homeTeam:{ name:'Дженоа', crestUrl:'' },
      awayTeam:{ name:'Комо', crestUrl:'' },
      score:{ home:null, away:null },
      coverage:{ overview:true, stats:false, events:false, lineups:false, players:false },
    },
    sections:{ overview:data, stats:null, events:null, lineups:null, players:null },
    sectionState:{
      overview:{ status:'ready', error:'' },
      stats:{ status:'idle', error:'' },
      events:{ status:'idle', error:'' },
      lineups:{ status:'idle', error:'' },
      players:{ status:'idle', error:'' },
    },
  };
}

test('Round 41 upcoming-match overview renders venue and referee instead of an empty panel', () => {
  const overview = {
    venue:{ name:'Stadio Luigi Ferraris', city:'Genova', capacity:36599 },
    referee:{ name:'Daniele Doveri' },
    form:{ home:[], away:[] },
    prediction:null,
    predictionSplit:null,
    summaryStats:null,
    momentum:null,
    shotmap:null,
  };

  const html = renderMatchCenterOverview(overview, { coverage:{ overview:true } });
  assert.match(html, /data-cw233-mc-overview-region="context"/);
  assert.match(html, /Стадион/);
  assert.match(html, /Stadio Luigi Ferraris/);
  assert.match(html, /Genova/);
  assert.match(html, /Судья/);
  assert.match(html, /Daniele Doveri/);

  const full = renderMatchCenterView(overviewState(overview));
  assert.match(full, /Stadio Luigi Ferraris/);
  assert.match(full, /Daniele Doveri/);
  assert.doesNotMatch(full, /data-cw233-mc-overview-empty/);
});

test('Round 41 sparse rich overview keeps explicit unavailable hierarchy, never a blank rectangle', () => {
  const html = renderMatchCenterOverview({
    venue:{ name:'', city:'', capacity:null },
    referee:null,
    form:{ home:[], away:[] },
    prediction:null,
    predictionSplit:null,
    summaryStats:null,
    momentum:null,
    shotmap:null,
  }, { coverage:{ overview:true } });

  assert.match(html, /data-cw233-mc-overview-region="form"/);
  assert.match(html, /data-cw251-overview-form-unavailable/);
  assert.match(html, /Форма команд пока не опубликована провайдером/);
  assert.match(html, /data-cw233-mc-overview-region="context"/);
  assert.match(html, /data-cw251-overview-context-unavailable/);
  assert.match(html, /Стадион и судья пока не опубликованы провайдером/);
});
