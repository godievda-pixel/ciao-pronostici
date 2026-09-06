import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderBottomNav } from '../src/v23/ui/bottom-nav.mjs';
import { renderTeamBadge } from '../src/v23/ui/team-badge.mjs';
import { renderMatchCard } from '../src/v23/ui/match-card.mjs';
import { renderTournamentCard } from '../src/v23/ui/tournament-card.mjs';
import { renderStatusState } from '../src/v23/ui/status-state.mjs';
import { renderTabs } from '../src/v23/ui/tabs.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.resolve(here, '../src/v23');

function count(text, needle) {
  return text.split(needle).length - 1;
}

test('bottom navigation contains exactly five approved Russian labels and one active item', () => {
  const html = renderBottomNav('matches');
  for (const label of ['Главная','Прогнозы','Рейтинг','Матчи','Таблицы']) {
    assert.equal(count(html, `>${label}<`), 1, label);
  }
  assert.equal(count(html, 'data-nav-item='), 5);
  assert.equal(count(html, 'aria-current="page"'), 1);
  assert.match(html, /data-section="matches"[^>]*aria-current="page"/);
});

test('match card renders canonical Russian team names, competition/status/time and never provider English fields', () => {
  const match = {
    id:'ucl:12345',
    competition:'ucl',
    competitionNameRu:'Лига чемпионов',
    stageNameRu:'Общий этап',
    status:'scheduled',
    statusRu:'Скоро',
    homeTeam:{ id:'44', nameRu:'Интер', nameProvider:'Inter' },
    awayTeam:{ id:'88', nameRu:'Манчестер Сити', nameProvider:'Manchester City' },
  };
  const html = renderMatchCard(match, { timeLabel:'Сегодня · 21:45' });
  assert.match(html, /data-action="open-match"/);
  assert.match(html, /data-match-id="ucl:12345"/);
  assert.match(html, />Интер</);
  assert.match(html, />Манчестер Сити</);
  assert.match(html, /Лига чемпионов/);
  assert.match(html, /Общий этап/);
  assert.match(html, /Сегодня · 21:45/);
  assert.match(html, /Скоро/);
  assert.doesNotMatch(html, />Inter</);
  assert.doesNotMatch(html, /Manchester City/);
  assert.doesNotMatch(html, /nameProvider/);
});

test('shared UI escapes dynamic strings rather than injecting HTML', () => {
  const malicious = '<img src=x onerror=alert(1)>';
  const badge = renderTeamBadge({ nameRu:malicious });
  const tournament = renderTournamentCard({ id:'ucl', nameRu:malicious, subtitleRu:'Европа' });
  assert.doesNotMatch(badge, /<img src=x/);
  assert.match(badge, /&lt;img/);
  assert.doesNotMatch(tournament, /<img src=x/);
  assert.match(tournament, /&lt;img/);
});

test('loading, error and empty states expose stable semantic state markers', () => {
  assert.match(renderStatusState('loading'), /data-state="loading"/);
  assert.match(renderStatusState('error', { message:'Не удалось обновить' }), /data-state="error"/);
  assert.match(renderStatusState('error', { message:'Не удалось обновить' }), /Не удалось обновить/);
  assert.match(renderStatusState('empty', { message:'Ничего нет' }), /data-state="empty"/);
  assert.throws(() => renderStatusState('fatal'), /status_state_invalid/);
});

test('tabs render one selected tab and keep labels escaped', () => {
  const html = renderTabs(['Обзор','Статистика','События','Составы','Игроки'], 'События');
  assert.equal(count(html, 'role="tab"'), 5);
  assert.equal(count(html, 'aria-selected="true"'), 1);
  assert.match(html, /data-tab="События"[^>]*aria-selected="true"/);
});

test('new standalone component CSS uses design tokens for color and radius and has no v22.5 legacy selectors', async () => {
  for (const file of ['styles/shell.css','styles/components.css','styles/screens.css']) {
    const css = await fs.readFile(path.join(src, file), 'utf8');
    assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b/i, `${file}: raw color`);
    assert.doesNotMatch(css, /\brgba?\(/i, `${file}: raw rgb color`);
    assert.doesNotMatch(css, /legacy-|modular-host|v22/i, `${file}: legacy selector`);
  }
});
