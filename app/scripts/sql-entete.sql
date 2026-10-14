-- =====================================================================
-- Octobre Rose 2026 (ADG) – base centrale
-- Généré par app/scripts/sql.mjs à partir des fiches de l'application.
-- Les fiches sont saisies hors ligne sur les téléphones puis synchronisées ici.
-- =====================================================================

create schema if not exists private;

-- Sites ---------------------------------------------------------------
create table public.sites (
  id smallint primary key,
  code text not null unique check (code ~ '^[A-Z]{2,5}$'),
  nom text not null,
  type text not null default 'communautaire' check (type in ('formation_sanitaire', 'communautaire')),
  created_at timestamptz not null default now()
);
insert into public.sites (id, code, nom, type) values
  (1, 'CBP', 'Clinique Blaise Pascal', 'formation_sanitaire'),
  (2, 'CEN', 'CENOU', 'formation_sanitaire');

-- Comptes : chacun s'inscrit, un administrateur valide ----------------
create table public.profils (
  id uuid primary key references auth.users (id) on delete cascade,
  identifiant text not null unique,
  nom_complet text not null default '',
  telephone text,
  role text not null default 'agent' check (role in ('admin', 'agent')),
  site_id smallint references public.sites (id),
  site_souhaite smallint references public.sites (id),
  valide boolean not null default false,
  actif boolean not null default true,
  created_at timestamptz not null default now()
);
create index on public.profils (site_id);
create index on public.profils (site_souhaite);

-- Cibles des indicateurs ---------------------------------------------
create table public.cibles (
  indicateur text primary key,
  cible integer check (cible >= 0),
  updated_at timestamptz not null default now()
);
insert into public.cibles (indicateur) values
  ('sensibilises_femmes'), ('sensibilises_hommes'), ('seances'), ('examens_seins'), ('depistages_col'),
  ('anomalies_orientees'), ('lesions_traitees'), ('cas_references'), ('references_effectives'),
  ('supports_produits'), ('supports_diffuses'), ('medias'), ('leaders');

-- Fonctions d'accès (schéma privé, non exposé) ------------------------
create or replace function private.est_valide()
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.profils p where p.id = (select auth.uid()) and p.valide and p.actif) $$;

create or replace function private.est_admin()
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.profils p where p.id = (select auth.uid()) and p.valide and p.actif and p.role = 'admin') $$;

-- Fiches nominatives : l'administrateur voit tout, un agent voit son site (ou tout s'il n'a pas de site)
create or replace function private.acces_site(p_site smallint)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.profils p where p.id = (select auth.uid()) and p.valide and p.actif
                      and (p.role = 'admin' or p.site_id is null or p.site_id = p_site)) $$;

grant usage on schema private to authenticated;
grant execute on function private.est_valide(), private.est_admin(), private.acces_site(smallint) to authenticated;
revoke execute on function private.est_valide(), private.est_admin(), private.acces_site(smallint) from anon, public;

-- Profil créé à l'inscription. Le tout premier compte devient administrateur validé.
create or replace function private.creer_profil()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare premier boolean;
begin
  perform pg_advisory_xact_lock(hashtext('octobre-rose-premier-compte'));
  select not exists (select 1 from public.profils) into premier;
  insert into public.profils (id, identifiant, nom_complet, telephone, site_souhaite, role, valide)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'identifiant', ''), split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'nom_complet', ''),
    nullif(new.raw_user_meta_data ->> 'telephone', ''),
    (select s.id from public.sites s where s.id = nullif(new.raw_user_meta_data ->> 'site_souhaite', '')::smallint),
    case when premier then 'admin' else 'agent' end,
    premier
  );
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function private.creer_profil();

-- Heure de réception par le serveur (sert à la synchronisation) ; seul l'admin peut supprimer
create or replace function private.horodater()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.synced_at := clock_timestamp();
  if tg_op = 'INSERT' then new.saisi_par_id := coalesce(new.saisi_par_id, auth.uid()); end if;
  if new.supprime and (tg_op = 'INSERT' or not old.supprime) and not private.est_admin() then
    raise exception 'Seul un administrateur peut supprimer une fiche' using errcode = '42501';
  end if;
  return new;
end;
$$;
