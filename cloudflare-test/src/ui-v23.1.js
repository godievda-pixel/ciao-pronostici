(() => {
  const OLD_TITLE = 'Сегодня в мире кальчо';
  const NEW_TITLE = 'Кальчо сегодня';

  function polish() {
    document.querySelectorAll('.cw231-today-head h2').forEach((node) => {
      if (node.textContent.trim() === OLD_TITLE) node.textContent = NEW_TITLE;
    });
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
