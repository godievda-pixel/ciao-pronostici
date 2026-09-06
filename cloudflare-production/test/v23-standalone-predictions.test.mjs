import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PREDICTION_COMPETITIONS,
  PREDICTION_MODES,
  loadPredictions,
  renderPredictions,
  savePrediction,
  validatePredictionScore,
} from '../src/v23/screens/predictions.mjs';

const NOW = '2026-09-07T17:00:00.000Z';
const TIME_ZONE = 'Europe/Berlin';

const match = {
  id:'ucl:77', providerMatchId:'77', competition:'ucl', competitionNameRu:'Лига чемпионов',
  season:'2026', stage:'Общий этап', round:null, kickoffAt:'2026-09-07T18:45:00.000Z',
  status:'scheduled', minute:null,
  home:{ id:'101', nameRu:'Интер' }, away:{ id:'202', nameRu:'Арсенал' },
  score:{ home:null, away:null }, isItalianRelevant:true, isQualification:false,
};

const saved = {
  userId:7, matchId:'ucl:77', competition:'ucl',
  predictedHome:2, predictedAway:1, points:null, resultType:null,
  lockedAt:'2026-09-07T18:30:00.000Z',
};

function apiFixture(overrides = {}) {
  const calls = [];
  return {
    calls,
    async call(action, payload) {
      calls.push({action,payload});
      if (overrides[action]) return await overrides[action](payload);
      if (action === 'predictions_available') {
        return [{ match:{...match, competition:payload.competition, competitionNameRu:competitionName(payload.competition)}, prediction:saved, deadlineAt:'2026-09-07T18:30:00.000Z' }];
      }
      if (action === 'predictions_mine') {
        return [{ prediction:{...saved, competition:payload.competition}, match:{...match, competition:payload.competition, competitionNameRu:competitionName(payload.competition)} }];
      }
      if (action === 'prediction_save') return {...saved, predictedHome:payload.home, predictedAway:payload.away};
      throw new Error(`unexpected_action:${action}`);
    },
  };
}

function competitionName(id) {
  return {
    serie_a:'Серия А', coppa_italia:'Кубок Италии', ucl:'Лига чемпионов',
    uel:'Лига Европы', uecl:'Лига конференций',
  }[id];
}

test('prediction screen exposes exactly two subviews and six approved competition filters', () => {
  assert.deepEqual(PREDICTION_MODES, [
    {id:'available', label:'Прогнозы'},
    {id:'mine', label:'Мои прогнозы'},
  ]);
  assert.deepEqual(PREDICTION_COMPETITIONS.map(item => item.label), [
    'Все','Серия А','Кубок Италии','Лига чемпионов','Лига Европы','Лига конференций',
  ]);
  assert.deepEqual(PREDICTION_COMPETITIONS.map(item => item.id), [
    'all','serie_a','coppa_italia','ucl','uel','uecl',
  ]);
});

test('score validation accepts only integer values from 0 through 20', () => {
  for (const value of [0,1,9,20,'0','20']) assert.equal(validatePredictionScore(value), Number(value));
  for (const value of [-1,21,1.5,'','x',null,undefined]) {
    assert.throws(() => validatePredictionScore(value), /invalid_score/);
  }
});

test('available mode loads one competition and renders editable saved score with local kickoff/deadline', async () => {
  const api = apiFixture();
  const model = await loadPredictions({api, mode:'available', competition:'ucl', now:NOW, timeZone:TIME_ZONE});
  assert.deepEqual(api.calls, [{action:'predictions_available', payload:{competition:'ucl', now_ms:Date.parse(NOW)}}]);
  assert.equal(model.items.length, 1);
  assert.equal(model.items[0].match.homeTeam.nameRu, 'Интер');
  assert.equal(model.items[0].match.timeLabel, 'Сегодня · 20:45');
  assert.equal(model.items[0].deadlineLabel, 'до 20:30');

  const html = renderPredictions(model);
  assert.match(html, /data-screen="predictions"/);
  assert.match(html, />Прогнозы</);
  assert.match(html, />Мои прогнозы</);
  assert.match(html, /data-action="save-prediction"/);
  assert.match(html, /data-match-id="ucl:77"/);
  assert.match(html, /value="2"/);
  assert.match(html, /value="1"/);
  assert.match(html, /до 20:30/);
  assert.match(html, /Интер/);
  assert.match(html, /Арсенал/);
  assert.doesNotMatch(html, />Inter</);
});

