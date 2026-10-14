-- =====================================================================
-- Campagne Octobre Rose 2026 – ADG
-- Base de données des outils de collecte (outils 1 à 8)
-- =====================================================================
-- Tables : sites, profils, seances_sensibilisation (outil 1),
--          depistages (outil 2), references_cas (outils 4 et 5),
--          supports_communication (6a), activites_medias (6b),
--          leaders_impliques (6c), syntheses_journalieres (7), cibles (8)
-- Vues   : v_registre_depistage (outil 3), v_synthese_journaliere (7),
--          v_indicateurs (8), v_taux (8)
-- Sécurité : RLS sur toutes les tables ; seul le personnel validé
--            par la coordination accède aux données.
-- =====================================================================

create schema if not exists private;

-- ---------------------------------------------------------------------
-- Référentiels
-- ---------------------------------------------------------------------
create table public.sites (
  id         smallint generated always as identity primary key,
  code       text not null unique check (code ~ '^[A-Z]{2,5}$'),
  nom        text not null,
  type       text not null default 'formation_sanitaire'
             check (type in ('formation_sanitaire', 'communautaire')),
  actif      boolean not null default true,
  created_at timestamptz not null default now()
);
comment on table public.sites is 'Sites de dépistage et de sensibilisation (code utilisé dans le code bénéficiaire)';

insert into public.sites (code, nom, type) values
  ('CBP', 'Clinique Blaise Pascal', 'formation_sanitaire'),
  ('CEN', 'CENOU', 'formation_sanitaire');

create table public.profils (
  id          uuid primary key references auth.users (id) on delete cascade,
  nom_complet text not null default '',
  email       text,
  role        text not null default 'agent'
              check (role in ('agent', 'responsable_site', 'coordination')),
  site_id     smallint references public.sites (id),
  valide      boolean not null default false,
  created_at  timestamptz not null default now()
);
comment on table public.profils is 'Membres de l''équipe. Un compte n''accède aux données qu''une fois validé par la coordination.';

-- ---------------------------------------------------------------------
-- Fonctions d'aide aux règles d'accès (schéma privé, non exposé par l'API)
-- ---------------------------------------------------------------------
create or replace function private.est_personnel()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.profils p
                 where p.id = (select auth.uid()) and p.valide);
$$;

create or replace function private.est_coordination()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.profils p
                 where p.id = (select auth.uid()) and p.valide
                   and p.role = 'coordination');
$$;

-- Vrai si l'utilisateur peut voir les données nominatives du site donné :
-- la coordination voit tout ; les autres voient leur site (ou tout s'ils n'ont pas de site).
create or replace function private.acces_site(p_site smallint)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.profils p
                 where p.id = (select auth.uid()) and p.valide
                   and (p.role = 'coordination' or p.site_id is null or p.site_id = p_site));
$$;

grant usage on schema private to authenticated;
grant execute on function private.est_personnel(), private.est_coordination(),
  private.acces_site(smallint) to authenticated;
revoke execute on function private.est_personnel(), private.est_coordination(),
  private.acces_site(smallint) from anon, public;

-- Création automatique du profil à l'inscription
create or replace function private.creer_profil()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profils (id, email, nom_complet)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'nom_complet', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.creer_profil();

