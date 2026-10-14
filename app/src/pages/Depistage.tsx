import { useCallback, useEffect, useState } from 'react';
import { LIBELLES, depistage, reference } from '../forms/definitions';
import type { Valeurs } from '../forms/types';
import { FormRenderer } from '../components/FormRenderer';
import { Tableau, dateFr } from '../components/PageListe';
import { exporterCsv } from '../lib/data';
import { messageErreur, supabase } from '../lib/supabase';
import { useSession } from '../lib/session';

const lib = (k: string, v: unknown) => LIBELLES[k]?.[String(v)] ?? String(v ?? '');
const aujourdhui = () => new Date().toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
// Outil 2 – Nouvelle fiche individuelle
// ---------------------------------------------------------------------------
export function PageNouvelleFiche({ allerA }: { allerA: (p: string) => void }) {
  const [cle, setCle] = useState(0);
  const [resultat, setResultat] = useState<Valeurs | 'horsligne' | null>(null);
  const [referer, setReferer] = useState<Valeurs | null>(null);

  if (referer) {
    return <FormulaireReference depistage={referer} onFini={() => { setReferer(null); setResultat(null); setCle((k) => k + 1); }} />;
  }

  if (resultat) {
    const doitReferer = resultat !== 'horsligne' && ['ref_sein', 'ref_col', 'ref_deux'].includes(String(resultat.decision_finale));
    return (
      <section className="confirmation">
        {resultat === 'horsligne' ? (
          <div className="alerte attention">Pas de réseau : la fiche est gardée sur cet appareil et sera envoyée automatiquement. Le code bénéficiaire sera attribué à l’envoi.</div>
        ) : (
          <>
            <p>Fiche enregistrée. Code bénéficiaire :</p>
            <p className="code-beneficiaire">{String(resultat.code)}</p>
            <p className="aide">Inscrivez ce code sur la fiche papier et sur le registre.</p>
          </>
        )}
        <div className="actions-fiche">
          {doitReferer && <button className="btn principal" onClick={() => setReferer(resultat as Valeurs)}>Remplir la fiche de référence</button>}
          <button className={`btn ${doitReferer ? 'secondaire' : 'principal'}`} onClick={() => { setResultat(null); setCle((k) => k + 1); }}>Nouvelle bénéficiaire</button>
          <button className="btn secondaire" onClick={() => allerA('registre')}>Voir le registre du jour</button>
        </div>
      </section>
    );
  }

  return (
    <section>
      <p className="intro">Outil 2 – une fiche par femme, complétée à chaque poste (accueil, sein, col, conseil).</p>
      <FormRenderer key={cle} form={depistage} onEnregistre={(l) => { setResultat(l ?? 'horsligne'); window.scrollTo({ top: 0 }); }} />
    </section>
  );
}

