import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolveAuthenticatedUser } from '../src/v23.3/prediction-auth.mjs';
import { renderTablesHub } from '../src/v23.3/tables-ui.mjs';

function request() {
  return new Request('https://ciao-web-app-test.ciao-web.workers.dev/api/v23.3/rankings/me', {
    headers: { 'x-telegram-init-data':'signed-telegram-data' },
  });
}

test('prediction auth resolves the real Telegram account from nested legacy state payload', async () => {
  const env = {
    CIAO_WEB_API: {
      async fetch() {
        return Response.json({
          ok:true,
          data:{
            user:{ id:4242, first_name:'Даниил', last_name:'', username:'danya' },
          },
        });
      },
    },
  };
  const user = await resolveAuthenticatedUser({ request:request(), env });
  assert.deepEqual(user, {
    userId:'telegram:4242',
    displayName:'Даниил',
    username:'danya',
  });
});

test('prediction UI falls back to Telegram account name before generic participant copy', async () => {
  const source = await readFile(new URL('../src/v23.3/predictions-ui.mjs', import.meta.url), 'utf8');
  assert.match(source, /initDataUnsafe\?\.user/);
  assert.match(source, /resolvePredictionDisplayName/);
});

test('Durable Object uses Cloudflare SQLite transactionSync instead of SQL transaction statements', async () => {
  const source = await readFile(new URL('../src/v23.3/prediction-league-do.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /BEGIN IMMEDIATE|\bCOMMIT\b|\bROLLBACK\b/);
  assert.match(source, /storage\.transactionSync/);
});

test('home Today cards have a dedicated premium layout that keeps metadata and teams separated', async () => {
  const source = await readFile(new URL('../src/v23.3/premium-polish-ui.mjs', import.meta.url), 'utf8');
  assert.match(source, /\.cw231-today-card-top\{display:grid/);
  assert.match(source, /\.cw231-today-match\{display:grid/);
  assert.match(source, /grid-template-columns:minmax\(0,1fr\) auto/);
});

test('Serie A Matches keeps the proven legacy calendar path', async () => {
  const source = await readFile(new URL('../src/v23.2/matches-ui.mjs', import.meta.url), 'utf8');
  assert.match(source, /if \(competition === 'serie_a'\) \{\s*close\(\);\s*return 'legacy';/);
});

test('Serie A table marks Europe and relegation zones and explains them', () => {
  const row = position => ({
    position,
    team:{ id:String(position), name:`Команда ${position}`, crestUrl:'' },
    played:2,
    wins:2,
    draws:0,
    losses:0,
    goalDifference:4,
    points:6,
  });
  const html = renderTablesHub({
    selectedCompetition:'serie_a',
    data:{ rows:[row(1), row(5), row(6), row(18), row(19), row(20)] },
  });
  assert.match(html, /cw233-zone--ucl/);
  assert.match(html, /cw233-zone--uel/);
  assert.match(html, /cw233-zone--uecl/);
  assert.match(html, /cw233-zone--relegation/);
  assert.match(html, /Лига чемпионов/);
  assert.match(html, /Лига Европы/);
  assert.match(html, /Лига конференций/);
  assert.match(html, /Вылет в Серию B/);
});

test('table polish never guesses a crest from an unrelated numeric team id', async () => {
  const source = await readFile(new URL('../src/v23.3/premium-polish-ui.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /sports\.bzzoiro\.com\/img\/team\/\$\{encodeURIComponent\(teamId\)\}/);
});
