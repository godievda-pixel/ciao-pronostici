import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveCanonicalMatchTarget } from '../src/v23.3/match-center-links.mjs';
import { normalizeSerieALegacyMatchCenter } from '../src/v23.3/serie-a-match-center-legacy-normalizer.mjs';
import { adaptSerieALegacyMatchCenter } from '../src/v23.3/serie-a-match-center-adapter.mjs';
import { normalizeRound512SerieARaw } from '../src/v23.3/round51-2-serie-a-recovery.mjs';
import {
  loadSerieAMatchCenterBase,
  loadSerieAMatchCenterSection,
} from '../src/v23.3/serie-a-match-center-provider.mjs';

function json(payload) {
  return Response.json({ ok:true, ...payload });
}

function scheduleTarget() {
  const homeImg = { getAttribute:name => name === 'src' ? 'https://img.test/roma.png' : '' };
  const awayImg = { getAttribute:name => name === 'src' ? 'https://img.test/atalanta.png' : '' };
  const homeName = { textContent:'Рома' };
  const awayName = { textContent:'Аталанта' };
  const time = { getAttribute:name => name === 'datetime' ? '2026-09-05T18:45:00Z' : '' };
  const competitionHost = { dataset:{ cw232Competition:'serie_a' } };
  const card = {
    dataset:{ cw232Match:'serie_a:77', cw232MatchState:'finished' },
    closest(selector) {
      if (selector === '[data-cw232-competition]') return competitionHost;
      return null;
    },
    querySelector(selector) {
      if (selector === '.cw232-match-team--home strong') return homeName;
      if (selector === '.cw232-match-team--away strong') return awayName;
      if (selector === '.cw232-match-team--home img') return homeImg;
      if (selector === '.cw232-match-team--away img') return awayImg;
      if (selector === 'time[datetime]') return time;
      return null;
    },
  };
  return {
    closest(selector) {
      if (selector === '[data-cw232-match]') return card;
      if (selector === '#ciao-v232-matches-overlay') return {};
      return null;
    },
  };
}

test('Round 51.2 schedule-card click carries team crests directly into initialMatch without relying on cache timing', () => {
  const payload = resolveCanonicalMatchTarget(scheduleTarget());
  assert.equal(payload.competition, 'serie_a');
  assert.equal(payload.matchId, 'serie_a:77');
  assert.equal(payload.initialMatch.homeTeam.name, 'Рома');
  assert.equal(payload.initialMatch.homeTeam.crestUrl, 'https://img.test/roma.png');
  assert.equal(payload.initialMatch.awayTeam.name, 'Аталанта');
  assert.equal(payload.initialMatch.awayTeam.crestUrl, 'https://img.test/atalanta.png');
  assert.equal(payload.initialMatch.kickoffAt, '2026-09-05T18:45:00Z');
});

test('Round 51.2 legacy recovery preserves short_name/name and player id aliases on shots', () => {
  const normalized = normalizeSerieALegacyMatchCenter(normalizeRound512SerieARaw({
    match:{ id:77, home:{ id:1, name:'Рома' }, away:{ id:2, name:'Аталанта' } },
    stats:{
      stats:{ home:{ total_shots:1 }, away:{ total_shots:1 } },
      shotmap:[
        { pos:{ x:82, y:45 }, is_home:true, min:59, xg:.39, short_name:'D. Malen', player_id:14 },
        { pos:{ x:76, y:55 }, is_home:false, min:61, xg:.12, name:'Éderson', pid:15 },
      ],
    },
  }));
  const adapted = adaptSerieALegacyMatchCenter(normalized);
  assert.equal(adapted.stats.shots[0].player, 'D. Malen');
  assert.equal(adapted.stats.shots[0].playerId, 14);
  assert.equal(adapted.stats.shots[1].player, 'Éderson');
  assert.equal(adapted.stats.shots[1].playerId, 15);
});

