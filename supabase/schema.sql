-- =========================================================
-- Arena · banco de dados (Supabase / PostgreSQL)
-- Cole este arquivo inteiro em: Supabase → SQL Editor → New query → Run
-- =========================================================

create extension if not exists pgcrypto;

-- Competições (cada uma tem seus times, competidores e chaveamento)
create table if not exists public.competitions (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  description     text default '',
  points_win      int  not null default 3,
  bonus_first     int  not null default 10,
  bonus_second    int  not null default 6,
  bonus_third     int  not null default 4,
  avoid_same_team boolean not null default true,
  created_at      timestamptz not null default now()
);

-- Times (nome + cor)
create table if not exists public.teams (
  id             uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions(id) on delete cascade,
  name           text not null,
  color          text not null default '#7c5cff',
  created_at     timestamptz not null default now()
);
create unique index if not exists teams_unique_name on public.teams (competition_id, lower(name));

-- Competidores: cada um pertence a UM único time (team_id obrigatório)
-- e o nome é único dentro da competição (não pode estar em dois times).
create table if not exists public.competitors (
  id             uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions(id) on delete cascade,
  team_id        uuid not null references public.teams(id) on delete cascade,
  name           text not null,
  created_at     timestamptz not null default now()
);
create unique index if not exists competitors_unique_name on public.competitors (competition_id, lower(name));
create index if not exists competitors_team on public.competitors (team_id);

-- Chaveamento: ordem sorteada da 1ª fase (slots) + vencedores de cada batalha (results)
create table if not exists public.brackets (
  competition_id uuid primary key references public.competitions(id) on delete cascade,
  slots          jsonb not null,
  results        jsonb not null default '{}'::jsonb,
  generated_at   timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ---------------------------------------------------------
-- Segurança (Row Level Security)
-- Leitura pública (telão). Escrita só para usuário logado (admin).
-- IMPORTANTE: em Authentication → Sign In / Providers, DESATIVE
-- "Allow new users to sign up" e crie o admin manualmente em
-- Authentication → Users → Add user.
-- ---------------------------------------------------------
alter table public.competitions enable row level security;
alter table public.teams        enable row level security;
alter table public.competitors  enable row level security;
alter table public.brackets     enable row level security;

do $$
declare t text;
begin
  foreach t in array array['competitions','teams','competitors','brackets'] loop
    execute format('drop policy if exists "leitura publica" on public.%I', t);
    execute format('drop policy if exists "escrita admin" on public.%I', t);
    execute format('create policy "leitura publica" on public.%I for select using (true)', t);
    execute format('create policy "escrita admin" on public.%I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

grant usage on schema public to anon, authenticated;
grant select on public.competitions, public.teams, public.competitors, public.brackets to anon;
grant select, insert, update, delete on public.competitions, public.teams, public.competitors, public.brackets to authenticated;
