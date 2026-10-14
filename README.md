# Octobre Rose 2026 – Collecte des données (ADG)

Application web installable (PWA) pour saisir les **8 outils de collecte** de la campagne Octobre Rose 2026 de l'Association Développement par la Gouvernance (ADG), avec un tableau de bord des indicateurs.

**Adresse :** https://setou-zon.github.io/octobre-rose/

- **Fonctionne sans internet** : après la première ouverture, l'application s'ouvre et enregistre les fiches hors connexion.
- **S’installe** sur téléphone et ordinateur : bouton « Installer l’application » sur l’écran de connexion, dans l’en-tête et sur le tableau de bord (avec la marche à suivre si le navigateur ne propose pas l’installation directe).
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

Comptes : **inscription avec une vraie adresse e-mail → confirmation par le lien reçu → activation par un administrateur.** Sans l'activation, le compte n'accède à aucune donnée.

Réglages Supabase (une seule fois, dans le projet « octobre rose ») :

1. **Authentication → URL Configuration** : *Site URL* = `https://setou-zon.github.io/octobre-rose/`, et ajouter la même adresse dans *Redirect URLs*. Sinon les liens reçus par e-mail ouvrent une mauvaise page.
2. **Envoi des e-mails (SMTP)** : le service d'e-mails intégré de Supabase n'envoie qu'aux membres de l'équipe Supabase, avec quelques messages par heure. Pour les agents, configurer un service SMTP dans **Project Settings → Authentication → SMTP Settings** (par ex. Brevo ou Resend, offres gratuites).
3. Facultatif : **Authentication → Email Templates**, coller les modèles en français de `supabase/templates/` (confirmation et mot de passe).
4. Laisser **Confirm email** activé.

Ensuite :

1. **Le tout premier compte créé devient administrateur** (dès qu'il a confirmé son e-mail). La coordination s'inscrit avant de partager le lien.
2. Chaque agent s'inscrit (nom, e-mail, téléphone, site, mot de passe) et confirme son adresse ; il apparaît dans **Équipe → Demandes de compte à valider**, où l'administrateur l'active et choisit son site.
3. *Mot de passe oublié* envoie un lien par e-mail pour en choisir un nouveau.
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
