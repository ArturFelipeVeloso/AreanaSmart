/* =========================================================
   Desenho da árvore mata-mata (estilo Copa do Mundo:
   duas metades convergindo para a final no centro)
   ========================================================= */
(function () {
  const E = window.Engine;
  const esc = E.esc;

  function playerRow(m, pid, side, ctx, opts) {
    const p = pid ? ctx.byId[pid] : null;
    if (!p) {
      const label = m.bye ? (m.key === 'third' ? 'Sem adversário · 3º direto' : 'Classificado direto') : (pid ? 'Removido' : 'A definir');
      return `<div class="pr empty${m.bye ? ' bye-note' : ''}"><span class="pr-bar"></span><span class="pr-name">${label}</span></div>`;
    }
    const t = ctx.teamById[p.team_id] || { name: '—', color: '#64748b' };
    let cls = 'pr';
    if (m.decided && !m.bye) cls += m.winner === pid ? ' win' : ' lose';
    if (m.bye) cls += ' win';
    const click = opts.editable && m.a && m.b ? ` data-pick="${m.key}" data-pid="${pid}" role="button" tabindex="0"` : '';
    return `<div class="${cls}${click ? ' clickable' : ''}" style="--tc:${esc(t.color)}"${click}>
      <span class="pr-bar"></span>
      <span class="pr-name">${esc(p.name)}</span>
      <span class="pr-team">${esc(t.name)}</span>
      ${m.decided && m.winner === pid && !m.bye ? '<span class="pr-check">✓</span>' : ''}
    </div>`;
  }

  function matchCard(m, ctx, opts, extra = '') {
    const isNext = ctx.next && ctx.next.key === m.key;
    return `<div class="match${m.decided ? ' decided' : ''}${m.bye ? ' is-bye' : ''}${isNext ? ' is-next' : ''} ${extra}">
      ${playerRow(m, m.a, 'a', ctx, opts)}
      ${playerRow(m, m.b, 'b', ctx, opts)}
    </div>`;
  }

  function roundCol(d, r, side, list, ctx, opts) {
    const lastSide = r === d.R - 2;
    const slots = list.map((m, i) => {
      const cls = ['slot'];
      if (r > 0) cls.push('in');
      cls.push(lastSide ? 'out-straight' : i % 2 === 0 ? 'out-top' : 'out-bottom');
      return `<div class="${cls.join(' ')}">${matchCard(m, ctx, opts)}</div>`;
    }).join('');
    return `<div class="round"><div class="round-title">${E.roundName(d.R, r)}</div><div class="round-body">${slots}</div></div>`;
  }

  function render(el, d, ctx, opts = {}) {
    if (!d) { el.innerHTML = ''; return; }
    ctx.next = d.next;
    let left = '', right = '';
    for (let r = 0; r < d.R - 1; r++) {
      const ms = d.rounds[r];
      const half = ms.length / 2;
      left += roundCol(d, r, 'left', ms.slice(0, half), ctx, opts);
      right = roundCol(d, r, 'right', ms.slice(half), ctx, opts) + right;
    }
    const champ = d.placements.first ? ctx.byId[d.placements.first] : null;
    const champTeam = champ ? ctx.teamById[champ.team_id] : null;
    const center = `
      <div class="round center${d.R > 1 ? ' has-sides' : ''}">
        <div class="round-title gold">Final</div>
        <div class="round-body">
          <div class="final-wrap">
            <div class="trophy${champ ? ' won' : ''}">
              <svg viewBox="0 0 64 64" aria-hidden="true"><path d="M18 6h28v6h10v6c0 8-6 14-13 15-2 5-6 8-9 9v8h8v6H22v-6h8v-8c-3-1-7-4-9-9-7-1-13-7-13-15v-6h10V6zm-6 12v0c0 5 3 8 6 9V18h-6zm40 0h-6v9c3-1 6-4 6-9z" fill="currentColor"/></svg>
              ${champ ? `<div class="champ-name" style="--tc:${esc(champTeam ? champTeam.color : '#fbbf24')}">${esc(champ.name)}</div>` : ''}
            </div>
            <div class="slot fin">${matchCard(d.final, ctx, opts, 'final-match')}</div>
            ${d.third ? `<div class="third-wrap"><div class="round-title small">Disputa de 3º lugar</div>${matchCard(d.third, ctx, opts, 'third-match')}</div>` : ''}
          </div>
        </div>
      </div>`;
    el.innerHTML = `<div class="bracket R${d.R}"><div class="side left">${left}</div>${center}<div class="side right">${right}</div></div>`;

    if (opts.editable && opts.onPick) {
      el.querySelectorAll('[data-pick]').forEach((n) => {
        const go = () => opts.onPick(n.dataset.pick, n.dataset.pid);
        n.addEventListener('click', go);
        n.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
      });
    }
  }

  window.BracketView = { render };
})();
