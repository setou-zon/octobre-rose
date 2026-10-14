
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
