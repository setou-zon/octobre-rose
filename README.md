# Octobre Rose 2026 – Collecte des données (ADG)

Application web de saisie des **8 outils de collecte** de la campagne Octobre Rose 2026 de l'Association Développement par la Gouvernance (ADG), avec une base de données **Supabase**.

| Outil | Écran de l'application | Table / vue Supabase |
| --- | --- | --- |
| 1 – Registre des séances de sensibilisation | Sensibilisation | `seances_sensibilisation` |
| 2 – Fiche individuelle de dépistage | Dépistage | `depistages` (nominatif) |
| 3 – Registre journalier de dépistage | Registre | vue `v_registre_depistage` (sans nom) |
| 4 – Fiche de référence / contre-référence | depuis la fiche, puis Références (impression) | `references_cas` |
| 5 – Registre de suivi des références | Références | `references_cas` |
| 6 – Supports, médias et leaders | Communication | `supports_communication`, `activites_medias`, `leaders_impliques` |
| 7 – Synthèse journalière par site | Synthèse | vue `v_synthese_journaliere` + `syntheses_journalieres` |
| 8 – Synthèse finale des indicateurs | Indicateurs | vues `v_indicateurs`, `v_taux` + `cibles` |

## Ce que fait l'application

- **Code bénéficiaire automatique** `OR26-[Site]-[Jour]-[N°]` (ex. `OR26-CBP-07-015`) et **numéro de référence** `R26-0001`.
- **Contrôles de saisie** : pas d'examen sans consentement, questions affichées seulement si elles s'appliquent, alerte si une anomalie suspecte n'est pas référée.
- **Indicateurs calculés en direct** (section 13 des TDR), cibles modifiables par la coordination, export CSV pour Excel.
- **Suivi des références** : rappel des relances à J+7 et J+21, taux de références effectives, fiche de référence imprimable.
- **Hors connexion** : une nouvelle fiche saisie sans réseau est gardée sur l'appareil et envoyée automatiquement au retour du réseau.
- **Confidentialité** : les noms ne figurent que dans les fiches individuelles et les références ; un agent ne voit que les fiches de son site ; un nouveau compte n'a accès à rien tant que la coordination ne l'a pas validé.

## Rôles

| Rôle | Droits |
| --- | --- |
| Agent de saisie | Saisit et consulte les fiches de son site, la sensibilisation et la communication |
| Responsable de site | Idem, pour son site |
| Coordination ADG | Voit tous les sites, valide les comptes, fixe les cibles, supprime, exporte les fiches nominatives |

## Mise en place

### 1. Base de données Supabase

1. Créer un projet Supabase (région Paris `eu-west-3` conseillée).
2. Dans **SQL Editor**, exécuter `supabase/migrations/20261013000000_octobre_rose_schema.sql`
   (ou `supabase db push` avec la CLI Supabase).
3. Ajouter les sites communautaires si besoin :
   ```sql
   insert into public.sites (code, nom, type) values ('GOU', 'Gounghin', 'communautaire');
   ```

### 2. Premier compte de coordination

1. Ouvrir l'application et **créer un compte**.
2. Dans le **SQL Editor** de Supabase, le passer en coordination :
   ```sql
   update public.profils set valide = true, role = 'coordination'
    where email = 'adresse@exemple.org';
   ```
3. Ensuite, la coordination valide les autres comptes depuis l'écran **Équipe**.

### 3. Lancer l'application en local

```bash
cd app
cp .env.example .env.local   # puis renseigner l'URL et la clé publishable du projet
npm install
npm run dev
```

### 4. Mise en ligne (GitHub Pages)

1. Dans GitHub : **Settings → Pages → Source : GitHub Actions**.
2. **Settings → Secrets and variables → Actions → Variables**, ajouter :
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY` (clé publique « publishable » ; ne jamais mettre la clé `service_role`)
3. Chaque envoi sur `main` publie l'application à l'adresse `https://<compte>.github.io/octobre-rose/`.
4. Dans Supabase, **Authentication → URL Configuration** : mettre cette adresse dans *Site URL* et *Redirect URLs*.

## Tests de la base

`supabase/tests/test_rls_et_indicateurs.sql` vérifie les codes automatiques, le cloisonnement par site, le blocage des comptes non validés et le calcul des indicateurs. Il s'exécute dans une transaction annulée ; à lancer sur une base de test :

```bash
DATABASE_URL=postgres://... npm --prefix app run test:db
```

## Structure

```
app/                         Application React + Vite
  src/forms/definitions.ts   Contenu des fiches (questions, choix, règles d'affichage)
  src/pages/                 Écrans
supabase/migrations/         Schéma de la base, règles d'accès, vues des indicateurs
supabase/tests/              Tests SQL
```

Pour ajouter ou modifier une question : changer la colonne dans une nouvelle migration SQL, puis le champ dans `app/src/forms/definitions.ts`.
