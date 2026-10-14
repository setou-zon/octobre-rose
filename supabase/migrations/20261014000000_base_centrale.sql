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

create table public.seances_sensibilisation (
  id uuid primary key,
  saisi_par text,
  modifie_par text,
  saisi_par_id uuid default auth.uid() references public.profils (id) on delete set null,
  supprime boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  synced_at timestamptz not null default now(),
  numero text,
  date_seance date,
  heure_debut time,
  heure_fin time,
  commune text,
  quartier text,
  lieu_type text,
  lieu_autre text,
  lieu_precis text,
  type_activite text,
  langues text[],
  animateurs text,
  nb_leaders numeric,
  noms_leaders text,
  themes text[],
  f_moins15 numeric,
  h_moins15 numeric,
  f_15_24 numeric,
  h_15_24 numeric,
  f_25_49 numeric,
  h_25_49 numeric,
  f_50plus numeric,
  h_50plus numeric,
  nb_intentions_depistage numeric,
  nb_supports_distribues numeric,
  observations text,
  total_femmes integer,
  total_hommes integer,
  total integer
);
create index on public.seances_sensibilisation (synced_at);
create index on public.seances_sensibilisation (saisi_par_id);
create trigger horodatage before insert or update on public.seances_sensibilisation for each row execute function private.horodater();

create table public.depistages (
  id uuid primary key,
  saisi_par text,
  modifie_par text,
  saisi_par_id uuid default auth.uid() references public.profils (id) on delete set null,
  supprime boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  synced_at timestamptz not null default now(),
  site_id smallint references public.sites (id),
  date_depistage date,
  nom_prenoms text,
  age numeric,
  telephone text,
  quartier text,
  situation_matrimoniale text,
  niveau_instruction text,
  sources_info text[],
  consentement boolean,
  atcd_familial text,
  atcd_personnel_cancer text,
  deja_examen_seins text,
  deja_depistage_col text,
  pratique_aes text,
  vaccinee_hpv text,
  vih_positif text,
  menopausee text,
  nb_grossesses numeric,
  allaitement text,
  plaintes text[],
  plainte_autre text,
  sein_examine boolean,
  sd_inspection text,
  sg_inspection text,
  sd_nodule boolean,
  sg_nodule boolean,
  sd_nodule_cm numeric,
  sg_nodule_cm numeric,
  sd_retraction boolean,
  sg_retraction boolean,
  sd_ecoulement boolean,
  sg_ecoulement boolean,
  sd_ecoulement_aspect text,
  sg_ecoulement_aspect text,
  sd_adenopathie boolean,
  sg_adenopathie boolean,
  conclusion_sein text,
  cat_sein text[],
  cat_sein_autre text,
  aes_enseigne boolean,
  col_realise boolean,
  motif_non_col text,
  methode_col text,
  resultat_col text,
  resultat_hpv text,
  eligible_traitement text,
  traitement_col text,
  suite_col text,
  date_rdv_controle date,
  conseils text[],
  decision_finale text,
  prestataire text,
  qualification text,
  observations text,
  code text,
  numero_ordre integer,
  code_initial text
);
create index on public.depistages (synced_at);
create index on public.depistages (saisi_par_id);
create index on public.depistages (site_id);
create trigger horodatage before insert or update on public.depistages for each row execute function private.horodater();

create table public.references_cas (
  id uuid primary key,
  saisi_par text,
  modifie_par text,
  saisi_par_id uuid default auth.uid() references public.profils (id) on delete set null,
  supprime boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  synced_at timestamptz not null default now(),
  date_reference date,
  structure_destination text,
  services text[],
  service_autre text,
  motifs text[],
  motif_autre text,
  resume_constatations text,
  gestes_realises text,
  urgence text,
  prestataire text,
  relance_j7_date date,
  relance_j7_resultat text,
  relance_j21_date date,
  relance_j21_resultat text,
  recue text,
  obstacles text[],
  obstacle_autre text,
  cr_recue boolean,
  cr_date_reception date,
  cr_examens text[],
  cr_diagnostic text,
  cr_prise_en_charge text,
  cr_recommandations text,
  cr_signataire text,
  numero text,
  depistage_id uuid not null references public.depistages (id) on delete cascade,
  code_initial text
);
create index on public.references_cas (synced_at);
create index on public.references_cas (saisi_par_id);
create index on public.references_cas (depistage_id);
create trigger horodatage before insert or update on public.references_cas for each row execute function private.horodater();

create table public.supports_communication (
  id uuid primary key,
  saisi_par text,
  modifie_par text,
  saisi_par_id uuid default auth.uid() references public.profils (id) on delete set null,
  supprime boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  synced_at timestamptz not null default now(),
  type_support text,
  type_autre text,
  qte_produite numeric,
  qte_diffusee numeric,
  lieux_canaux text,
  periode text
);
create index on public.supports_communication (synced_at);
create index on public.supports_communication (saisi_par_id);
create trigger horodatage before insert or update on public.supports_communication for each row execute function private.horodater();

