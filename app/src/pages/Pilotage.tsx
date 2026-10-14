import { useCallback, useEffect, useState } from 'react';
import { synthese } from '../forms/definitions';
import { FormRenderer } from '../components/FormRenderer';
import { Tableau } from '../components/Tableau';
import { Ruban } from '../components/Ruban';
import { useAuth } from '../lib/auth';
import { metaEcrire, metaLire, type Fiche, type Table } from '../lib/db';
import { exporterExcel } from '../lib/excel';
import { aujourdhui, nombre } from '../lib/format';
import { indicateurs, sensibilisationParAge, syntheseJour, taux } from '../lib/indicateurs';
import { exporterCsv, liste, toutesLesDonnees } from '../lib/store';

type Donnees = Record<Table, Fiche[]>;

/** Charge toutes les données visibles et se met à jour à chaque enregistrement ou import */
function useDonnees() {
  const { compte } = useAuth();
  const [d, setD] = useState<Donnees | null>(null);
  const [cibles, setCibles] = useState<Record<string, number | null>>({});
  const charger = useCallback(async () => {
    const [donnees, c] = await Promise.all([toutesLesDonnees(compte), metaLire<Record<string, number | null>>('cibles')]);
    setD(donnees); setCibles(c ?? {});
  }, [compte]);
  useEffect(() => {
    charger();
    window.addEventListener('or26-donnees', charger);
    return () => window.removeEventListener('or26-donnees', charger);
  }, [charger]);
  return { d, cibles, charger };
}

// ---------------------------------------------------------------------------
// Tableau de bord
// ---------------------------------------------------------------------------
const DEBUT = '2026-10-07';
const FIN = '2026-10-11';

