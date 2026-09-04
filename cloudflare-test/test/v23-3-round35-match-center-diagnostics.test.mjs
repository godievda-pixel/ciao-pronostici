import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  ROUND35_CSS,
  isRound35ExternalCompetition,
  removeRound35ExternalOverviewForm,
} from '../src/v23.3/round35-match-center-overview-fixes.mjs';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

function externalFormFixture({ competition = 'uel', tab = 'overview' } = {}) {
  let sectionRemoved = 0;
  let markerRemoved = 0;
  const section = { remove(){ sectionRemoved += 1; } };
  const marker = {
    closest(selector){ return selector === '.mc-section' ? section : null; },
    remove(){ markerRemoved += 1; },
  };
  const host = {
    dataset:{ mcTabContent:tab },
    querySelectorAll(selector){
      assert.equal(selector, '.cw14-form-card');
      return [marker];
    },
  };
  const root = {
    dataset:{ cw233McCompetition:competition },
    classList:{ contains(value){ return value === 'match-center-open'; } },
    querySelector(selector){
      return selector === '[data-mc-tab-content="overview"]' && tab === 'overview' ? host : null;
    },
  };
  return {
    root,
    counts:() => ({ sectionRemoved, markerRemoved }),
  };
}

test('Round 35 removes the whole Form section from external EK/KI Overview', () => {
  for (const competition of ['coppa_italia', 'ucl', 'uel', 'uecl', 'champions_league', 'europa_league', 'conference_league']) {
    assert.equal(isRound35ExternalCompetition(competition), true, competition);
    const fixture = externalFormFixture({ competition });
    assert.equal(removeRound35ExternalOverviewForm(fixture.root), 1);
    assert.deepEqual(fixture.counts(), { sectionRemoved:1, markerRemoved:0 });
  }
});

test('Round 35 never removes Form from Serie A Match Center', () => {
  assert.equal(isRound35ExternalCompetition('serie_a'), false);
  const fixture = externalFormFixture({ competition:'serie_a' });
  assert.equal(removeRound35ExternalOverviewForm(fixture.root), 0);
  assert.deepEqual(fixture.counts(), { sectionRemoved:0, markerRemoved:0 });
});

test('Round 35 Form guard is scoped to Overview and has a CSS fail-safe', () => {
  const fixture = externalFormFixture({ competition:'uel', tab:'stats' });
  assert.equal(removeRound35ExternalOverviewForm(fixture.root), 0);
  assert.deepEqual(fixture.counts(), { sectionRemoved:0, markerRemoved:0 });
  assert.match(
    ROUND35_CSS,
    /\[data-cw233-mc-competition\][\s\S]*?\[data-mc-tab-content=['"]overview['"]\][\s\S]*?\.mc-section:has\(\.cw14-form-card\)[\s\S]*?display:none!important/,
  );
});

test('Round 35 pins Контекст Серии А to the Serie A blue palette in every tournament', () => {
  const start = ROUND35_CSS.indexOf('.cw18-match-context');
  const end = ROUND35_CSS.indexOf('/* External Overview Form fail-safe', start);
  assert.ok(start >= 0 && end > start, 'Serie A context CSS block must be explicit');
  const contextCss = ROUND35_CSS.slice(start, end);
  assert.match(contextCss, /--cw233-serie-context-bg:#071626/);
  assert.match(contextCss, /--cw233-serie-context-accent:#0c5aa8/);
  assert.match(contextCss, /--cw233-serie-context-accent-2:#287fc7/);
  assert.match(contextCss, /\.cw18-context-team/);
  assert.match(contextCss, /\.cw18-context-title/);
  assert.doesNotMatch(contextCss, /var\(--cw233-mc-accent(?:-2)?\)/);
});

test('Round 35 runtime is loaded after the older Match Center stability layer', async () => {
  const source = await read('../src/v23.3/index.mjs');
  const round31 = source.indexOf("import './round31-match-center-stability.mjs';");
  const round35 = source.indexOf("import './round35-match-center-overview-fixes.mjs';");
  assert.ok(round31 >= 0, 'Round 31 import must remain');
  assert.ok(round35 > round31, 'Round 35 must execute after Round 31');
});
