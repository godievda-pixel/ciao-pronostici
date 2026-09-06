import { escapeHtml } from './html.mjs';

const ITEMS = Object.freeze([
  Object.freeze({ section:'home', label:'Главная', icon:'⌂' }),
  Object.freeze({ section:'predictions', label:'Прогнозы', icon:'✎' }),
  Object.freeze({ section:'ranking', label:'Рейтинг', icon:'☆' }),
  Object.freeze({ section:'matches', label:'Матчи', icon:'◉' }),
  Object.freeze({ section:'tables', label:'Таблицы', icon:'▦' }),
]);

export function renderBottomNav(active = 'home') {
  const activeSection = ITEMS.some(item => item.section === active) ? active : 'home';
  const items = ITEMS.map(item => {
    const selected = item.section === activeSection;
    return `<button class="bottom-nav__item${selected ? ' is-active' : ''}" type="button" data-nav-item="true" data-section="${escapeHtml(item.section)}"${selected ? ' aria-current="page"' : ''}><span class="bottom-nav__icon" aria-hidden="true">${escapeHtml(item.icon)}</span><span class="bottom-nav__label">${escapeHtml(item.label)}</span></button>`;
  }).join('');
  return `<nav class="bottom-nav" data-component="bottom-nav" aria-label="Основная навигация">${items}</nav>`;
}

export const BOTTOM_NAV_ITEMS = ITEMS;
