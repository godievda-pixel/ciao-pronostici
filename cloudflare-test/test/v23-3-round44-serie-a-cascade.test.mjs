import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('Round 44 Serie A overrides the Round 8 Matches layer with equal-or-higher specificity', async () => {
  const [round8, round43] = await Promise.all([
    read('../src/v23.3/round8-performance-premium.mjs'),
    read('../src/v23.3/round43-serie-a-ui.mjs'),
  ]);

  assert.match(round8, /#ciao-v232-matches-overlay \.cw232-competition\[data-cw232-theme='serie-a'\]/);
  assert.match(round8, /#ciao-v232-matches-overlay \.cw232-match-card/);

  assert.match(round43, /#ciao-v232-matches-overlay \.cw232-competition\[data-cw232-competition='serie_a'\]\s*\{/);
  assert.match(round43, /#ciao-v232-matches-overlay \.cw232-competition\[data-cw232-competition='serie_a'\] \.cw232-match-card\s*\{/);
  assert.match(round43, /#ciao-v232-matches-overlay \.cw232-competition\[data-cw232-competition='serie_a'\] \.cw232-match-card__status\s*\{/);
  assert.match(round43, /#ciao-v232-matches-overlay \.cw232-competition\[data-cw232-competition='serie_a'\] \.cw232-group-tabs button\[aria-selected='true'\]\s*\{/);
});