create table public.activites_medias (
  id uuid primary key,
  saisi_par text,
  modifie_par text,
  saisi_par_id uuid default auth.uid() references public.profils (id) on delete set null,
  supprime boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  synced_at timestamptz not null default now(),
  date_activite date,
  media text,
  type_media text,
  format text,
  langue text,
  duree_diffusions text,
  portee_estimee numeric,
  commentaire text
);
create index on public.activites_medias (synced_at);
create index on public.activites_medias (saisi_par_id);
create trigger horodatage before insert or update on public.activites_medias for each row execute function private.horodater();

create table public.leaders_impliques (
  id uuid primary key,
  saisi_par text,
  modifie_par text,
  saisi_par_id uuid default auth.uid() references public.profils (id) on delete set null,
  supprime boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  synced_at timestamptz not null default now(),
  nom text,
  categorie text,
  localite text,
  telephone text,
  roles text[]
);
create index on public.leaders_impliques (synced_at);
create index on public.leaders_impliques (saisi_par_id);
create trigger horodatage before insert or update on public.leaders_impliques for each row execute function private.horodater();

create table public.syntheses_journalieres (
  id uuid primary key,
  saisi_par text,
  modifie_par text,
  saisi_par_id uuid default auth.uid() references public.profils (id) on delete set null,
  supprime boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  synced_at timestamptz not null default now(),
  site_id smallint references public.sites (id),
  date_synthese date,
  ruptures text,
  temps_attente_min numeric,
  non_recues numeric,
  difficultes text,
  responsable text
);
create index on public.syntheses_journalieres (synced_at);
create index on public.syntheses_journalieres (saisi_par_id);
create index on public.syntheses_journalieres (site_id);
create trigger horodatage before insert or update on public.syntheses_journalieres for each row execute function private.horodater();

-- Codes uniques (une fiche renumérotée garde son code d'origine dans code_initial)
create unique index depistages_code_unique on public.depistages (code);
create unique index references_numero_unique on public.references_cas (numero);

-- =====================================================================
-- Règles d'accès (RLS)
-- =====================================================================
alter table public.sites enable row level security;
alter table public.profils enable row level security;
alter table public.cibles enable row level security;

revoke all on all tables in schema public from anon;
grant select on public.sites to anon;

-- Sites : visibles par tous (liste du formulaire d'inscription) ; gérés par l'admin
create policy lecture on public.sites for select to anon, authenticated using (true);
create policy ajout on public.sites for insert to authenticated with check ((select private.est_admin()));
create policy modification on public.sites for update to authenticated using ((select private.est_admin())) with check ((select private.est_admin()));

-- Profils : chacun voit le sien ; l'admin voit et valide tout le monde
create policy lecture on public.profils for select to authenticated using (id = (select auth.uid()) or (select private.est_admin()));
create policy validation on public.profils for update to authenticated using ((select private.est_admin())) with check ((select private.est_admin()));

-- Cibles
create policy lecture on public.cibles for select to authenticated using ((select private.est_valide()));
create policy modification on public.cibles for update to authenticated using ((select private.est_admin())) with check ((select private.est_admin()));

do $$
declare t text;
begin
  -- Tables sans données nominatives : tout le personnel validé
  foreach t in array array['seances_sensibilisation', 'supports_communication', 'activites_medias', 'leaders_impliques'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy lecture on public.%I for select to authenticated using ((select private.est_valide()))', t);
    execute format('create policy saisie on public.%I for insert to authenticated with check ((select private.est_valide()))', t);
    execute format('create policy modification on public.%I for update to authenticated using ((select private.est_valide())) with check ((select private.est_valide()))', t);
  end loop;
  -- Tables par site
  foreach t in array array['depistages', 'syntheses_journalieres'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy lecture on public.%I for select to authenticated using ((select private.acces_site(site_id)))', t);
    execute format('create policy saisie on public.%I for insert to authenticated with check ((select private.acces_site(site_id)))', t);
    execute format('create policy modification on public.%I for update to authenticated using ((select private.acces_site(site_id))) with check ((select private.acces_site(site_id)))', t);
  end loop;
end $$;

-- Références : suivent les droits de la bénéficiaire
alter table public.references_cas enable row level security;
create policy lecture on public.references_cas for select to authenticated
  using (exists (select 1 from public.depistages d where d.id = depistage_id));
create policy saisie on public.references_cas for insert to authenticated
  with check (exists (select 1 from public.depistages d where d.id = depistage_id));
create policy modification on public.references_cas for update to authenticated
  using (exists (select 1 from public.depistages d where d.id = depistage_id))
  with check (exists (select 1 from public.depistages d where d.id = depistage_id));

-- Pas de suppression physique : les suppressions passent par « supprime = true » (admin)
