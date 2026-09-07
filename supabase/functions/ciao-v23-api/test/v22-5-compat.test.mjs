import assert from 'node:assert/strict';
import test from 'node:test';
import { legacyRouteFor } from '../compat-v22-5.mjs';

test('legacy core aliases resolve to one compatibility core route', () => {
  for (const slug of ['ciao-core-api-fast','ciao-core-api-fast-v4','ciao-core-api-fast-v5','ciao-core-api-fast-v6']) {
    assert.deepEqual(legacyRouteFor(slug, { action:'state' }), { kind:'core', action:'state' });
  }
});

test('specialized stable v22.5 endpoints resolve deterministically', () => {
  assert.deepEqual(legacyRouteFor('ciao-fast-api-v2', { action:'live_updates' }), { kind:'live_updates', action:'live_updates' });
  assert.deepEqual(legacyRouteFor('ciao-match-center-fast-v3', { match_id:123 }), { kind:'match_center', action:'load' });
  assert.deepEqual(legacyRouteFor('ciao-schedule-fast-v1', {}), { kind:'schedule', action:'load' });
  assert.deepEqual(legacyRouteFor('ciao-club-profile-fast', { team_id:10 }), { kind:'club_profile', action:'load' });
  assert.deepEqual(legacyRouteFor('ciao-club-calendar-fast-v1', { team_id:10 }), { kind:'club_calendar', action:'load' });
  assert.deepEqual(legacyRouteFor('ciao-live-snapshot-v1', {}), { kind:'live_snapshot', action:'load' });
  assert.deepEqual(legacyRouteFor('ciao-prediction-insights-v1', { match_id:123 }), { kind:'prediction_insights', action:'load' });
});

test('unknown legacy endpoint fails closed', () => {
  assert.throws(() => legacyRouteFor('totally-unknown-api', {}), /unknown_legacy_endpoint:totally-unknown-api/);
});
