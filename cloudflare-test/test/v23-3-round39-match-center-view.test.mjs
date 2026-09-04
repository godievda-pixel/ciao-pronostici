import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MATCH_CENTER_VIEW_TABS,
  renderMatchCenterView,
} from '../src/v23.3/match-center-view.mjs';

const COVERAGE = Object.freeze({
  overview:true,
  stats:true,
  events:true,
  lineups:true,
  players:true,
});

const THEMES = Object.freeze({
  serie_a:'serie-a',
  coppa_italia:'coppa',
  ucl:'champions',
  uel:'europa',
  uecl:'conference',
});

function stateFor(competition, overrides = {}) {
  return {
    open:true,
    phase:'ready',
    competition,
    matchId:`${competition}:42`,
    activeTab:'overview',
    error:'',
    match:{
      competition,
      matchId:`${competition}:42`,
      status:'live',
      minute:67,
      kickoffAt:'2026-09-04T18:45:00Z',
      homeTeam:{ id:'home', name:'Домашние', crestUrl:'/home.png' },
      awayTeam:{ id:'away', name:'Гости', crestUrl:'/away.png' },
      score:{ home:2, away:1 },
      venue:'Stadio Test',
      referee:'A. Referee',
      coverage:COVERAGE,
      updatedAt:'2026-09-04T19:00:00Z',
    },
    sections:{ overview:{ venue:'Stadio Test' }, stats:null, events:null, lineups:null, players:null },
    sectionState:{
      overview:{ status:'ready', error:'' },
      stats:{ status:'idle', error:'' },
      events:{ status:'idle', error:'' },
      lineups:{ status:'idle', error:'' },
      players:{ status:'idle', error:'' },
    },
    ...overrides,
  };
}

test('standalone Match Center consumes canonical nested score without legacy aliases', () => {
  const html = renderMatchCenterView(stateFor('serie_a'));

  assert.match(html, /data-cw239-match-center/);
  assert.match(html, /data-cw239-score>2:1</);
  assert.match(html, /LIVE · 67′/);
  assert.match(html, />Домашние</);
  assert.match(html, />Гости</);
  assert.doesNotMatch(html, /homeScore|awayScore/);
});

test('all five tournaments share one View structure and differ only by competition theme', () => {
  assert.deepEqual(MATCH_CENTER_VIEW_TABS, ['overview','stats','events','lineups','players']);

  for (const [competition, theme] of Object.entries(THEMES)) {
    const html = renderMatchCenterView(stateFor(competition));
    assert.match(html, new RegExp(`data-cw239-competition="${competition}"`));
    assert.match(html, new RegExp(`data-cw239-theme="${theme}"`));
    assert.equal((html.match(/data-cw239-tab=/g) || []).length, 5);
    assert.match(html, /Обзор/);
    assert.match(html, /Статы/);
    assert.match(html, /События/);
    assert.match(html, /Составы/);
    assert.match(html, /Игроки/);
  }
});

test('loading and section error states keep the same mounted frame', () => {
  const loading = renderMatchCenterView({
    ...stateFor('ucl'),
    phase:'loading-base',
    match:null,
    sections:{ overview:null, stats:null, events:null, lineups:null, players:null },
  });
  assert.match(loading, /data-cw239-match-center/);
  assert.match(loading, /data-cw239-view-state="loading"/);
  assert.match(loading, /Загружаем матч/);

  const error = renderMatchCenterView(stateFor('ucl', {
    activeTab:'stats',
    sectionState:{
      overview:{ status:'ready', error:'' },
      stats:{ status:'error', error:'provider_failed' },
      events:{ status:'idle', error:'' },
      lineups:{ status:'idle', error:'' },
      players:{ status:'idle', error:'' },
    },
  }));
  assert.match(error, /data-cw239-section-state="error"/);
  assert.match(error, /Повторить/);
  assert.match(error, /data-cw239-action="retry-section"/);
});
