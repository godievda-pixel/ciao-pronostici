import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeMatch } from '../src/modular/data/match-normalizer.mjs';
import { createSerieAClubIndex } from '../src/modular/data/selectors.mjs';
import { renderFavoriteClub } from '../src/modular/screens/favorite-club.mjs';
import { renderCalcioToday, createCalcioTodayController } from '../src/modular/screens/calcio-today.mjs';

function m(id, competition, kickoffAt, home, away, extra={}) {
  return normalizeMatch({ id, kickoff_at:kickoffAt, home, away, ...extra }, competition);
}

const clubs = createSerieAClubIndex([
  { team_id:109, team_name:'Juventus' },
  { team_id:110, team_name:'Inter' },
]);

test('favorite club renders exactly one nearest match as a single full-card click target', () => {
  const matches = [
    m(1,'serie_a','2026-09-10T18:00:00Z',{id:109,name:'Juventus',crestUrl:'juve.png'},{id:200,name:'Roma',crestUrl:'roma.png'}),
    m(2,'ucl','2026-09-08T19:00:00Z',{id:300,name:'Arsenal',crestUrl:'arsenal.png'},{id:109,name:'Juventus',crestUrl:'juve.png'}),
  ];
  const html = renderFavoriteClub({
    favoriteClub:{ id:109, name:'Juventus', crestUrl:'juve.png' },
    matches,
    now:new Date('2026-09-06T10:00:00Z'),
  });
  assert.match(html, /data-ciao-match-id="ucl:2"/);
  assert.match(html, /data-ciao-competition="ucl"/);
  assert.equal((html.match(/<button[^>]+class="ciao-match-card /g) || []).length, 1);
  assert.match(html, /juve\.png/);
  assert.match(html, /arsenal\.png/);
  assert.match(html, /^<section[\s\S]*<button[^>]+data-ciao-match-id=/);
});

test('Calcio today uses exact empty copy and never substitutes upcoming fixtures', () => {
  const html = renderCalcioToday({
    matches:[m(1,'serie_a','2026-09-07T12:00:00Z',{id:109,name:'Juventus'},{id:200,name:'Roma'})],
    clubIndex:clubs,
    now:new Date('2026-09-06T10:00:00Z'),
  });
  assert.match(html, /Кальчо сегодня нет :\(/);
  assert.doesNotMatch(html, /Juventus/);
});

test('Calcio today card reflects live score/minute and controller re-renders live updates', async () => {
  const initial = m(9,'serie_a','2026-09-06T18:00:00Z',{id:109,name:'Juventus'},{id:200,name:'Roma'},{status:'live',live_elapsed:12,home_score:0,away_score:0});
  const updated = m(9,'serie_a','2026-09-06T18:00:00Z',{id:109,name:'Juventus'},{id:200,name:'Roma'},{status:'live',live_elapsed:31,home_score:1,away_score:0});
  let listener = null;
  const rendered = [];
  const liveEngine = {
    subscribe(fn){ listener = fn; return () => { listener = null; }; },
    async start(){ return {}; },
    stop(){},
  };
  const controller = createCalcioTodayController({
    dataService:{ async loadAllMatches(){ return { matches:[initial], errors:[] }; } },
    liveEngine,
    clubIndex:clubs,
    now:() => new Date('2026-09-06T10:00:00Z'),
    render:html => rendered.push(html),
  });
  await controller.start();
  assert.match(rendered.at(-1), /0\s*:\s*0/);
  listener({ data:{ matches:[updated] } });
  assert.match(rendered.at(-1), /1\s*:\s*0/);
  assert.match(rendered.at(-1), /31′/);
  controller.stop();
});
