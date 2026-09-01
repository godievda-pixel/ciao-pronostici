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

  function parseNearest(text) {
    const parts = String(text || '')
      .split('·')
      .map((part) => part.trim())
      .filter(Boolean);

    if (parts.length < 2) return null;

    const label = /^Ближайший матч$/i.test(parts[0]) ? parts.shift() : 'Ближайший матч';
    const match = parts.shift() || '';
    const time = parts.join(' · ');

    return { label, match, time };
  }

  function enhanceEmpty(empty) {
    if (!empty) return;

    let title = empty.querySelector('.cw231-empty__title');
    if (!title) {
      const oldTitle = empty.querySelector('b');
      if (oldTitle) {
        oldTitle.classList.add('cw231-empty__title');
        title = oldTitle;
      }
    }

    if (title && !empty.querySelector('.cw231-empty__icon')) {
      title.before(element('div', 'cw231-empty__icon', '⚽'));
    }

    if (title && !empty.querySelector('.cw231-empty__hint')) {
      title.after(element('div', 'cw231-empty__hint', 'Следующий матч уже на горизонте'));
    }

    if (empty.querySelector('.cw231-empty__next-card')) return;

    const candidates = [...empty.children].filter((node) => {
      if (!(node instanceof HTMLElement)) return false;
      if (node.matches('.cw231-empty__icon,.cw231-empty__title,.cw231-empty__hint')) return false;
      return /Ближайший матч/i.test(node.textContent || '');
    });

    const current = candidates[0];
    if (!current) return;

    const nearest = parseNearest(current.textContent);
    if (!nearest) return;

    const card = element('div', 'cw231-empty__next-card');
    card.appendChild(element('div', 'cw231-empty__next-label', nearest.label));
    card.appendChild(element('div', 'cw231-empty__match', nearest.match));
    if (nearest.time) card.appendChild(element('div', 'cw231-empty__time', nearest.time));

    current.replaceWith(card);
  }

  function polish() {
    document.querySelectorAll('.cw231-today-head').forEach(enhanceHeader);
    document.querySelectorAll('.cw231-empty').forEach(enhanceEmpty);
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