test('Все loads exactly five competition-specific backend lists and merges them chronologically', async () => {
  const api = apiFixture({
    predictions_available: async payload => [{
      match:{...match, id:`${payload.competition}:${payload.competition}`, competition:payload.competition, competitionNameRu:competitionName(payload.competition), kickoffAt: payload.competition === 'serie_a' ? '2026-09-07T17:30:00.000Z' : '2026-09-07T19:00:00.000Z'},
      prediction:null,
      deadlineAt: payload.competition === 'serie_a' ? '2026-09-07T17:15:00.000Z' : '2026-09-07T18:45:00.000Z',
    }],
  });
  const model = await loadPredictions({api, mode:'available', competition:'all', now:NOW, timeZone:TIME_ZONE});
  assert.deepEqual(api.calls.map(call => call.payload.competition), ['serie_a','coppa_italia','ucl','uel','uecl']);
  assert.equal(model.items.length, 5);
  assert.equal(model.items[0].match.competition, 'serie_a');
});

test('mine mode renders prediction, final score, status and correctly inflected awarded points', async () => {
  const api = apiFixture({
    predictions_mine: async payload => [{
      prediction:{...saved, competition:payload.competition, points:5},
      match:{...match, competition:payload.competition, competitionNameRu:competitionName(payload.competition), status:'finished', score:{home:2,away:1}},
    }],
  });
  const model = await loadPredictions({api, mode:'mine', competition:'ucl', now:NOW, timeZone:TIME_ZONE});
  const html = renderPredictions(model);
  assert.match(html, /Ваш прогноз/);
  assert.match(html, /2 — 1/);
  assert.match(html, /Итоговый счёт/);
  assert.match(html, /5 очков/);
  assert.match(html, /Завершён/);
  assert.doesNotMatch(html, /data-action="save-prediction"/);
});

test('mine mode preserves a saved prediction even if current provider match is unavailable', async () => {
  const api = apiFixture({ predictions_mine: async () => [{prediction:saved, match:null}] });
  const model = await loadPredictions({api, mode:'mine', competition:'ucl', now:NOW, timeZone:TIME_ZONE});
  assert.equal(model.items.length, 1);
  const html = renderPredictions(model);
  assert.match(html, /Матч больше недоступен в текущем списке/);
  assert.match(html, /2 — 1/);
});

test('savePrediction validates locally, sends canonical payload and returns inline success message', async () => {
  const api = apiFixture();
  const result = await savePrediction({api, competition:'ucl', matchId:'ucl:77', homeScore:'2', awayScore:'1', now:NOW});
  assert.deepEqual(api.calls, [{action:'prediction_save', payload:{competition:'ucl', match_id:'ucl:77', home:2, away:1, now_ms:Date.parse(NOW)}}]);
  assert.equal(result.ok, true);
  assert.equal(result.message, 'Прогноз сохранён');
  assert.equal(result.prediction.predictedHome, 2);
});

test('closed prediction response becomes inline Russian feedback and does not invent points', async () => {
  const error = Object.assign(new Error('prediction_closed'), {code:'prediction_closed', message:'Прогноз уже закрыт', status:400});
  const api = apiFixture({ prediction_save: async () => { throw error; } });
  const result = await savePrediction({api, competition:'ucl', matchId:'ucl:77', homeScore:2, awayScore:1, now:NOW});
  assert.deepEqual(result, {ok:false, code:'prediction_closed', message:'Прогноз уже закрыт'});
  assert.equal(Object.hasOwn(result, 'points'), false);
  const html = renderPredictions({mode:'available',competition:'ucl',items:[],feedback:result});
  assert.match(html, /Прогноз уже закрыт/);
});

test('renderer has all six filters exactly once and never calculates or displays unsupplied points', () => {
  const html = renderPredictions({mode:'available',competition:'all',items:[],feedback:null});
  for (const item of PREDICTION_COMPETITIONS) {
    const needle = `data-competition="${item.id}"`;
    assert.equal(html.split(needle).length - 1, 1, item.id);
  }
  assert.doesNotMatch(html, /\+0 очк|5\/3\/2\/0/);
});
