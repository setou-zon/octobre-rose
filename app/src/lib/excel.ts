import type { Site } from './auth';
import type { Fiche, Table } from './db';
import { indicateurs, registre, syntheseJour, taux } from './indicateurs';

type Donnees = Record<Table, Fiche[]>;
const TECHNIQUES = ['supprime', 'id', 'depistage_id'];

function aplatir(l: Record<string, unknown>[]) {
  return l.map((x) => Object.fromEntries(Object.entries(x)
    .filter(([k]) => !TECHNIQUES.includes(k))
    .map(([k, v]) => [k, Array.isArray(v) ? v.join(', ') : typeof v === 'boolean' ? (v ? 'oui' : 'non') : v ?? ''])));
}

/** Un classeur Excel : une feuille par outil + indicateurs. Chargé à la demande. */
export async function exporterExcel(d: Donnees, sites: Site[], cibles: Record<string, number | null>, nominatif: boolean) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  const ajouter = (nom: string, lignes: Record<string, unknown>[]) => {
    const ws = XLSX.utils.json_to_sheet(lignes.length ? lignes : [{ info: 'Aucune donnée' }]);
    const cols = Object.keys(lignes[0] ?? { info: '' });
    ws['!cols'] = cols.map((c) => ({ wch: Math.min(45, Math.max(10, c.length + 2, ...lignes.slice(0, 200).map((l) => String(l[c] ?? '').length))) }));
    XLSX.utils.book_append_sheet(wb, ws, nom.slice(0, 31));
  };

  ajouter('8 - Indicateurs', indicateurs(d, cibles).map((i) => ({ Indicateur: i.libelle, Source: i.source, Cible: i.cible ?? '', Réalisé: i.realise, 'Taux (%)': i.taux ?? '' })));
  ajouter('8 - Taux', taux(d).map((t) => ({ Taux: t.libelle, Numérateur: t.numerateur, Dénominateur: t.denominateur, 'Résultat (%)': t.taux ?? '' })));

  // Outil 7 : une ligne par site et par jour
  const jours = new Map<string, Fiche[]>();
  for (const x of d.depistages) {
    const k = `${x.site_id}|${x.date_depistage}`;
    jours.set(k, [...(jours.get(k) ?? []), x]);
  }
  const s7: Record<string, unknown>[] = [];
  for (const [k, l] of [...jours.entries()].sort()) {
    const [site, date] = k.split('|');
    const ligne: Record<string, unknown> = { Site: sites.find((s) => String(s.id) === site)?.nom ?? site, Date: date };
    for (const r of syntheseJour(l)) ligne[r.libelle] = r.total;
    s7.push(ligne);
  }
  ajouter('7 - Synthèse par jour', s7);
  ajouter('7 - Logistique', aplatir(d.syntheses_journalieres.map((s) => ({ ...s, site_id: sites.find((x) => x.id === s.site_id)?.nom ?? s.site_id }))));
  ajouter('1 - Sensibilisation', aplatir(d.seances_sensibilisation));
  ajouter('3 - Registre', aplatir(registre(d, sites).map(({ site_id: _s, ...r }) => r)));
  const codes = new Map(d.depistages.map((x) => [x.id, x.code]));
  ajouter('5 - Références', aplatir(d.references_cas.map((r) => ({ code_beneficiaire: codes.get(String(r.depistage_id)) ?? '', ...r }))));
  ajouter('6a - Supports', aplatir(d.supports_communication));
  ajouter('6b - Médias', aplatir(d.activites_medias));
  ajouter('6c - Leaders', aplatir(d.leaders_impliques));
  if (nominatif) ajouter('2 - Fiches (nominatif)', aplatir(d.depistages.map((x) => ({ ...x, site_id: sites.find((s) => s.id === x.site_id)?.nom ?? x.site_id }))));

  XLSX.writeFile(wb, `octobre-rose-2026_donnees_${new Date().toISOString().slice(0, 10)}${nominatif ? '_NOMINATIF' : ''}.xlsx`);
}