-- Horodatage de mise à jour
create or replace function private.maj_updated_at()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Outil 1 – Registre des séances de sensibilisation
-- ---------------------------------------------------------------------
create table public.seances_sensibilisation (
  id             uuid primary key default gen_random_uuid(),
  numero         text,
  date_seance    date not null,
  heure_debut    time,
  heure_fin      time,
  commune        text,
  quartier       text,
  lieu_precis    text,
  lieu_type      text not null check (lieu_type in
                 ('quartier', 'marche', 'ecole', 'lieu_culte', 'centre_communautaire', 'autre')),
  lieu_autre     text,
  type_activite  text not null check (type_activite in
                 ('causerie', 'session_information', 'demonstration_aes', 'animation_masse')),
  langues        text[] not null default '{}',
  animateurs     text,
  nb_leaders     integer not null default 0 check (nb_leaders >= 0),
  noms_leaders   text,
  themes         text[] not null default '{}',
  f_moins15      integer not null default 0 check (f_moins15 >= 0),
  h_moins15      integer not null default 0 check (h_moins15 >= 0),
  f_15_24        integer not null default 0 check (f_15_24 >= 0),
  h_15_24        integer not null default 0 check (h_15_24 >= 0),
  f_25_49        integer not null default 0 check (f_25_49 >= 0),
  h_25_49        integer not null default 0 check (h_25_49 >= 0),
  f_50plus       integer not null default 0 check (f_50plus >= 0),
  h_50plus       integer not null default 0 check (h_50plus >= 0),
  total_femmes   integer generated always as (f_moins15 + f_15_24 + f_25_49 + f_50plus) stored,
  total_hommes   integer generated always as (h_moins15 + h_15_24 + h_25_49 + h_50plus) stored,
  total          integer generated always as
                 (f_moins15 + f_15_24 + f_25_49 + f_50plus + h_moins15 + h_15_24 + h_25_49 + h_50plus) stored,
  nb_intentions_depistage integer not null default 0 check (nb_intentions_depistage >= 0),
  nb_supports_distribues  integer not null default 0 check (nb_supports_distribues >= 0),
  observations   text,
  saisi_par      uuid default auth.uid() references public.profils (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index on public.seances_sensibilisation (date_seance);
create index on public.seances_sensibilisation (saisi_par);
create trigger maj before update on public.seances_sensibilisation
  for each row execute function private.maj_updated_at();

-- ---------------------------------------------------------------------
-- Outil 2 – Fiche individuelle de dépistage (données nominatives)
-- ---------------------------------------------------------------------
create table public.depistages (
  id                  uuid primary key default gen_random_uuid(),
  code                text unique,             -- OR26-CBP-07-015, calculé
  site_id             smallint not null references public.sites (id),
  date_depistage      date not null default current_date,
  numero_ordre        integer,                 -- calculé
  -- Section A – Accueil
  nom_prenoms         text not null,
  age                 integer not null check (age between 9 and 110),
  telephone           text,
  quartier            text,
  situation_matrimoniale text check (situation_matrimoniale in
                      ('celibataire', 'mariee', 'veuve', 'divorcee')),
  niveau_instruction  text check (niveau_instruction in
                      ('aucun', 'primaire', 'secondaire', 'superieur')),
  sources_info        text[] not null default '{}',
  consentement        boolean not null,
  -- Section B – Antécédents
  atcd_familial       text check (atcd_familial in ('oui', 'non', 'nsp')),
  atcd_personnel_cancer text check (atcd_personnel_cancer in ('oui', 'non', 'nsp')),
  deja_examen_seins   text check (deja_examen_seins in ('oui', 'non', 'nsp')),
  deja_depistage_col  text check (deja_depistage_col in ('oui', 'non', 'nsp')),
  pratique_aes        text check (pratique_aes in ('oui', 'non', 'nsp')),
  vaccinee_hpv        text check (vaccinee_hpv in ('oui', 'non', 'nsp')),
  vih_positif         text check (vih_positif in ('oui', 'non', 'nsp')),
  menopausee          text check (menopausee in ('oui', 'non', 'nsp')),
  nb_grossesses       integer check (nb_grossesses between 0 and 30),
  allaitement         text check (allaitement in ('oui', 'non', 'jamais')),
  plaintes            text[] not null default '{}',
  plainte_autre       text,
  -- Section C – Examen clinique des seins
  sein_examine        boolean not null default false,
  sd_inspection       text check (sd_inspection in ('normale', 'anormale')),
  sg_inspection       text check (sg_inspection in ('normale', 'anormale')),
  sd_nodule           boolean,
  sd_nodule_cm        numeric(4, 1) check (sd_nodule_cm > 0),
  sg_nodule           boolean,
  sg_nodule_cm        numeric(4, 1) check (sg_nodule_cm > 0),
  sd_retraction       boolean,
  sg_retraction       boolean,
  sd_ecoulement       boolean,
  sd_ecoulement_aspect text,
  sg_ecoulement       boolean,
  sg_ecoulement_aspect text,
  sd_adenopathie      boolean,
  sg_adenopathie      boolean,
  conclusion_sein     text check (conclusion_sein in ('normal', 'benigne', 'suspecte')),
  cat_sein            text[] not null default '{}',
  cat_sein_autre      text,
  aes_enseigne        boolean,
  -- Section D – Dépistage du col
  col_realise         boolean not null default false,
  motif_non_col       text check (motif_non_col in
                      ('refus', 'regles', 'grossesse', 'hors_age', 'rupture_intrants', 'autre')),
  methode_col         text check (methode_col in ('IVA', 'IVL', 'HPV', 'frottis', 'autre')),
  resultat_col        text check (resultat_col in
                      ('negatif', 'positif', 'suspicion_cancer', 'non_concluant')),
  resultat_hpv        text check (resultat_hpv in ('negatif', 'positif', 'en_attente')),
  eligible_traitement text check (eligible_traitement in ('oui', 'non', 'na')),
  traitement_col      text check (traitement_col in
                      ('thermocoagulation', 'cryotherapie', 'rad_leep', 'non_realise')),
  suite_col           text check (suite_col in ('referee', 'rdv_controle')),
  date_rdv_controle   date,
  -- Section E – Conseil et orientation
  conseils            text[] not null default '{}',
  decision_finale     text check (decision_finale in
                      ('aucune', 'controle', 'ref_sein', 'ref_col', 'ref_deux')),
  prestataire         text,
  qualification       text check (qualification in
                      ('medecin', 'sage_femme', 'infirmier', 'autre')),
  observations        text,
  saisi_par           uuid default auth.uid() references public.profils (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint examen_avec_consentement
    check (consentement or (not sein_examine and not col_realise)),
  constraint col_resultat_si_realise
    check (col_realise or resultat_col is null)
);
create index on public.depistages (site_id, date_depistage);
create index on public.depistages (saisi_par);
create unique index depistages_site_date_ordre on public.depistages (site_id, date_depistage, numero_ordre);

-- Numéro d'ordre et code bénéficiaire automatiques : OR26-[Site]-[Jour]-[N°]
create or replace function private.attribuer_code_depistage()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_code_site text;
begin
  select code into v_code_site from public.sites where id = new.site_id;
  -- verrou par site et par jour pour éviter deux numéros identiques
  perform pg_advisory_xact_lock(hashtext('depistage-' || new.site_id || '-' || new.date_depistage));
  select coalesce(max(numero_ordre), 0) + 1 into new.numero_ordre
    from public.depistages
   where site_id = new.site_id and date_depistage = new.date_depistage;
  new.code := 'OR' || to_char(new.date_depistage, 'YY') || '-' || v_code_site || '-'
              || to_char(new.date_depistage, 'DD') || '-' || lpad(new.numero_ordre::text, 3, '0');
  return new;
end;
$$;

create trigger code_depistage before insert on public.depistages
  for each row execute function private.attribuer_code_depistage();

-- Le code, le site, la date et le numéro ne changent plus après création
create or replace function private.figer_code_depistage()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.code := old.code;
  new.numero_ordre := old.numero_ordre;
  new.site_id := old.site_id;
  new.date_depistage := old.date_depistage;
  new.updated_at := now();
  return new;
end;
$$;

create trigger figer_code before update on public.depistages
  for each row execute function private.figer_code_depistage();

-- ---------------------------------------------------------------------
-- Outils 4 et 5 – Référence / contre-référence et suivi des références
-- ---------------------------------------------------------------------
create sequence public.references_numero_seq;

create table public.references_cas (
  id                    uuid primary key default gen_random_uuid(),
  numero                text unique,               -- R26-0001, calculé
  depistage_id          uuid not null references public.depistages (id) on delete cascade,
  date_reference        date not null default current_date,
  structure_destination text not null,
  services              text[] not null default '{}',
  service_autre         text,
  motifs                text[] not null default '{}',
  motif_autre           text,
  resume_constatations  text,
  gestes_realises       text,
  urgence               text not null default 'prioritaire'
                        check (urgence in ('urgent', 'prioritaire', 'non_urgent')),
  prestataire           text,
  -- Suivi (outil 5)
  relance_j7_date       date,
  relance_j7_resultat   text,
  relance_j21_date      date,
  relance_j21_resultat  text,
  recue                 text not null default 'inconnu' check (recue in ('oui', 'non', 'inconnu')),
  obstacles             text[] not null default '{}',
  obstacle_autre        text,
  -- Contre-référence (volet 2)
  cr_recue              boolean not null default false,
  cr_date_reception     date,
  cr_examens            text[] not null default '{}',
  cr_diagnostic         text check (cr_diagnostic in ('benin', 'precancereux', 'cancer', 'en_attente')),
  cr_prise_en_charge    text,
  cr_recommandations    text,
  cr_signataire         text,
  saisi_par             uuid default auth.uid() references public.profils (id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index on public.references_cas (depistage_id);
create index on public.references_cas (saisi_par);

create or replace function private.attribuer_numero_reference()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  new.numero := 'R' || to_char(new.date_reference, 'YY') || '-'
                || lpad(nextval('public.references_numero_seq')::text, 4, '0');
  return new;
end;
$$;

create trigger numero_reference before insert on public.references_cas
  for each row execute function private.attribuer_numero_reference();

create or replace function private.figer_numero_reference()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.numero := old.numero;
  new.depistage_id := old.depistage_id;
  new.updated_at := now();
  return new;
end;
$$;

create trigger figer_numero before update on public.references_cas
  for each row execute function private.figer_numero_reference();

-- ---------------------------------------------------------------------
-- Outil 6 – Supports, médias et leaders
-- ---------------------------------------------------------------------
create table public.supports_communication (
  id              uuid primary key default gen_random_uuid(),
  type_support    text not null check (type_support in
                  ('affiche', 'banderole', 'depliant', 'capsule_video', 'message_whatsapp',
                   'publication_reseaux', 'autre')),
  type_autre      text,
  qte_produite    integer not null default 0 check (qte_produite >= 0),
  qte_diffusee    integer not null default 0 check (qte_diffusee >= 0),
  lieux_canaux    text,
  periode         text,
  saisi_par       uuid default auth.uid() references public.profils (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index on public.supports_communication (saisi_par);
create trigger maj before update on public.supports_communication
  for each row execute function private.maj_updated_at();

create table public.activites_medias (
  id               uuid primary key default gen_random_uuid(),
  date_activite    date not null,
  media            text not null,
  type_media       text not null check (type_media in ('radio', 'television', 'presse', 'en_ligne')),
  format           text check (format in ('emission', 'spot', 'reportage', 'interview', 'publication', 'autre')),
  langue           text,
  duree_diffusions text,
  portee_estimee   integer check (portee_estimee >= 0),
  commentaire      text,
  saisi_par        uuid default auth.uid() references public.profils (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index on public.activites_medias (saisi_par);
create trigger maj before update on public.activites_medias
  for each row execute function private.maj_updated_at();

create table public.leaders_impliques (
  id          uuid primary key default gen_random_uuid(),
  nom         text not null,
  categorie   text not null check (categorie in
              ('religieux', 'coutumier', 'communautaire', 'association', 'influenceur')),
  localite    text,
  roles       text[] not null default '{}',
  telephone   text,
  saisi_par   uuid default auth.uid() references public.profils (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index on public.leaders_impliques (saisi_par);
create trigger maj before update on public.leaders_impliques
  for each row execute function private.maj_updated_at();

-- ---------------------------------------------------------------------
-- Outil 7 – Logistique et difficultés du jour (les chiffres viennent de la vue)
-- ---------------------------------------------------------------------
create table public.syntheses_journalieres (
  id                   uuid primary key default gen_random_uuid(),
  site_id              smallint not null references public.sites (id),
  date_synthese        date not null,
  ruptures             text,
  temps_attente_min    integer check (temps_attente_min >= 0),
  non_recues           integer not null default 0 check (non_recues >= 0),
  difficultes          text,
  responsable          text,
  saisi_par            uuid default auth.uid() references public.profils (id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (site_id, date_synthese)
);
create index on public.syntheses_journalieres (saisi_par);
create trigger maj before update on public.syntheses_journalieres
  for each row execute function private.maj_updated_at();

-- ---------------------------------------------------------------------
-- Outil 8 – Cibles des indicateurs
-- ---------------------------------------------------------------------
create table public.cibles (
  indicateur text primary key,
  cible      integer check (cible >= 0),
  updated_at timestamptz not null default now()
);
insert into public.cibles (indicateur) values
  ('sensibilises_femmes'), ('sensibilises_hommes'), ('seances'),
  ('examens_seins'), ('depistages_col'), ('anomalies_orientees'),
  ('lesions_traitees'), ('cas_references'), ('references_effectives'),
  ('supports_produits'), ('supports_diffuses'), ('medias'), ('leaders');

-- ---------------------------------------------------------------------
-- Vues de restitution (respectent les droits de l'utilisateur)
-- ---------------------------------------------------------------------

-- Outil 3 – Registre journalier, sans nom ni téléphone
create view public.v_registre_depistage with (security_invoker = true) as
select d.id, d.code, d.site_id, s.code as site_code, s.nom as site_nom, d.date_depistage, d.numero_ordre, d.age,
       (d.deja_examen_seins = 'non') as premier_depistage_sein,
       case when not d.sein_examine then 'NF'
            when d.conclusion_sein = 'suspecte' then 'S'
            when d.conclusion_sein = 'benigne' then 'A'
            else 'N' end as examen_seins,
       array_to_string(array(select unnest(d.cat_sein) intersect
                             select unnest(array['echographie', 'mammographie'])), ' / ') as examen_complementaire,
       (d.deja_depistage_col = 'non') as premier_depistage_col,
       case when d.col_realise then d.methode_col else 'NF' end as methode_col,
       case d.resultat_col when 'negatif' then 'N' when 'positif' then 'A'
            when 'suspicion_cancer' then 'S' when 'non_concluant' then '?' end as resultat_col,
       case d.traitement_col when 'thermocoagulation' then 'Thermo'
            when 'cryotherapie' then 'Cryo' when 'rad_leep' then 'RAD/LEEP' end as traitement,
       case d.decision_finale when 'ref_sein' then 'Sein' when 'ref_col' then 'Col'
            when 'ref_deux' then 'Les deux' end as referee,
       (select string_agg(r.numero, ', ' order by r.numero)
          from public.references_cas r where r.depistage_id = d.id) as numeros_reference,
       d.observations
  from public.depistages d
  join public.sites s on s.id = d.site_id;

-- Outil 7 – Synthèse journalière par site et tranche d'âge
create view public.v_synthese_journaliere with (security_invoker = true) as
select s.code as site_code, s.nom as site_nom, d.site_id, d.date_depistage,
       case when d.age < 25 then 'moins_25' when d.age < 50 then '25_49' else '50_plus' end as tranche_age,
       count(*)                                                              as accueillies,
       count(*) filter (where d.sein_examine)                                as examens_seins,
       count(*) filter (where d.sein_examine and d.deja_examen_seins = 'non') as premiers_examens_seins,
       count(*) filter (where d.conclusion_sein = 'suspecte')                as anomalies_suspectes,
       count(*) filter (where d.cat_sein && array['echographie', 'mammographie']) as orientees_imagerie,
       count(*) filter (where d.col_realise)                                 as depistages_col,
       count(*) filter (where d.col_realise and d.deja_depistage_col = 'non') as premiers_depistages_col,
       count(*) filter (where d.resultat_col = 'positif')                    as lesions_precancereuses,
       count(*) filter (where d.resultat_col = 'suspicion_cancer')           as suspicions_cancer_col,
       count(*) filter (where d.traitement_col in ('thermocoagulation', 'cryotherapie', 'rad_leep')) as lesions_traitees,
       count(*) filter (where d.decision_finale in ('ref_sein', 'ref_col', 'ref_deux')) as referees,
       count(*) filter (where not d.consentement or d.motif_non_col = 'refus') as refus
  from public.depistages d
  join public.sites s on s.id = d.site_id
 group by s.code, s.nom, d.site_id, d.date_depistage, tranche_age;

-- Outil 8 – Synthèse finale des indicateurs TDR
create view public.v_indicateurs with (security_invoker = true) as
with r as (
  select 1 as ordre, 'sensibilises_femmes' as indicateur, 'Personnes sensibilisées – femmes' as libelle,
         'Outil 1' as source, (select coalesce(sum(total_femmes), 0) from public.seances_sensibilisation) as realise
  union all select 2, 'sensibilises_hommes', 'Personnes sensibilisées – hommes', 'Outil 1',
         (select coalesce(sum(total_hommes), 0) from public.seances_sensibilisation)
  union all select 3, 'seances', 'Séances de sensibilisation réalisées', 'Outil 1',
         (select count(*) from public.seances_sensibilisation)
  union all select 4, 'examens_seins', 'Femmes ayant eu un examen clinique des seins ou une orientation', 'Outil 7',
         (select count(*) from public.depistages where sein_examine or cardinality(cat_sein) > 0)
  union all select 5, 'depistages_col', 'Femmes dépistées pour le cancer du col', 'Outil 7',
         (select count(*) from public.depistages where col_realise)
  union all select 6, 'anomalies_orientees', 'Femmes avec lésions précancéreuses ou anomalies orientées', 'Outils 3 et 7',
         (select count(*) from public.depistages
           where (conclusion_sein in ('benigne', 'suspecte') or resultat_col in ('positif', 'suspicion_cancer'))
             and (decision_finale in ('controle', 'ref_sein', 'ref_col', 'ref_deux')
                  or traitement_col in ('thermocoagulation', 'cryotherapie', 'rad_leep')
                  or cardinality(cat_sein) > 0))
  union all select 7, 'lesions_traitees', 'Lésions précancéreuses traitées sur place', 'Outil 7',
         (select count(*) from public.depistages
           where traitement_col in ('thermocoagulation', 'cryotherapie', 'rad_leep'))
  union all select 8, 'cas_references', 'Cas suspects référés vers une structure sanitaire', 'Outils 4 et 5',
         (select count(distinct depistage_id) from public.references_cas)
  union all select 9, 'references_effectives', 'Références effectives (reçues à la structure)', 'Outil 5',
         (select count(distinct depistage_id) from public.references_cas where recue = 'oui')
  union all select 10, 'supports_produits', 'Supports de communication produits', 'Outil 6a',
         (select coalesce(sum(qte_produite), 0) from public.supports_communication)
  union all select 11, 'supports_diffuses', 'Supports de communication diffusés', 'Outil 6a',
         (select coalesce(sum(qte_diffusee), 0) from public.supports_communication)
  union all select 12, 'medias', 'Médias impliqués', 'Outil 6b',
         (select count(distinct lower(trim(media))) from public.activites_medias)
  union all select 13, 'leaders', 'Leaders communautaires impliqués', 'Outil 6c',
         (select count(*) from public.leaders_impliques)
)
select r.ordre, r.indicateur, r.libelle, r.source, c.cible, r.realise::integer as realise,
       case when c.cible > 0 then round(100.0 * r.realise / c.cible, 1) end as taux
  from r left join public.cibles c using (indicateur)
 order by r.ordre;

-- Outil 8 – Taux à calculer pour le rapport
create view public.v_taux with (security_invoker = true) as
with d as (
  select count(*) filter (where col_realise) as col,
         count(*) filter (where resultat_col = 'positif') as positifs,
         count(*) filter (where eligible_traitement = 'oui') as eligibles,
         count(*) filter (where traitement_col in ('thermocoagulation', 'cryotherapie', 'rad_leep')) as traitees,
         count(*) filter (where sein_examine) as seins,
         count(*) filter (where conclusion_sein = 'suspecte') as suspectes
    from public.depistages
), r as (
  select count(distinct depistage_id) as referees,
         count(distinct depistage_id) filter (where recue = 'oui') as recues
    from public.references_cas
)
select 1 as ordre, 'Taux de positivité au dépistage du col' as libelle,
       d.positifs as numerateur, d.col as denominateur,
       round(100.0 * d.positifs / nullif(d.col, 0), 1) as taux from d
union all
select 2, 'Taux de traitement immédiat des lésions éligibles', d.traitees, d.eligibles,
       round(100.0 * d.traitees / nullif(d.eligibles, 0), 1) from d
union all
select 3, 'Taux d''anomalies mammaires suspectes', d.suspectes, d.seins,
       round(100.0 * d.suspectes / nullif(d.seins, 0), 1) from d
union all
select 4, 'Taux de références effectives', r.recues, r.referees,
       round(100.0 * r.recues / nullif(r.referees, 0), 1) from r;

-- ---------------------------------------------------------------------
-- Règles d'accès (RLS)
-- ---------------------------------------------------------------------
alter table public.sites                   enable row level security;
alter table public.profils                 enable row level security;
alter table public.seances_sensibilisation enable row level security;
alter table public.depistages              enable row level security;
alter table public.references_cas          enable row level security;
alter table public.supports_communication  enable row level security;
alter table public.activites_medias        enable row level security;
alter table public.leaders_impliques       enable row level security;
alter table public.syntheses_journalieres  enable row level security;
alter table public.cibles                  enable row level security;

-- Aucun accès anonyme
revoke all on all tables in schema public from anon;
revoke all on sequence public.references_numero_seq from anon;
grant usage on sequence public.references_numero_seq to authenticated;

-- Sites : lecture par le personnel, gestion par la coordination
create policy sites_lecture on public.sites for select to authenticated
  using ((select private.est_personnel()));
create policy sites_gestion on public.sites for all to authenticated
  using ((select private.est_coordination())) with check ((select private.est_coordination()));

-- Profils : chacun voit le sien ; la coordination voit et valide tout le monde
create policy profils_lecture on public.profils for select to authenticated
  using (id = (select auth.uid()) or (select private.est_coordination()));
create policy profils_gestion on public.profils for update to authenticated
  using ((select private.est_coordination())) with check ((select private.est_coordination()));

-- Tables non nominatives : tout le personnel lit et saisit ; suppression par la coordination
do $$
declare t text;
begin
  foreach t in array array['seances_sensibilisation', 'supports_communication',
                           'activites_medias', 'leaders_impliques']
  loop
    execute format('create policy lecture on public.%I for select to authenticated using ((select private.est_personnel()))', t);
    execute format('create policy saisie on public.%I for insert to authenticated with check ((select private.est_personnel()))', t);
    execute format('create policy modification on public.%I for update to authenticated using ((select private.est_personnel())) with check ((select private.est_personnel()))', t);
    execute format('create policy suppression on public.%I for delete to authenticated using ((select private.est_coordination()))', t);
  end loop;
end $$;

-- Dépistages (nominatifs) : limités au site de l'agent, sauf coordination
create policy lecture on public.depistages for select to authenticated
  using ((select private.acces_site(site_id)));
create policy saisie on public.depistages for insert to authenticated
  with check ((select private.acces_site(site_id)));
create policy modification on public.depistages for update to authenticated
  using ((select private.acces_site(site_id))) with check ((select private.acces_site(site_id)));
create policy suppression on public.depistages for delete to authenticated
  using ((select private.est_coordination()));

-- Références : suivent les droits du dépistage concerné
create policy lecture on public.references_cas for select to authenticated
  using (exists (select 1 from public.depistages d where d.id = depistage_id));
create policy saisie on public.references_cas for insert to authenticated
  with check (exists (select 1 from public.depistages d where d.id = depistage_id));
create policy modification on public.references_cas for update to authenticated
  using (exists (select 1 from public.depistages d where d.id = depistage_id))
  with check (exists (select 1 from public.depistages d where d.id = depistage_id));
create policy suppression on public.references_cas for delete to authenticated
  using ((select private.est_coordination()));

-- Synthèses journalières : par site
create policy lecture on public.syntheses_journalieres for select to authenticated
  using ((select private.acces_site(site_id)));
create policy saisie on public.syntheses_journalieres for insert to authenticated
  with check ((select private.acces_site(site_id)));
create policy modification on public.syntheses_journalieres for update to authenticated
  using ((select private.acces_site(site_id))) with check ((select private.acces_site(site_id)));
create policy suppression on public.syntheses_journalieres for delete to authenticated
  using ((select private.est_coordination()));

-- Cibles : lecture par le personnel, modification par la coordination
create policy lecture on public.cibles for select to authenticated
  using ((select private.est_personnel()));
create policy gestion on public.cibles for update to authenticated
  using ((select private.est_coordination())) with check ((select private.est_coordination()));

revoke all on public.v_registre_depistage, public.v_synthese_journaliere,
  public.v_indicateurs, public.v_taux from anon;
grant select on public.v_registre_depistage, public.v_synthese_journaliere,
  public.v_indicateurs, public.v_taux to authenticated;
