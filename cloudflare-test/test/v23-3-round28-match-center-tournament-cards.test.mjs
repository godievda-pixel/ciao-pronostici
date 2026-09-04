import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('Round 28 Serie A Match Center keeps its own back button and fully owns the viewport', async () => {
  const theme = await read('../src/v23.3/legacy-match-center-theme.mjs');
  const homePatch = await read('../scripts/home-v23-3-source-patch.mjs');

  assert.doesNotMatch(
    theme,
    /match-center-open:not\(\[data-cw233-mc-competition\]\)[\s\S]*?\.mc-back\s*\{[\s\S]*?display:\s*none!important/,
    'the inner Match Center back button must remain visible for Serie A',
  );
  assert.match(
    theme,
    /#ciao-miniapp-root\.match-center-open \.mc-shell\s*\{[\s\S]*?border:\s*0!important[\s\S]*?outline:\s*0!important/,
    'the legacy shell must not leave a blue frame around the viewport',
  );
  assert.match(
    homePatch,
    /addEventListener\?\.\('ciao-v233-open-serie-a-match',\s*__cw233SuspendMatchesOverlay\)/,
    'opening the Serie A Match Center must suspend the outer Matches overlay just like external tournaments',
  );
});
