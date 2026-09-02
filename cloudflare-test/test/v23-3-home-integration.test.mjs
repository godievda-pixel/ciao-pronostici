import test from 'node:test';
import assert from 'node:assert/strict';

async function homeModule() {
  try {
    return await import('../src/v23.3/home-integration.mjs');
  } catch {
    return {};
  }
}

async function patchModule() {
  try {
    return await import('../scripts/home-v23-3-source-patch.mjs');
  } catch {
    return {};
  }
}

function match(competition, matchId, kickoffAt, home, away) {
  return {
    competition,
    matchId,
    kickoffAt,
    status: 'scheduled',
    predictionDeadline: new Date(Date.parse(kickoffAt) - 15 * 60 * 1000).toISOString(),
    homeTeam: { id: `${matchId}-h`, name: home, crestUrl: `https://img.test/${matchId}-h.png` },
    awayTeam: { id: `${matchId}-a`, name: away, crestUrl: `https://img.test/${matchId}-a.png` },
    homeScore: null,
    awayScore: null,
  };
}

test('v23.3 Home renderer interleaves all five competitions and exposes canonical card identity', async () => {
  const { renderHomeTodaySection } = await homeModule();
  assert.equal(typeof renderHomeTodaySection, 'function');

  const matches = [
    match('uecl', 'uecl:5', '2026-09-08T20:00:00Z', 'Фиорентина', 'Ренн'),
    match('serie_a', 'serie_a:1', '2026-09-08T16:00:00Z', 'Интер', 'Ювентус'),
    match('ucl', 'ucl:3', '2026-09-08T18:00:00Z', 'Реал Мадрид', 'Милан'),
    match('coppa_italia', 'coppa_italia:2', '2026-09-08T17:00:00Z', 'Рома', 'Пиза'),
    match('uel', 'uel:4', '2026-09-08T19:00:00Z', 'Болонья', 'Арсенал'),
  ];

  const html = renderHomeTodaySection(matches, {
    now: new Date('2026-09-08T12:00:00Z'),
    timeZone: 'UTC',
  });

  for (const label of ['Серия А', 'Кубок Италии', 'Лига Чемпионов', 'Лига Европы', 'Лига Конференций']) {
    assert.match(html, new RegExp(label));
  }
  assert.match(html, /data-cw233-competition="ucl"/);
  assert.match(html, /data-cw233-match="ucl:3"/);
  assert.ok(html.indexOf('Интер') < html.indexOf('Рома'));
  assert.ok(html.indexOf('Рома') < html.indexOf('Реал Мадрид'));
  assert.ok(html.indexOf('Реал Мадрид') < html.indexOf('Болонья'));
});

test('v23.3 Home runtime preserves successful cached feeds when one competition refresh fails', async () => {
  const { createHomeRuntime } = await homeModule();
  assert.equal(typeof createHomeRuntime, 'function');

  let phase = 1;
  const runtime = createHomeRuntime({
    now: () => new Date('2026-09-08T12:00:00Z'),
    loadMatches: async competition => {
      if (phase === 2 && competition === 'ucl') throw new Error('ucl temporary failure');
      return {
        competition,
        matches: [match(
          competition,
          `${competition}:${phase}`,
          `2026-09-08T${String(15 + ['serie_a','coppa_italia','ucl','uel','uecl'].indexOf(competition)).padStart(2, '0')}:00:00Z`,
          `${competition}-home-${phase}`,
          `${competition}-away-${phase}`,
        )],
      };
    },
  });

  await runtime.ensure({ force: true });
  assert.equal(runtime.state().matches.some(item => item.matchId === 'ucl:1'), true);

  phase = 2;
  await runtime.ensure({ force: true });
  const state = runtime.state();
  assert.equal(state.matches.some(item => item.matchId === 'ucl:1'), true);
  assert.equal(state.matches.some(item => item.matchId === 'uel:2'), true);
  assert.equal(Boolean(state.errors.ucl), true);
});

test('Home source patch removes reset notice and installs one non-blocking v23.3 Home wrapper', async () => {
  const { applyHomeV233SourcePatch } = await patchModule();
  assert.equal(typeof applyHomeV233SourcePatch, 'function');

  const source = `
    <div>Начало нового сезона! Счёт обнулен, все начинают с нуля. Удачи!</div>
    <script>
      function __cw231HomeHtml(){ return '<div><section class="cw231-today"><div>legacy</div></section></div>'; }
      predict = __cw231HomeHtml;
    </script>
  `;

  const first = applyHomeV233SourcePatch(source);
  const second = applyHomeV233SourcePatch(first);

  assert.equal(second, first);
  assert.doesNotMatch(first, /Начало нового сезона! Счёт обнулен, все начинают с нуля\. Удачи!/);
  assert.equal((first.match(/cw233-home-multicompetition/g) || []).length, 1);
  assert.match(first, /CiaoV233Home\?\.ensure\?\.\(\)/);
  assert.match(first, /CiaoV233Home\?\.html\?\.\(\)/);
  assert.match(first, /ciao-v233-home-ready/);
  assert.match(first, /const base = __cw233LegacyHomeHtml\(\);/);
});
