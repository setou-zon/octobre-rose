import { o, type Formulaire, type Valeurs } from './types';

const aujourdhui = () => new Date().toISOString().slice(0, 10);
const tab = (v: Valeurs, k: string) => (Array.isArray(v[k]) ? (v[k] as string[]) : []);

// ---------------------------------------------------------------------------
// Libellés partagés (aussi utilisés dans les listes)
// ---------------------------------------------------------------------------
export const LIBELLES: Record<string, Record<string, string>> = {
  lieu_type: { quartier: 'Quartier', marche: 'Marché', ecole: 'École', lieu_culte: 'Lieu de culte', centre_communautaire: 'Centre communautaire', autre: 'Autre' },
  type_activite: { causerie: 'Causerie éducative', session_information: 'Session d’information', demonstration_aes: 'Démonstration auto-examen', animation_masse: 'Animation de masse' },
  conclusion_sein: { normal: 'Normal', benigne: 'Anomalie bénigne probable', suspecte: 'Anomalie suspecte' },
  resultat_col: { negatif: 'Négatif', positif: 'Positif (lésion précancéreuse)', suspicion_cancer: 'Suspicion de cancer', non_concluant: 'Non concluant' },
  decision_finale: { aucune: 'Aucune suite', controle: 'Contrôle programmé', ref_sein: 'Référée – sein', ref_col: 'Référée – col', ref_deux: 'Référée – les deux' },
  urgence: { urgent: 'Urgent (sous 7 jours)', prioritaire: 'Prioritaire (sous 30 jours)', non_urgent: 'Non urgent' },
  recue: { oui: 'Oui', non: 'Non', inconnu: 'Pas encore su' },
  type_support: { affiche: 'Affiches', banderole: 'Banderoles', depliant: 'Dépliants / flyers', capsule_video: 'Capsules vidéo', message_whatsapp: 'Messages WhatsApp', publication_reseaux: 'Publications réseaux sociaux', autre: 'Autre' },
  type_media: { radio: 'Radio', television: 'Télévision', presse: 'Presse', en_ligne: 'En ligne' },
  categorie: { religieux: 'Religieux', coutumier: 'Coutumier', communautaire: 'Communautaire', association: 'Association', influenceur: 'Influenceur' },
  role: { agent: 'Agent de saisie', admin: 'Administrateur (coordination)' },
};
const opts = (k: string) => Object.entries(LIBELLES[k]).map(([v, l]) => ({ v, l }));

