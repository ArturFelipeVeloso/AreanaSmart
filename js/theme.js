/* Tema claro/escuro: aplica antes de desenhar a página e salva a escolha no navegador */
(function () {
  const KEY = 'arena_theme';
  const root = document.documentElement;
  let saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) {}
  root.dataset.theme = saved === 'light' ? 'light' : 'dark';

  function paint() {
    const light = root.dataset.theme === 'light';
    document.querySelectorAll('[data-theme-toggle]').forEach((b) => {
      b.textContent = light ? '🌙' : '☀️';
      b.title = light ? 'Mudar para tema escuro' : 'Mudar para tema claro';
      b.setAttribute('aria-label', b.title);
    });
  }
  window.toggleTheme = function () {
    root.dataset.theme = root.dataset.theme === 'light' ? 'dark' : 'light';
    try { localStorage.setItem(KEY, root.dataset.theme); } catch (e) {}
    paint();
  };
  // mantém outras abas (ex.: telão e admin abertos juntos) sincronizadas
  window.addEventListener('storage', (e) => { if (e.key === KEY) { root.dataset.theme = e.newValue === 'light' ? 'light' : 'dark'; paint(); } });
  document.addEventListener('DOMContentLoaded', () => {
    paint();
    document.querySelectorAll('[data-theme-toggle]').forEach((b) => b.addEventListener('click', window.toggleTheme));
  });
})();
