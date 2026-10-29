# 🏆 Arena — Sistema de Competição Mata-Mata

Telão público com **ranking por time**, **ranking individual** e **árvore mata-mata estilo Copa do Mundo**, mais um **painel admin com login** para cadastrar competições, times, competidores, sortear confrontos e lançar resultados.

Feito em HTML + CSS + JavaScript puro: não precisa de build, roda direto no **GitHub Pages**.

## Páginas

| Página | Para quê |
|---|---|
| `index.html` | **Telão** (público). Botão *Tela cheia* ou tecla **F**. Atualiza sozinho. |
| `admin/` | **Painel admin** (login e senha). Endereço: `.../admin/` |

## Como funciona

1. **Competição** — crie uma competição (pode ter quantas quiser; cada uma tem seus próprios times, competidores e chave). Defina pontos por vitória e bônus de 1º, 2º e 3º lugar.
2. **Times** — nome + cor (a cor aparece no telão).
3. **Competidores** — cada competidor fica em **um único time**; um time pode ter vários competidores. Dá para colar vários nomes de uma vez (um por linha) e trocar alguém de time depois.
4. **Chaveamento** — clique em **🎲 Gerar tabela e árvore**. O botão vira **Sortear novamente**: sorteie quantas vezes quiser.
5. **Resultados** — na árvore do admin, clique no nome do **vencedor** de cada batalha. Clique de novo para desfazer.
6. No fim acontecem a **final** (1º e 2º) e a **disputa de 3º lugar**.

### Regras
- As batalhas são **individuais**, mas os **pontos vão para o time** do competidor.
- Pontos do competidor = vitórias × *pontos por vitória* + bônus de colocação (1º, 2º, 3º).
- Pontos do time = soma dos pontos dos seus competidores. **O time em 1º lugar é o campeão.**
- Desempate de times: pontos → vitórias → melhor colocação individual.
- **Número de competidores que não fecha a chave** (ímpar, por exemplo): a árvore é montada no tamanho 2, 4, 8, 16, 32… e alguns jogadores ficam **sem batalha na 1ª fase, já classificados** para a próxima (“classificado direto”). Isso só acontece na 1ª fase, garantindo que a semifinal sempre tenha 4 jogadores e exista a disputa de 3º lugar.
- Opção (ligada por padrão): o sorteio evita que colegas do mesmo time se enfrentem na 1ª fase, quando possível.

---

## Banco de dados: dois modos

### Modo 1 — Local (padrão, zero configuração)
Os dados ficam no **navegador** (localStorage).
- **Criar acesso de admin:** na tela de login do admin, clique em *Criar acesso de admin*, escolha usuário e senha (com confirmação) e informe a **senha master**.
- A senha master fica em `js/config.js` apenas como hash PBKDF2 (`masterPassHash`). Para trocá-la, gere um novo hash e substitua essa linha.
- As contas criadas ficam salvas neste navegador (com a senha em hash). Troque a sua senha em *Conta e backup*.
- Abra o **admin e o telão no mesmo computador e navegador** (ex.: o notebook ligado ao projetor/TV: telão numa janela em tela cheia, admin em outra). O telão atualiza na hora.
- Faça **backup** em *Conta e backup → Exportar*.

### Modo 2 — Online com Supabase (gratuito, recomendado para evento)
Banco PostgreSQL na nuvem: o admin pode lançar resultados do celular e o telão em qualquer computador atualiza sozinho.

1. Crie uma conta em [supabase.com](https://supabase.com) e um projeto novo.
2. Vá em **SQL Editor → New query**, cole o conteúdo de [`supabase/schema.sql`](supabase/schema.sql) e clique em **Run**.
3. Em **Authentication → Sign In / Providers**, **desative** “Allow new users to sign up”.
4. Em **Authentication → Users → Add user**, crie o admin (e-mail + senha). Marque “Auto Confirm User”.
5. Em **Project Settings → API**, copie a **Project URL** e a chave **anon public**.
6. Cole as duas em `js/config.js`:
   ```js
   supabaseUrl: 'https://SEU-PROJETO.supabase.co',
   supabaseAnonKey: 'eyJhbGciOi...',
   ```
7. Pronto: o login do admin passa a ser o e-mail/senha do Supabase.

> A chave *anon* é pública por natureza. A segurança vem das regras (RLS) do `schema.sql`: qualquer um pode **ler** (telão), mas só o admin logado pode **escrever**.

---

## Publicar no GitHub Pages

1. Crie um repositório no GitHub (ex.: `arena-competicoes`).
2. Envie todos os arquivos desta pasta para a raiz do repositório:
   ```bash
   git init
   git add .
   git commit -m "Arena: sistema de competição"
   git branch -M main
   git remote add origin https://github.com/SEU-USUARIO/arena-competicoes.git
   git push -u origin main
   ```
3. No repositório: **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main` / `(root)` → Save**.
4. Em 1–2 minutos o site estará em `https://SEU-USUARIO.github.io/arena-competicoes/`
   - Telão: `.../arena-competicoes/`
   - Admin: `.../arena-competicoes/admin/`

Para testar no computador antes de publicar: dê dois cliques em `index.html`, ou rode `python3 -m http.server` na pasta e abra `http://localhost:8000`.

## Estrutura

```
index.html            Telão público
admin/index.html      Painel admin (endereço .../admin/)
admin.html            Redireciona links antigos para admin/
css/style.css         Visual
js/config.js          Configuração (modo local ou Supabase)
js/engine.js          Sorteio, árvore, pontuação e rankings
js/store.js           Camada de dados (localStorage / Supabase)
js/bracket-view.js    Desenho da árvore
js/public.js          Lógica do telão
js/admin.js           Lógica do admin
supabase/schema.sql   Tabelas + regras de segurança
```

## Segurança (importante)
- **Modo local:** a senha fica em `js/config.js` como hash PBKDF2 (210 mil iterações), nunca em texto. Use uma senha forte, porque o repositório é público. Ela protege o painel contra cliques acidentais do público, mas quem tiver acesso ao mesmo computador e souber usar as ferramentas do navegador consegue mexer nos dados. Para um evento com o notebook sob seu controle, é suficiente.
- **Modo Supabase:** autenticação e permissões são verificadas pelo servidor do banco, ou seja, segurança de verdade.