// ---------------------------------------------------------------------------
// Outil 1 – Séance de sensibilisation
// ---------------------------------------------------------------------------
export const seance: Formulaire = {
  table: 'seances_sensibilisation',
  titre: 'Séance de sensibilisation',
  defaut: () => ({ date_seance: aujourdhui(), langues: [], themes: [] }),
  verifier: (v) => {
    const total = ['f_moins15', 'h_moins15', 'f_15_24', 'h_15_24', 'f_25_49', 'h_25_49', 'f_50plus', 'h_50plus']
      .reduce((s, k) => s + (Number(v[k]) || 0), 0);
    return total === 0 ? ['Indiquez au moins un participant dans le décompte.'] : [];
  },
  sections: [
    {
      titre: 'A. Identification de la séance',
      champs: [
        { name: 'numero', label: 'N° de la séance', type: 'text' },
        { name: 'date_seance', label: 'Date', type: 'date', required: true },
        { name: 'heure_debut', label: 'Heure de début', type: 'time' },
        { name: 'heure_fin', label: 'Heure de fin', type: 'time' },
        { name: 'commune', label: 'Commune / arrondissement', type: 'text' },
        { name: 'quartier', label: 'Quartier', type: 'text' },
        { name: 'lieu_type', label: 'Lieu', type: 'choix', required: true, options: opts('lieu_type'), large: true },
        { name: 'lieu_autre', label: 'Préciser le lieu', type: 'text', si: (v) => v.lieu_type === 'autre' },
        { name: 'lieu_precis', label: 'Lieu précis (nom)', type: 'text' },
        { name: 'type_activite', label: 'Type d’activité', type: 'choix', required: true, options: opts('type_activite'), large: true },
        { name: 'langues', label: 'Langue(s) utilisée(s)', type: 'multi', large: true,
          options: o([['francais', 'Français'], ['moore', 'Mooré'], ['dioula', 'Dioula'], ['fulfulde', 'Fulfuldé'], ['autre', 'Autre']]) },
        { name: 'animateurs', label: 'Animateur(s)', type: 'text', large: true },
        { name: 'nb_leaders', label: 'Leaders communautaires présents (nombre)', type: 'number', min: 0, zero: true },
        { name: 'noms_leaders', label: 'Noms des leaders', type: 'text' },
      ],
    },
    {
      titre: 'B. Thèmes abordés',
      champs: [
        { name: 'themes', label: 'Thèmes (plusieurs réponses possibles)', type: 'multi', large: true,
          options: o([
            ['sein_risques', 'Cancer du sein : facteurs de risque et signes d’alerte'],
            ['aes', 'Auto-examen des seins (démonstration)'],
            ['col_hpv', 'Cancer du col de l’utérus et HPV'],
            ['vaccination_hpv', 'Vaccination contre le HPV'],
            ['depistage_precoce', 'Importance du dépistage précoce'],
            ['lieux_dates', 'Lieux et dates du dépistage (7–11 octobre)'],
            ['tabous', 'Lutte contre les tabous et la stigmatisation'],
          ]) },
      ],
    },
    {
      titre: 'C. Décompte des participants',
      aide: 'Nombre de personnes par sexe et tranche d’âge.',
      champs: [
        { name: 'f_moins15', label: 'Femmes – moins de 15 ans', type: 'number', min: 0, zero: true },
        { name: 'h_moins15', label: 'Hommes – moins de 15 ans', type: 'number', min: 0, zero: true },
        { name: 'f_15_24', label: 'Femmes – 15 à 24 ans', type: 'number', min: 0, zero: true },
        { name: 'h_15_24', label: 'Hommes – 15 à 24 ans', type: 'number', min: 0, zero: true },
        { name: 'f_25_49', label: 'Femmes – 25 à 49 ans', type: 'number', min: 0, zero: true },
        { name: 'h_25_49', label: 'Hommes – 25 à 49 ans', type: 'number', min: 0, zero: true },
        { name: 'f_50plus', label: 'Femmes – 50 ans et plus', type: 'number', min: 0, zero: true },
        { name: 'h_50plus', label: 'Hommes – 50 ans et plus', type: 'number', min: 0, zero: true },
        { name: 'nb_intentions_depistage', label: 'Femmes ayant exprimé l’intention de se faire dépister', type: 'number', min: 0, zero: true },
        { name: 'nb_supports_distribues', label: 'Supports distribués (dépliants, flyers)', type: 'number', min: 0, zero: true },
      ],
    },
    {
      titre: 'D. Observations',
      champs: [
        { name: 'observations', label: 'Questions fréquentes, rumeurs ou résistances observées', type: 'textarea', large: true },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Outil 2 – Fiche individuelle de dépistage
// ---------------------------------------------------------------------------
const consent = (v: Valeurs) => v.consentement === true;
const seinOk = (v: Valeurs) => consent(v) && v.sein_examine === true;
const colOk = (v: Valeurs) => consent(v) && v.col_realise === true;

export const depistage: Formulaire = {
  table: 'depistages',
  titre: 'Fiche individuelle de dépistage',
  defaut: () => ({ date_depistage: aujourdhui(), sources_info: [], plaintes: [], cat_sein: [], conseils: [] }),
  verifier: (v) => {
    const e: string[] = [];
    if (v.consentement !== true && (v.sein_examine || v.col_realise)) e.push('Aucun examen sans consentement éclairé.');
    if (consent(v) && v.sein_examine == null) e.push('Indiquez si l’examen clinique des seins a été réalisé.');
    if (consent(v) && v.col_realise == null) e.push('Indiquez si le dépistage du col a été réalisé.');
    if (v.sein_examine && !v.conclusion_sein) e.push('Indiquez la conclusion de l’examen des seins.');
    if (v.col_realise && !v.resultat_col) e.push('Indiquez le résultat du dépistage du col.');
    if (v.col_realise === false && consent(v) && !v.motif_non_col) e.push('Indiquez pourquoi le dépistage du col n’a pas été fait.');
    if (v.conclusion_sein === 'suspecte' && !['ref_sein', 'ref_deux'].includes(String(v.decision_finale)))
      e.push('Anomalie mammaire suspecte : la décision finale devrait être une référence pour le sein.');
    if (v.resultat_col === 'suspicion_cancer' && !['ref_col', 'ref_deux'].includes(String(v.decision_finale)))
      e.push('Suspicion de cancer du col : la décision finale devrait être une référence pour le col.');
    return e;
  },
  sections: [
    {
      titre: 'A. Accueil et identification',
      aide: 'Le code bénéficiaire (OR26-Site-Jour-Appareil+N°, ex. OR26-CBP-07-A015) est attribué automatiquement à l’enregistrement.',
      champs: [
        { name: 'site_id', label: 'Site', type: 'site', required: true },
        { name: 'date_depistage', label: 'Date', type: 'date', required: true },
        { name: 'nom_prenoms', label: 'Nom et prénom(s)', type: 'text', required: true },
        { name: 'age', label: 'Âge (années révolues)', type: 'number', min: 9, max: 110, required: true },
        { name: 'telephone', label: 'Téléphone (facultatif)', type: 'tel' },
        { name: 'quartier', label: 'Quartier / village de résidence', type: 'text' },
        { name: 'situation_matrimoniale', label: 'Situation matrimoniale', type: 'choix', large: true,
          options: o([['celibataire', 'Célibataire'], ['mariee', 'Mariée / en union'], ['veuve', 'Veuve'], ['divorcee', 'Divorcée / séparée']]) },
        { name: 'niveau_instruction', label: 'Niveau d’instruction', type: 'choix', large: true,
          options: o([['aucun', 'Aucun'], ['primaire', 'Primaire'], ['secondaire', 'Secondaire'], ['superieur', 'Supérieur']]) },
        { name: 'sources_info', label: 'Comment a-t-elle connu la campagne ?', type: 'multi', large: true,
          options: o([['relais', 'Relais / causerie'], ['leader', 'Leader communautaire'], ['radio', 'Radio'], ['reseaux', 'Réseaux sociaux / WhatsApp'], ['affiche', 'Affiche'], ['agent_sante', 'Agent de santé'], ['proche', 'Proche']]) },
        { name: 'consentement', label: 'Consentement éclairé obtenu', type: 'ouinon', required: true, large: true,
          aide: 'Si non, aucun examen ne peut être réalisé.' },
      ],
    },
    {
      titre: 'B. Antécédents et facteurs de risque',
      si: consent,
      champs: [
        { name: 'atcd_familial', label: 'Cancer du sein ou de l’ovaire chez une parente proche', type: 'ouinonnsp' },
        { name: 'atcd_personnel_cancer', label: 'Antécédent personnel de cancer', type: 'ouinonnsp' },
        { name: 'deja_examen_seins', label: 'A déjà eu un examen des seins par un agent de santé', type: 'ouinonnsp' },
        { name: 'deja_depistage_col', label: 'A déjà fait un dépistage du cancer du col', type: 'ouinonnsp' },
        { name: 'pratique_aes', label: 'Pratique l’auto-examen des seins', type: 'ouinonnsp' },
        { name: 'vaccinee_hpv', label: 'Vaccinée contre le HPV', type: 'ouinonnsp' },
        { name: 'vih_positif', label: 'Statut VIH connu positif (facultatif, avec tact)', type: 'ouinonnsp' },
        { name: 'menopausee', label: 'Ménopausée', type: 'ouinonnsp' },
        { name: 'nb_grossesses', label: 'Nombre de grossesses', type: 'number', min: 0, max: 30 },
        { name: 'allaitement', label: 'Allaitement', type: 'choix', options: o([['oui', 'Oui'], ['non', 'Non'], ['jamais', 'Jamais allaité']]) },
        { name: 'plaintes', label: 'Plaintes actuelles', type: 'multi', large: true,
          options: o([['aucune', 'Aucune'], ['boule', 'Boule au sein'], ['ecoulement', 'Écoulement du mamelon'], ['douleur_mammaire', 'Douleur mammaire'], ['modif_peau', 'Modification de la peau ou du mamelon'], ['saignements', 'Saignements anormaux / après rapports'], ['pertes', 'Pertes anormales'], ['douleurs_pelviennes', 'Douleurs pelviennes'], ['autre', 'Autre']]) },
        { name: 'plainte_autre', label: 'Autre plainte', type: 'text', si: (v) => tab(v, 'plaintes').includes('autre') },
      ],
    },
    {
      titre: 'C. Examen clinique des seins',
      si: consent,
      champs: [
        { name: 'sein_examine', label: 'Examen clinique des seins réalisé', type: 'ouinon', large: true },
        { name: 'sd_inspection', label: 'Sein droit – inspection', type: 'choix', si: seinOk, options: o([['normale', 'Normale'], ['anormale', 'Anormale']]) },
        { name: 'sg_inspection', label: 'Sein gauche – inspection', type: 'choix', si: seinOk, options: o([['normale', 'Normale'], ['anormale', 'Anormale']]) },
        { name: 'sd_nodule', label: 'Sein droit – nodule / masse palpable', type: 'ouinon', si: seinOk },
        { name: 'sg_nodule', label: 'Sein gauche – nodule / masse palpable', type: 'ouinon', si: seinOk },
        { name: 'sd_nodule_cm', label: 'Sein droit – taille du nodule (cm)', type: 'number', step: 0.1, min: 0.1, si: (v) => seinOk(v) && v.sd_nodule === true },
        { name: 'sg_nodule_cm', label: 'Sein gauche – taille du nodule (cm)', type: 'number', step: 0.1, min: 0.1, si: (v) => seinOk(v) && v.sg_nodule === true },
        { name: 'sd_retraction', label: 'Sein droit – rétraction du mamelon / peau d’orange', type: 'ouinon', si: seinOk },
        { name: 'sg_retraction', label: 'Sein gauche – rétraction du mamelon / peau d’orange', type: 'ouinon', si: seinOk },
        { name: 'sd_ecoulement', label: 'Sein droit – écoulement mamelonnaire', type: 'ouinon', si: seinOk },
        { name: 'sg_ecoulement', label: 'Sein gauche – écoulement mamelonnaire', type: 'ouinon', si: seinOk },
        { name: 'sd_ecoulement_aspect', label: 'Sein droit – aspect de l’écoulement', type: 'text', si: (v) => seinOk(v) && v.sd_ecoulement === true },
        { name: 'sg_ecoulement_aspect', label: 'Sein gauche – aspect de l’écoulement', type: 'text', si: (v) => seinOk(v) && v.sg_ecoulement === true },
        { name: 'sd_adenopathie', label: 'Adénopathie axillaire droite', type: 'ouinon', si: seinOk },
        { name: 'sg_adenopathie', label: 'Adénopathie axillaire gauche', type: 'ouinon', si: seinOk },
        { name: 'conclusion_sein', label: 'Conclusion de l’examen des seins', type: 'choix', si: seinOk, large: true, options: opts('conclusion_sein') },
        { name: 'cat_sein', label: 'Conduite à tenir', type: 'multi', si: seinOk, large: true,
          options: o([['conseils', 'Conseils et auto-examen mensuel'], ['echographie', 'Échographie mammaire'], ['mammographie', 'Mammographie'], ['consultation_specialisee', 'Consultation spécialisée'], ['autre', 'Autre']]) },
        { name: 'cat_sein_autre', label: 'Autre conduite à tenir', type: 'text', si: (v) => seinOk(v) && tab(v, 'cat_sein').includes('autre') },
        { name: 'aes_enseigne', label: 'Auto-examen des seins enseigné', type: 'ouinon', si: seinOk },
      ],
    },
    {
      titre: 'D. Dépistage du cancer du col de l’utérus',
      si: consent,
      champs: [
        { name: 'col_realise', label: 'Dépistage du col réalisé', type: 'ouinon', large: true },
        { name: 'motif_non_col', label: 'Motif de non-réalisation', type: 'choix', large: true, si: (v) => consent(v) && v.col_realise === false,
          options: o([['refus', 'Refus'], ['regles', 'Règles'], ['grossesse', 'Grossesse'], ['hors_age', 'Hors tranche d’âge'], ['rupture_intrants', 'Rupture d’intrants'], ['autre', 'Autre']]) },
        { name: 'methode_col', label: 'Méthode utilisée', type: 'choix', large: true, si: colOk,
          options: o([['IVA', 'IVA (acide acétique)'], ['IVL', 'IVL (Lugol)'], ['HPV', 'Test HPV'], ['frottis', 'Frottis cervico-vaginal'], ['autre', 'Autre']]) },
        { name: 'resultat_col', label: 'Résultat', type: 'choix', large: true, si: colOk, options: opts('resultat_col') },
        { name: 'resultat_hpv', label: 'Résultat du test HPV', type: 'choix', si: (v) => colOk(v) && v.methode_col === 'HPV',
          options: o([['negatif', 'Négatif'], ['positif', 'Positif'], ['en_attente', 'En attente']]) },
        { name: 'eligible_traitement', label: 'Éligible au traitement immédiat', type: 'choix', si: (v) => colOk(v) && v.resultat_col === 'positif',
          options: o([['oui', 'Oui'], ['non', 'Non'], ['na', 'NA']]) },
        { name: 'traitement_col', label: 'Traitement réalisé sur place', type: 'choix', large: true, si: (v) => colOk(v) && v.resultat_col === 'positif',
          options: o([['thermocoagulation', 'Thermocoagulation'], ['cryotherapie', 'Cryothérapie'], ['rad_leep', 'RAD / LEEP'], ['non_realise', 'Non réalisé']]) },
        { name: 'suite_col', label: 'Si non traitée sur place', type: 'choix', si: (v) => colOk(v) && (v.traitement_col === 'non_realise' || v.resultat_col === 'suspicion_cancer'),
          options: o([['referee', 'Référée'], ['rdv_controle', 'Rendez-vous de contrôle']]) },
        { name: 'date_rdv_controle', label: 'Date du rendez-vous de contrôle', type: 'date', si: (v) => v.suite_col === 'rdv_controle' },
      ],
    },
    {
      titre: 'E. Conseil et orientation',
      champs: [
        { name: 'conseils', label: 'Conseil donné', type: 'multi', large: true, si: consent,
          options: o([['resultats_expliques', 'Résultats expliqués'], ['prevention', 'Conseils de prévention donnés'], ['info_vaccination', 'Information vaccination HPV (filles de la famille)'], ['soutien', 'Soutien psychosocial de base'], ['rdv_suivi', 'Rendez-vous de suivi donné']]) },
        { name: 'decision_finale', label: 'Décision finale', type: 'choix', large: true, options: opts('decision_finale'),
          aide: 'Pour une référence, remplissez ensuite la fiche de référence depuis le registre.' },
        { name: 'prestataire', label: 'Nom du prestataire', type: 'text' },
        { name: 'qualification', label: 'Qualification', type: 'choix',
          options: o([['medecin', 'Médecin'], ['sage_femme', 'Sage-femme'], ['infirmier', 'Infirmier(e)'], ['autre', 'Autre']]) },
        { name: 'observations', label: 'Observations', type: 'textarea', large: true },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Outils 4 et 5 – Référence, contre-référence et suivi
// ---------------------------------------------------------------------------
export const reference: Formulaire = {
  table: 'references_cas',
  titre: 'Fiche de référence',
  defaut: () => ({ date_reference: aujourdhui(), services: [], motifs: [], obstacles: [], cr_examens: [], urgence: 'prioritaire', recue: 'inconnu', cr_recue: false }),
  sections: [
    {
      titre: 'Volet 1 – Référence',
      aide: 'Le numéro de référence (R26-0001) est attribué automatiquement.',
      champs: [
        { name: 'date_reference', label: 'Date de la référence', type: 'date', required: true },
        { name: 'structure_destination', label: 'Structure de destination', type: 'text', required: true },
        { name: 'services', label: 'Service / spécialiste visé', type: 'multi', large: true,
          options: o([['gynecologie', 'Gynécologie'], ['radiologie', 'Radiologie (écho / mammo)'], ['oncologie', 'Oncologie'], ['chirurgie', 'Chirurgie'], ['anapath', 'Anatomo-pathologie'], ['autre', 'Autre']]) },
        { name: 'service_autre', label: 'Autre service', type: 'text', si: (v) => tab(v, 'services').includes('autre') },
        { name: 'motifs', label: 'Motif de la référence', type: 'multi', large: true,
          options: o([['masse', 'Masse / nodule mammaire'], ['ecoulement', 'Écoulement suspect'], ['adenopathie', 'Adénopathie axillaire'], ['lesion_col', 'Lésion précancéreuse du col non traitable sur place'], ['suspicion_col', 'Suspicion de cancer du col'], ['hpv_positif', 'Test HPV positif'], ['autre', 'Autre']]) },
        { name: 'motif_autre', label: 'Autre motif', type: 'text', si: (v) => tab(v, 'motifs').includes('autre') },
        { name: 'resume_constatations', label: 'Résumé des constatations', type: 'textarea', large: true },
        { name: 'gestes_realises', label: 'Gestes réalisés sur place', type: 'textarea', large: true },
        { name: 'urgence', label: 'Degré d’urgence', type: 'choix', large: true, required: true, options: opts('urgence') },
        { name: 'prestataire', label: 'Prestataire (nom et qualification)', type: 'text' },
      ],
    },
    {
      titre: 'Suivi de la référence',
      aide: 'Relance téléphonique conseillée à J+7 et J+21.',
      champs: [
        { name: 'relance_j7_date', label: 'Relance J+7 – date', type: 'date' },
        { name: 'relance_j7_resultat', label: 'Relance J+7 – résultat', type: 'text' },
        { name: 'relance_j21_date', label: 'Relance J+21 – date', type: 'date' },
        { name: 'relance_j21_resultat', label: 'Relance J+21 – résultat', type: 'text' },
        { name: 'recue', label: 'Reçue à la structure', type: 'choix', options: opts('recue'), large: true },
        { name: 'obstacles', label: 'Obstacles signalés', type: 'multi', large: true,
          options: o([['cout', 'Coût'], ['distance', 'Distance'], ['peur', 'Peur'], ['famille', 'Opposition familiale'], ['autre', 'Autre']]) },
        { name: 'obstacle_autre', label: 'Autre obstacle', type: 'text', si: (v) => tab(v, 'obstacles').includes('autre') },
      ],
    },
    {
      titre: 'Volet 2 – Contre-référence',
      champs: [
        { name: 'cr_recue', label: 'Contre-référence reçue', type: 'ouinon', large: true },
        { name: 'cr_date_reception', label: 'Date de réception de la patiente', type: 'date', si: (v) => v.cr_recue === true },
        { name: 'cr_examens', label: 'Examens réalisés', type: 'multi', large: true, si: (v) => v.cr_recue === true,
          options: o([['echographie', 'Échographie mammaire'], ['mammographie', 'Mammographie'], ['biopsie', 'Biopsie'], ['colposcopie', 'Colposcopie'], ['autre', 'Autre']]) },
        { name: 'cr_diagnostic', label: 'Diagnostic retenu', type: 'choix', large: true, si: (v) => v.cr_recue === true,
          options: o([['benin', 'Bénin'], ['precancereux', 'Lésion précancéreuse'], ['cancer', 'Cancer confirmé'], ['en_attente', 'En attente de résultats']]) },
        { name: 'cr_prise_en_charge', label: 'Prise en charge proposée', type: 'textarea', large: true, si: (v) => v.cr_recue === true },
        { name: 'cr_recommandations', label: 'Recommandations pour le suivi', type: 'textarea', large: true, si: (v) => v.cr_recue === true },
        { name: 'cr_signataire', label: 'Signataire (nom, qualification)', type: 'text', si: (v) => v.cr_recue === true },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Outil 6 – Supports, médias, leaders
// ---------------------------------------------------------------------------
export const support: Formulaire = {
  table: 'supports_communication',
  titre: 'Support de communication',
  sections: [{
    titre: 'Support',
    champs: [
      { name: 'type_support', label: 'Type de support', type: 'choix', required: true, large: true, options: opts('type_support') },
      { name: 'type_autre', label: 'Préciser', type: 'text', si: (v) => v.type_support === 'autre' },
      { name: 'qte_produite', label: 'Quantité produite', type: 'number', min: 0, zero: true },
      { name: 'qte_diffusee', label: 'Quantité diffusée / distribuée', type: 'number', min: 0, zero: true },
      { name: 'lieux_canaux', label: 'Lieux ou canaux de diffusion', type: 'text', large: true },
      { name: 'periode', label: 'Période', type: 'text' },
    ],
  }],
};

export const media: Formulaire = {
  table: 'activites_medias',
  titre: 'Activité média',
  defaut: () => ({ date_activite: aujourdhui() }),
  sections: [{
    titre: 'Activité',
    champs: [
      { name: 'date_activite', label: 'Date', type: 'date', required: true },
      { name: 'media', label: 'Média (nom)', type: 'text', required: true },
      { name: 'type_media', label: 'Type', type: 'choix', required: true, large: true, options: opts('type_media') },
      { name: 'format', label: 'Format', type: 'choix', large: true,
        options: o([['emission', 'Émission'], ['spot', 'Spot'], ['reportage', 'Reportage'], ['interview', 'Interview'], ['publication', 'Publication'], ['autre', 'Autre']]) },
      { name: 'langue', label: 'Langue', type: 'text' },
      { name: 'duree_diffusions', label: 'Durée ou nombre de diffusions', type: 'text' },
      { name: 'portee_estimee', label: 'Audience ou portée estimée (vues, partages)', type: 'number', min: 0 },
      { name: 'commentaire', label: 'Commentaire', type: 'textarea', large: true },
    ],
  }],
};

export const leader: Formulaire = {
  table: 'leaders_impliques',
  titre: 'Leader communautaire',
  defaut: () => ({ roles: [] }),
  sections: [{
    titre: 'Leader ou partenaire',
    champs: [
      { name: 'nom', label: 'Nom', type: 'text', required: true },
      { name: 'categorie', label: 'Catégorie', type: 'choix', required: true, large: true, options: opts('categorie') },
      { name: 'localite', label: 'Localité', type: 'text' },
      { name: 'telephone', label: 'Téléphone', type: 'tel' },
      { name: 'roles', label: 'Rôle joué', type: 'multi', large: true,
        options: o([['mobilisation', 'Mobilisation'], ['message', 'Relais du message'], ['lancement', 'Présence au lancement'], ['autre', 'Autre']]) },
    ],
  }],
};

// ---------------------------------------------------------------------------
// Outil 7 – Logistique et difficultés du jour
// ---------------------------------------------------------------------------
export const synthese: Formulaire = {
  table: 'syntheses_journalieres',
  titre: 'Logistique et difficultés du jour',
  defaut: () => ({ date_synthese: aujourdhui() }),
  sections: [{
    titre: 'Logistique et difficultés',
    champs: [
      { name: 'site_id', label: 'Site', type: 'site', required: true },
      { name: 'date_synthese', label: 'Date', type: 'date', required: true },
      { name: 'ruptures', label: 'Ruptures de consommables (préciser)', type: 'textarea', large: true },
      { name: 'temps_attente_min', label: 'Temps d’attente moyen (minutes)', type: 'number', min: 0 },
      { name: 'non_recues', label: 'Femmes non reçues faute de temps', type: 'number', min: 0, zero: true },
      { name: 'difficultes', label: 'Difficultés rencontrées et solutions apportées', type: 'textarea', large: true },
      { name: 'responsable', label: 'Responsable de site', type: 'text' },
    ],
  }],
};
