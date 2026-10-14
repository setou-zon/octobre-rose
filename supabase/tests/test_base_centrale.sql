-- Tests de la base centrale (transaction annulée à la fin)
\set ON_ERROR_STOP 1
begin;
insert into auth.users (id, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-00000000000c', 'coord@x.app', '{"identifiant":"coord","nom_complet":"Awa"}'),
 ('00000000-0000-0000-0000-0000000000a1', 'mariam@x.app', '{"identifiant":"mariam","nom_complet":"Mariam","site_souhaite":"1"}'),
 ('00000000-0000-0000-0000-0000000000a2', 'issa@x.app', '{"identifiant":"issa","nom_complet":"Issa","site_souhaite":"2"}');
do $$ begin
  assert (select role || valide from public.profils where identifiant = 'coord') = 'admintrue', 'premier compte = admin validé';
  assert (select role || valide from public.profils where identifiant = 'mariam') = 'agentfalse', 'inscription en attente';
end $$;

set local role authenticated;
-- Mariam non validée : rien
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
do $$ begin
  begin
    insert into public.seances_sensibilisation (id, date_seance) values (gen_random_uuid(), '2026-10-05');
    raise exception 'ÉCHEC : saisie sans validation';
  exception when insufficient_privilege then null; end;
end $$;
-- Mariam ne peut pas se valider elle-même
update public.profils set valide = true where identifiant = 'mariam';
-- L'admin valide Mariam (site 1) et Issa (site 2)
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', true);
do $$ begin assert (select valide from public.profils where identifiant = 'mariam') = false, 'pas d auto-validation'; end $$;
update public.profils set valide = true, site_id = site_souhaite where identifiant in ('mariam', 'issa');

-- Mariam saisit à CBP
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
insert into public.depistages (id, code, site_id, date_depistage, nom_prenoms, age, consentement, sein_examine, cat_sein, updated_at)
values ('11111111-1111-1111-1111-111111111111', 'OR26-CBP-07-001', 1, '2026-10-07', 'Femme A', 40, true, true, '{mammographie}', now());
insert into public.references_cas (id, numero, depistage_id, structure_destination) values (gen_random_uuid(), 'R26-0001', '11111111-1111-1111-1111-111111111111', 'CHU');
insert into public.seances_sensibilisation (id, date_seance, f_15_24, total_femmes, total) values (gen_random_uuid(), '2026-10-05', 12, 12, 12);
do $$ begin
  begin
    insert into public.depistages (id, code, site_id, nom_prenoms, age, consentement) values (gen_random_uuid(), 'X', 2, 'Hors site', 30, true);
    raise exception 'ÉCHEC : saisie hors site';
  exception when insufficient_privilege then null; end;
  begin
    update public.depistages set supprime = true where code = 'OR26-CBP-07-001';
    raise exception 'ÉCHEC : suppression par un agent';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.depistages (id, code, site_id, nom_prenoms, age, consentement) values (gen_random_uuid(), 'OR26-CBP-07-001', 1, 'Doublon', 30, true);
    raise exception 'ÉCHEC : code en double accepté';
  exception when unique_violation then null; end;
  assert (select saisi_par_id from public.depistages where code = 'OR26-CBP-07-001') = '00000000-0000-0000-0000-0000000000a1', 'saisi_par_id';
end $$;

-- Issa (site 2) ne voit pas les fiches de CBP
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', true);
do $$ begin
  assert (select count(*) from public.depistages) = 0, 'cloisonnement';
  assert (select count(*) from public.references_cas) = 0, 'cloisonnement références';
  assert (select count(*) from public.seances_sensibilisation) = 1, 'sensibilisation partagée';
  assert (select count(*) from public.profils) = 1, 'ne voit que son profil';
end $$;

-- Admin : voit tout, peut supprimer
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', true);
update public.depistages set supprime = true where code = 'OR26-CBP-07-001';
do $$ begin
  assert (select count(*) from public.profils) = 3, 'admin voit les profils';
  assert (select supprime from public.depistages where code = 'OR26-CBP-07-001'), 'suppression admin';
end $$;

-- Anonyme : sites seulement
reset role; set local role anon;
do $$ begin
  assert (select count(*) from public.sites) = 2, 'sites visibles à l inscription';
  begin perform 1 from public.depistages; raise exception 'ÉCHEC : accès anonyme';
  exception when insufficient_privilege then null; end;
end $$;
select 'TOUS LES TESTS PASSENT' as resultat;
rollback;
