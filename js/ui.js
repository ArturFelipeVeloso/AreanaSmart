/* Utilidades de interface compartilhadas */
(function () {
  const UI = {};

  UI.LOGO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4h12v4a6 6 0 0 1-12 0V4z"/><path d="M6 6H3v1a4 4 0 0 0 4 4M18 6h3v1a4 4 0 0 1-4 4"/><path d="M12 14v4M8 21h8M9 18h6"/></svg>';
  UI.CUP = '<svg viewBox="0 0 64 64"><path d="M18 6h28v6h10v6c0 8-6 14-13 15-2 5-6 8-9 9v8h8v6H22v-6h8v-8c-3-1-7-4-9-9-7-1-13-7-13-15v-6h10V6zm-6 12c0 5 3 8 6 9V18h-6zm40 0h-6v9c3-1 6-4 6-9z" fill="currentColor"/></svg>';

  UI.toast = (msg, type = '') => {
    let box = document.querySelector('.toast-box');
    if (!box) { box = document.createElement('div'); box.className = 'toast-box'; document.body.appendChild(box); }
    const t = document.createElement('div');
    t.className = 'toast ' + type; t.textContent = msg; box.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; setTimeout(() => t.remove(), 300); }, type === 'err' ? 5000 : 2600);
  };

  UI.confirm = (title, text, okLabel = 'Confirmar', danger = false) => new Promise((resolve) => {
    const bg = document.createElement('div');
    bg.className = 'modal-bg';
    bg.innerHTML = `<div class="modal card"><h3>${Engine.esc(title)}</h3><p>${Engine.esc(text)}</p>
      <div class="actions"><button class="btn ghost" data-a="0">Cancelar</button><button class="btn ${danger ? 'danger' : 'primary'}" data-a="1">${Engine.esc(okLabel)}</button></div></div>`;
    document.body.appendChild(bg);
    const done = (v) => { bg.remove(); resolve(v); };
    bg.addEventListener('click', (e) => { if (e.target === bg) done(false); const a = e.target.closest('[data-a]'); if (a) done(a.dataset.a === '1'); });
    bg.querySelector('[data-a="1"]').focus();
  });

  UI.ctx = (data) => ({
    byId: Object.fromEntries(data.competitors.map((c) => [c.id, c])),
    teamById: Object.fromEntries(data.teams.map((t) => [t.id, t])),
  });

  window.UI = UI;
})();
