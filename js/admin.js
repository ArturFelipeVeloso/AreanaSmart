/* Painel administrativo */
(function () {
  const $ = (id) => document.getElementById(id);
  const esc = Engine.esc;
  const PALETTE = ['#ef4444', '#f97316', '#f59e0b', '#eab308', '#22c55e', '#10b981', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef', '#ec4899', '#f8fafc', '#64748b'];
  const isLocal = Store.mode === 'local';

  let compId = localStorage.getItem('arena_admin_comp') || null;
  let data = null;
  let tab = 'comp';

  document.querySelectorAll('[data-logo]').forEach((n) => { n.innerHTML = UI.LOGO; });

  const run = async (fn, okMsg) => {
    try { const r = await fn(); if (okMsg) UI.toast(okMsg, 'ok'); return r; }
    catch (e) { console.error(e); UI.toast(e.message || String(e), 'err'); return undefined; }
  };

  /* ================= LOGIN ================= */
  async function initAuth() {
    if (await Store.isLoggedIn()) return showApp();
    $('loginView').hidden = false;
    $('appView').hidden = true;
    if (!isLocal) { $('lUserLbl').textContent = 'E-mail'; $('lUser').type = 'email'; }
    $('loginForm').onsubmit = async (e) => {
      e.preventDefault();
      if (await run(() => Store.login($('lUser').value, $('lPass').value).then(() => true))) showApp();
    };
    $('lUser').focus();
  }

  $('logoutBtn').onclick = async () => { await Store.logout(); location.reload(); };

  /* ================= APP ================= */
  async function showApp() {
    $('loginView').hidden = true;
    $('appView').hidden = false;
    $('modeBadge').textContent = isLocal ? 'MODO LOCAL · dados neste navegador' : 'ONLINE · Supabase';
    $('modeBadge').className = 'badge' + (isLocal ? '' : ' on');
    if (!isLocal) { $('oldPwWrap').hidden = true; $('importLbl').hidden = true; $('pwHint').textContent = 'Nova senha do seu usuário no Supabase.'; }
    buildSwatches();
    await reload();
  }

  async function reload() {
    const list = await run(() => Store.listCompetitions()) || [];
    if (!compId || !list.some((c) => c.id === compId)) compId = list[0] ? list[0].id : null;
    if (compId) localStorage.setItem('arena_admin_comp', compId);
    $('compSelect').hidden = !list.length;
    $('compSelect').innerHTML = list.map((c) => `<option value="${c.id}"${c.id === compId ? ' selected' : ''}>${esc(c.name)}</option>`).join('');
    $('firstComp').hidden = !!compId;
    $('compArea').hidden = !compId;
    $('openScreen').href = 'index.html' + (compId ? '?c=' + compId : '');
    if (!compId) { data = null; return; }
    data = await run(() => Store.loadCompetition(compId));
    if (data) renderAll();
  }

  $('compSelect').onchange = (e) => { compId = e.target.value; reload(); };

  async function createComp(name) {
    const c = await run(() => Store.saveCompetition({ name }), 'Competição criada!');
    if (c) { compId = c.id; setTab('teams'); await reload(); }
  }
  $('firstCompForm').onsubmit = (e) => { e.preventDefault(); createComp(e.target.name.value.trim()); e.target.reset(); };
  $('newCompBtn').onclick = () => {
    const bg = document.createElement('div');
    bg.className = 'modal-bg';
    bg.innerHTML = `<form class="modal card"><h3>Nova competição</h3><p>Times, competidores e chaveamento ficam separados por competição.</p>
      <div class="field" style="margin-bottom:16px"><label>Nome</label><input class="input" name="n" required placeholder="Ex.: Copa de Robótica 2027"></div>
      <div class="actions"><button type="button" class="btn ghost" data-x>Cancelar</button><button class="btn primary">Criar</button></div></form>`;
    document.body.appendChild(bg);
    const f = bg.querySelector('form');
    f.n.focus();
    bg.addEventListener('click', (e) => { if (e.target === bg || e.target.closest('[data-x]')) bg.remove(); });
    f.onsubmit = (e) => { e.preventDefault(); const n = f.n.value.trim(); bg.remove(); createComp(n); };
  };

  /* ================= TABS ================= */
  function setTab(t) {
    tab = t;
    document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === t));
    document.querySelectorAll('.pane').forEach((p) => p.classList.toggle('active', p.dataset.pane === t));
  }
  document.querySelectorAll('.tab').forEach((b) => { b.onclick = () => setTab(b.dataset.tab); });

  function renderAll() {
    $('cTeams').textContent = data.teams.length;
    $('cPlayers').textContent = data.competitors.length;
    renderCompForm();
    renderTeams();
    renderPlayers();
    renderBracket();
  }

  /* ================= COMPETIÇÃO ================= */
  function renderCompForm() {
    const f = $('compForm'), c = data.competition;
    ['name', 'description', 'points_win', 'bonus_first', 'bonus_second', 'bonus_third'].forEach((k) => { f[k].value = c[k] == null ? '' : c[k]; });
    f.avoid_same_team.checked = c.avoid_same_team !== false;
  }
  $('compForm').onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target;
    const num = (k) => Math.max(0, parseInt(f[k].value, 10) || 0);
    const ok = await run(() => Store.saveCompetition({
      id: compId, name: f.name.value.trim(), description: f.description.value.trim(),
      points_win: num('points_win'), bonus_first: num('bonus_first'), bonus_second: num('bonus_second'), bonus_third: num('bonus_third'),
      avoid_same_team: f.avoid_same_team.checked,
    }), 'Competição salva!');
    if (ok) reload();
  };
  $('delCompBtn').onclick = async () => {
    if (!(await UI.confirm('Excluir competição?', `"${data.competition.name}" será apagada com todos os times, competidores e resultados. Não dá para desfazer.`, 'Excluir', true))) return;
    if ((await run(() => Store.deleteCompetition(compId).then(() => true), 'Competição excluída.'))) { compId = null; localStorage.removeItem('arena_admin_comp'); setTab('comp'); reload(); }
  };

  /* ================= TIMES ================= */
  function buildSwatches() {
    const f = $('teamForm');
    $('swatches').innerHTML = PALETTE.map((c) => `<button type="button" class="swatch" style="background:${c}" data-c="${c}" title="${c}"></button>`).join('');
    $('swatches').onclick = (e) => { const s = e.target.closest('[data-c]'); if (s) { f.color.value = s.dataset.c; markSwatch(); } };
    f.color.oninput = markSwatch;
  }
  function markSwatch() {
    const v = $('teamForm').color.value.toLowerCase();
    document.querySelectorAll('.swatch').forEach((s) => s.classList.toggle('sel', s.dataset.c === v));
  }
  function nextColor() {
    const used = new Set(data.teams.map((t) => t.color.toLowerCase()));
    return PALETTE.find((c) => !used.has(c)) || PALETTE[data.teams.length % PALETTE.length];
  }
  function resetTeamForm() {
    const f = $('teamForm');
    f.reset(); f.id.value = ''; f.color.value = nextColor(); markSwatch();
    $('teamFormTitle').textContent = 'Novo time'; $('teamCancel').hidden = true;
  }
  function renderTeams() {
    if (!$('teamForm').id.value) resetTeamForm();
    const count = (id) => data.competitors.filter((c) => c.team_id === id).length;
    $('teamListAdmin').innerHTML = data.teams.length ? data.teams.map((t) => `
      <div class="item">
        <span class="t-dot" style="--tc:${esc(t.color)};width:22px;height:22px;border-radius:7px"></span>
        <div class="grow"><b>${esc(t.name)}</b><div class="sub">${count(t.id)} competidor(es) · ${esc(t.color)}</div></div>
        <button class="btn sm" data-edit="${t.id}">Editar</button>
        <button class="btn sm danger" data-del="${t.id}">Excluir</button>
      </div>`).join('') : '<p class="hint">Nenhum time ainda. Cadastre o primeiro ao lado.</p>';
  }
  $('teamListAdmin').onclick = async (e) => {
    const ed = e.target.closest('[data-edit]'), del = e.target.closest('[data-del]');
    if (ed) {
      const t = data.teams.find((x) => x.id === ed.dataset.edit), f = $('teamForm');
      f.id.value = t.id; f.name.value = t.name; f.color.value = t.color; markSwatch();
      $('teamFormTitle').textContent = 'Editar time'; $('teamCancel').hidden = false; f.name.focus();
    }
    if (del) {
      const t = data.teams.find((x) => x.id === del.dataset.del);
      const n = data.competitors.filter((c) => c.team_id === t.id).length;
      if (!(await UI.confirm(`Excluir o time "${t.name}"?`, n ? `Os ${n} competidor(es) deste time também serão removidos.` : 'O time não tem competidores.', 'Excluir', true))) return;
      await run(() => Store.deleteTeam(t.id), 'Time excluído.');
      reload();
    }
  };
  $('teamCancel').onclick = resetTeamForm;
  $('teamForm').onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target;
    const ok = await run(() => Store.saveTeam({ id: f.id.value || undefined, competition_id: compId, name: f.name.value.trim(), color: f.color.value }), 'Time salvo!');
    if (ok) { resetTeamForm(); await reload(); $('teamForm').name.focus(); }
  };

  /* ================= COMPETIDORES ================= */
  function renderPlayers() {
    const sel = $('playerTeam'), prev = sel.value;
    sel.innerHTML = data.teams.length ? data.teams.map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join('') : '<option value="">Cadastre um time primeiro</option>';
    if (data.teams.some((t) => t.id === prev)) sel.value = prev;
    const teamOpts = (cur) => data.teams.map((t) => `<option value="${t.id}"${t.id === cur ? ' selected' : ''}>${esc(t.name)}</option>`).join('');
    $('playerGroups').innerHTML = data.teams.length ? data.teams.map((t) => {
      const ps = data.competitors.filter((c) => c.team_id === t.id);
      return `<div class="team-group"><div class="team-group-h"><span class="t-dot" style="--tc:${esc(t.color)}"></span>${esc(t.name)} <span class="sub" style="color:var(--muted);font-weight:500">(${ps.length})</span></div>
        <div class="chips">${ps.length ? ps.map((p) => `<span class="chip"><span class="chip-name" data-rename="${p.id}" title="Clique 2 vezes para editar o nome">${esc(p.name)}</span>
          <select data-move="${p.id}" title="Trocar de time">${teamOpts(t.id)}</select>
          <button data-rm="${p.id}" title="Remover">×</button></span>`).join('') : '<span class="sub" style="color:var(--muted)">Sem competidores</span>'}</div></div>`;
    }).join('') : '<p class="hint">Cadastre os times primeiro.</p>';
  }
  $('playerForm').onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target;
    const names = [...new Set(f.names.value.split(/\n|;/).map((s) => s.trim()).filter(Boolean))];
    if (!f.team_id.value) return UI.toast('Cadastre um time primeiro.', 'err');
    let added = 0;
    const failed = [];
    for (const name of names) {
      try { await Store.saveCompetitor({ competition_id: compId, team_id: f.team_id.value, name }); added++; }
      catch (err) { failed.push(err.message); }
    }
    if (added) UI.toast(`${added} competidor(es) adicionado(s).`, 'ok');
    failed.forEach((m) => UI.toast(m, 'err'));
    if (!failed.length) f.names.value = '';
    await reload();
    f.names.focus();
  };
  $('playerGroups').onchange = async (e) => {
    const s = e.target.closest('[data-move]'); if (!s) return;
    const p = data.competitors.find((c) => c.id === s.dataset.move);
    await run(() => Store.saveCompetitor(Object.assign({}, p, { team_id: s.value })), 'Competidor movido de time.');
    reload();
  };
  // Duplo clique no nome do competidor: edição inline (Enter salva, Esc cancela)
  $('playerGroups').ondblclick = (e) => {
    const span = e.target.closest('[data-rename]');
    if (!span || span.querySelector('input')) return;
    const p = data.competitors.find((c) => c.id === span.dataset.rename);
    if (!p) return;
    const input = document.createElement('input');
    input.className = 'chip-input';
    input.value = p.name;
    input.size = Math.max(6, p.name.length + 2);
    span.textContent = '';
    span.appendChild(input);
    input.focus();
    input.select();
    let done = false;
    const finish = async (save) => {
      if (done) return;
      done = true;
      const name = input.value.trim();
      if (!save || !name || name === p.name) { span.textContent = p.name; return; }
      const ok = await run(() => Store.saveCompetitor(Object.assign({}, p, { name })), 'Nome atualizado!');
      if (!ok) span.textContent = p.name;
      await reload();
    };
    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') { ev.preventDefault(); finish(true); }
      if (ev.key === 'Escape') { ev.preventDefault(); finish(false); }
    });
    input.addEventListener('input', () => { input.size = Math.max(6, input.value.length + 2); });
    input.addEventListener('blur', () => finish(true));
  };

  $('playerGroups').onclick = async (e) => {
    const b = e.target.closest('[data-rm]'); if (!b) return;
    const p = data.competitors.find((c) => c.id === b.dataset.rm);
    if (!(await UI.confirm(`Remover ${p.name}?`, 'Se já houver chaveamento, será preciso sortear novamente.', 'Remover', true))) return;
    await run(() => Store.deleteCompetitor(p.id), 'Competidor removido.');
    reload();
  };

  /* ================= CHAVEAMENTO ================= */
  function isStale() {
    if (!data.bracket) return false;
    const inB = new Set(data.bracket.slots.filter(Boolean));
    const ids = new Set(data.competitors.map((c) => c.id));
    return inB.size !== ids.size || [...ids].some((id) => !inB.has(id));
  }
  function renderBracket() {
    const n = data.competitors.length;
    const S = n >= 2 ? Engine.nextPow2(n) : 0;
    const d = Engine.derive(data.bracket);
    const played = d ? Engine.allMatches(d).filter((m) => m.decided && !m.bye).length : 0;
    const total = d ? Engine.allMatches(d).filter((m) => !m.bye).length : 0;
    $('bracketStats').innerHTML = `
      <div class="stat"><b>${data.teams.length}</b><span>times</span></div>
      <div class="stat"><b>${n}</b><span>competidores</span></div>
      <div class="stat"><b>${S || '—'}</b><span>tamanho da chave</span></div>
      <div class="stat"><b>${S ? S - n : '—'}</b><span>classificados direto (bye)</span></div>
      <div class="stat"><b>${d ? `${played}/${total}` : '—'}</b><span>batalhas concluídas</span></div>`;
    let warn = '';
    if (n < 2) warn = 'Cadastre pelo menos 2 competidores para gerar o chaveamento.';
    else if (isStale()) warn = '⚠️ Os competidores mudaram depois do sorteio. Sorteie novamente para incluir todos.';
    $('bracketWarn').innerHTML = warn ? `<div class="warn">${warn}</div>` : '';
    $('genBtn').textContent = data.bracket ? '🎲 Sortear novamente' : '🎲 Gerar tabela e árvore';
    $('genBtn').disabled = n < 2;
    $('clearResBtn').disabled = !played;
    $('delBracketBtn').disabled = !data.bracket;
    if (d) {
      BracketView.render($('adminBracket'), d, UI.ctx(data), { editable: true, onPick: pick });
    } else {
      $('adminBracket').innerHTML = n >= 2 ? '<div class="empty-state" style="min-height:200px"><div>Clique em <b>Gerar tabela e árvore</b> para sortear os confrontos.</div></div>' : '';
    }
  }

  async function pick(key, pid) {
    const br = Object.assign({}, data.bracket, { results: Object.assign({}, data.bracket.results || {}) });
    if (br.results[key] === pid) delete br.results[key];
    else br.results[key] = pid;
    const pruned = Engine.prune(br);
    await run(() => Store.saveBracket(compId, pruned));
    await reload();
    const d = Engine.derive(pruned);
    if (d && d.finished) {
      const st = Engine.standings(data.competition, data.teams, data.competitors, d);
      if (st.teams[0]) UI.toast(`🏆 Competição encerrada! Time campeão: ${st.teams[0].name}`, 'ok');
    }
  }

  $('genBtn').onclick = async () => {
    const d = Engine.derive(data.bracket);
    const played = d ? Engine.allMatches(d).filter((m) => m.decided && !m.bye).length : 0;
    if (played && !(await UI.confirm('Sortear novamente?', `Já existem ${played} resultado(s) lançado(s). Um novo sorteio apaga todos os resultados.`, 'Sortear mesmo assim', true))) return;
    const br = Engine.generate(data.competitors, data.competition.avoid_same_team !== false);
    if (!br) return UI.toast('Cadastre pelo menos 2 competidores.', 'err');
    const btn = $('genBtn'); btn.disabled = true;
    await run(() => Store.saveBracket(compId, br), data.bracket ? 'Novo sorteio feito!' : 'Tabela e árvore geradas!');
    await reload();
  };
  $('clearResBtn').onclick = async () => {
    if (!(await UI.confirm('Limpar resultados?', 'Os confrontos sorteados são mantidos, só os vencedores são apagados.', 'Limpar', true))) return;
    await run(() => Store.saveBracket(compId, Object.assign({}, data.bracket, { results: {} })), 'Resultados limpos.');
    reload();
  };
  $('delBracketBtn').onclick = async () => {
    if (!(await UI.confirm('Apagar chaveamento?', 'A árvore e todos os resultados desta competição serão apagados.', 'Apagar', true))) return;
    await run(() => Store.deleteBracket(compId), 'Chaveamento apagado.');
    reload();
  };

  /* ================= CONTA / BACKUP ================= */
  $('pwForm').onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target;
    const r = await run(() => Store.changePassword(f.old.value, f.new.value).then((x) => x || true));
    if (!r) return;
    f.reset();
    if (r.configLine) {
      $('pwOut').hidden = false;
      $('pwLine').value = r.configLine;
      $('pwLine').select();
      UI.toast('Hash gerado. Agora substitua a linha no js/config.js.', 'ok');
    } else UI.toast('Senha alterada!', 'ok');
  };
  $('pwCopy').onclick = async () => {
    try { await navigator.clipboard.writeText($('pwLine').value); UI.toast('Copiado!', 'ok'); }
    catch (e) { $('pwLine').select(); }
  };
  $('exportBtn').onclick = async () => {
    const all = await run(() => Store.exportAll());
    if (!all) return;
    const blob = new Blob([JSON.stringify(all, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `arena-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  $('importFile').onchange = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    if (!(await UI.confirm('Importar backup?', 'Todos os dados atuais deste navegador serão substituídos pelo conteúdo do arquivo.', 'Importar', true))) { e.target.value = ''; return; }
    const text = await file.text();
    await run(() => Store.importAll(JSON.parse(text)), 'Backup importado!');
    e.target.value = '';
    compId = null; reload();
  };

  initAuth();
})();
