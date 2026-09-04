import test from 'node:test';
import assert from 'node:assert/strict';
import { createMatchesUiController } from '../src/v23.2/matches-ui.mjs';

test('Round 26 Serie A stays in the new Matches competition screen instead of falling back to legacy calendar', async () => {
  const shown = [];
  const loaded = [];
  let hidden = 0;

  const controller = createMatchesUiController({
    show(html) { shown.push(html); },
    hide() { hidden += 1; },
    async loadScreen(competition) {
      loaded.push(competition);
      return `<section data-cw232-view="competition" data-cw232-competition="${competition}"></section>`;
    },
  });

  controller.openHub();
  const result = await controller.openCompetition('serie_a');

  assert.equal(result, 'loaded');
  assert.deepEqual(loaded, ['serie_a']);
  assert.equal(hidden, 0);
  assert.match(shown.at(-1), /data-cw232-view="competition"/);
  assert.match(shown.at(-1), /data-cw232-competition="serie_a"/);
});