function recoveryEnv() {
  const calls = [];
  const baseMatch = {
    id:77,
    status:'finished',
    is_finished:true,
    home:{ id:1, name:'Рома' },
    away:{ id:2, name:'Аталанта' },
    home_score:2,
    away_score:1,
  };
  const starters = Array.from({ length:11 }, (_, index) => ({
    id:index + 1,
    short_name:`Roma ${index + 1}`,
    position:index === 0 ? 'GK' : 'MF',
    shirt_number:index + 1,
  }));
  const full = {
    match:baseMatch,
    incidents:{ incidents:[
      { type:'goal', minute:12, is_home:true, player:{ name:'D. Malen' }, player_id:14, home_score:1, away_score:0 },
      { type:'goal', minute:34, is_home:true, player:{ name:'P. Dybala' }, player_id:21, home_score:2, away_score:0 },
      { type:'goal', minute:47, is_home:false, player:{ name:'Éderson' }, player_id:15, home_score:2, away_score:1 },
    ] },
    lineups:{ lineups:{
      home:{ formation:'3-4-2-1', players:starters, substitutes:[{ id:31, short_name:'Roma Bench', position:'MF', shirt_number:31 }] },
      away:{ formation:'3-4-2-1', players:starters.map((p,index)=>({ ...p, id:100 + index, short_name:`Atalanta ${index + 1}` })), substitutes:[{ id:41, short_name:'Atalanta Bench', position:'FW', shirt_number:41 }] },
    } },
    player_stats:{ player_stats:[
      { player_id:14, name:'D. Malen', team_id:1, team_name:'Рома', rating:8.1, minutes_played:90 },
      { player_id:21, name:'P. Dybala', team_id:1, team_name:'Рома', rating:7.8, minutes_played:90 },
      { player_id:15, name:'Éderson', team_id:2, team_name:'Аталанта', rating:7.4, minutes_played:90 },
      { player_id:31, name:'Roma Bench', team_id:1, team_name:'Рома', rating:6.7, minutes_played:18 },
    ] },
    stats:{
      stats:{ home:{ total_shots:26 }, away:{ total_shots:6 } },
      shotmap:[{ pos:{ x:82, y:45 }, is_home:true, min:59, xg:.39, player_id:14 }],
    },
  };
  return {
    calls,
    env:{ CIAO_WEB_API:{
      fetch:async request => {
        const url = new URL(request.url);
        const body = await request.clone().json().catch(() => ({}));
        calls.push({ path:url.pathname, sections:Array.isArray(body.sections) ? [...body.sections] : null });
        if (url.pathname.endsWith('/ciao-match-summary-fast-v2')) return json({ match:baseMatch });
        const sections = Array.isArray(body.sections) ? body.sections : [];
        if (sections.length === 0) return json(full);
        if (sections.length === 1 && sections[0] === 'incidents') {
          return json({ match:baseMatch, incidents:{ incidents:[full.incidents.incidents[2]] } });
        }
        if (sections.includes('lineups')) {
          return json({
            match:baseMatch,
            lineups:{ lineups:{
              home:{ formation:'3-4-2-1', players:starters, substitutes:[] },
              away:{ formation:'3-4-2-1', players:starters.map((p,index)=>({ ...p, id:100 + index })), substitutes:[] },
            } },
            player_stats:{ player_stats:[] },
          });
        }
        if (sections.includes('player_stats')) return json({ match:baseMatch, player_stats:{ player_stats:[] } });
        if (sections.includes('stats')) return json({ match:baseMatch, stats:full.stats, player_stats:full.player_stats, lineups:full.lineups });
        return json({ match:baseMatch });
      },
    } },
  };
}

test('Round 51.2 incomplete hero incidents escalate once to full Match Center and recover all scorers', async () => {
  const { env, calls } = recoveryEnv();
  const result = await loadSerieAMatchCenterBase({
    request:new Request('https://test.local/api/v23.3/match-center'),
    env,
    initData:'signed-user',
    matchId:'serie_a:77',
  });
  assert.equal(result.match.goals.home.length, 2);
  assert.equal(result.match.goals.away.length, 1);
  assert.deepEqual(result.match.goals.home.map(goal => goal.player), ['D. Malen','P. Dybala']);
  assert.ok(calls.some(call => call.path.endsWith('/ciao-match-center-fast-v3') && Array.isArray(call.sections) && call.sections.length === 0));
});

test('Round 51.2 incomplete lineups escalate once to full Match Center and recover bench plus ratings', async () => {
  const { env, calls } = recoveryEnv();
  const result = await loadSerieAMatchCenterSection({
    request:new Request('https://test.local/api/v23.3/match-center'),
    env,
    initData:'signed-user',
    matchId:'serie_a:77',
    section:'lineups',
  });
  assert.equal(result.available, true);
  assert.equal(result.data.home.substitutes.length, 1);
  assert.equal(result.data.away.substitutes.length, 1);
  assert.equal(result.data.home.substitutes[0].name, 'Roma Bench');
  assert.equal(result.data.home.substitutes[0].rating, 6.7);
  assert.ok(calls.some(call => call.path.endsWith('/ciao-match-center-fast-v3') && Array.isArray(call.sections) && call.sections.length === 0));
});

test('Round 51.2 stats resolve shot player by player_id from player stats/lineups', async () => {
  const { env } = recoveryEnv();
  const result = await loadSerieAMatchCenterSection({
    request:new Request('https://test.local/api/v23.3/match-center'),
    env,
    initData:'signed-user',
    matchId:'serie_a:77',
    section:'stats',
  });
  assert.equal(result.available, true);
  assert.equal(result.data.shots[0].playerId, 14);
  assert.equal(result.data.shots[0].player, 'D. Malen');
});

test('Round 51.2 empty player-stats response escalates to full Match Center before declaring ratings unavailable', async () => {
  const { env, calls } = recoveryEnv();
  const result = await loadSerieAMatchCenterSection({
    request:new Request('https://test.local/api/v23.3/match-center'),
    env,
    initData:'signed-user',
    matchId:'serie_a:77',
    section:'players',
  });
  assert.equal(result.available, true);
  assert.ok(result.data.some(player => player.rating === 8.1));
  assert.ok(calls.some(call => call.path.endsWith('/ciao-match-center-fast-v3') && Array.isArray(call.sections) && call.sections.length === 0));
});