export function PageAccueil({ allerA }: { allerA: (p: string) => void }) {
  const { compte, sites } = useAuth();
  const { d, cibles } = useDonnees();
  const [telechargement, setTelechargement] = useState(false);
  if (!d) return <p className="chargement">Chargement…</p>;

  const ind = indicateurs(d, cibles);
  const tx = taux(d);
  const get = (k: string) => ind.find((i) => i.cle === k)!;
  const sensibilises = get('sensibilises_femmes').realise + get('sensibilises_hommes').realise;
  const aujourd = aujourdhui();
  const jourCampagne = aujourd < DEBUT ? null : aujourd > FIN ? 'terminee' : Math.round((new Date(aujourd).getTime() - new Date(DEBUT).getTime()) / 86400000) + 1;

  // Femmes accueillies par jour de campagne (7 → 11 octobre) + jours hors période s'il y en a
  const parJour = new Map<string, number>();
  for (let j = 7; j <= 11; j++) parJour.set(`2026-10-${String(j).padStart(2, '0')}`, 0);
  for (const x of d.depistages) parJour.set(String(x.date_depistage), (parJour.get(String(x.date_depistage)) ?? 0) + 1);
  const jours = [...parJour.entries()].sort(([a], [b]) => a.localeCompare(b));
  const maxJour = Math.max(1, ...jours.map(([, v]) => v));

  const age = sensibilisationParAge(d.seances_sensibilisation);
  const maxAge = Math.max(1, ...age.flatMap((a) => [a.femmes, a.hommes]));

  const parSite = sites.map((s) => {
    const l = d.depistages.filter((x) => x.site_id === s.id);
    return { site: s.nom, femmes: l.length, seins: l.filter((x) => x.sein_examine).length, col: l.filter((x) => x.col_realise).length,
      referees: l.filter((x) => ['ref_sein', 'ref_col', 'ref_deux'].includes(String(x.decision_finale))).length };
  }).filter((s) => s.femmes > 0);

  async function toutTelecharger(nominatif: boolean) {
    setTelechargement(true);
    try { await exporterExcel(d!, sites, cibles, nominatif); } finally { setTelechargement(false); }
  }

  const TUILES = [
    { cle: 'sensibilises', libelle: 'Personnes sensibilisées', valeur: sensibilises, detail: `${nombre(get('sensibilises_femmes').realise)} femmes · ${nombre(get('sensibilises_hommes').realise)} hommes`, ind: null },
    { cle: 'examens_seins', libelle: 'Examens cliniques des seins', valeur: get('examens_seins').realise, ind: get('examens_seins') },
    { cle: 'depistages_col', libelle: 'Dépistages du col de l’utérus', valeur: get('depistages_col').realise, ind: get('depistages_col') },
    { cle: 'cas_references', libelle: 'Femmes référées', valeur: get('cas_references').realise, detail: `${nombre(get('references_effectives').realise)} reçues par la structure`, ind: get('cas_references') },
  ];

  return (
    <section className="tableau-de-bord">
      <div className="banniere">
        <Ruban className="banniere-ruban" />
        <div>
          <p className="banniere-sur">Campagne de lutte contre les cancers féminins · ADG</p>
          <h2 className="banniere-titre">Octobre Rose 2026</h2>
          <p className="banniere-texte">
            Dépistage du sein et du col de l’utérus du 7 au 11 octobre 2026
            {jourCampagne === 'terminee' ? ' · campagne terminée' : jourCampagne ? ` · jour ${jourCampagne} sur 5` : ''}
          </p>
        </div>
        <div className="banniere-actions">
          <button className="btn blanc" onClick={() => allerA('fiche')}>+ Nouvelle bénéficiaire</button>
          <button className="btn contour-blanc" onClick={() => allerA('sensibilisation')}>+ Séance de sensibilisation</button>
        </div>
      </div>

      <div className="tuiles">
        {TUILES.map((t) => (
          <div className="tuile" key={t.cle}>
            <span className="tuile-libelle">{t.libelle}</span>
            <span className="tuile-valeur">{nombre(t.valeur)}</span>
            {t.ind?.cible ? (
              <>
                <div className="jauge" role="progressbar" aria-valuenow={t.ind.taux ?? 0} aria-valuemin={0} aria-valuemax={100} aria-label={`${t.libelle} : ${nombre(t.ind.taux)} % de la cible`}>
                  <div style={{ width: `${Math.min(100, t.ind.taux ?? 0)}%` }} />
                </div>
                <span className="tuile-detail">{nombre(t.ind.taux)} % de la cible ({nombre(t.ind.cible)})</span>
              </>
            ) : <span className="tuile-detail">{t.detail ?? 'Cible non fixée'}</span>}
          </div>
        ))}
      </div>

      <div className="deux-colonnes">
        <figure className="carte graphique">
          <figcaption><h3>Femmes accueillies par jour</h3></figcaption>
          <div className="colonnes-graph" role="img" aria-label={jours.map(([j, v]) => `${j} : ${v}`).join(', ')}>
            {jours.map(([j, v]) => (
              <div className="col-graph" key={j} title={`${new Date(j + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} : ${v} femme(s)`}>
                <div className="col-zone">
                  <span className="col-valeur">{v || ''}</span>
                  <div className="col-barre" style={{ height: `${(100 * v) / maxJour}%` }} />
                </div>
                <span className="col-jour">{new Date(j + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })}</span>
              </div>
            ))}
          </div>
        </figure>

        <figure className="carte graphique">
          <figcaption>
            <h3>Personnes sensibilisées par âge</h3>
            <div className="legende-graph"><span className="cle femmes" /> Femmes <span className="cle hommes" /> Hommes</div>
          </figcaption>
          <div className="barres-groupes">
            {age.map((a) => (
              <div className="groupe" key={a.libelle}>
                <span className="groupe-libelle">{a.libelle}</span>
                <div className="paire">
                  <div className="ligne-barre" title={`${a.libelle} – femmes : ${a.femmes}`}>
                    <div className="b femmes" style={{ width: `${(100 * a.femmes) / maxAge}%` }} /><span>{a.femmes}</span>
                  </div>
                  <div className="ligne-barre" title={`${a.libelle} – hommes : ${a.hommes}`}>
                    <div className="b hommes" style={{ width: `${(100 * a.hommes) / maxAge}%` }} /><span>{a.hommes}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </figure>
      </div>

      <div className="deux-colonnes">
        <div className="carte">
          <h3>Taux clés</h3>
          <ul className="taux">
            {tx.map((t) => (
              <li key={t.libelle}>
                <span>{t.libelle}</span>
                <b>{t.taux == null ? '–' : `${nombre(t.taux)} %`}</b>
                <small>{t.numerateur} sur {t.denominateur}</small>
              </li>
            ))}
          </ul>
        </div>
        <div className="carte">
          <h3>Par site de dépistage</h3>
          {parSite.length ? (
            <Tableau lignes={parSite} colonnes={[
              { titre: 'Site', rendu: (l) => String(l.site) },
              { titre: 'Femmes', num: true, rendu: (l) => String(l.femmes) },
              { titre: 'Seins', num: true, rendu: (l) => String(l.seins) },
              { titre: 'Col', num: true, rendu: (l) => String(l.col) },
              { titre: 'Référées', num: true, rendu: (l) => String(l.referees) },
            ]} />
          ) : <p className="vide">Pas encore de dépistage.</p>}
        </div>
      </div>

      <div className="carte telechargement">
        <div>
          <h3>Télécharger les données</h3>
          <p className="aide">Un fichier Excel avec une feuille par outil et les indicateurs. Sans nom ni téléphone.</p>
        </div>
        <div className="barre">
          <button className="btn principal" disabled={telechargement} onClick={() => toutTelecharger(false)}>{telechargement ? 'Préparation…' : 'Télécharger (Excel)'}</button>
          {compte?.role === 'admin' && <button className="btn secondaire" disabled={telechargement} onClick={() => toutTelecharger(true)}>Avec les fiches nominatives</button>}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Outil 7 – Synthèse journalière par site
// ---------------------------------------------------------------------------
export function PageSynthese() {
  const { sites, compte } = useAuth();
  const [site, setSite] = useState(compte?.site_id ? String(compte.site_id) : String(sites[0]?.id ?? ''));
  const [date, setDate] = useState(aujourdhui());
  const [deps, setDeps] = useState<Fiche[]>([]);
  const [logistique, setLogistique] = useState<Fiche | null>(null);
  const [edition, setEdition] = useState(false);
  const [info, setInfo] = useState('');

  const charger = useCallback(async () => {
    const [d, s] = await Promise.all([liste('depistages', compte), liste('syntheses_journalieres', compte)]);
    setDeps(d.filter((x) => String(x.site_id) === site && x.date_depistage === date));
    setLogistique(s.find((x) => String(x.site_id) === site && x.date_synthese === date) ?? null);
  }, [site, date, compte]);
  useEffect(() => { charger(); }, [charger]);

  const lignes = syntheseJour(deps);

  if (edition) {
    return (
      <section>
        <h2>Logistique et difficultés du jour</h2>
        <FormRenderer form={synthese} id={logistique?.id}
          initial={logistique ?? { ...synthese.defaut!(), site_id: Number(site), date_synthese: date }}
          onAnnuler={() => setEdition(false)}
          onEnregistre={() => { setEdition(false); setInfo('Synthèse enregistrée.'); charger(); }} />
      </section>
    );
  }

  const nomSite = sites.find((s) => String(s.id) === site)?.nom ?? '';
  return (
    <section>
      <p className="intro">Outil 7 – calculée automatiquement à partir des fiches. À transmettre chaque soir avant 20 h.</p>
      {info && <div className="alerte succes">{info}</div>}
      <div className="filtres">
        <label>Site
          <select value={site} onChange={(e) => setSite(e.target.value)} disabled={compte?.role !== 'admin' && compte?.site_id != null}>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
          </select>
        </label>
        <label>Date <input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <button className="btn secondaire" onClick={() => exporterCsv(`outil7_synthese_${nomSite}_${date}`, lignes.map(({ cle: _c, ...l }) => l))}>Télécharger (CSV)</button>
        <button className="btn secondaire" onClick={() => window.print()}>Imprimer</button>
      </div>
      <h2 className="imprime-seulement">Synthèse journalière – {nomSite} – {date}</h2>
      <div className="tableau-defile">
        <table>
          <thead><tr><th>Indicateur</th><th className="num">&lt; 25 ans</th><th className="num">25 – 49 ans</th><th className="num">50 ans et +</th><th className="num">Total</th></tr></thead>
          <tbody>
            {lignes.map((l) => (
              <tr key={l.cle} className={l.libelle.startsWith('dont') ? 'sous-ligne' : ''}>
                <td>{l.libelle}</td>
                <td className="num">{l.moins_25}</td><td className="num">{l['25_49']}</td>
                <td className="num">{l['50_plus']}</td><td className="num"><b>{l.total}</b></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="carte">
        <h3>Logistique et difficultés du jour</h3>
        {logistique ? (
          <dl className="details">
            <dt>Ruptures</dt><dd>{String(logistique.ruptures ?? '–')}</dd>
            <dt>Temps d’attente moyen</dt><dd>{logistique.temps_attente_min != null ? `${logistique.temps_attente_min} min` : '–'}</dd>
            <dt>Femmes non reçues faute de temps</dt><dd>{String(logistique.non_recues ?? 0)}</dd>
            <dt>Difficultés et solutions</dt><dd>{String(logistique.difficultes ?? '–')}</dd>
            <dt>Responsable</dt><dd>{String(logistique.responsable ?? '–')}</dd>
          </dl>
        ) : <p className="vide">Pas encore renseignée pour ce jour.</p>}
        <button className="btn secondaire" onClick={() => { setInfo(''); setEdition(true); }}>{logistique ? 'Modifier' : 'Renseigner'}</button>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Outil 8 – Synthèse finale des indicateurs
// ---------------------------------------------------------------------------
export function PageIndicateurs() {
  const { compte, sites } = useAuth();
  const admin = compte?.role === 'admin';
  const { d, cibles, charger } = useDonnees();
  if (!d) return <p className="chargement">Chargement…</p>;
  const ind = indicateurs(d, cibles);

  async function changerCible(cle: string, v: string) {
    const c = { ...cibles, [cle]: v === '' ? null : Math.max(0, Math.round(Number(v))) };
    await metaEcrire('cibles', c);
    charger();
  }

  return (
    <section>
      <p className="intro">Outil 8 – indicateurs de la section 13 des TDR, calculés à partir des fiches de cet appareil (pensez à importer les fichiers des autres appareils). {admin ? 'Saisissez les cibles dans la colonne « Cible ».' : ''}</p>
      <div className="tableau-defile">
        <table>
          <thead><tr><th>Indicateur TDR</th><th>Source</th><th className="num">Cible</th><th className="num">Réalisé</th><th className="num">Taux</th></tr></thead>
          <tbody>
            {ind.map((i) => (
              <tr key={i.cle}>
                <td>{i.libelle}</td>
                <td className="discret">{i.source}</td>
                <td className="num">
                  {admin ? (
                    <input className="cible" type="number" min={0} defaultValue={i.cible == null ? '' : String(i.cible)}
                      aria-label={`Cible – ${i.libelle}`} onBlur={(e) => changerCible(i.cle, e.target.value)} />
                  ) : (i.cible == null ? '–' : nombre(i.cible))}
                </td>
                <td className="num"><b>{nombre(i.realise)}</b></td>
                <td className="num">{i.taux == null ? '–' : `${nombre(i.taux)} %`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3>Taux à calculer pour le rapport</h3>
      <Tableau lignes={taux(d)} colonnes={[
        { titre: 'Taux', rendu: (t) => String(t.libelle) },
        { titre: 'Numérateur', num: true, rendu: (t) => String(t.numerateur) },
        { titre: 'Dénominateur', num: true, rendu: (t) => String(t.denominateur) },
        { titre: 'Résultat', num: true, rendu: (t) => <b>{t.taux == null ? '–' : `${nombre(t.taux)} %`}</b> },
      ]} />
      <div className="barre" style={{ marginTop: '1rem' }}>
        <button className="btn principal" onClick={() => exporterExcel(d, sites, cibles, false)}>Télécharger toutes les données (Excel)</button>
        <button className="btn secondaire" onClick={() => exporterCsv('outil8_indicateurs', ind.map(({ cle: _c, ...i }) => i))}>Indicateurs (CSV)</button>
      </div>
    </section>
  );
}
