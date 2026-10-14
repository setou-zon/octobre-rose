import { useCallback, useEffect, useState } from 'react';
import { LIBELLES, synthese } from '../forms/definitions';
import type { Valeurs } from '../forms/types';
import { FormRenderer } from '../components/FormRenderer';
import { Tableau } from '../components/PageListe';
import { exporterCsv } from '../lib/data';
import { messageErreur, supabase } from '../lib/supabase';
import { useSession, type Profil } from '../lib/session';

const aujourdhui = () => new Date().toISOString().slice(0, 10);
const n = (x: unknown) => Number(x ?? 0);

// ---------------------------------------------------------------------------
// Tableau de bord (accueil)
// ---------------------------------------------------------------------------
export function PageAccueil({ allerA }: { allerA: (p: string) => void }) {
  const [ind, setInd] = useState<Valeurs[]>([]);
  const [taux, setTaux] = useState<Valeurs[]>([]);
  const [jour, setJour] = useState<Valeurs[]>([]);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    (async () => {
      const [a, b, c] = await Promise.all([
        supabase.from('v_indicateurs').select('*').order('ordre'),
        supabase.from('v_taux').select('*').order('ordre'),
        supabase.from('v_synthese_journaliere').select('date_depistage, accueillies, depistages_col, referees'),
      ]);
      const e = a.error ?? b.error ?? c.error;
      if (e) setErreur(messageErreur(e));
      setInd((a.data ?? []) as Valeurs[]);
      setTaux((b.data ?? []) as Valeurs[]);
      setJour((c.data ?? []) as Valeurs[]);
    })();
  }, []);

  const parJour = Object.entries(jour.reduce<Record<string, number>>((acc, l) => {
    const d = String(l.date_depistage); acc[d] = (acc[d] ?? 0) + n(l.accueillies); return acc;
  }, {})).sort(([x], [y]) => x.localeCompare(y));
  const maxJour = Math.max(1, ...parJour.map(([, v]) => v));
  const cles = ['sensibilises_femmes', 'examens_seins', 'depistages_col', 'cas_references'];

  return (
    <section>
      {erreur && <div className="alerte erreur">{erreur}</div>}
      <div className="raccourcis">
        <button className="btn principal grand" onClick={() => allerA('fiche')}>+ Nouvelle bénéficiaire</button>
        <button className="btn secondaire grand" onClick={() => allerA('sensibilisation')}>+ Séance de sensibilisation</button>
      </div>
      <div className="tuiles">
        {ind.filter((i) => cles.includes(String(i.indicateur))).map((i) => (
          <div className="tuile" key={String(i.indicateur)}>
            <span className="tuile-libelle">{String(i.libelle).replace(' ou une orientation', '').replace(' vers une structure sanitaire', '')}</span>
            <span className="tuile-valeur">{n(i.realise).toLocaleString('fr-FR')}</span>
            {i.cible != null && (
              <>
                <div className="jauge"><div style={{ width: `${Math.min(100, n(i.taux))}%` }} /></div>
                <span className="tuile-cible">{n(i.taux)} % de la cible ({n(i.cible).toLocaleString('fr-FR')})</span>
              </>
            )}
          </div>
        ))}
      </div>

      <div className="deux-colonnes">
        <div className="carte">
          <h3>Femmes accueillies par jour</h3>
          {parJour.length === 0 ? <p className="vide">Pas encore de dépistage.</p> : (
            <div className="barres">
              {parJour.map(([d, v]) => (
                <div className="barre-ligne" key={d}>
                  <span>{new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })}</span>
                  <div className="barre-fond"><div style={{ width: `${(100 * v) / maxJour}%` }} /></div>
                  <b>{v}</b>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="carte">
          <h3>Taux clés</h3>
          <ul className="taux">
            {taux.map((t) => (
              <li key={String(t.ordre)}>
                <span>{String(t.libelle)}</span>
                <b>{t.taux == null ? '–' : `${t.taux} %`}</b>
                <small>{n(t.numerateur)} / {n(t.denominateur)}</small>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Outil 7 – Synthèse journalière par site
// ---------------------------------------------------------------------------
const LIGNES_7: [string, string][] = [
  ['accueillies', 'Femmes accueillies'],
  ['examens_seins', 'Examen clinique des seins'],
  ['premiers_examens_seins', 'dont 1er examen de leur vie'],
  ['anomalies_suspectes', 'Anomalies mammaires suspectes'],
  ['orientees_imagerie', 'Orientées vers écho / mammographie'],
  ['depistages_col', 'Dépistées pour le col'],
  ['premiers_depistages_col', 'dont 1er dépistage de leur vie'],
  ['lesions_precancereuses', 'Lésions précancéreuses (positives)'],
  ['suspicions_cancer_col', 'Suspicions de cancer du col'],
  ['lesions_traitees', 'Lésions traitées sur place'],
  ['referees', 'Femmes référées'],
  ['refus', 'Femmes ayant refusé un examen'],
];

export function PageSynthese() {
  const { sites, profil } = useSession();
  const [site, setSite] = useState(profil?.site_id ? String(profil.site_id) : String(sites[0]?.id ?? ''));
  const [date, setDate] = useState(aujourdhui());
  const [chiffres, setChiffres] = useState<Valeurs[]>([]);
  const [logistique, setLogistique] = useState<Valeurs | null>(null);
  const [edition, setEdition] = useState(false);
  const [erreur, setErreur] = useState('');
  const [info, setInfo] = useState('');

  const charger = useCallback(async () => {
    if (!site) return;
    const [a, b] = await Promise.all([
      supabase.from('v_synthese_journaliere').select('*').eq('site_id', Number(site)).eq('date_depistage', date),
      supabase.from('syntheses_journalieres').select('*').eq('site_id', Number(site)).eq('date_synthese', date).maybeSingle(),
    ]);
    const e = a.error ?? b.error;
    setErreur(e ? messageErreur(e) : '');
    setChiffres((a.data ?? []) as Valeurs[]);
    setLogistique((b.data as Valeurs) ?? null);
  }, [site, date]);
  useEffect(() => { charger(); }, [charger]);

  const val = (cle: string, tranche?: string) =>
    chiffres.filter((c) => !tranche || c.tranche_age === tranche).reduce((s, c) => s + n(c[cle]), 0);

  if (edition) {
    return (
      <section>
        <h2>Logistique et difficultés du jour</h2>
        <FormRenderer form={synthese} id={logistique?.id as string | undefined}
          initial={logistique ?? { ...synthese.defaut!(), site_id: Number(site), date_synthese: date }}
          onAnnuler={() => setEdition(false)}
          onEnregistre={() => { setEdition(false); setInfo('Synthèse enregistrée.'); charger(); }} />
      </section>
    );
  }

  const nomSite = sites.find((s) => String(s.id) === site)?.nom ?? '';
  const exporter = () => exporterCsv(`outil7_synthese_${nomSite}_${date}`, LIGNES_7.map(([k, l]) => ({
    indicateur: l, moins_25_ans: val(k, 'moins_25'), '25_49_ans': val(k, '25_49'), '50_ans_et_plus': val(k, '50_plus'), total: val(k),
  })));

  return (
    <section>
      <p className="intro">Outil 7 – calculée automatiquement à partir des fiches. À transmettre chaque soir avant 20 h.</p>
      {erreur && <div className="alerte erreur">{erreur}</div>}
      {info && <div className="alerte succes">{info}</div>}
      <div className="filtres">
        <label>Site
          <select value={site} onChange={(e) => setSite(e.target.value)}>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
          </select>
        </label>
        <label>Date <input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <button className="btn secondaire" onClick={exporter}>Exporter (CSV)</button>
        <button className="btn secondaire" onClick={() => window.print()}>Imprimer</button>
      </div>
      <div className="tableau-defile">
        <table>
          <thead><tr><th>Indicateur</th><th className="num">&lt; 25 ans</th><th className="num">25 – 49 ans</th><th className="num">50 ans et +</th><th className="num">Total</th></tr></thead>
          <tbody>
            {LIGNES_7.map(([k, l]) => (
              <tr key={k} className={l.startsWith('dont') ? 'sous-ligne' : ''}>
                <td>{l}</td>
                <td className="num">{val(k, 'moins_25')}</td><td className="num">{val(k, '25_49')}</td>
                <td className="num">{val(k, '50_plus')}</td><td className="num"><b>{val(k)}</b></td>
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
const TABLES_EXPORT: [string, string][] = [
  ['seances_sensibilisation', 'outil1_seances'],
  ['v_registre_depistage', 'outil3_registre_anonyme'],
  ['references_cas', 'outil5_references'],
  ['supports_communication', 'outil6a_supports'],
  ['activites_medias', 'outil6b_medias'],
  ['leaders_impliques', 'outil6c_leaders'],
  ['v_synthese_journaliere', 'outil7_syntheses'],
  ['syntheses_journalieres', 'outil7_logistique'],
];

export function PageIndicateurs() {
  const { profil } = useSession();
  const coord = profil?.role === 'coordination';
  const [ind, setInd] = useState<Valeurs[]>([]);
  const [taux, setTaux] = useState<Valeurs[]>([]);
  const [erreur, setErreur] = useState('');

  const charger = useCallback(async () => {
    const [a, b] = await Promise.all([
      supabase.from('v_indicateurs').select('*').order('ordre'),
      supabase.from('v_taux').select('*').order('ordre'),
    ]);
    const e = a.error ?? b.error;
    setErreur(e ? messageErreur(e) : '');
    setInd((a.data ?? []) as Valeurs[]);
    setTaux((b.data ?? []) as Valeurs[]);
  }, []);
  useEffect(() => { charger(); }, [charger]);

  async function changerCible(indicateur: string, v: string) {
    const cible = v === '' ? null : Math.max(0, Math.round(Number(v)));
    const { error } = await supabase.from('cibles').update({ cible, updated_at: new Date().toISOString() }).eq('indicateur', indicateur);
    if (error) setErreur(messageErreur(error)); else charger();
  }

  async function exporterTable(table: string, nom: string) {
    const { data, error } = await supabase.from(table).select('*').limit(10000);
    if (error) setErreur(messageErreur(error)); else exporterCsv(nom, (data ?? []) as Valeurs[]);
  }

  return (
    <section>
      <p className="intro">Outil 8 – indicateurs de la section 13 des TDR, calculés en direct. {coord ? 'Saisissez les cibles dans la colonne « Cible ».' : ''}</p>
      {erreur && <div className="alerte erreur">{erreur}</div>}
      <div className="tableau-defile">
        <table>
          <thead><tr><th>Indicateur TDR</th><th>Source</th><th className="num">Cible</th><th className="num">Réalisé</th><th className="num">Taux</th></tr></thead>
          <tbody>
            {ind.map((i) => (
              <tr key={String(i.indicateur)}>
                <td>{String(i.libelle)}</td>
                <td className="discret">{String(i.source)}</td>
                <td className="num">
                  {coord ? (
                    <input className="cible" type="number" min={0} defaultValue={i.cible == null ? '' : String(i.cible)}
                      aria-label={`Cible – ${i.libelle}`} onBlur={(e) => changerCible(String(i.indicateur), e.target.value)} />
                  ) : (i.cible == null ? '–' : n(i.cible).toLocaleString('fr-FR'))}
                </td>
                <td className="num"><b>{n(i.realise).toLocaleString('fr-FR')}</b></td>
                <td className="num">{i.taux == null ? '–' : `${i.taux} %`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3>Taux à calculer pour le rapport</h3>
      <Tableau lignes={taux} colonnes={[
        { titre: 'Taux', rendu: (t) => String(t.libelle) },
        { titre: 'Numérateur', num: true, rendu: (t) => String(t.numerateur) },
        { titre: 'Dénominateur', num: true, rendu: (t) => String(t.denominateur) },
        { titre: 'Résultat', num: true, rendu: (t) => <b>{t.taux == null ? '–' : `${t.taux} %`}</b> },
      ]} />
      <h3>Exporter les données (CSV, ouvrable dans Excel)</h3>
      <div className="barre enveloppe">
        <button className="btn secondaire" onClick={() => exporterCsv('outil8_indicateurs', ind)}>Indicateurs</button>
        {TABLES_EXPORT.map(([t, nom]) => (
          <button key={t} className="btn secondaire" onClick={() => exporterTable(t, nom)}>{nom.replace(/_/g, ' ')}</button>
        ))}
        {coord && <button className="btn secondaire" onClick={() => exporterTable('depistages', 'outil2_fiches_nominatives')}>outil2 fiches nominatives</button>}
      </div>
      {coord && <p className="aide">Les fiches nominatives contiennent des données de santé : ne les partagez qu’avec la structure sanitaire concernée.</p>}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Équipe – validation des comptes (coordination)
// ---------------------------------------------------------------------------
export function PageEquipe() {
  const { sites, profil: moi } = useSession();
  const [profils, setProfils] = useState<Profil[]>([]);
  const [erreur, setErreur] = useState('');

  const charger = useCallback(async () => {
    const { data, error } = await supabase.from('profils').select('*').order('valide').order('created_at', { ascending: false });
    if (error) setErreur(messageErreur(error)); else setProfils((data ?? []) as Profil[]);
  }, []);
  useEffect(() => { charger(); }, [charger]);

  async function maj(id: string, champs: Partial<Profil>) {
    const { error } = await supabase.from('profils').update(champs).eq('id', id);
    if (error) setErreur(messageErreur(error)); else charger();
  }

  return (
    <section>
      <p className="intro">Validez chaque nouveau compte et rattachez-le à un site. Un agent ne voit les fiches nominatives que de son site.</p>
      {erreur && <div className="alerte erreur">{erreur}</div>}
      <div className="tableau-defile">
        <table>
          <thead><tr><th>Nom</th><th>E-mail</th><th>Rôle</th><th>Site</th><th>Accès</th></tr></thead>
          <tbody>
            {profils.map((p) => (
              <tr key={p.id}>
                <td>{p.nom_complet || '–'}</td>
                <td className="discret">{p.email}</td>
                <td>
                  <select value={p.role} disabled={p.id === moi?.id} onChange={(e) => maj(p.id, { role: e.target.value as Profil['role'] })}>
                    {Object.entries(LIBELLES.role).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </td>
                <td>
                  <select value={p.site_id ?? ''} onChange={(e) => maj(p.id, { site_id: e.target.value ? Number(e.target.value) : null })}>
                    <option value="">Tous les sites</option>
                    {sites.map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
                  </select>
                </td>
                <td>
                  {p.id === moi?.id ? 'Vous' : (
                    <button className={`btn ${p.valide ? 'secondaire' : 'principal'} petit`} onClick={() => maj(p.id, { valide: !p.valide })}>
                      {p.valide ? 'Suspendre' : 'Valider'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
