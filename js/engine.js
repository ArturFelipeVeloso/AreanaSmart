/* =========================================================
   Motor da competição: sorteio, árvore mata-mata e rankings
   (funções puras, sem acesso a banco ou DOM)
   ========================================================= */
(function () {
  const E = {};

  E.nextPow2 = (n) => { let s = 1; while (s < n) s *= 2; return s; };

  function bitrev(i, bits) {
    let r = 0;
    for (let b = 0; b < bits; b++) r = (r << 1) | ((i >> b) & 1);
    return r;
  }

  E.shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  /**
   * Sorteia a chave. A árvore sempre tem tamanho potência de 2 (2, 4, 8, 16...).
   * Quando o número de competidores não fecha a chave, alguns jogadores
   * ficam sem adversário na 1ª fase (bye) e já avançam. Os byes são
   * espalhados pela árvore para nunca haver dois byes no mesmo confronto.
   */
  E.generate = (competitors, avoidSameTeam) => {
    const n = competitors.length;
    if (n < 2) return null;
    const S = E.nextPow2(n);
    const pairs = S / 2;
    const bits = Math.log2(pairs);
    const byes = S - n;
    const byeOrder = [...Array(pairs).keys()].map((i) => bitrev(i, bits));
    const byePairs = new Set(byeOrder.slice(0, byes));
    const tries = avoidSameTeam ? 600 : 1;
    let best = null;

    for (let t = 0; t < tries; t++) {
      const list = E.shuffle(competitors);
      const slots = Array(S).fill(null);
      let k = 0, cost = 0;
      for (let p = 0; p < pairs; p++) {
        if (byePairs.has(p)) {
          slots[2 * p] = list[k++].id;
        } else {
          const a = list[k++], b = list[k++];
          slots[2 * p] = a.id; slots[2 * p + 1] = b.id;
          if (a.team_id === b.team_id) cost++;
        }
      }
      if (!best || cost < best.cost) best = { slots, cost };
      if (cost === 0) break;
    }
    return { slots: best.slots, results: {}, generated_at: new Date().toISOString() };
  };

  E.roundName = (R, r) => {
    const count = Math.pow(2, R - 1 - r);
    if (count === 1) return 'Final';
    if (count === 2) return 'Semifinal';
    if (count === 4) return 'Quartas de final';
    if (count === 8) return 'Oitavas de final';
    return `${count}-avos de final`;
  };

  /** Monta a árvore completa a partir da chave sorteada + resultados lançados. */
  E.derive = (br) => {
    if (!br || !Array.isArray(br.slots) || br.slots.length < 2) return null;
    const S = br.slots.length;
    const R = Math.round(Math.log2(S));
    const res = br.results || {};
    const rounds = [];
    let parts = br.slots.slice();

    for (let r = 0; r < R; r++) {
      const ms = [];
      for (let i = 0; i < parts.length / 2; i++) {
        const a = parts[2 * i] || null, b = parts[2 * i + 1] || null;
        const m = { key: `r${r}m${i}`, round: r, index: i, a, b, winner: null, loser: null, bye: false, decided: false };
        if (a && b) {
          const w = res[m.key];
          if (w === a || w === b) { m.winner = w; m.loser = w === a ? b : a; m.decided = true; }
        } else if (r === 0 && (a || b)) {
          m.bye = true; m.winner = a || b; m.decided = true;
        }
        ms.push(m);
      }
      rounds.push(ms);
      parts = ms.map((m) => m.winner);
    }

    let third = null;
    if (R >= 2) {
      const semis = rounds[R - 2];
      third = { key: 'third', round: 'third', index: 0, a: null, b: null, winner: null, loser: null, bye: false, decided: false };
      if (semis.every((m) => m.decided)) {
        const a = semis[0].loser, b = semis[1].loser;
        third.a = a; third.b = b;
        if (a && b) {
          const w = res.third;
          if (w === a || w === b) { third.winner = w; third.loser = w === a ? b : a; third.decided = true; }
        } else if (a || b) {
          third.bye = true; third.winner = a || b; third.decided = true;
        } else {
          third = null;
        }
      }
    }

    const final = rounds[R - 1][0];
    const placements = {
      first: final.winner, second: final.loser,
      third: third ? third.winner : null, fourth: third ? third.loser : null,
    };
    const finished = final.decided && (!third || third.decided);

    // Próxima batalha: primeiro confronto com os dois lados definidos e sem vencedor.
    // A disputa de 3º lugar acontece antes da final.
    let next = null;
    for (let r = 0; r < R - 1 && !next; r++) next = rounds[r].find((m) => m.a && m.b && !m.decided) || null;
    if (!next && third && third.a && third.b && !third.decided) next = third;
    if (!next && final.a && final.b && !final.decided) next = final;

    return { S, R, rounds, third, final, placements, finished, next };
  };

  /** Remove resultados que deixaram de valer (ex.: vencedor trocado numa fase anterior). */
  E.prune = (br) => {
    const d = E.derive(br);
    if (!d) return br;
    const results = {};
    const all = d.rounds.flat().concat(d.third ? [d.third] : []);
    all.forEach((m) => { if (m.decided && !m.bye) results[m.key] = m.winner; });
    return Object.assign({}, br, { results });
  };

  E.allMatches = (d) => (d ? d.rounds.flat().concat(d.third ? [d.third] : []) : []);

  /** Rankings individual e por time. */
  E.standings = (comp, teams, competitors, d) => {
    const pw = Number(comp.points_win) || 0;
    const bonus = [Number(comp.bonus_first) || 0, Number(comp.bonus_second) || 0, Number(comp.bonus_third) || 0];
    const inBracket = new Set(d ? d.rounds[0].flatMap((m) => [m.a, m.b]).filter(Boolean) : []);
    const P = {};
    competitors.forEach((c) => {
      P[c.id] = { id: c.id, name: c.name, team_id: c.team_id, wins: 0, losses: 0, points: 0, place: null, out: null, status: '' };
    });

    if (d) {
      d.rounds.forEach((ms, r) => ms.forEach((m) => {
        if (!m.decided || m.bye) return;
        if (P[m.winner]) P[m.winner].wins++;
        if (P[m.loser]) { P[m.loser].losses++; if (r < d.R - 1) P[m.loser].out = E.roundName(d.R, r); }
      }));
      if (d.third && d.third.decided && !d.third.bye) {
        if (P[d.third.winner]) P[d.third.winner].wins++;
        if (P[d.third.loser]) P[d.third.loser].losses++;
      }
      const pl = d.placements;
      [[pl.first, 1], [pl.second, 2], [pl.third, 3], [pl.fourth, 4]].forEach(([id, n]) => { if (id && P[id]) P[id].place = n; });
    }

    const list = Object.values(P);
    list.forEach((p) => {
      p.points = p.wins * pw + (p.place && p.place <= 3 ? bonus[p.place - 1] : 0);
      if (p.place === 1) p.status = 'Campeão';
      else if (p.place === 2) p.status = 'Vice-campeão';
      else if (p.place === 3) p.status = '3º lugar';
      else if (p.place === 4) p.status = '4º lugar';
      else if (p.out) p.status = `Eliminado · ${p.out}`;
      else if (d && d.third && !d.third.decided && (d.third.a === p.id || d.third.b === p.id)) p.status = 'Disputa 3º lugar';
      else if (inBracket.has(p.id)) p.status = 'Na disputa';
      else p.status = d ? 'Fora do sorteio' : 'Aguardando sorteio';
      p.alive = inBracket.has(p.id) && !p.out && !p.place;
      if (d && d.third && !d.third.decided && (d.third.a === p.id || d.third.b === p.id)) p.alive = true;
      if (d && !d.final.decided && (d.final.a === p.id || d.final.b === p.id)) p.alive = true;
    });

    list.sort((a, b) => b.points - a.points || b.wins - a.wins || (a.place || 99) - (b.place || 99) || a.losses - b.losses || a.name.localeCompare(b.name, 'pt-BR'));
    list.forEach((p, i) => {
      const prev = list[i - 1];
      p.pos = prev && prev.points === p.points && prev.wins === p.wins && prev.losses === p.losses && !p.place && !prev.place ? prev.pos : i + 1;
    });

    const T = teams.map((t) => {
      const members = list.filter((p) => p.team_id === t.id);
      return {
        id: t.id, name: t.name, color: t.color,
        members: members.length,
        alive: members.filter((p) => p.alive).length,
        wins: members.reduce((s, p) => s + p.wins, 0),
        points: members.reduce((s, p) => s + p.points, 0),
        best: members.reduce((m, p) => (p.place && (!m || p.place < m) ? p.place : m), null),
      };
    });
    T.sort((a, b) => b.points - a.points || b.wins - a.wins || (a.best || 99) - (b.best || 99) || b.alive - a.alive || a.name.localeCompare(b.name, 'pt-BR'));
    T.forEach((t, i) => { t.pos = i + 1; });

    return { players: list, teams: T, finished: !!(d && d.finished) };
  };

  /** Cor de texto legível sobre uma cor de fundo. */
  E.textOn = (hex) => {
    const h = String(hex || '#000').replace('#', '');
    const f = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(f.substr(i, 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
    const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return L > 0.4 ? '#0b1020' : '#ffffff';
  };

  E.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  window.Engine = E;
})();
