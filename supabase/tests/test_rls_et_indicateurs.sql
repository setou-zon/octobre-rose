-- Tests de la base (à lancer sur une base de test, jamais en production).
-- Vérifie : codes automatiques, cloisonnement par site, comptes non validés, vues indicateurs.
\set ON_ERROR_STOP 1
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000c', 'coord@test'),
  ('00000000-0000-0000-0000-0000000000a1', 'agent.cbp@test'),
  ('00000000-0000-0000-0000-0000000000a2', 'agent.cen@test'),
  ('00000000-0000-0000-0000-0000000000ff', 'inconnu@test');

update public.profils set valide = true, role = 'coordination' where email = 'coord@test';
update public.profils set valide = true, site_id = (select id from public.sites where code = 'CBP') where email = 'agent.cbp@test';
update public.profils set valide = true, site_id = (select id from public.sites where code = 'CEN') where email = 'agent.cen@test';

-- Agent CBP saisit deux femmes
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);

insert into public.depistages (site_id, date_depistage, nom_prenoms, age, consentement, deja_examen_seins,
  sein_examine, conclusion_sein, cat_sein, col_realise, methode_col, resultat_col, eligible_traitement,
  traitement_col, decision_finale, deja_depistage_col)
values
  ((select id from public.sites where code = 'CBP'), '2026-10-07', 'Femme A', 34, true, 'non',
   true, 'normal', '{conseils}', true, 'IVA', 'positif', 'oui', 'thermocoagulation', 'aucune', 'non'),
  ((select id from public.sites where code = 'CBP'), '2026-10-07', 'Femme B', 52, true, 'oui',
   true, 'suspecte', '{mammographie}', false, null, null, null, null, 'ref_sein', 'oui');

insert into public.references_cas (depistage_id, date_reference, structure_destination, motifs, recue)
select id, '2026-10-07', 'CHU Yalgado', '{masse}', 'oui' from public.depistages where nom_prenoms = 'Femme B';

insert into public.seances_sensibilisation (date_seance, lieu_type, type_activite, f_15_24, h_25_49, f_50plus)
values ('2026-10-05', 'marche', 'causerie', 20, 5, 7);

do $$ begin
  assert (select string_agg(code, ',' order by code) from public.depistages) = 'OR26-CBP-07-001,OR26-CBP-07-002',
    'codes bénéficiaires';
  assert (select numero from public.references_cas) = 'R26-0001', 'numéro de référence';
end $$;

-- Agent CBP ne peut pas saisir pour CEN
do $$ begin
  begin
    insert into public.depistages (site_id, nom_prenoms, age, consentement)
    values ((select id from public.sites where code = 'CEN'), 'Interdit', 30, true);
    raise exception 'ÉCHEC : saisie hors site autorisée';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Le code ne peut pas être modifié
update public.depistages set code = 'X', age = 35 where nom_prenoms = 'Femme A';
do $$ begin
  assert (select code from public.depistages where nom_prenoms = 'Femme A') = 'OR26-CBP-07-001', 'code figé';
  assert (select age from public.depistages where nom_prenoms = 'Femme A') = 35, 'modification permise';
end $$;

-- Pas d'examen sans consentement
do $$ begin
  begin
    insert into public.depistages (site_id, nom_prenoms, age, consentement, sein_examine)
    values ((select id from public.sites where code = 'CBP'), 'Sans consentement', 30, false, true);
    raise exception 'ÉCHEC : examen sans consentement accepté';
  exception when check_violation then null;
  end;
end $$;

-- Agent CEN ne voit pas les données nominatives de CBP, mais voit la sensibilisation
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', true);
do $$ begin
  assert (select count(*) from public.depistages) = 0, 'cloisonnement dépistages';
  assert (select count(*) from public.references_cas) = 0, 'cloisonnement références';
  assert (select count(*) from public.seances_sensibilisation) = 1, 'sensibilisation partagée';
end $$;
-- Agent CEN ne peut pas se promouvoir
update public.profils set role = 'coordination' where id = '00000000-0000-0000-0000-0000000000a2';
do $$ begin
  assert (select role from public.profils where id = '00000000-0000-0000-0000-0000000000a2') = 'agent', 'pas d''auto-promotion';
end $$;

-- Compte non validé : rien
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000ff', true);
do $$ begin
  assert (select count(*) from public.seances_sensibilisation) = 0, 'non validé : sensibilisation';
  assert (select count(*) from public.sites) = 0, 'non validé : sites';
  assert (select coalesce(sum(realise), 0) from public.v_indicateurs) = 0, 'non validé : indicateurs';
end $$;

-- Coordination : tout voir, indicateurs justes
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', true);
update public.cibles set cible = 100 where indicateur = 'sensibilises_femmes';
do $$
declare v record;
begin
  for v in select indicateur, realise, taux from public.v_indicateurs loop
    raise notice '% = % (taux %)', v.indicateur, v.realise, v.taux;
  end loop;
  assert (select realise from public.v_indicateurs where indicateur = 'sensibilises_femmes') = 27, 'femmes sensibilisées';
  assert (select taux from public.v_indicateurs where indicateur = 'sensibilises_femmes') = 27.0, 'taux';
  assert (select realise from public.v_indicateurs where indicateur = 'examens_seins') = 2, 'examens seins';
  assert (select realise from public.v_indicateurs where indicateur = 'depistages_col') = 1, 'col';
  assert (select realise from public.v_indicateurs where indicateur = 'anomalies_orientees') = 2, 'anomalies orientées';
  assert (select realise from public.v_indicateurs where indicateur = 'cas_references') = 1, 'références';
  assert (select taux from public.v_taux where ordre = 1) = 100.0, 'positivité col';
  assert (select sum(accueillies) from public.v_synthese_journaliere) = 2, 'synthèse journalière';
  assert (select examen_seins from public.v_registre_depistage where code = 'OR26-CBP-07-002') = 'S', 'registre';
  assert (select numeros_reference from public.v_registre_depistage where code = 'OR26-CBP-07-002') = 'R26-0001', 'registre ref';
end $$;

-- Anonyme : aucun accès
reset role;
set local role anon;
do $$ begin
  begin
    perform 1 from public.depistages;
    raise exception 'ÉCHEC : accès anonyme';
  exception when insufficient_privilege then null;
  end;
end $$;

select 'TOUS LES TESTS PASSENT' as resultat;
rollback;
