const root = document.getElementById('app');

if (!root) throw new Error('v23_app_root_missing');

root.innerHTML = `
  <main class="app-shell" aria-live="polite">
    <section class="boot-card">
      <p class="eyebrow">Ciao, Web!</p>
      <h1>Загрузка приложения</h1>
      <p class="muted">Подготавливаем новую версию.</p>
    </section>
  </main>
`;
