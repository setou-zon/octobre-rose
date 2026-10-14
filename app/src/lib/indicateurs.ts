import type { Site } from './auth';
import type { Fiche, Table } from './db';

type Donnees = Record<Table, Fiche[]>;
const arr = (x: unknown) => (Array.isArray(x) ? (x as string[]) : []);
const TRAITEMENTS = ['thermocoagulation', 'cryotherapie', 'rad_leep'];
const REFS = ['ref_sein', 'ref_col', 'ref_deux'];

export const trancheAge = (age: unknown) => (Number(age) < 25 ? 'moins_25' : Number(age) < 50 ? '25_49' : '50_plus');

// ---------------------------------------------------------------------------
// Outil 3 – registre sans nom
// ---------------------------------------------------------------------------
export function registre(d: Donnees, sites: Site[]) {
  const refsPar = new Map<string, string[]>();
  for (const r of d.references_cas) refsPar.set(String(r.depistage_id), [...(refsPar.get(String(r.depistage_id)) ?? []), String(r.numero)]);
  return d.depistages.map((x) => {
    const site = sites.find((s) => s.id === x.site_id);
    return {
      id: x.id,
      code: x.code,
      site: site?.nom ?? '',
      site_id: x.site_id,
      date: x.date_depistage,
      age: x.age,
      premier_sein: x.deja_examen_seins == null ? null : x.deja_examen_seins === 'non',
      examen_seins: !x.sein_examine ? 'NF' : x.conclusion_sein === 'suspecte' ? 'S' : x.conclusion_sein === 'benigne' ? 'A' : 'N',
      examen_complementaire: arr(x.cat_sein).filter((c) => c === 'echographie' || c === 'mammographie').join(' / '),
      premier_col: x.deja_depistage_col == null ? null : x.deja_depistage_col === 'non',
      methode_col: x.col_realise ? (x.methode_col ?? '?') : 'NF',
      resultat_col: ({ negatif: 'N', positif: 'A', suspicion_cancer: 'S', non_concluant: '?' } as Record<string, string>)[String(x.resultat_col)] ?? null,
      traitement: ({ thermocoagulation: 'Thermo', cryotherapie: 'Cryo', rad_leep: 'RAD/LEEP' } as Record<string, string>)[String(x.traitement_col)] ?? null,
      referee: ({ ref_sein: 'Sein', ref_col: 'Col', ref_deux: 'Les deux' } as Record<string, string>)[String(x.decision_finale)] ?? null,
      numeros_reference: (refsPar.get(x.id) ?? []).sort().join(', '),
    };
  }).sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(a.code).localeCompare(String(b.code)));
}

// ---------------------------------------------------------------------------
// Outil 7 – compteurs d'une liste de dépistages
// ---------------------------------------------------------------------------
export const LIGNES_SYNTHESE: [string, string, (x: Fiche) => boolean][] = [
  ['accueillies', 'Femmes accueillies', () => true],
  ['examens_seins', 'Examen clinique des seins', (x) => x.sein_examine === true],
  ['premiers_examens_seins', 'dont 1er examen de leur vie', (x) => x.sein_examine === true && x.deja_examen_seins === 'non'],
  ['anomalies_suspectes', 'Anomalies mammaires suspectes', (x) => x.conclusion_sein === 'suspecte'],
  ['orientees_imagerie', 'Orientées vers écho / mammographie', (x) => arr(x.cat_sein).some((c) => c === 'echographie' || c === 'mammographie')],
  ['depistages_col', 'Dépistées pour le col', (x) => x.col_realise === true],
  ['premiers_depistages_col', 'dont 1er dépistage de leur vie', (x) => x.col_realise === true && x.deja_depistage_col === 'non'],
  ['lesions_precancereuses', 'Lésions précancéreuses (positives)', (x) => x.resultat_col === 'positif'],
  ['suspicions_cancer_col', 'Suspicions de cancer du col', (x) => x.resultat_col === 'suspicion_cancer'],
  ['lesions_traitees', 'Lésions traitées sur place', (x) => TRAITEMENTS.includes(String(x.traitement_col))],
  ['referees', 'Femmes référées', (x) => REFS.includes(String(x.decision_finale))],
  ['refus', 'Femmes ayant refusé un examen', (x) => x.consentement !== true || x.motif_non_col === 'refus'],
];

export function syntheseJour(depistages: Fiche[]) {
  return LIGNES_SYNTHESE.map(([cle, libelle, f]) => {
    const l = depistages.filter(f);
    const par = (t: string) => l.filter((x) => trancheAge(x.age) === t).length;
    return { cle, libelle, moins_25: par('moins_25'), '25_49': par('25_49'), '50_plus': par('50_plus'), total: l.length };
  });
}

