import { useCallback, useEffect, useState } from 'react';
import { depistage, reference } from '../forms/definitions';
import type { Valeurs } from '../forms/types';
import { FormRenderer } from '../components/FormRenderer';
import { BoutonPdf } from '../components/BoutonPdf';
import { Tableau } from '../components/Tableau';
import { useAuth } from '../lib/auth';
import type { Fiche } from '../lib/db';
import { aujourdhui, dateFr, lib } from '../lib/format';
import { registre } from '../lib/indicateurs';
import { exporterCsv, liste, supprimer, toutesLesDonnees } from '../lib/store';

// ---------------------------------------------------------------------------
// Outil 2 – Nouvelle fiche individuelle
// ---------------------------------------------------------------------------
export function PageNouvelleFiche({ allerA }: { allerA: (p: string) => void }) {
  const [cle, setCle] = useState(0);
  const [resultat, setResultat] = useState<Valeurs | null>(null);
  const [referer, setReferer] = useState<Valeurs | null>(null);

  const recommencer = () => { setReferer(null); setResultat(null); setCle((k) => k + 1); window.scrollTo({ top: 0 }); };

  if (referer) return <FormulaireReference depistage={referer} onFini={recommencer} />;

  if (resultat) {
    const doitReferer = ['ref_sein', 'ref_col', 'ref_deux'].includes(String(resultat.decision_finale));
    return (
      <section className="confirmation">
        <p>Fiche enregistrée sur cet appareil. Code bénéficiaire :</p>
        <p className="code-beneficiaire">{String(resultat.code)}</p>
        <p className="aide">Inscrivez ce code sur la fiche papier et sur le registre.</p>
        <div className="actions-fiche">
          {doitReferer && <button className="btn principal" onClick={() => setReferer(resultat)}>Remplir la fiche de référence</button>}
          <BoutonPdf form={depistage} valeurs={resultat} code={String(resultat.code)} confidentiel nomFichier={`fiche_${resultat.code}.pdf`} />
          <button className={`btn ${doitReferer ? 'secondaire' : 'principal'}`} onClick={recommencer}>Nouvelle bénéficiaire</button>
          <button className="btn secondaire" onClick={() => allerA('registre')}>Voir le registre</button>
        </div>
      </section>
    );
  }

  return (
    <section>
      <p className="intro">Outil 2 – une fiche par femme, complétée à chaque poste (accueil, sein, col, conseil). Fonctionne sans internet.</p>
      <FormRenderer key={cle} form={depistage} onEnregistre={(l) => { setResultat(l); window.scrollTo({ top: 0 }); }} />
    </section>
  );
}

// ---------------------------------------------------------------------------
// Outil 3 – Registre journalier (sans nom), avec ouverture de la fiche
// ---------------------------------------------------------------------------
type LigneRegistre = ReturnType<typeof registre>[number];

