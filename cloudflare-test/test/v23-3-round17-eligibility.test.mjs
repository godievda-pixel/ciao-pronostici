import test from 'node:test';
import assert from 'node:assert/strict';

import { shouldIncludeMatch } from '../src/v23.2/match-normalizer.mjs';
import { fetchBsdMatchSnapshot } from '../src/v23.2/bsd-provider.mjs';

const team = (name, countryCode = '') => ({ name, countryCode });
const match = (competition, homeTeam, awayTeam, extra = {}) => ({
  competition,
  homeTeam,
  awayTeam,
  stage:'League Stage',
  round:1,
  ...extra,
});

test('Round 17 keeps UEFA match with an Italian club', () => {
  assert.equal(shouldIncludeMatch(match('ucl', team('Интер'), team('Арсенал'))), true);
});

test('Round 17 excludes UEFA match without an Italian club', () => {
  assert.equal(shouldIncludeMatch(match('ucl', team('Барселона'), team('Арсенал'))), false);
});

test('Round 17 applies the Italian predicate to Coppa Italia too', () => {
  assert.equal(shouldIncludeMatch(match('coppa_italia', team('Ювентус'), team('Милан'))), true);
  assert.equal(shouldIncludeMatch(match('coppa_italia', team('Арсенал'), team('Барселона'))), false);
});

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers:{ 'content-type':'application/json' },
  });
}

function nonItalianSnapshotFetch(url) {
  const href = String(url);
  if (href.includes('/leagues/?')) {
    return Promise.resolve(jsonResponse({ results:[{ id:10, name:'UEFA Champions League' }] }));
  }
  if (href.includes('/leagues/10/season/')) {
    return Promise.resolve(jsonResponse({ id:20, name:'2026/27' }));
  }
  if (href.includes('/events/99/')) {
    return Promise.resolve(jsonResponse({
      id:99,
      league:{ id:10, name:'UEFA Champions League' },
      season:{ id:20, name:'2026/27' },
      event_date:'2026-09-10T19:00:00Z',
      status:'scheduled',
      round_name:'League Stage',
      round_number:1,
      home_team:{ id:501, name:'Barcelona', country_code:'ESP' },
      away_team:{ id:502, name:'Arsenal', country_code:'ENG' },
    }));
  }
  return Promise.resolve(jsonResponse({ results:[] }));
}

test('Round 17 BSD direct snapshot rejects non-Italian UEFA match with match_not_eligible', async () => {
  await assert.rejects(
    () => fetchBsdMatchSnapshot({
      competition:'ucl',
      matchId:'ucl:99',
      apiKey:'test',
      fetchImpl:nonItalianSnapshotFetch,
    }),
    error => error?.code === 'match_not_eligible',
  );
});
