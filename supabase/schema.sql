-- =============================================================================
-- Silavia — schéma Supabase (Postgres)
-- À exécuter en une seule fois dans : Supabase Dashboard > SQL Editor > New query
-- Le script est idempotent : il peut être relancé sans casser les données.
-- =============================================================================

-- Nécessaire pour gen_random_uuid()
create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- Table des leads
-- -----------------------------------------------------------------------------
create table if not exists public.leads (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade default auth.uid(),
  nom         text not null,
  poste       text,
  societe     text,
  lien        text,
  tel         text,
  adresse     text,
  commission  numeric default 0,
  last        date default current_date,
  outreach    boolean not null default false,
  reponse     boolean not null default false,
  rdv         boolean not null default false,
  present     boolean not null default false,
  pitch       boolean not null default false,
  "close"     boolean not null default false,
  created_at  timestamptz default now()
);

-- Sécurité : Row Level Security OBLIGATOIRE.
-- Sans policy correspondante, aucune ligne n'est accessible.
alter table public.leads enable row level security;

-- -----------------------------------------------------------------------------
-- Policies : chaque utilisateur ne voit et ne modifie que ses propres leads.
-- -----------------------------------------------------------------------------
drop policy if exists "leads_select_own" on public.leads;
create policy "leads_select_own"
  on public.leads
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "leads_insert_own" on public.leads;
create policy "leads_insert_own"
  on public.leads
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "leads_update_own" on public.leads;
create policy "leads_update_own"
  on public.leads
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "leads_delete_own" on public.leads;
create policy "leads_delete_own"
  on public.leads
  for delete
  to authenticated
  using (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- Index : lecture des leads d'un utilisateur triés par dernière action
-- -----------------------------------------------------------------------------
create index if not exists leads_user_id_last_idx
  on public.leads (user_id, last desc);

-- Droits d'accès pour les rôles Supabase (la RLS reste le garde-fou).
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.leads to authenticated;
