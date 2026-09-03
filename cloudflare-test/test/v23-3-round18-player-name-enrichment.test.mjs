import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchBsdMatchCenterSection } from '../src/v23.2/bsd-provider.mjs';

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers:{ 'content-type':'application/json' },
  });
}

test('Round 18 players enrich missing BSD player names from lineups by playerId', async () => {
  const fetchImpl = async url => {
    const href = String(url);
    if (href.includes('/leagues/?')) {
      return jsonResponse({ results:[{ id:42, name:'Coppa Italia' }] });
    }
    if (href.includes('/leagues/42/season/')) {
      return jsonResponse({ id:26, name:'2026/27' });
    }
    if (href.includes('/events/600982/player-stats/')) {
      return jsonResponse({
        event_id:600982,
        player_stats:[
          { player_id:28704, team_id:1393, rating:8.8, goals:2, minutes_played:29 },
          { player_id:39195, team_id:1607, rating:7.1, goals:1, minutes_played:60 },
        ],
      });
    }
    if (href.includes('/events/600982/lineups/')) {
      return jsonResponse({
        event_id:600982,
        lineup_status:'confirmed',
        lineups:{
          home:{
            formation:'4-1-4-1',
            players:[{ id:28704, short_name:'J. Pohjanpalo', position:'F' }],
            substitutes:[],
          },
          away:{
            formation:'3-4-2-1',
            players:[{ id:39195, short_name:'E. Gliozzi', position:'F' }],
            substitutes:[],
          },
        },
      });
    }
    if (href.includes('/events/600982/')) {
      return jsonResponse({
        id:600982,
        league:{ id:42, name:'Coppa Italia' },
        season:{ id:26, name:'2026/27' },
        event_date:'2026-09-03T16:00:00Z',
        status:'finished',
        round_name:'Round of 32',
        round_number:6,
        home_score:5,
        away_score:2,
        home_team:{ id:1393, name:'Palermo', country_code:'ITA' },
        away_team:{ id:1607, name:'Mantova', country_code:'ITA' },
      });
    }
    return jsonResponse({ results:[] });
  };

  const result = await fetchBsdMatchCenterSection({
    competition:'coppa_italia',
    matchId:'coppa_italia:600982',
    section:'players',
    apiKey:'test',
    fetchImpl,
  });

  assert.equal(result.available, true);
  assert.equal(result.data[0].playerId, 28704);
  assert.equal(result.data[0].name, 'J. Pohjanpalo');
  assert.equal(result.data[0].teamName, 'Палермо');
  assert.equal(result.data[1].playerId, 39195);
  assert.equal(result.data[1].name, 'E. Gliozzi');
  assert.equal(result.data[1].teamName, 'Мантова');
});