// ---------------------------------------------------------------------------
// Outil 8 – indicateurs de la section 13 des TDR
// ---------------------------------------------------------------------------
export const INDICATEURS: { cle: string; libelle: string; source: string; calcul: (d: Donnees) => number }[] = [
  { cle: 'sensibilises_femmes', libelle: 'Personnes sensibilisées – femmes', source: 'Outil 1', calcul: (d) => somme(d.seances_sensibilisation, 'total_femmes') },
  { cle: 'sensibilises_hommes', libelle: 'Personnes sensibilisées – hommes', source: 'Outil 1', calcul: (d) => somme(d.seances_sensibilisation, 'total_hommes') },
  { cle: 'seances', libelle: 'Séances de sensibilisation réalisées', source: 'Outil 1', calcul: (d) => d.seances_sensibilisation.length },
  { cle: 'examens_seins', libelle: 'Femmes ayant eu un examen clinique des seins ou une orientation', source: 'Outils 2 et 7', calcul: (d) => d.depistages.filter((x) => x.sein_examine === true || arr(x.cat_sein).length > 0).length },
  { cle: 'depistages_col', libelle: 'Femmes dépistées pour le cancer du col', source: 'Outils 2 et 7', calcul: (d) => d.depistages.filter((x) => x.col_realise === true).length },
  {
    cle: 'anomalies_orientees', libelle: 'Femmes avec lésions précancéreuses ou anomalies orientées', source: 'Outils 3 et 7',
    calcul: (d) => d.depistages.filter((x) => (['benigne', 'suspecte'].includes(String(x.conclusion_sein)) || ['positif', 'suspicion_cancer'].includes(String(x.resultat_col)))
      && (['controle', ...REFS].includes(String(x.decision_finale)) || TRAITEMENTS.includes(String(x.traitement_col)) || arr(x.cat_sein).length > 0)).length,
  },
  { cle: 'lesions_traitees', libelle: 'Lésions précancéreuses traitées sur place', source: 'Outil 7', calcul: (d) => d.depistages.filter((x) => TRAITEMENTS.includes(String(x.traitement_col))).length },
  { cle: 'cas_references', libelle: 'Cas suspects référés vers une structure sanitaire', source: 'Outils 4 et 5', calcul: (d) => new Set(d.references_cas.map((r) => r.depistage_id)).size },
  { cle: 'references_effectives', libelle: 'Références effectives (reçues à la structure)', source: 'Outil 5', calcul: (d) => new Set(d.references_cas.filter((r) => r.recue === 'oui').map((r) => r.depistage_id)).size },
  { cle: 'supports_produits', libelle: 'Supports de communication produits', source: 'Outil 6a', calcul: (d) => somme(d.supports_communication, 'qte_produite') },
  { cle: 'supports_diffuses', libelle: 'Supports de communication diffusés', source: 'Outil 6a', calcul: (d) => somme(d.supports_communication, 'qte_diffusee') },
  { cle: 'medias', libelle: 'Médias impliqués', source: 'Outil 6b', calcul: (d) => new Set(d.activites_medias.map((m) => String(m.media ?? '').trim().toLowerCase()).filter(Boolean)).size },
  { cle: 'leaders', libelle: 'Leaders communautaires impliqués', source: 'Outil 6c', calcul: (d) => d.leaders_impliques.length },
];

function somme(l: Fiche[], k: string) { return l.reduce((s, x) => s + (Number(x[k]) || 0), 0); }

export function indicateurs(d: Donnees, cibles: Record<string, number | null>) {
  return INDICATEURS.map((i) => {
    const realise = i.calcul(d);
    const cible = cibles[i.cle] ?? null;
    return { cle: i.cle, libelle: i.libelle, source: i.source, cible, realise, taux: cible ? Math.round((1000 * realise) / cible) / 10 : null };
  });
}

export function taux(d: Donnees) {
  const x = d.depistages;
  const col = x.filter((f) => f.col_realise === true).length;
  const positifs = x.filter((f) => f.resultat_col === 'positif').length;
  const eligibles = x.filter((f) => f.eligible_traitement === 'oui').length;
  const traitees = x.filter((f) => TRAITEMENTS.includes(String(f.traitement_col))).length;
  const seins = x.filter((f) => f.sein_examine === true).length;
  const suspectes = x.filter((f) => f.conclusion_sein === 'suspecte').length;
  const referees = new Set(d.references_cas.map((r) => r.depistage_id)).size;
  const recues = new Set(d.references_cas.filter((r) => r.recue === 'oui').map((r) => r.depistage_id)).size;
  const t = (n: number, dn: number) => (dn ? Math.round((1000 * n) / dn) / 10 : null);
  return [
    { libelle: 'Taux de positivité au dépistage du col', numerateur: positifs, denominateur: col, taux: t(positifs, col) },
    { libelle: 'Taux de traitement immédiat des lésions éligibles', numerateur: traitees, denominateur: eligibles, taux: t(traitees, eligibles) },
    { libelle: 'Taux d’anomalies mammaires suspectes', numerateur: suspectes, denominateur: seins, taux: t(suspectes, seins) },
    { libelle: 'Taux de références effectives', numerateur: recues, denominateur: referees, taux: t(recues, referees) },
  ];
}

/** Personnes sensibilisées par tranche d'âge et sexe */
export function sensibilisationParAge(seances: Fiche[]) {
  const tr: [string, string, string][] = [['Moins de 15 ans', 'f_moins15', 'h_moins15'], ['15 – 24 ans', 'f_15_24', 'h_15_24'], ['25 – 49 ans', 'f_25_49', 'h_25_49'], ['50 ans et plus', 'f_50plus', 'h_50plus']];
  return tr.map(([libelle, f, h]) => ({ libelle, femmes: somme(seances, f), hommes: somme(seances, h) }));
}
