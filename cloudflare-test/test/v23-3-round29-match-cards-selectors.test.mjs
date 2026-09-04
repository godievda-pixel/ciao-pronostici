import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { renderCompetitionScreen } from '../src/v23.2/matches-ui.mjs';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

function scheduledMatch(competition, round, id) {
  return {
    competition,
    matchId:`${competition}:${id}`,
    kickoffAt:`2026-09-${String(round + 1).padStart(2, '0')}T18:45:00Z`,
    status:'scheduled',
    round,
    stage:`Round ${round}`,
    homeTeam:{ name:`Home ${round}`, crestUrl:'https://example.test/home.png' },
    awayTeam:{ name:`Away ${round}`, crestUrl:'https://example.test/away.png' },
  };
}

function count(source, token) {
  return String(source).split(token).length - 1;
}

test('Round 29 Serie A renders round selector buttons instead of one flat grouped list', () => {
  const html = renderCompetitionScreen('serie_a', {
    matches:[scheduledMatch('serie_a', 1, 1), scheduledMatch('serie_a', 2, 2), scheduledMatch('serie_a', 3, 3)],
  }, { now:new Date('2026-09-01T10:00:00Z') });

  assert.match(html, /class="cw232-group-tabs"/);
  assert.match(html, /data-cw232-group-key="round:1"[^>]*>1<\/button>/);
  assert.match(html, /data-cw232-group-key="round:2"[^>]*>2<\/button>/);
  assert.match(html, /data-cw232-group-key="round:3"[^>]*>3<\/button>/);
});

test('Round 29 native rich match cards are not decorated a second time by Round 8', async () => {
  const round8 = await read('../src/v23.3/round8-performance-premium.mjs');
  assert.match(
    round8,
    /decorateMatchCard\(card\)[\s\S]*?querySelector\?\.\('\.cw232-match-card__meta'\)[\s\S]*?return/,
    'Round 8 must leave the Round 28 native meta/status row untouched',
  );

  const html = renderCompetitionScreen('coppa_italia', {
    matches:[{ ...scheduledMatch('coppa_italia', 1, 11), stage:'Round of 16' }],
  });
  assert.equal(count(html, 'cw232-match-card__status'), 1);
  assert.equal(count(html, 'cw232-match-card__kickoff'), 1);
});

test('Round 29 inactive round and stage buttons are neutral translucent in every tournament', async () => {
  const round8 = await read('../src/v23.3/round8-performance-premium.mjs');
  assert.match(
    round8,
    /\.cw232-group-tabs button\{[^}]*background:rgba\(255,255,255,[^)]+\)[^}]*border:1px solid rgba\(255,255,255,[^)]+\)/,
  );
  assert.doesNotMatch(
    round8,
    /\.cw232-group-tabs button\{[^}]*background:[^;}]*var\(--cw232-(?:accent|match-accent)/,
  );
});

test('Round 29 active selectors and status badge inherit the current tournament match palette', async () => {
  const round8 = await read('../src/v23.3/round8-performance-premium.mjs');
  assert.match(
    round8,
    /\.cw232-group-tabs button\[aria-selected='true'\]\{[^}]*var\(--cw232-match-accent\)[^}]*var\(--cw232-match-accent-2\)/,
  );
  assert.match(
    round8,
    /\.cw232-match-card__status\{[^}]*var\(--cw232-match-accent\)[^}]*var\(--cw232-match-accent-2\)/,
  );
});
