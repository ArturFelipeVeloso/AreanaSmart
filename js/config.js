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
};
