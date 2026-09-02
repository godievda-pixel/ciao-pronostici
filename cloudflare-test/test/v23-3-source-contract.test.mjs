import test from 'node:test';
import assert from 'node:assert/strict';
import {
  V233_SOURCE_MARKERS,
  extractSourceHints,
} from '../src/v23.2/api-contract-observer.mjs';

const sample = `
  <div>Начало нового сезона! Счёт обнулен, все начинают с нуля. Удачи!</div>
  function predict(){ return 'prediction'; }
  function mine(){ return 'mine'; }
  async function saveAll(){ return api({action:'save_predictions',round:3,predictions:[]}); }
  async function load(){ return api({action:'state',round:3}); }
  function table(){ return 'Общая таблица'; }
  async function openMatchCenter(matchId){ return matchId; }
  function __cw231HomeHtml(){ return '<section></section>'; }
  const serie_a_table = true;
`;

test('v23.3 source contract discovers every required stable integration anchor', () => {
  const hints = extractSourceHints(sample);

  for (const marker of V233_SOURCE_MARKERS) {
    assert.equal(
      hints.some(item => item.marker === marker),
      true,
      `missing source hint: ${marker}`,
    );
  }
});
