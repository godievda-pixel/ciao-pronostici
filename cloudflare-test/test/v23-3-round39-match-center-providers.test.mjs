import test from 'node:test';
import assert from 'node:assert/strict';
import { createMatchCenterProviders } from '../src/v23.3/match-center-providers.mjs';

function rawMatch(nameA, nameB, extras = {}) {
  return {
    status:'live',
    kickoff_at:'2026-09-10T19:00:00Z',
    minute:37,
    home_score:1,
    away_score:0,
    home_team:{ id:501, name:nameA, logo_url:'https://cdn/home.png' },
    away_team:{ id:502, name:nameB, logo_url:'https://cdn/away.png' },
    venue_name:'San Siro',
    coverage:{ overview:true, stats:true, events:true, lineups:true, players:true, momentum:true },
    html:'<div>legacy-ui-must-not-leak</div>',
    event:'ciao-v233-open-external-legacy-match',
    ...extras,
  };
}

test('Serie A and UEFA providers expose the same canonical base shape', async () => {
  const providers = createMatchCenterProviders({
    loadSerieABase:async () => ({ match:rawMatch('Inter', 'Milan') }),
    loadSerieASection:async () => ({ available:false, data:null }),
    loadExternalBase:async () => ({ match:rawMatch('Inter', 'Arsenal') }),
    loadExternalSection:async () => ({ available:true, data:{} }),
  });

  const serieA = await providers.loadBase({ competition:'serie_a', matchId:'serie_a:42' });
  const ucl = await providers.loadBase({ competition:'ucl', matchId:'ucl:77' });

  assert.deepEqual(Object.keys(serieA), Object.keys(ucl));
  assert.equal(serieA.competition, 'serie_a');
  assert.equal(ucl.competition, 'ucl');
  assert.equal(serieA.matchId, 'serie_a:42');
  assert.equal(ucl.matchId, 'ucl:77');
  assert.equal(serieA.homeTeam.name, 'Inter');
  assert.equal(ucl.awayTeam.name, 'Arsenal');
  assert.deepEqual(ucl.score, { home:1, away:0 });
  assert.equal(ucl.minute, 37);
  assert.equal('html' in serieA, false);
  assert.equal('event' in ucl, false);
});

test('external sections normalize coverage to the five canonical capabilities and strip UI metadata', async () => {
  const providers = createMatchCenterProviders({
    loadSerieABase:async () => ({ match:rawMatch('Inter', 'Milan') }),
    loadSerieASection:async () => ({ available:false, data:null }),
    loadExternalBase:async () => ({ match:rawMatch('Inter', 'Arsenal') }),
    loadExternalSection:async () => ({
      available:true,
      coverage:{ overview:true, stats:true, events:true, lineups:false, players:false, shotmap:true },
      data:{ home:{ xg:1.4 }, away:{ xg:.8 } },
      html:'legacy',
      event:'legacy-ui-event',
    }),
  });

  const stats = await providers.loadSection({ competition:'ucl', matchId:'ucl:77', section:'stats' });
  assert.deepEqual(stats, {
    section:'stats',
    available:true,
    coverage:{ overview:true, stats:true, events:true, lineups:false, players:false },
    data:{ home:{ xg:1.4 }, away:{ xg:.8 } },
  });
  assert.equal('html' in stats, false);
  assert.equal('event' in stats, false);
});

test('provider registry rejects unsupported competitions and mismatched canonical ids before I/O', async () => {
  let calls = 0;
  const hit = async () => { calls += 1; return { match:rawMatch('A', 'B') }; };
  const providers = createMatchCenterProviders({
    loadSerieABase:hit,
    loadSerieASection:hit,
    loadExternalBase:hit,
    loadExternalSection:hit,
  });

  await assert.rejects(() => providers.loadBase({ competition:'bundesliga', matchId:'bundesliga:1' }), /competition_not_supported/);
  await assert.rejects(() => providers.loadBase({ competition:'ucl', matchId:'uel:77' }), /competition_match_mismatch/);
  await assert.rejects(() => providers.loadSection({ competition:'ucl', matchId:'ucl:77', section:'weather' }), /invalid_match_center_section/);
  assert.equal(calls, 0);
});
