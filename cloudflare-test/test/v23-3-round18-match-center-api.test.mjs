import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.js';

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers:{ 'content-type':'application/json' },
  });
}

function richEvent(overrides = {}) {
  return {
    id:77,
    league:{ id:10, name:'UEFA Champions League' },
    season:{ id:20, name:'2026/27' },
    event_date:'2026-09-10T19:00:00Z',
    status:'live',
    minute:37,
    round_name:'League Stage',
    round_number:1,
    home_score:1,
    away_score:0,
    home_team:{ id:501, name:'Inter', country_code:'ITA' },
    away_team:{ id:502, name:'Arsenal', country_code:'ENG' },
    venue:{ name:'San Siro', city:'Milano', capacity:75817 },
    statistics:{
      home:{ expected_goals:1.42, ball_possession:58, total_shots:13, shots_on_target:6 },
      away:{ expected_goals:0.81, ball_possession:42, total_shots:9, shots_on_target:3 },
    },
    incidents:[{ type:'goal', minute:23, is_home:true, player:'Lautaro', home_score:1, away_score:0 }],
    lineups:{ home:{ formation:'3-5-2', players:[] }, away:{ formation:'4-3-3', players:[] } },
    player_stats:[{ player_id:9, short_name:'Lautaro', rating:7.8, minutes_played:90 }],
    ...overrides,
  };
}

function installBsdFetch(event, { eventStatus = 200 } = {}) {
  const previous = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async url => {
    calls += 1;
    const href = String(url);
    if (href.includes('/leagues/?')) return jsonResponse({ results:[{ id:10, name:'UEFA Champions League' }] });
    if (href.includes('/leagues/10/season/')) return jsonResponse({ id:20, name:'2026/27' });
    if (href.includes('/events/77/')) return jsonResponse(eventStatus === 200 ? event : { error:'upstream' }, eventStatus);
    return jsonResponse({ results:[] });
  };
  return {
    calls:() => calls,
    restore:() => { globalThis.fetch = previous; },
  };
}

function request(query) {
  return new Request(`https://ciao-web-app-test.ciao-web.workers.dev/api/v23.3/match-center?${query}`, {
    headers:{ 'x-telegram-init-data':'signed-test-user' },
  });
}

test('Round 18 Match Center base endpoint returns lightweight base plus explicit coverage', async () => {
  const mock = installBsdFetch(richEvent());
  try {
    const response = await worker.fetch(request('competition=ucl&match_id=ucl%3A77'), { BSD_API_KEY:'test' }, {});
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.ok, true);
    assert.equal(payload.data.provider, 'bsd-v2');
    assert.equal(payload.data.match.matchId, 'ucl:77');
    assert.equal(payload.data.match.homeTeam.name, 'Интер');
    assert.equal(payload.data.match.coverage.stats, true);
    assert.equal(payload.data.match.coverage.players, true);
    assert.equal('statistics' in payload.data.match, false);
    assert.equal('events' in payload.data.match, false);
  } finally {
    mock.restore();
  }
});

test('Round 18 Match Center section endpoint returns exactly one canonical section with full coverage', async () => {
  const mock = installBsdFetch(richEvent());
  try {
    const response = await worker.fetch(request('competition=ucl&match_id=ucl%3A77&section=stats'), { BSD_API_KEY:'test' }, {});
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.ok, true);
    assert.equal(payload.data.competition, 'ucl');
    assert.equal(payload.data.matchId, 'ucl:77');
    assert.equal(payload.data.section, 'stats');
    assert.deepEqual(payload.data.coverage, {
      overview:true,
      stats:true,
      events:true,
      lineups:true,
      players:true,
      momentum:false,
      shotmap:false,
    });
    assert.equal(payload.data.data.home.xg, 1.42);
    assert.equal(payload.data.data.away.shotsOnTarget, 3);
    assert.equal('events' in payload.data, false);
  } finally {
    mock.restore();
  }
});

test('Round 18 rejects an invalid Match Center section before BSD I/O', async () => {
  const mock = installBsdFetch(richEvent());
  try {
    const response = await worker.fetch(request('competition=ucl&match_id=ucl%3A77&section=weather'), { BSD_API_KEY:'test' }, {});
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      ok:false,
      error:'invalid_match_center_section',
      section:'weather',
      competition:'ucl',
    });
    assert.equal(mock.calls(), 0);
  } finally {
    mock.restore();
  }
});

test('Round 18 section endpoint keeps Italian eligibility as a controlled 404', async () => {
  const mock = installBsdFetch(richEvent({
    home_team:{ id:501, name:'Barcelona', country_code:'ESP' },
    away_team:{ id:502, name:'Arsenal', country_code:'ENG' },
  }));
  try {
    const response = await worker.fetch(request('competition=ucl&match_id=ucl%3A77&section=events'), { BSD_API_KEY:'test' }, {});
    assert.equal(response.status, 404);
    const payload = await response.json();
    assert.equal(payload.error, 'match_not_eligible');
    assert.equal(payload.competition, 'ucl');
  } finally {
    mock.restore();
  }
});

test('Round 18 section provider failure is local to the requested section response', async () => {
  const broken = installBsdFetch(richEvent(), { eventStatus:500 });
  try {
    const response = await worker.fetch(request('competition=ucl&match_id=ucl%3A77&section=stats'), { BSD_API_KEY:'test' }, {});
    assert.equal(response.status, 502);
    const payload = await response.json();
    assert.equal(payload.error, 'match_center_section_upstream_failed');
    assert.equal(payload.section, 'stats');
  } finally {
    broken.restore();
  }

  const healthy = installBsdFetch(richEvent());
  try {
    const response = await worker.fetch(request('competition=ucl&match_id=ucl%3A77'), { BSD_API_KEY:'test' }, {});
    assert.equal(response.status, 200);
  } finally {
    healthy.restore();
  }
});
