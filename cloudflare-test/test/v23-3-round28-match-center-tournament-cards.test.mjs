import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { renderCompetitionScreen } from '../src/v23.2/matches-ui.mjs';

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

test('Round 28 external Match Center uses a positive legacy-compatible runtime id instead of -1', async () => {
  const homePatch = await read('../scripts/home-v23-3-source-patch.mjs');
  assert.doesNotMatch(homePatch, /matchViewId\s*=\s*-1\s*;/);
  assert.match(homePatch, /function\s+__cw233ExternalRuntimeId\s*\(/);
  assert.match(homePatch, /matchViewId\s*=\s*__cw233ExternalRuntimeId\(detail\)\s*;/);
});

test('Round 28 Serie A context cards use premium competition surfaces instead of the old flat blue cards', async () => {
  const theme = await read('../src/v23.3/legacy-match-center-theme.mjs');
  assert.match(
    theme,
    /\.cw14-info-item,[\s\S]*?\.cw14-form-card\s*\{[\s\S]*?linear-gradient\(145deg,[\s\S]*?var\(--cw233-mc-accent\)[\s\S]*?var\(--cw233-mc-accent-2\)/,
  );
  assert.match(
    theme,
    /\.cw14-info-item,[\s\S]*?\.cw14-form-card\s*\{[\s\S]*?border:\s*1px solid color-mix\(in srgb,var\(--cw233-mc-accent\)/,
  );
  assert.match(
    theme,
    /\.cw14-info-item,[\s\S]*?\.cw14-form-card\s*\{[\s\S]*?box-shadow:/,
  );
});

test('Round 28 every competition renders the same rich scheduled-match card structure', () => {
  const competitions = ['serie_a', 'coppa_italia', 'ucl', 'uel', 'uecl'];
  for (const competition of competitions) {
    const html = renderCompetitionScreen(competition, {
      matches:[{
        matchId:`${competition}:9001`,
        competition,
        kickoffAt:'2026-09-05T18:45:00Z',
        status:'scheduled',
        stage:'Round 1',
        round:1,
        homeTeam:{ name:'Home', crestUrl:'https://example.test/home.png' },
        awayTeam:{ name:'Away', crestUrl:'https://example.test/away.png' },
      }],
    }, { now:new Date('2026-09-04T10:00:00Z') });

    assert.match(html, /cw232-match-card__meta/);
    assert.match(html, /cw232-match-card__status/);
    assert.match(html, /cw232-match-card__kickoff/);
    assert.match(html, /cw232-match-card__score[^>]*>—\s*:\s*—</);
    assert.match(html, /МАТЧ НЕ НАЧАЛСЯ/);
    assert.match(html, /ОЖИДАЕМ НАЧАЛО/);
  }
});

test('Round 28 match cards and group tabs inherit per-tournament CSS variables', async () => {
  const source = await read('../src/v23.2/matches-ui.mjs');
  assert.match(source, /--cw232-match-accent:#0c5aa8/);
  assert.match(source, /data-cw232-theme='coppa'[\s\S]*--cw232-match-accent:#ce2b37[\s\S]*--cw232-match-accent-2:#009246/);
  assert.match(source, /data-cw232-theme='champions'[\s\S]*--cw232-match-accent:#3157ff[\s\S]*--cw232-match-accent-2:#7b42ff/);
  assert.match(source, /data-cw232-theme='europa'[\s\S]*--cw232-match-accent:#f06722[\s\S]*--cw232-match-accent-2:#ff9b32/);
  assert.match(source, /data-cw232-theme='conference'[\s\S]*--cw232-match-accent:#22a866[\s\S]*--cw232-match-accent-2:#55d68e/);
  assert.match(source, /\.cw232-match-card\{[\s\S]*var\(--cw232-match-accent\)[\s\S]*var\(--cw232-match-accent-2\)/);
  assert.match(source, /\.cw232-group-tabs button\[aria-selected='true'\][\s\S]*var\(--cw232-match-accent\)[\s\S]*var\(--cw232-match-accent-2\)/);
});
