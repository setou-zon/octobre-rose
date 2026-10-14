# Octobre Rose 2026 – Collecte des données (ADG)

Application web installable (PWA) pour saisir les **8 outils de collecte** de la campagne Octobre Rose 2026 de l'Association Développement par la Gouvernance (ADG), avec un tableau de bord des indicateurs.

**Adresse :** https://setou-zon.github.io/octobre-rose/

- **Fonctionne sans internet** : après la première ouverture, l'application s'ouvre et enregistre les fiches hors connexion.
- **S'installe** sur téléphone et ordinateur comme une application (bouton « Installer l'application » dans le menu ; sur iPhone : Safari → Partager → Sur l'écran d'accueil).
- **Aucun serveur** : les données restent sur l'appareil. Elles sont regroupées par fichiers (voir plus bas).
- **Accès par compte** : identifiant et mot de passe, comptes créés par l'administrateur.

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

## Mise en route

1. **Coordination** – ouvrir l'adresse, choisir *Créer le compte administrateur*, donner un code appareil (ex. `A`).
2. Dans **Équipe** : créer un compte par agent (site de rattachement, mot de passe), ajouter les sites communautaires, puis **Exporter la configuration**.
3. **Chaque autre appareil** – ouvrir l'adresse, choisir *Installer la configuration de la coordination*, sélectionner le fichier reçu et donner un **code appareil différent** (B, C, D…). Les agents s'y connectent avec leurs identifiants.

Le code appareil entre dans le code bénéficiaire (`OR26-CBP-07-A015` = Clinique Blaise Pascal, 7 octobre, appareil A, 15e femme) : deux appareils ne peuvent donc jamais donner le même code.

## Regrouper les données

1. Chaque soir, chaque agent ouvre **Données → Créer le fichier d'envoi** et transmet le fichier `.json` à la coordination (WhatsApp, e-mail, clé USB). Ce fichier sert aussi de sauvegarde.
2. La coordination ouvre **Données → Importer les fichiers des agents**. Une fiche déjà présente n'est jamais dupliquée ; la version la plus récente est gardée, et les suppressions sont propagées.
3. Le **tableau de bord** et les **indicateurs** se mettent à jour ; **Télécharger (Excel)** produit un classeur avec une feuille par outil et les indicateurs.

## Confidentialité

- Mots de passe chiffrés (PBKDF2), session limitée à 8 heures.
- Un agent rattaché à un site ne voit que les fiches nominatives de ce site.
- Le registre, les exports Excel standard et les synthèses ne contiennent ni nom ni téléphone ; seul l'administrateur peut exporter les fiches nominatives.
- Les données sont stockées dans le navigateur de l'appareil : protégez les appareils par un code de verrouillage et ne videz pas les données du navigateur avant d'avoir créé un fichier d'envoi.

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
app/src/lib/store.ts           Enregistrement, codes, fichiers d'envoi et import
app/src/lib/indicateurs.ts     Calcul des indicateurs (registre, synthèse, TDR)
app/src/pages/                 Écrans
```
