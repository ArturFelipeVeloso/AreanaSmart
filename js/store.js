/* =========================================================
   Camada de dados. Mesma interface para dois "back-ends":
   - LocalStore: localStorage do navegador (padrão)
   - SupabaseStore: PostgreSQL na nuvem (Supabase)
   ========================================================= */
(function () {
  const CFG = window.ARENA_CONFIG || {};
  const DB_KEY = 'arena_db_v1';
  const SESSION_KEY = 'arena_session_v1';
  const ACCOUNTS_KEY = 'arena_admins_v1';

  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2));
  const now = () => new Date().toISOString();
  const norm = (s) => String(s || '').trim().toLocaleLowerCase('pt-BR');



  const PBKDF2_ITER = 210000;
  const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  async function pbkdf2(pass, saltHex, iter) {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveBits']);
    const salt = new Uint8Array(saltHex.match(/../g).map((h) => parseInt(h, 16)));
    return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, key, 256));
  }
  async function hashPass(pass) {
    const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
    return `pbkdf2$${PBKDF2_ITER}$${salt}$${await pbkdf2(pass, salt, PBKDF2_ITER)}`;
  }
  async function verifyPass(pass, stored) {
    const [alg, iter, salt, hash] = String(stored).split('$');
    if (alg !== 'pbkdf2' || !hash) return false;
    return (await pbkdf2(String(pass || ''), salt, Number(iter))) === hash;
  }

  const COMP_DEFAULTS = { description: '', points_win: 3, bonus_first: 10, bonus_second: 6, bonus_third: 4, avoid_same_team: true };

  /* ---------------- LOCAL ---------------- */
  const LocalStore = {
    mode: 'local',
    _read() {
      try { return Object.assign({ competitions: [], teams: [], competitors: [], brackets: {} }, JSON.parse(localStorage.getItem(DB_KEY) || '{}')); }
      catch (e) { return { competitions: [], teams: [], competitors: [], brackets: {} }; }
    },
    _write(db) { localStorage.setItem(DB_KEY, JSON.stringify(db)); },

    async listCompetitions() {
      return this._read().competitions.slice().sort((a, b) => b.created_at.localeCompare(a.created_at));
    },
    async loadCompetition(id) {
      const db = this._read();
      const competition = db.competitions.find((c) => c.id === id) || null;
      if (!competition) return null;
      return {
        competition,
        teams: db.teams.filter((t) => t.competition_id === id).sort((a, b) => a.created_at.localeCompare(b.created_at)),
        competitors: db.competitors.filter((c) => c.competition_id === id).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
        bracket: db.brackets[id] || null,
      };
    },
    async saveCompetition(c) {
      const db = this._read();
      if (!String(c.name || '').trim()) throw new Error('Informe o nome da competição.');
      if (c.id) {
        const i = db.competitions.findIndex((x) => x.id === c.id);
        db.competitions[i] = Object.assign({}, db.competitions[i], c);
        this._write(db); return db.competitions[i];
      }
      const row = Object.assign({}, COMP_DEFAULTS, c, { id: uid(), created_at: now() });
      db.competitions.push(row); this._write(db); return row;
    },
    async deleteCompetition(id) {
      const db = this._read();
      db.competitions = db.competitions.filter((c) => c.id !== id);
      db.teams = db.teams.filter((t) => t.competition_id !== id);
      db.competitors = db.competitors.filter((c) => c.competition_id !== id);
      delete db.brackets[id];
      this._write(db);
    },
    async saveTeam(t) {
      const db = this._read();
      if (!String(t.name || '').trim()) throw new Error('Informe o nome do time.');
      if (db.teams.some((x) => x.competition_id === t.competition_id && x.id !== t.id && norm(x.name) === norm(t.name)))
        throw new Error('Já existe um time com esse nome nesta competição.');
      if (t.id) {
        const i = db.teams.findIndex((x) => x.id === t.id);
        db.teams[i] = Object.assign({}, db.teams[i], t); this._write(db); return db.teams[i];
      }
      const row = Object.assign({ color: '#3b82f6' }, t, { id: uid(), created_at: now() });
      db.teams.push(row); this._write(db); return row;
    },
    async deleteTeam(id) {
      const db = this._read();
      db.teams = db.teams.filter((t) => t.id !== id);
      db.competitors = db.competitors.filter((c) => c.team_id !== id);
      this._write(db);
    },
    async saveCompetitor(c) {
      const db = this._read();
      if (!String(c.name || '').trim()) throw new Error('Informe o nome do competidor.');
      if (!c.team_id) throw new Error('Escolha o time do competidor.');
      const dup = db.competitors.find((x) => x.competition_id === c.competition_id && x.id !== c.id && norm(x.name) === norm(c.name));
      if (dup) throw new Error(`"${c.name}" já está cadastrado nesta competição (um competidor só pode estar em 1 time).`);
      if (c.id) {
        const i = db.competitors.findIndex((x) => x.id === c.id);
        db.competitors[i] = Object.assign({}, db.competitors[i], c); this._write(db); return db.competitors[i];
      }
      const row = Object.assign({}, c, { id: uid(), created_at: now() });
      db.competitors.push(row); this._write(db); return row;
    },
    async deleteCompetitor(id) {
      const db = this._read();
      db.competitors = db.competitors.filter((c) => c.id !== id); this._write(db);
    },
    async saveBracket(competitionId, br) {
      const db = this._read();
      db.brackets[competitionId] = Object.assign({}, br, { competition_id: competitionId, updated_at: now() });
      this._write(db);
    },
    async deleteBracket(competitionId) {
      const db = this._read(); delete db.brackets[competitionId]; this._write(db);
    },
    async exportAll() { return this._read(); },
    async importAll(data) {
      if (!data || !Array.isArray(data.competitions)) throw new Error('Arquivo de backup inválido.');
      this._write({ competitions: data.competitions, teams: data.teams || [], competitors: data.competitors || [], brackets: data.brackets || {} });
    },

    /* autenticação local
       - Contas de admin criadas pela tela "Criar acesso", que exige a SENHA MASTER.
         A senha master só existe como hash PBKDF2 em js/config.js (masterPassHash).
       - As contas ficam neste navegador, com a senha também em hash PBKDF2.
       - O admin fixo do config.js (adminUser/adminPassHash), se definido, continua valendo. */
    _accounts() { try { return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]'); } catch (e) { return []; } },
    canCreateAccount() { return !!CFG.masterPassHash; },
    async createAccount(user, pass, master) {
      const u = norm(user);
      if (!u) throw new Error('Informe o usuário.');
      if (!pass || pass.length < 6) throw new Error('A senha precisa ter pelo menos 6 caracteres.');
      if (!CFG.masterPassHash || !(await verifyPass(master, CFG.masterPassHash))) throw new Error('Senha master incorreta.');
      const list = this._accounts();
      if (list.some((a) => a.user === u) || (CFG.adminUser && norm(CFG.adminUser) === u)) throw new Error('Esse usuário já existe.');
      list.push({ user: u, hash: await hashPass(pass), created_at: now() });
      localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(list));
      sessionStorage.setItem(SESSION_KEY, u);
    },
    async needsSetup() { return false; },
    async setup() { throw new Error('Use "Criar acesso".'); },
    async login(user, pass) {
      const u = norm(user);
      const acc = this._accounts().find((a) => a.user === u);
      let ok = false;
      if (acc) ok = await verifyPass(pass, acc.hash);
      else if (CFG.adminUser && CFG.adminPassHash && norm(CFG.adminUser) === u) ok = await verifyPass(pass, CFG.adminPassHash);
      if (!ok) throw new Error('Usuário ou senha incorretos.');
      sessionStorage.setItem(SESSION_KEY, u);
    },
    async isLoggedIn() { const v = sessionStorage.getItem(SESSION_KEY); return !!v; },
    currentUser() { const v = sessionStorage.getItem(SESSION_KEY); return v && v !== '1' ? v : ''; },
    async logout() { sessionStorage.removeItem(SESSION_KEY); },
    async changePassword(oldPass, newPass) {
      if (!newPass || newPass.length < 6) throw new Error('A nova senha precisa ter pelo menos 6 caracteres.');
      const u = this.currentUser();
      const list = this._accounts();
      const acc = list.find((a) => a.user === u);
      if (acc) {
        if (!(await verifyPass(oldPass, acc.hash))) throw new Error('Senha atual incorreta.');
        acc.hash = await hashPass(newPass);
        localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(list));
        return true;
      }
      // admin fixo do config.js: gera a linha para substituir no arquivo
      if (!(await verifyPass(oldPass, String(CFG.adminPassHash || '')))) throw new Error('Senha atual incorreta.');
      return { configLine: `adminPassHash: '${await hashPass(newPass)}',` };
    },

    onChange(cb) {
      window.addEventListener('storage', (e) => { if (e.key === DB_KEY) cb(); });
      setInterval(cb, 3000);
    },
  };

  /* ---------------- SUPABASE ---------------- */
  function SupabaseStore() {
    const sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey);
    const ok = ({ data, error }) => {
      if (error) {
        if (error.code === '23505') throw new Error('Nome duplicado: já existe um registro com esse nome nesta competição.');
        if (error.code === '42501' || /row-level security/i.test(error.message)) throw new Error('Sem permissão. Faça login novamente.');
        throw new Error(error.message);
      }
      return data;
    };
    const pick = (o, keys) => keys.reduce((r, k) => { if (o[k] !== undefined) r[k] = o[k]; return r; }, {});
    const COMP_F = ['name', 'description', 'points_win', 'bonus_first', 'bonus_second', 'bonus_third', 'avoid_same_team'];

    return {
      mode: 'supabase',
      async listCompetitions() { return ok(await sb.from('competitions').select('*').order('created_at', { ascending: false })); },
      async loadCompetition(id) {
        const [c, t, p, b] = await Promise.all([
          sb.from('competitions').select('*').eq('id', id).maybeSingle(),
          sb.from('teams').select('*').eq('competition_id', id).order('created_at'),
          sb.from('competitors').select('*').eq('competition_id', id).order('name'),
          sb.from('brackets').select('*').eq('competition_id', id).maybeSingle(),
        ]);
        const competition = ok(c);
        if (!competition) return null;
        return { competition, teams: ok(t), competitors: ok(p), bracket: ok(b) };
      },
      async saveCompetition(c) {
        if (!String(c.name || '').trim()) throw new Error('Informe o nome da competição.');
        const row = pick(Object.assign({}, c.id ? {} : COMP_DEFAULTS, c), COMP_F);
        if (c.id) return ok(await sb.from('competitions').update(row).eq('id', c.id).select().single());
        return ok(await sb.from('competitions').insert(row).select().single());
      },
      async deleteCompetition(id) { ok(await sb.from('competitions').delete().eq('id', id)); },
      async saveTeam(t) {
        if (!String(t.name || '').trim()) throw new Error('Informe o nome do time.');
        const row = pick(t, ['competition_id', 'name', 'color']);
        if (t.id) return ok(await sb.from('teams').update(row).eq('id', t.id).select().single());
        return ok(await sb.from('teams').insert(row).select().single());
      },
      async deleteTeam(id) { ok(await sb.from('teams').delete().eq('id', id)); },
      async saveCompetitor(c) {
        if (!String(c.name || '').trim()) throw new Error('Informe o nome do competidor.');
        if (!c.team_id) throw new Error('Escolha o time do competidor.');
        const row = pick(c, ['competition_id', 'team_id', 'name']);
        if (c.id) return ok(await sb.from('competitors').update(row).eq('id', c.id).select().single());
        return ok(await sb.from('competitors').insert(row).select().single());
      },
      async deleteCompetitor(id) { ok(await sb.from('competitors').delete().eq('id', id)); },
      async saveBracket(competitionId, br) {
        ok(await sb.from('brackets').upsert({
          competition_id: competitionId, slots: br.slots, results: br.results || {},
          generated_at: br.generated_at || now(), updated_at: now(),
        }));
      },
      async deleteBracket(competitionId) { ok(await sb.from('brackets').delete().eq('competition_id', competitionId)); },
      async exportAll() {
        const [c, t, p, b] = await Promise.all(['competitions', 'teams', 'competitors', 'brackets'].map((x) => sb.from(x).select('*')));
        const brackets = {}; ok(b).forEach((r) => { brackets[r.competition_id] = r; });
        return { competitions: ok(c), teams: ok(t), competitors: ok(p), brackets };
      },
      async importAll() { throw new Error('No modo online, importe pelo painel do Supabase (Table Editor → Import).'); },

      async needsSetup() { return false; },
      async setup() {},
      async login(email, pass) {
        const { error } = await sb.auth.signInWithPassword({ email: String(email).trim(), password: pass });
        if (error) throw new Error('E-mail ou senha incorretos.');
      },
      async isLoggedIn() { const { data } = await sb.auth.getSession(); return !!data.session; },
      async logout() { await sb.auth.signOut(); },
      async changePassword(_old, newPass) {
        if (!newPass || newPass.length < 6) throw new Error('A nova senha precisa ter pelo menos 6 caracteres.');
        const { error } = await sb.auth.updateUser({ password: newPass }); if (error) throw new Error(error.message);
      },
      onChange(cb) { setInterval(cb, Math.max(2, Number(CFG.refreshSeconds) || 4) * 1000); },
    };
  }

  const useSupabase = !!(CFG.supabaseUrl && CFG.supabaseAnonKey && window.supabase);
  window.Store = useSupabase ? SupabaseStore() : LocalStore;
})();
