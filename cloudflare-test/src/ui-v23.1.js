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

  function polish() {
    document.querySelectorAll('.cw231-today-head').forEach(enhanceHeader);
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
