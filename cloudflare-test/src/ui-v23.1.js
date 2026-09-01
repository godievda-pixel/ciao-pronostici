(() => {
  const OLD_TITLE = 'Сегодня в мире кальчо';
  const NEW_TITLE = 'Кальчо сегодня';
  const SUBTITLE = 'Матчи и события дня';

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function enhanceHeader(head) {
    if (!head) return;

    const title = head.querySelector('h2');
    if (!title) return;

    if (title.textContent.trim() === OLD_TITLE) title.textContent = NEW_TITLE;

    if (!title.closest('.cw231-today-heading')) {
      const heading = element('div', 'cw231-today-heading');
      title.before(heading);
      heading.appendChild(title);
      heading.appendChild(element('p', 'cw231-today-subtitle', SUBTITLE));
    } else if (!head.querySelector('.cw231-today-subtitle')) {
      title.closest('.cw231-today-heading')?.appendChild(
        element('p', 'cw231-today-subtitle', SUBTITLE),
      );
    }

    const panel = head.parentElement;
    if (!panel) return;

    panel.classList.add('cw231-today-premium');

    if (!panel.querySelector(':scope > .cw231-today-glow')) {
      panel.prepend(element('div', 'cw231-today-glow'));
    }
  }

  function enhanceFavoriteMatchCard() {
    document.querySelectorAll('.cw211-favorite-body .cw211-info-card').forEach((card) => {
      const trigger = card.querySelector('.cw211-match-btn[data-cw211-match]');
      const matchId = trigger?.dataset?.cw211Match;
      if (!matchId) return;

      card.classList.add('cw231-favorite-match-card');
      card.dataset.cw211Match = matchId;
      card.setAttribute('role', 'button');
      card.setAttribute('aria-label', 'Открыть ближайший матч любимого клуба');
      card.tabIndex = 0;

      if (card.dataset.cw231KeyBound === '1') return;
      card.dataset.cw231KeyBound = '1';
      card.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        card.click();
      });
    });
  }

  function polish() {
    document.querySelectorAll('.cw231-today-head').forEach(enhanceHeader);
    enhanceFavoriteMatchCard();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', polish, { once: true });
  } else {
    polish();
  }

  new MutationObserver(polish).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
})();