export function PageRegistre() {
  const { sites, compte } = useAuth();
  const [site, setSite] = useState<string>(compte?.site_id ? String(compte.site_id) : '');
  const [date, setDate] = useState(aujourdhui());
  const [lignes, setLignes] = useState<LigneRegistre[]>([]);
  const [fiche, setFiche] = useState<Fiche | null>(null);
  const [referer, setReferer] = useState<Fiche | null>(null);

  const charger = useCallback(async () => {
    const d = await toutesLesDonnees(compte);
    setLignes(registre(d, sites).filter((l) => (!site || String(l.site_id) === site) && (!date || l.date === date)));
  }, [site, date, compte, sites]);
  useEffect(() => { charger(); }, [charger]);

  async function ouvrir(l: Valeurs) {
    const f = (await liste('depistages', compte)).find((x) => x.id === l.id);
    if (f) setFiche(f);
  }

  if (referer) return <FormulaireReference depistage={referer} onFini={() => { setReferer(null); setFiche(null); charger(); }} />;

  if (fiche) {
    return (
      <section>
        <h2>Fiche {String(fiche.code)}</h2>
        <div className="barre">
          <button className="btn secondaire" onClick={() => setReferer(fiche)}>Référer cette bénéficiaire</button>
          <BoutonPdf form={depistage} valeurs={fiche} code={String(fiche.code)} confidentiel nomFichier={`fiche_${fiche.code}.pdf`} />
        </div>
        <FormRenderer form={depistage} initial={fiche} id={fiche.id}
          onAnnuler={() => setFiche(null)}
          onSupprimer={compte?.role === 'admin' ? async () => {
            if (!confirm(`Supprimer la fiche ${fiche.code} et ses références ?`)) return;
            await supprimer('depistages', fiche.id, compte); setFiche(null); charger();
          } : undefined}
          onEnregistre={() => { setFiche(null); charger(); }} />
      </section>
    );
  }

  const nb = (f: (l: LigneRegistre) => boolean) => lignes.filter(f).length;
  const oN = (v: boolean | null) => (v == null ? '–' : v ? 'O' : 'Nn');
  return (
    <section>
      <p className="intro">Outil 3 – une ligne par femme, sans nom. Touchez une ligne pour ouvrir ou compléter la fiche.</p>
      <div className="filtres">
        <label>Site
          <select value={site} onChange={(e) => setSite(e.target.value)} disabled={compte?.role !== 'admin' && compte?.site_id != null}>
            <option value="">Tous les sites</option>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
          </select>
        </label>
        <label>Date <input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <button className="btn secondaire" onClick={() => setDate('')}>Toutes les dates</button>
        <button className="btn secondaire" disabled={!lignes.length} onClick={() => exporterCsv('outil3_registre', lignes as unknown as Valeurs[], ['id', 'site_id'])}>Télécharger (CSV)</button>
      </div>
      <p className="legende">Codes : <b>N</b> normal / négatif · <b>A</b> anomalie / positif · <b>S</b> suspect · <b>NF</b> non fait</p>
      <Tableau lignes={lignes as unknown as Valeurs[]} onClic={ouvrir} vide="Aucune bénéficiaire enregistrée pour ce filtre."
        colonnes={[
          { titre: 'Code', rendu: (l) => <span className="mono">{String(l.code)}</span> },
          { titre: 'Âge', num: true, rendu: (l) => String(l.age) },
          { titre: '1er sein', rendu: (l) => oN(l.premier_sein as boolean | null) },
          { titre: 'Seins', rendu: (l) => <Pastille v={String(l.examen_seins)} /> },
          { titre: 'Examen compl.', rendu: (l) => String(l.examen_complementaire || '–') },
          { titre: '1er col', rendu: (l) => oN(l.premier_col as boolean | null) },
          { titre: 'Méthode col', rendu: (l) => String(l.methode_col) },
          { titre: 'Résultat col', rendu: (l) => <Pastille v={String(l.resultat_col ?? '–')} /> },
          { titre: 'Traitement', rendu: (l) => String(l.traitement ?? '–') },
          { titre: 'Référée', rendu: (l) => String(l.referee ?? '–') },
          { titre: 'N° réf.', rendu: (l) => String(l.numeros_reference ?? '') },
        ]} />
      <p className="totaux">
        Total : <b>{lignes.length}</b> · Examens seins : <b>{nb((l) => l.examen_seins !== 'NF')}</b> · Suspects seins : <b>{nb((l) => l.examen_seins === 'S')}</b> ·
        Col dépistées : <b>{nb((l) => l.methode_col !== 'NF')}</b> · Col positifs : <b>{nb((l) => l.resultat_col === 'A')}</b> · Référées : <b>{nb((l) => !!l.referee)}</b>
      </p>
    </section>
  );
}

function Pastille({ v }: { v: string }) {
  const c = v === 'S' ? 'p-suspect' : v === 'A' ? 'p-anomalie' : v === 'N' ? 'p-normal' : 'p-neutre';
  return <span className={`pastille ${c}`}>{v}</span>;
}

