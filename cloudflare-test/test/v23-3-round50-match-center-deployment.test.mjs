import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const PROBE_PATH = new URL('../scripts/probe-round50-match-center.mjs', import.meta.url);
const WORKFLOW_PATH = new URL('../../.github/workflows/ciao-test-check.yml', import.meta.url);

function sourceOrEmpty(url) {
  return existsSync(url) ? readFileSync(url, 'utf8') : '';
}

test('Round 50 deployed probe script exists and checks every parity block', () => {
  const source = sourceOrEmpty(PROBE_PATH);
  assert.ok(source.length > 0, 'Round 50 deployed probe script must exist');
  for (const marker of [
    'v23-3-round50-match-center.json',
    'match-center-overview.mjs',
    'match-center-stats.mjs',
    'match-center-events.mjs',
    'match-center-lineups.mjs',
    'match-center-players.mjs',
    'data-cw250-key-indicators',
    'data-cw250-mc-stats-primary',
    'data-cw250-mc-stats-secondary',
    'data-cw250-mc-pressure',
    'data-cw250-mc-events-timeline',
    'data-cw250-mc-lineup-stage',
    'data-cw250-mc-player-card',
    'MATCH_CENTER_HOST_SCROLLBAR_CSS',
    "coppa_italia:freezeTheme('coppa'",
    "ucl:freezeTheme('champions'",
    "uel:freezeTheme('europa'",
    "uecl:freezeTheme('conference'",
  ]) {
    assert.match(source, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('Round 50 deployed probe is wired into develop-push CI with retries and artifact upload', () => {
  const workflow = sourceOrEmpty(WORKFLOW_PATH);
  assert.match(workflow, /Probe deployed Round 50 Match Center parity/);
  assert.match(workflow, /node scripts\/probe-round50-match-center\.mjs/);
  assert.match(workflow, /for attempt in 1 2 3 4 5 6/);
  assert.match(workflow, /name: ciao-v23-3-round50-match-center/);
  assert.match(workflow, /path: cloudflare-test\/artifacts\/v23-3-round50-match-center\.json/);
});
