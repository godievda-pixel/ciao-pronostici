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
    const normalized = String(text || '')
      .replace(/\s+/g, ' ')
      .trim();

    const dotMatch = normalized.match(
      /Ближайший матч\s*[·:]?\s*([^·]+?)\s*·\s*(.+)$/i,
    );

    if (dotMatch) {
      return {
        label: 'Ближайший матч',
        match: dotMatch[1].trim(),
        time: dotMatch[2].trim(),
      };
    }

    return null;
  }

  function extractNearest(empty) {
    const children = [...empty.children].filter((node) => {
      if (!(node instanceof HTMLElement)) return false;
      return !node.matches(
        '.cw231-empty__title,.cw231-empty__next-card',
      );
    });

    for (const node of children) {
      const nearest = parseNearest(node.textContent);
      if (nearest) return { nearest, source: node };
    }

    const nearest = parseNearest(empty.textContent);
    return nearest ? { nearest, source: null } : null;
  }

  function enhanceEmpty(empty) {
    if (!empty) return;

    empty.querySelectorAll('.cw231-empty__icon,.cw231-empty__hint').forEach((node) => {
      node.remove();
    });

    let title = empty.querySelector('.cw231-empty__title');
    if (!title) {
      const oldTitle = empty.querySelector('b');
      if (oldTitle) {
        oldTitle.classList.add('cw231-empty__title');
        title = oldTitle;
      }
    }

    if (!title || empty.querySelector('.cw231-empty__next-card')) return;

    const found = extractNearest(empty);
    if (!found) return;

    const card = element('div', 'cw231-empty__next-card');
    card.appendChild(element('div', 'cw231-empty__next-label', found.nearest.label));
    card.appendChild(element('div', 'cw231-empty__match', found.nearest.match));
    if (found.nearest.time) {
      card.appendChild(element('div', 'cw231-empty__time', found.nearest.time));
    }

    if (found.source) found.source.replaceWith(card);
    else empty.appendChild(card);
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