// ---------------------------------------------------------------------------
// Outil 4 – Formulaire de référence lié à une bénéficiaire
// ---------------------------------------------------------------------------
function FormulaireReference({ depistage: d, onFini }: { depistage: Valeurs; onFini: () => void }) {
  const motifs: string[] = [];
  if (d.conclusion_sein === 'suspecte' || d.sd_nodule || d.sg_nodule) motifs.push('masse');
  if (d.sd_ecoulement || d.sg_ecoulement) motifs.push('ecoulement');
  if (d.sd_adenopathie || d.sg_adenopathie) motifs.push('adenopathie');
  if (d.resultat_col === 'positif') motifs.push('lesion_col');
  if (d.resultat_col === 'suspicion_cancer') motifs.push('suspicion_col');
  if (d.resultat_hpv === 'positif') motifs.push('hpv_positif');
  return (
    <section>
      <h2>Fiche de référence – {String(d.code ?? '')}</h2>
      <p className="intro">{String(d.nom_prenoms ?? '')}, {String(d.age ?? '')} ans{d.telephone ? ` · ${d.telephone}` : ''}</p>
      <FormRenderer form={reference} extra={{ depistage_id: d.id }}
        initial={{ ...reference.defaut!(), motifs, prestataire: d.prestataire ?? '' }}
        onAnnuler={onFini} onEnregistre={onFini} />
    </section>
  );
}

// ---------------------------------------------------------------------------
// Outil 5 – Suivi des références (+ impression de la fiche)
// ---------------------------------------------------------------------------
type Ref = Fiche & { dep?: Fiche };

export function PageReferences() {
  const { compte, sites } = useAuth();
  const [lignes, setLignes] = useState<Ref[]>([]);
  const [edition, setEdition] = useState<Ref | null>(null);
  const [impression, setImpression] = useState<Ref | null>(null);

  const charger = useCallback(async () => {
    const [refs, deps] = await Promise.all([liste('references_cas', compte), liste('depistages', compte)]);
    const parId = new Map(deps.map((d) => [d.id, d]));
    setLignes(refs.map((r) => ({ ...r, dep: parId.get(String(r.depistage_id)) }) as Ref)
      .sort((a, b) => String(b.date_reference).localeCompare(String(a.date_reference))));
  }, [compte]);
  useEffect(() => { charger(); }, [charger]);

  if (impression) return <FicheReferenceImprimable r={impression} site={sites.find((s) => s.id === impression.dep?.site_id)?.nom ?? ''} onRetour={() => setImpression(null)} />;

  if (edition) {
    const { dep, ...ref } = edition;
    return (
      <section>
        <h2>Référence {String(ref.numero)} – {String(dep?.code ?? '')}</h2>
        <p className="intro">{String(dep?.nom_prenoms ?? '')}{dep?.telephone ? ` · ${dep.telephone}` : ''}</p>
        <div className="barre">
          <BoutonPdf form={reference} valeurs={ref} titre="Fiche de référence / contre-référence" code={String(ref.numero)} confidentiel
            nomFichier={`reference_${ref.numero}.pdf`}
            enTete={[
              ['Code bénéficiaire', String(dep?.code ?? '')],
              ['Patiente', `${dep?.nom_prenoms ?? ''}${dep?.age ? `, ${dep.age} ans` : ''}`],
              ['Téléphone', String(dep?.telephone ?? '')],
              ['Structure qui réfère', sites.find((s) => s.id === dep?.site_id)?.nom ?? ''],
            ]} />
          <button className="btn secondaire" onClick={() => setImpression(edition)}>Imprimer</button>
        </div>
        <FormRenderer form={reference} initial={ref} id={ref.id}
          onAnnuler={() => setEdition(null)}
          onSupprimer={compte?.role === 'admin' ? async () => {
            if (!confirm('Supprimer cette référence ?')) return;
            await supprimer('references_cas', ref.id, compte); setEdition(null); charger();
          } : undefined}
          onEnregistre={() => { setEdition(null); charger(); }} />
      </section>
    );
  }

  const recues = lignes.filter((l) => l.recue === 'oui').length;
  const aRelancer = (l: Valeurs) => {
    const jours = (Date.now() - new Date(String(l.date_reference)).getTime()) / 86400000;
    return l.recue !== 'oui' && ((jours >= 7 && !l.relance_j7_date) || (jours >= 21 && !l.relance_j21_date));
  };
  return (
    <section>
      <p className="intro">Outils 4 et 5 – chaque femme référée est suivie jusqu’à sa réception par la structure. Les nouvelles références se créent depuis la fiche de la bénéficiaire (registre).</p>
      <div className="barre">
        <span className="compteur">{lignes.length} référence(s) · {recues} reçue(s) · taux de références effectives : <b>{lignes.length ? Math.round((100 * recues) / lignes.length) : 0} %</b></span>
        <button className="btn secondaire" disabled={!lignes.length}
          onClick={() => exporterCsv('outil5_references', lignes.map(({ dep, ...r }) => ({ code_beneficiaire: dep?.code, ...r })), ['supprime', 'depistage_id'])}>Télécharger (CSV)</button>
      </div>
      <Tableau lignes={lignes} onClic={(l) => setEdition(l as Ref)} vide="Aucune référence pour le moment."
        colonnes={[
          { titre: 'N°', rendu: (l) => <span className="mono">{String(l.numero)}</span> },
          { titre: 'Code', rendu: (l) => <span className="mono">{String((l.dep as Fiche | undefined)?.code ?? '')}</span> },
          { titre: 'Date', rendu: (l) => dateFr(l.date_reference) },
          { titre: 'Destination', rendu: (l) => String(l.structure_destination) },
          { titre: 'Urgence', rendu: (l) => lib('urgence', l.urgence).split(' (')[0] },
          { titre: 'Reçue', rendu: (l) => lib('recue', l.recue) },
          { titre: 'Contre-réf.', rendu: (l) => (l.cr_recue ? 'Oui' : 'Non') },
          { titre: 'À faire', rendu: (l) => (aRelancer(l) ? <span className="pastille p-suspect">Relancer</span> : '') },
        ]} />
    </section>
  );
}

