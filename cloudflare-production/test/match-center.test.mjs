import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MATCH_CENTER_TABS,
  renderMatchCenter,
  createMatchCenterController,
} from '../src/modular/screens/match-center.mjs';

const competitions = ['serie_a','coppa_italia','ucl','uel','uecl'];

test('all five competitions share the exact same Match Center tab contract', () => {
  assert.deepEqual(MATCH_CENTER_TABS, [
    ['overview','Обзор'],
    ['stats','Статистика'],
    ['events','События'],
    ['lineups','Составы'],
    ['players','Игроки'],
  ]);
  for (const competition of competitions) {
    const html = renderMatchCenter({
      competition,
      matchId:`${competition}:1`,
      activeTab:'overview',
      sections:{ overview:{ title:'Матч' } },
    });
    assert.match(html, new RegExp(`data-tournament="${competition}"`));
    assert.doesNotMatch(html, /Контекст Серии А/);
    for (const [, label] of MATCH_CENTER_TABS) assert.match(html, new RegExp(label));
  }
});

test('visible Match Center Back delegates only to the shared router', () => {
  let backCalls = 0;
  const controller = createMatchCenterController({
    router:{ back(){ backCalls += 1; } },
    dataService:{ async loadMatchCenter(){ return {}; } },
    render(){},
  });
  controller.back();
  assert.equal(backCalls, 1);
  assert.equal('handlePopState' in controller, false);
});

test('one failed Match Center section does not blank already loaded sections', async () => {
  const renders = [];
  const controller = createMatchCenterController({
    router:{ back(){} },
    dataService:{
      async loadMatchCenter({ section }) {
        if (section === 'stats') throw new Error('stats unavailable');
        return { section, title:'ok' };
      },
    },
    render:view => renders.push(view),
  });
  await controller.open({ competition:'ucl', matchId:'ucl:99' });
  await controller.selectTab('stats');
  const state = controller.state();
  assert.equal(state.sections.overview.title, 'ok');
  assert.equal(state.sectionErrors.stats.message, 'stats unavailable');
  assert.ok(renders.length >= 2);
});
