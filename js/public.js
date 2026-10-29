/* Telão público: rankings + árvore, atualização automática */
(function () {
  const $ = (id) => document.getElementById(id);
  const esc = Engine.esc;
  let currentId = new URLSearchParams(location.search).get('c');
  let lastHash = '';

  $('logo').innerHTML = UI.LOGO;

  async function loadList() {
    const list = await Store.listCompetitions();
    if (!currentId || !list.some((c) => c.id === currentId)) currentId = list[0] ? list[0].id : null;
    $('compSelect').innerHTML = list.length
      ? list.map((c) => `<option value="${c.id}"${c.id === currentId ? ' selected' : ''}>${esc(c.name)}</option>`).join('')
      : '<option>Nenhuma competição</option>';
    return list;
  }

  async function refresh(force) {
    try {
      const list = await loadList();
      if (!currentId) return renderEmpty(list.length === 0);
      const data = await Store.loadCompetition(currentId);
      if (!data) return;
      const hash = JSON.stringify(data);
      if (!force && hash === lastHash) return;
      lastHash = hash;
      render(data);
    } catch (e) {
      console.error(e);
      $('compSub').textContent = 'Erro ao carregar: ' + e.message;
    }
  }

  function renderEmpty() {
    $('compName').textContent = 'Arena';
    $('compSub').textContent = 'Nenhuma competição cadastrada ainda';
    $('teamList').innerHTML = '';
    $('playersTable').innerHTML = '';
    $('nextBattle').innerHTML = '';
    $('champion').innerHTML = '';
    $('viewport').innerHTML = `<div class="empty-state"><div><div class="big">Bem-vindo à Arena</div>Entre no painel <a href="admin.html">Admin</a> para criar a primeira competição.</div></div>`;
  }

  function render(data) {
    const { competition: comp, teams, competitors, bracket } = data;
    const d = Engine.derive(bracket);
    const st = Engine.standings(comp, teams, competitors, d);
    const ctx = UI.ctx(data);
    document.title = `${comp.name} · Arena`;

    $('compName').textContent = comp.name;
    $('compSub').textContent = [comp.description, `${teams.length} times · ${competitors.length} competidores`, `vitória = ${comp.points_win} pts`].filter(Boolean).join(' · ');
    const live = $('liveBadge');
    live.className = 'live' + (st.finished ? ' done' : '');
    live.querySelector('span').textContent = st.finished ? 'ENCERRADA' : d ? 'AO VIVO' : 'EM BREVE';

    // ---- ranking por time
    const maxPts = Math.max(1, ...st.teams.map((t) => t.points));
    $('teamList').innerHTML = st.teams.length ? st.teams.map((t, i) => `
      <div class="team-row${i === 0 && t.points > 0 ? ' lead' : ''}" style="--tc:${esc(t.color)};--pct:${Math.round((t.points / maxPts) * 100)}%">
        <div class="t-pos">${i === 0 && t.points > 0 ? '👑' : t.pos + 'º'}</div>
        <div>
          <div class="t-name"><span class="t-dot"></span><span class="n">${esc(t.name)}</span></div>
          <div class="t-meta">${t.members} competidor${t.members === 1 ? '' : 'es'} · ${t.wins} vitória${t.wins === 1 ? '' : 's'}${d && !st.finished ? ` · ${t.alive} na disputa` : ''}</div>
        </div>
        <div class="t-pts">${t.points}<small>PTS</small></div>
      </div>`).join('') : '<div class="p-status" style="padding:8px">Nenhum time cadastrado.</div>';

    // ---- ranking individual
    $('playersCount').textContent = `${competitors.length} competidores`;
    const medal = (p) => (p.place && p.place <= 3 ? `<span class="medal m${p.place}">${p.place}</span>` : p.pos);
    $('playersTable').innerHTML = `<thead><tr><th class="num">#</th><th>Competidor</th><th class="num">V</th><th class="num">D</th><th style="text-align:right">Pts</th></tr></thead><tbody>` +
      st.players.map((p) => {
        const t = ctx.teamById[p.team_id] || {};
        const out = (p.out && !p.place) || p.place === 4;
        return `<tr class="${out ? 'out' : ''}"><td class="num">${medal(p)}</td>
          <td><div class="p-name"><span class="t-dot" style="--tc:${esc(t.color)}"></span>${esc(p.name)}</div><div class="p-status">${esc(t.name || '')} · ${esc(p.status)}</div></td>
          <td class="num">${p.wins}</td><td class="num">${p.losses}</td><td class="pts">${p.points}</td></tr>`;
      }).join('') + '</tbody>';

    // ---- campeão
    if (st.finished && st.teams[0]) {
      const t = st.teams[0];
      const pl = d.placements;
      const nm = (id) => (id && ctx.byId[id] ? esc(ctx.byId[id].name) : '—');
      $('champion').innerHTML = `<div class="champion-banner" style="--tc:${esc(t.color)};--fg:${Engine.textOn(t.color)}">
        <div class="cup">${UI.CUP}</div>
        <div><div class="lbl">Time campeão</div><div class="nm">${esc(t.name)} · ${t.points} pts</div></div>
        <div class="podium"><div><b>🥇 1º</b>${nm(pl.first)}</div><div><b>🥈 2º</b>${nm(pl.second)}</div><div><b>🥉 3º</b>${nm(pl.third)}</div></div>
      </div>`;
    } else $('champion').innerHTML = '';

    // ---- árvore
    if (!d) {
      $('bracketInfo').textContent = '';
      $('nextBattle').innerHTML = '';
      $('viewport').innerHTML = `<div class="empty-state"><div><div class="big">Aguardando sorteio</div>Os confrontos aparecem aqui assim que forem sorteados.</div></div>`;
      return;
    }
    const realPlayers = d.rounds[0].flatMap((m) => [m.a, m.b]).filter(Boolean).length;
    const byes = d.rounds[0].filter((m) => m.bye).length;
    $('bracketInfo').textContent = `${realPlayers} competidores · chave de ${d.S}${byes ? ` · ${byes} classificado${byes > 1 ? 's' : ''} direto na 1ª fase` : ''}`;

    if (d.next) {
      const side = (pid) => {
        const p = ctx.byId[pid]; const t = p ? ctx.teamById[p.team_id] : null;
        return `<span class="who"><span class="t-dot" style="--tc:${esc(t ? t.color : '#64748b')}"></span>${esc(p ? p.name : '?')}</span>`;
      };
      const phase = d.next.key === 'third' ? 'Disputa de 3º lugar' : Engine.roundName(d.R, d.next.round);
      $('nextBattle').innerHTML = `<div class="next-battle"><span class="lbl">Próxima batalha · ${phase}</span>${side(d.next.a)}<span class="vs">VS</span>${side(d.next.b)}</div>`;
    } else $('nextBattle').innerHTML = '';

    BracketView.render($('viewport'), d, ctx, {});
    fit();
  }

  // Ajusta a árvore ao tamanho da tela (ideal para telão / projetor)
  function fit() {
    const vp = $('viewport'), b = vp.querySelector('.bracket');
    if (!b) return;
    const s = Math.min((vp.clientWidth - 16) / b.offsetWidth, (vp.clientHeight - 16) / b.offsetHeight, 1.6);
    b.style.transform = `translate(-50%, -50%) scale(${Math.max(0.2, s)})`;
  }
  window.addEventListener('resize', fit);

  // Rolagem automática do ranking individual quando não cabe na tela
  (function autoScroll() {
    const el = $('playersScroll');
    let dir = 1, pause = 120, pos = 0;
    function step() {
      const max = el.scrollHeight - el.clientHeight;
      if (max > 4 && !el.matches(':hover')) {
        if (pause > 0) pause--;
        else {
          pos += dir * 0.5;
          if (pos >= max) { pos = max; dir = -1; pause = 180; }
          if (pos <= 0) { pos = 0; dir = 1; pause = 180; }
          el.scrollTop = pos;
        }
      } else pos = el.scrollTop;
      requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  })();

  // Tela cheia
  function toggleFs() {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(() => {});
  }
  $('fsBtn').addEventListener('click', toggleFs);
  document.addEventListener('keydown', (e) => { if ((e.key === 'f' || e.key === 'F') && !e.target.closest('input,select,textarea')) toggleFs(); });
  document.addEventListener('fullscreenchange', () => { document.body.classList.toggle('fs', !!document.fullscreenElement); setTimeout(fit, 120); });

  $('compSelect').addEventListener('change', (e) => {
    currentId = e.target.value;
    history.replaceState(null, '', '?c=' + currentId);
    refresh(true);
  });

  refresh(true);
  Store.onChange(() => refresh(false));
})();
