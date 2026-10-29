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

  /* ACESSO ADMIN (modo local)
     masterPassHash: hash PBKDF2 da SENHA MASTER, exigida na tela "Criar acesso"
       para cadastrar um novo usuário admin. A senha em si não aparece no código.
     adminUser/adminPassHash: admin fixo opcional (deixe vazio para desativar). */
  masterPassHash: 'pbkdf2$210000$bcbd71788dad3a3db0a340f18afe3fa5$0d4ca90408959c9d5c8ea15ba0eb53b35da4d901640c7779c0b46c59800de3a3',
  adminUser: '',
  adminPassHash: '',
};
