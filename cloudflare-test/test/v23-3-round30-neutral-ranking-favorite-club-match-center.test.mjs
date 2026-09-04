import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolveAuthenticatedUser } from '../src/v23.3/prediction-auth.mjs';
import { createPredictionService } from '../src/v23.3/prediction-service.mjs';

const runtimeUrl = new URL('../src/v23.3/round30-feedback-fixes.mjs', import.meta.url);
const indexSource = readFileSync(new URL('../src/v23.3/index.mjs', import.meta.url), 'utf8');
const rankingSource = readFileSync(new URL('../src/v23.3/ranking-ui.mjs', import.meta.url), 'utf8');
const legacyThemeSource = readFileSync(new URL('../src/v23.3/legacy-match-center-theme.mjs', import.meta.url), 'utf8');
const premiumSource = readFileSync(new URL('../src/v23.3/premium-polish-ui.mjs', import.meta.url), 'utf8');

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers:{ 'content-type':'application/json' },
  });
}

test('Round 30 runtime is wired into v23.3', () => {
  assert.equal(existsSync(runtimeUrl), true, 'Round 30 runtime module must exist');
  assert.match(indexSource, /import ['"]\.\/round30-feedback-fixes\.mjs['"]/);
});

test('Round 30 keeps Overall/All neutral while tournament scopes keep tournament themes', async () => {
  assert.equal(existsSync(runtimeUrl), true, 'Round 30 runtime module must exist');
  const { round30SurfaceTheme, ROUND30_CSS } = await import(runtimeUrl.href);
  assert.equal(round30SurfaceTheme('ranking', 'overall'), 'neutral');
  assert.equal(round30SurfaceTheme('predictions', 'all'), 'neutral');
  assert.equal(round30SurfaceTheme('ranking', 'serie_a'), 'serie-a');
  assert.equal(round30SurfaceTheme('ranking', 'coppa_italia'), 'coppa');
  assert.equal(round30SurfaceTheme('ranking', 'ucl'), 'champions');
  assert.equal(round30SurfaceTheme('ranking', 'uel'), 'europa');
  assert.equal(round30SurfaceTheme('ranking', 'uecl'), 'conference');
  assert.match(ROUND30_CSS, /data-cw233-round30-theme=['"]neutral['"]/);
  assert.match(ROUND30_CSS, /--r11soft/);
  assert.match(ROUND30_CSS, /\.cw233-ranking-row/);
  assert.match(ROUND30_CSS, /\.cw233-ranking-hero/);
});

test('prediction auth carries favorite clubs for the current user and ranking participants', async () => {
  const payload = {
    ok:true,
    user:{
      id:1,
      first_name:'Daniil',
      username:'danx95',
      favorite_team:{ id:10, name:'Милан', logo_url:'https://img.test/milan.png' },
    },
    standings:[
      {
        user:{
          id:2,
          first_name:'Georgio',
          username:'gg',
          favorite_team:{ id:20, name:'Интер', crestUrl:'https://img.test/inter.png' },
        },
      },
    ],
  };
  const request = {
    url:'https://test.local/api/predictions/rankings',
    headers:{ get(name){ return String(name).toLowerCase() === 'x-telegram-init-data' ? 'signed-init-data' : ''; } },
  };
  const env = { CIAO_WEB_API:{ async fetch(){ return jsonResponse(payload); } } };
  const auth = await resolveAuthenticatedUser({ request, env });

  assert.deepEqual(auth.favoriteTeam, {
    id:10,
    name:'Милан',
    crestUrl:'https://img.test/milan.png',
    customEmojiId:null,
  });
  const other = auth.participants.find(row => row.userId === 'telegram:2');
  assert.deepEqual(other?.favoriteTeam, {
    id:20,
    name:'Интер',
    crestUrl:'https://img.test/inter.png',
    customEmojiId:null,
  });
});

test('ranking service enriches returned ranking rows with favorite clubs without changing stored score rows', async () => {
  const authenticated = {
    userId:'telegram:1',
    displayName:'Daniil',
    username:'danx95',
    favoriteTeam:{ id:10, name:'Милан', crestUrl:'https://img.test/milan.png', customEmojiId:null },
    participants:[
      {
        userId:'telegram:2',
        displayName:'Georgio',
        username:'gg',
        favoriteTeam:{ id:20, name:'Интер', crestUrl:'https://img.test/inter.png', customEmojiId:null },
      },
    ],
  };
  const stub = {
    async fetch(request) {
      const path = new URL(request.url).pathname;
      if (path === '/participants') return jsonResponse({ ok:true, data:{ registered:true } });
      if (path === '/rankings') {
        return jsonResponse({ ok:true, data:{ ranking:[
          { user_id:'telegram:1', display_name:'Daniil', username:'danx95', points:2 },
          { user_id:'telegram:2', display_name:'Georgio', username:'gg', points:0 },
        ] } });
      }
      return jsonResponse({ ok:false }, 404);
    },
  };
  const env = {
    CIAO_ENV:'test',
    PREDICTION_SEASON:'2026-27',
    PREDICTION_LEAGUE:{ idFromName(){ return 'id'; }, get(){ return stub; } },
  };
  const service = createPredictionService({
    request:{},
    env,
    deps:{ resolveAuthenticatedUser:async () => authenticated },
    scheduleBackground(){},
  });
  const ranking = await service.rankings({ scope:'overall' });

  assert.deepEqual(ranking[0].favorite_team, authenticated.favoriteTeam);
  assert.deepEqual(ranking[1].favorite_team, authenticated.participants[0].favoriteTeam);
  assert.equal(ranking[0].is_current, true);
});

test('ranking UI renders favorite-club badges instead of name initials', () => {
  assert.match(rankingSource, /cw233-ranking-club-logo/);
  assert.match(rankingSource, /favorite_team|favoriteTeam/);
  assert.doesNotMatch(rankingSource, /cw233-ranking-avatar--hero[^`]*\$\{esc\(initials\(name\)\)\}/s);
  assert.doesNotMatch(rankingSource, /<div class="cw233-ranking-avatar">\$\{esc\(initials\(name\)\)\}<\/div>/);
});

test('legacy Match Center exclusively owns the viewport and centers its back arrow', () => {
  assert.match(legacyThemeSource, /match-center-open\s+#ciao-v232-matches-overlay/);
  assert.match(legacyThemeSource, /match-center-open\s+#ciao-v232-matches-overlay\s*\{[^}]*display:none!important/s);
  assert.match(legacyThemeSource, /\.mc-back\s*\{[^}]*align-items:center!important[^}]*justify-content:center!important[^}]*padding:0!important/s);
});

test('ranking place and points cells are centered', () => {
  assert.match(premiumSource, /\.cw233-ranking-stat\s*\{[^}]*align-items:center[^}]*justify-content:center[^}]*text-align:center/s);
});