function FicheReferenceImprimable({ r, site, onRetour }: { r: Ref; site: string; onRetour: () => void }) {
  const d = (r.dep ?? {}) as Valeurs;
  const liste = (x: unknown) => (Array.isArray(x) ? x.join(', ') : '');
  return (
    <section className="imprimable">
      <div className="barre ne-pas-imprimer">
        <button className="btn secondaire" onClick={onRetour}>Retour</button>
        <button className="btn principal" onClick={() => window.print()}>Imprimer</button>
      </div>
      <h2>Fiche de référence – Campagne Octobre Rose 2026</h2>
      <p>N° de référence : <b>{String(r.numero)}</b> · Code bénéficiaire : <b>{String(d.code ?? '')}</b></p>
      <h3>Volet 1 – Référence</h3>
      <table className="fiche-imp"><tbody>
        <tr><th>Structure qui réfère</th><td>{site}</td></tr>
        <tr><th>Date</th><td>{dateFr(r.date_reference)}</td></tr>
        <tr><th>Patiente</th><td>{String(d.nom_prenoms ?? '')}, {String(d.age ?? '')} ans · {String(d.telephone ?? '')}</td></tr>
        <tr><th>Structure de destination</th><td>{String(r.structure_destination)}</td></tr>
        <tr><th>Service visé</th><td>{liste(r.services)} {String(r.service_autre ?? '')}</td></tr>
        <tr><th>Motif</th><td>{liste(r.motifs)} {String(r.motif_autre ?? '')}</td></tr>
        <tr><th>Constatations</th><td>{String(r.resume_constatations ?? '')}</td></tr>
        <tr><th>Gestes réalisés</th><td>{String(r.gestes_realises ?? '')}</td></tr>
        <tr><th>Urgence</th><td>{lib('urgence', r.urgence)}</td></tr>
        <tr><th>Prestataire et signature</th><td>{String(r.prestataire ?? '')}<br /><br /></td></tr>
      </tbody></table>
      <h3>Volet 2 – Contre-référence (à retourner à l’ADG)</h3>
      <table className="fiche-imp"><tbody>
        <tr><th>Date de réception</th><td>____ / ____ / 2026</td></tr>
        <tr><th>Examens réalisés</th><td>☐ Échographie ☐ Mammographie ☐ Biopsie ☐ Colposcopie ☐ Autre</td></tr>
        <tr><th>Diagnostic retenu</th><td>☐ Bénin ☐ Lésion précancéreuse ☐ Cancer confirmé ☐ En attente</td></tr>
        <tr><th>Prise en charge proposée</th><td><br /><br /></td></tr>
        <tr><th>Recommandations</th><td><br /><br /></td></tr>
        <tr><th>Nom, signature et cachet</th><td><br /><br /></td></tr>
      </tbody></table>
    </section>
  );
}
