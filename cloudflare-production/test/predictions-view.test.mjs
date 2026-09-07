import test from 'node:test';
import assert from 'node:assert/strict';
import { renderPredictionsView } from '../src/predictions/view.mjs';

const competitions = [
  { key:'serie_a', title:'Серия А', theme:'serie-a' },
  { key:'coppa_italia', title:'Кубок Италии', theme:'coppa' },
  { key:'ucl', title:'Лига Чемпионов', theme:'champions' },
  { key:'uel', title:'Лига Европы', theme:'europa' },
  { key:'uecl', title:'Лига Конференций', theme:'conference' },
];

function baseCompetition(overrides = {}) {
  return {
    open:true,
    view:'competition',
    competition:'uel',
    mode:'edit',
    stageKey:'league-4',
    competitions,
    drafts:new Map(),
    loading:false,
    saving:false,
    error:'',
    payload:{
      competition:'uel',
      prediction_stage_key:'league-1',
      matches:[{
        matchId:'uel:400',
        stageKey:'league-4',
        stageLabel:'Общий этап · 4 тур',
        stageOrder:4,
        kickoffAt:'2026-11-05T20:00:00Z',
        status:'scheduled',
        open:false,
        stage_locked:true,
        homeTeam:{name:'Болонья',crestUrl:'https://example.com/bologna.png'},
        awayTeam:{name:'Бранн',crestUrl:'https://example.com/brann.png'},
        prediction:null,
      }],
    },
    ...overrides,
  };
}

test('hub has five tournament buttons and no mode toggle', () => {
  const html = renderPredictionsView({ open:true, view:'hub', competitions, drafts:new Map() });
  assert.equal((html.match(/data-pred-competition=/g) || []).length, 5);
  assert.doesNotMatch(html, /data-pred-mode=/);
});

test('competition view embeds mode toggle inside tournament screen', () => {
  const html = renderPredictionsView(baseCompetition({ mode:'mine' }));
  assert.match(html, /data-pred-mode="edit"/);
  assert.match(html, /data-pred-mode="mine"/);
  assert.match(html, /cw-pred-native-modes/);
});

test('4th locked round says after 3rd round and renders no lock glyph', () => {
  const html = renderPredictionsView(baseCompetition());
  assert.match(html, /после завершения 3-го тура/);
  assert.doesNotMatch(html, /🔒|🔐|lock-icon|stage-locked::before|stage-locked::after/);
  assert.match(html, /data-pred-stage="league-4"[^>]+disabled/);
});

test('my predictions card keeps compact missing prediction', () => {
  const html = renderPredictionsView(baseCompetition({ mode:'mine' }));
  assert.match(html, />— : —</);
  assert.match(html, />Прогноз не сделан</);
  assert.doesNotMatch(html, /<strong>Прогноз не сделан<\/strong>/);
});

test('live pill has live class while halftime does not', () => {
  const live = baseCompetition({
    payload:{ competition:'uel', matches:[{...baseCompetition().payload.matches[0], status:'live', minute:86, stage_locked:false, open:false}] },
    stageKey:'league-4',
  });
  const halftime = baseCompetition({
    payload:{ competition:'uel', matches:[{...baseCompetition().payload.matches[0], status:'halftime', stage_locked:false, open:false}] },
    stageKey:'league-4',
  });
  assert.match(renderPredictionsView(live), /cw-pred-native-status--live[^>]*>LIVE · 86′</);
  assert.doesNotMatch(renderPredictionsView(halftime), /cw-pred-native-status--live/);
  assert.match(renderPredictionsView(halftime), />ПЕРЕРЫВ</);
});

test('edit card renders score controls only for editable match', () => {
  const state = baseCompetition({
    stageKey:'league-1',
    payload:{ competition:'uel', matches:[{...baseCompetition().payload.matches[0], matchId:'uel:100', stageKey:'league-1', stageLabel:'Общий этап · 1 тур', stageOrder:1, stage_locked:false, open:true}] },
  });
  const html = renderPredictionsView(state);
  assert.match(html, /data-pred-delta="h:-1"/);
  assert.match(html, /data-pred-delta="a:1"/);
  assert.match(html, /data-pred-action="save"/);
});
