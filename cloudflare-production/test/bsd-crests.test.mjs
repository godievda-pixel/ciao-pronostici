import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {
  BSD_TEAM_ID_BY_LOCAL_ID,
  bsdTeamIdFor,
  bsdCrestUrlFor,
  injectBsdCrestPatch,
  runtimePatchSource,
  BSD_CREST_PATCH_MARKER,
} from '../scripts/bsd-crests.mjs';

test('maps the legacy local Serie A team ids to BSD ids', () => {
  assert.deepEqual(BSD_TEAM_ID_BY_LOCAL_ID, {
    1: 71, 2: 66, 3: 67, 4: 69, 5: 68,
    6: 1277, 7: 59, 8: 77, 9: 73, 10: 70,
    11: 60, 12: 63, 13: 1286, 14: 62, 15: 74,
    16: 65, 17: 61, 18: 78, 19: 75, 20: 1285,
  });
  assert.equal(bsdTeamIdFor({ id: 8, name: 'Интер' }), 77);
  assert.equal(bsdTeamIdFor({ id: 12, name: 'Милан' }), 63);
  assert.equal(bsdTeamIdFor({ name: 'Наполи' }), 62);
  assert.equal(bsdTeamIdFor({ id: 8, bsd_team_id: 999 }), 999);
});

test('builds club crest urls only from BSD', () => {
  assert.equal(
    bsdCrestUrlFor({ id: 8, name: 'Интер' }),
    'https://sports.bzzoiro.com/img/team/77/?bg=transparent',
  );
  assert.equal(
    bsdCrestUrlFor({ crestUrl: 'https://sports.bzzoiro.com/img/team/63/?bg=transparent' }),
    'https://sports.bzzoiro.com/img/team/63/?bg=transparent',
  );
  assert.equal(bsdCrestUrlFor({ id: 9999, name: 'Неизвестный клуб' }), '');
});

test('runtime patch replaces legacy emoji image markup before it reaches the DOM', () => {
  const legacy = id => `<img class="logo" src="https://legacy.invalid/?asset=emoji&id=${id}" alt="">`;
  const context = {
    S: {
      round: { matches: [{ home: { id: 8, name: 'Интер' }, away: { id: 12, name: 'Милан' } }] },
      serie_a_table: { rows: [{ team_id: 14, team_name: 'Наполи' }] },
    },
    predict: () => `<section>${legacy('a')}${legacy('b')}</section>`,
    mine: () => `<section>${legacy('a')}${legacy('b')}</section>`,
    __cw9CalendarCard: () => `<article>${legacy('a')}${legacy('b')}</article>`,
    serieA: () => `<div>${legacy('a')}</div>`,
    matchCenterHtml: () => `<main>${legacy('a')}${legacy('b')}</main>`,
    __cw18Logo: () => legacy('old'),
    __cw2154EmojiAssetUrl: () => 'https://legacy.invalid/?asset=emoji&id=old',
    __cw2154RepairClubAssets: () => 1,
  };
  vm.runInNewContext(runtimePatchSource(), context);

  const predicted = context.predict();
  assert.match(predicted, /sports\.bzzoiro\.com\/img\/team\/77\//);
  assert.match(predicted, /sports\.bzzoiro\.com\/img\/team\/63\//);
  assert.doesNotMatch(predicted, /asset=emoji/);

  const table = context.serieA();
  assert.match(table, /sports\.bzzoiro\.com\/img\/team\/62\//);
  assert.doesNotMatch(table, /asset=emoji/);

  const favorite = context.__cw18Logo({ id: 9, name: 'Ювентус' }, 'cw18-fav-logo-big');
  assert.match(favorite, /sports\.bzzoiro\.com\/img\/team\/73\//);
  assert.doesNotMatch(favorite, /asset=emoji/);

  assert.equal(context.__cw2154EmojiAssetUrl('123'), '');
  assert.equal(context.__cw2154RepairClubAssets(), 0);
});

test('runtime patch contains no Telegram emoji asset dependency', () => {
  const source = runtimePatchSource();
  assert.match(source, new RegExp(BSD_CREST_PATCH_MARKER));
  assert.match(source, /sports\.bzzoiro\.com\/img\/team/);
  assert.doesNotMatch(source, /custom_emoji_id/);
  assert.doesNotMatch(source, /asset=emoji/);
  assert.doesNotMatch(source, /compat-v22-5-emoji/);
  assert.doesNotMatch(source, /ciao-miniapp-api/);
});

test('injects BSD crest runtime once inside the final v22.5 IIFE', () => {
  const release = '<html><script>\n(function(){\n  const app=true;\n  /* ===== /Ciao, Web! v22.5 product polish layer ===== */\n\n})();\n</script></html>';
  const once = injectBsdCrestPatch(release);
  const twice = injectBsdCrestPatch(once);
  assert.match(once, new RegExp(BSD_CREST_PATCH_MARKER));
  assert.equal(once, twice);
  assert.ok(once.indexOf(BSD_CREST_PATCH_MARKER) < once.indexOf('/* ===== /Ciao, Web! v22.5 product polish layer ===== */'));
});
