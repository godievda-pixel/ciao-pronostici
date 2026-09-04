import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MATCH_CENTER_SECTIONS,
  normalizeCanonicalBase,
  normalizeCanonicalSection,
  isCanonicalBase,
} from '../src/v23.3/match-center-contract.mjs';

test('all supported matches normalize to one canonical base shape', () => {
  const base = normalizeCanonicalBase({
    status:'scheduled',
    kickoffAt:'2026-09-12T18:00:00Z',
    homeTeam:{ id:'1', name:'Inter', crestUrl:'https://cdn/inter.png' },
    awayTeam:{ id:'2', name:'Milan', crestUrl:'https://cdn/milan.png' },
    coverage:{ overview:true, stats:true, events:true, lineups:false, players:false },
  }, 'serie_a', 'serie_a:42');

  assert.equal(base.competition, 'serie_a');
  assert.equal(base.matchId, 'serie_a:42');
  assert.equal(base.homeTeam.name, 'Inter');
  assert.equal(base.awayTeam.name, 'Milan');
  assert.equal(base.score.home, null);
  assert.equal(base.score.away, null);
  assert.deepEqual(MATCH_CENTER_SECTIONS, ['overview','stats','events','lineups','players']);
  assert.equal(isCanonicalBase(base), true);
});

test('canonical base strips provider aliases and produces stable nullable fields', () => {
  const base = normalizeCanonicalBase({
    status:'finished',
    kickoff_at:'2026-09-12T18:00:00Z',
    home_score:2,
    away_score:1,
    venue_name:'San Siro',
    referee_name:'Referee',
    home_team:{ id:10, name:'Milan', logo_url:'https://cdn/milan.png' },
    away_team:{ id:20, name:'Inter', logo_url:'https://cdn/inter.png' },
  }, 'serie_a', 'serie_a:99');

  assert.deepEqual(base.homeTeam, { id:'10', name:'Milan', crestUrl:'https://cdn/milan.png' });
  assert.deepEqual(base.awayTeam, { id:'20', name:'Inter', crestUrl:'https://cdn/inter.png' });
  assert.deepEqual(base.score, { home:2, away:1 });
  assert.equal(base.kickoffAt, '2026-09-12T18:00:00Z');
  assert.equal(base.venue, 'San Siro');
  assert.equal(base.referee, 'Referee');
  assert.equal('home_team' in base, false);
  assert.equal('home_score' in base, false);
});

test('canonical sections use stable names and never carry UI instructions', () => {
  const section = normalizeCanonicalSection('stats', {
    available:true,
    coverage:{ stats:true },
    data:[{ label:'Possession', home:55, away:45 }],
    html:'<div>legacy</div>',
    event:'ciao-v233-open-external-legacy-match',
  });

  assert.deepEqual(section, {
    section:'stats',
    available:true,
    coverage:{ overview:false, stats:true, events:false, lineups:false, players:false },
    data:[{ label:'Possession', home:55, away:45 }],
  });
  assert.equal('html' in section, false);
  assert.equal('event' in section, false);
});