// ---------------------------------------------------------------------------
// Outil 3 – Registre journalier (sans nom), avec ouverture de la fiche
// ---------------------------------------------------------------------------
export function PageRegistre() {
  const { sites, profil } = useSession();
  const [site, setSite] = useState<string>(profil?.site_id ? String(profil.site_id) : '');
  const [date, setDate] = useState(aujourdhui());
  const [lignes, setLignes] = useState<Valeurs[]>([]);
  const [erreur, setErreur] = useState('');
  const [fiche, setFiche] = useState<Valeurs | null>(null);
  const [referer, setReferer] = useState<Valeurs | null>(null);

  const charger = useCallback(async () => {
    let q = supabase.from('v_registre_depistage').select('*');
    if (site) q = q.eq('site_id', Number(site));
    if (date) q = q.eq('date_depistage', date);
    const { data, error } = await q.order('date_depistage', { ascending: false }).order('site_code').order('numero_ordre').limit(2000);
    if (error) setErreur(messageErreur(error)); else { setErreur(''); setLignes((data ?? []) as Valeurs[]); }
  }, [site, date]);

  useEffect(() => { charger(); }, [charger]);

  async function ouvrir(l: Valeurs) {
    const { data, error } = await supabase.from('depistages').select('*').eq('id', l.id).single();
    if (error) setErreur(messageErreur(error)); else setFiche(data as Valeurs);
  }

  if (referer) return <FormulaireReference depistage={referer} onFini={() => { setReferer(null); charger(); }} />;

  if (fiche) {
    return (
      <section>
        <h2>Fiche {String(fiche.code)}</h2>
        <div className="barre">
          <button className="btn secondaire" onClick={() => setReferer(fiche)}>Référer cette bénéficiaire</button>
        </div>
        <FormRenderer form={depistage} initial={fiche} id={String(fiche.id)}
          onAnnuler={() => setFiche(null)} onEnregistre={() => { setFiche(null); charger(); }} />
      </section>
    );
  }

  const nb = (f: (l: Valeurs) => boolean) => lignes.filter(f).length;
  return (
    <section>
      <p className="intro">Outil 3 – une ligne par femme, sans nom. Touchez une ligne pour ouvrir ou compléter la fiche.</p>
      {erreur && <div className="alerte erreur">{erreur}</div>}
      <div className="filtres">
        <label>Site
          <select value={site} onChange={(e) => setSite(e.target.value)}>
            <option value="">Tous les sites</option>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
          </select>
        </label>
        <label>Date <input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <button className="btn secondaire" onClick={() => setDate('')}>Toutes les dates</button>
        <button className="btn secondaire" disabled={!lignes.length} onClick={() => exporterCsv('outil3_registre', lignes)}>Exporter (CSV)</button>
      </div>
      <p className="legende">Codes : <b>N</b> normal / négatif · <b>A</b> anomalie / positif · <b>S</b> suspect · <b>NF</b> non fait</p>
      <Tableau lignes={lignes} onClic={ouvrir} vide="Aucune bénéficiaire enregistrée pour ce filtre."
        colonnes={[
          { titre: 'Code', rendu: (l) => <span className="mono">{String(l.code)}</span> },
          { titre: 'Âge', num: true, rendu: (l) => String(l.age) },
          { titre: '1er sein', rendu: (l) => (l.premier_depistage_sein == null ? '–' : l.premier_depistage_sein ? 'O' : 'Nn') },
          { titre: 'Seins', rendu: (l) => <Pastille v={String(l.examen_seins)} /> },
          { titre: 'Examen compl.', rendu: (l) => String(l.examen_complementaire || '–') },
          { titre: '1er col', rendu: (l) => (l.premier_depistage_col == null ? '–' : l.premier_depistage_col ? 'O' : 'Nn') },
          { titre: 'Méthode col', rendu: (l) => String(l.methode_col ?? 'NF') },
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
export function PageReferences() {
  const [lignes, setLignes] = useState<Valeurs[]>([]);
  const [erreur, setErreur] = useState('');
  const [edition, setEdition] = useState<Valeurs | null>(null);
  const [impression, setImpression] = useState<Valeurs | null>(null);

  const charger = useCallback(async () => {
    const { data, error } = await supabase.from('references_cas')
      .select('*, depistages(code, nom_prenoms, age, telephone, sites(nom))')
      .order('date_reference', { ascending: false });
    if (error) setErreur(messageErreur(error)); else setLignes((data ?? []) as Valeurs[]);
  }, []);
  useEffect(() => { charger(); }, [charger]);

  if (impression) return <FicheReferenceImprimable r={impression} onRetour={() => setImpression(null)} />;

  if (edition) {
    const d = edition.depistages as Valeurs | null;
    return (
      <section>
        <h2>Référence {String(edition.numero)} – {String(d?.code ?? '')}</h2>
        <p className="intro">{String(d?.nom_prenoms ?? '')}{d?.telephone ? ` · ${d.telephone}` : ''}</p>
        <div className="barre"><button className="btn secondaire" onClick={() => setImpression(edition)}>Imprimer la fiche</button></div>
        <FormRenderer form={reference} initial={edition} id={String(edition.id)}
          onAnnuler={() => setEdition(null)} onEnregistre={() => { setEdition(null); charger(); }} />
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
      <p className="intro">Outils 4 et 5 – chaque femme référée est suivie jusqu’à sa réception par la structure. Les nouvelles références se créent depuis la fiche de la bénéficiaire.</p>
      {erreur && <div className="alerte erreur">{erreur}</div>}
      <div className="barre">
        <span className="compteur">{lignes.length} référence(s) · {recues} reçue(s) · taux de références effectives : <b>{lignes.length ? Math.round((100 * recues) / lignes.length) : 0} %</b></span>
        <button className="btn secondaire" disabled={!lignes.length} onClick={() => exporterCsv('outil5_references', lignes.map(({ depistages, ...r }) => ({ ...r, code: (depistages as Valeurs)?.code })))}>Exporter (CSV)</button>
      </div>
      <Tableau lignes={lignes} onClic={setEdition} vide="Aucune référence pour le moment."
        colonnes={[
          { titre: 'N°', rendu: (l) => <span className="mono">{String(l.numero)}</span> },
          { titre: 'Code', rendu: (l) => <span className="mono">{String((l.depistages as Valeurs)?.code ?? '')}</span> },
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

function FicheReferenceImprimable({ r, onRetour }: { r: Valeurs; onRetour: () => void }) {
  const d = (r.depistages ?? {}) as Valeurs;
  const site = (d.sites as Valeurs | undefined)?.nom;
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
        <tr><th>Structure qui réfère</th><td>{String(site ?? '')}</td></tr>
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
