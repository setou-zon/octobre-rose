# Octobre Rose 2026 – Collecte des données (ADG)

Application web installable (PWA) pour saisir les **8 outils de collecte** de la campagne Octobre Rose 2026 de l'Association Développement par la Gouvernance (ADG), avec un tableau de bord des indicateurs.

**Adresse :** https://setou-zon.github.io/octobre-rose/

- **Fonctionne sans internet** : après la première ouverture, l'application s'ouvre et enregistre les fiches hors connexion.
- **S'installe** sur téléphone et ordinateur comme une application (bouton « Installer l'application » dans le menu ; sur iPhone : Safari → Partager → Sur l'écran d'accueil).
- **Base centrale Supabase** (projet « octobre rose ») : chaque fiche est enregistrée sur le téléphone puis envoyée automatiquement dès qu'il y a du réseau ; les fiches des autres agents arrivent de la même façon.
- **Accès par compte** : chacun crée son compte, l'administrateur le valide.

| Outil | Écran |
| --- | --- |
| 1 – Registre des séances de sensibilisation | Sensibilisation |
| 2 – Fiche individuelle de dépistage | Dépistage |
| 3 – Registre journalier de dépistage | Registre (sans nom) |
| 4 – Fiche de référence / contre-référence | depuis la fiche, puis Références (impression) |
| 5 – Registre de suivi des références | Références |
| 6 – Supports, médias et leaders | Communication |
| 7 – Synthèse journalière par site | Synthèse du jour |
| 8 – Synthèse finale des indicateurs | Indicateurs + Tableau de bord |

Chaque fiche remplie se **télécharge en PDF** (bouton « Télécharger la fiche » quand elle est ouverte), et les fiches vierges des outils 1, 2, 4 et 7 se téléchargent depuis **Données** pour la saisie sur papier.

## Mise en route

1. Dans Supabase → **Authentication → Sign In / Providers → Email**, désactiver **Confirm email** (les comptes utilisent un identifiant, pas une vraie adresse ; c'est l'administrateur qui valide).
2. **Le tout premier compte créé devient administrateur.** La coordination ouvre l'adresse, choisit *Créer mon compte* avant tout le monde.
3. Chaque agent crée son compte (nom, téléphone, site, identifiant, mot de passe). Le compte est actif après validation dans **Équipe → Demandes de compte à valider**.
4. La création du compte et la première connexion demandent du réseau ; ensuite la saisie fonctionne sans internet.

Le code bénéficiaire suit le format de la fiche papier : `OR26-CBP-07-015`. Si deux téléphones ont donné le même code le même jour, la synchronisation renumérote la fiche arrivée en second (`OR26-CBP-07-015B`) et l'affiche dans **Données** pour correction sur la fiche papier.

## Base de données

- Schéma : `supabase/migrations/20261014000000_base_centrale.sql`, généré depuis les fiches par `npm run db:sql` (dossier `app`).
- Tests des règles d'accès : `supabase/tests/test_base_centrale.sql` (dans une transaction annulée).
- Tables : `depistages`, `references_cas`, `seances_sensibilisation`, `supports_communication`, `activites_medias`, `leaders_impliques`, `syntheses_journalieres`, plus `profils`, `sites`, `cibles`.
- Les suppressions sont logiques (`supprime = true`, réservé à l'administrateur) pour se propager à tous les téléphones.

## Confidentialité

- Comptes gérés par Supabase Auth ; un compte non validé ou désactivé n'accède à aucune donnée (règles d'accès dans la base).
- Un agent rattaché à un site ne voit que les fiches nominatives de ce site.
- Le registre, les exports Excel standard et les synthèses ne contiennent ni nom ni téléphone ; seul l'administrateur peut exporter les fiches nominatives.
- Une copie des fiches reste dans le navigateur du téléphone pour le travail hors ligne : protégez les téléphones par un code de verrouillage. Ne videz pas les données du navigateur tant que des fiches sont « à envoyer ».

## Développement

```bash
cd app
npm install
npm run dev      # http://localhost:5173/octobre-rose/
npm run build    # version de production dans app/dist
```

Chaque envoi sur `main` publie l'application sur GitHub Pages (Settings → Pages → Source : **GitHub Actions**).

```
app/src/forms/definitions.ts   Contenu des fiches (questions, choix, règles d'affichage)
app/src/lib/db.ts              Stockage local (IndexedDB)
app/src/lib/auth.tsx           Comptes et connexion
app/src/lib/store.ts           Enregistrement local, codes, sauvegarde de secours
app/src/lib/sync.ts            Synchronisation avec Supabase
app/src/lib/indicateurs.ts     Calcul des indicateurs (registre, synthèse, TDR)
app/src/pages/                 Écrans
```
