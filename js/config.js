/* =========================================================
   CONFIGURAÇÃO
   ---------------------------------------------------------
   MODO LOCAL (padrão): deixe supabaseUrl vazio.
     Os dados ficam salvos no navegador (localStorage).
     Abra o admin e o telão no MESMO navegador/computador
     (ex.: notebook ligado ao projetor). O telão atualiza sozinho.

   MODO ONLINE (Supabase, gratuito): preencha as duas chaves abaixo.
     Os dados ficam num banco PostgreSQL na nuvem e o telão
     pode ser aberto em qualquer dispositivo. Veja o README.md.
   ========================================================= */
window.ARENA_CONFIG = {
  supabaseUrl: '',        // ex.: 'https://abcdefgh.supabase.co'
  supabaseAnonKey: '',    // chave "anon public" do projeto
  refreshSeconds: 4,      // intervalo de atualização do telão no modo online
  appName: 'Arena',

  /* ACESSO ADMIN (modo local). Não existe cadastro pelo site:
     só entra quem tem este usuário e a senha correspondente ao hash.
     Para trocar a senha: Admin → Conta e backup → gere o novo hash
     e substitua a linha adminPassHash abaixo. */
  adminUser: 'admin',
  adminPassHash: 'pbkdf2$210000$72266157a2097e0cabe7fcf86bbb3d1b$33845c7130d31eec7819e4353cde9c42f79c42dcbb8a753ec7cea5e5ac17223f',
};
