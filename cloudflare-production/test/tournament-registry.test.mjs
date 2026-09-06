import test from 'node:test';
import assert from 'node:assert/strict';
import { TOURNAMENT_IDS, getTournament } from '../src/modular/core/tournament-registry.mjs';

test('Tournament Registry exposes all five supported competitions with stable themes', () => {
  assert.deepEqual(TOURNAMENT_IDS, ['serie_a','coppa_italia','ucl','uel','uecl']);
  const expected = {
    serie_a: ['Серия А', 'serie-a', true],
    coppa_italia: ['Кубок Италии', 'coppa', false],
    ucl: ['Лига Чемпионов', 'champions', true],
    uel: ['Лига Европы', 'europa', true],
    uecl: ['Лига Конференций', 'conference', true],
  };
  for (const [id, [label, theme, tables]] of Object.entries(expected)) {
    const config = getTournament(id);
    assert.equal(config.label, label);
    assert.equal(config.theme, theme);
    assert.equal(config.tables, tables);
  }
});

test('Tournament Registry rejects unknown competition ids', () => {
  assert.throws(() => getTournament('world_cup'), /Unknown tournament/);
});
