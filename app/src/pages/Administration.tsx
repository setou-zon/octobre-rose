import { useCallback, useEffect, useState } from 'react';
import { LIBELLES, depistage, reference, seance, synthese } from '../forms/definitions';
import { BoutonPdf } from '../components/BoutonPdf';
import { chargerSites, useAuth, type Compte, type Role, type Site } from '../lib/auth';
import { TABLES, tout } from '../lib/db';
import { dateFr } from '../lib/format';
import { exporterPaquet, importerPaquet, liste, type BilanImport } from '../lib/store';
import { messageErreur, supabase } from '../lib/supabase';
import { etatSync, synchroniser, type EtatSync } from '../lib/sync';

const NOMS_TABLES: Record<string, string> = {
  seances_sensibilisation: 'Séances de sensibilisation',
  depistages: 'Fiches de dépistage',
  references_cas: 'Références',
  supports_communication: 'Supports',
  activites_medias: 'Activités médias',
  leaders_impliques: 'Leaders',
  syntheses_journalieres: 'Synthèses journalières',
};

// ---------------------------------------------------------------------------
// Données : synchronisation avec la base centrale, sauvegarde, fiches vierges
// ---------------------------------------------------------------------------
export function PageDonnees() {
  const { compte } = useAuth();
  const admin = compte?.role === 'admin';
  const [sync, setSync] = useState<EtatSync>(etatSync());
  const [compteurs, setCompteurs] = useState<Record<string, { total: number; attente: number }>>({});
  const [message, setMessage] = useState<{ type: 'succes' | 'erreur'; texte: string } | null>(null);
  const [bilans, setBilans] = useState<BilanImport[]>([]);

  const charger = useCallback(async () => {
    const c: Record<string, { total: number; attente: number }> = {};
    for (const t of TABLES) {
      const visibles = await liste(t, compte);
      const attente = (await tout(t)).filter((f) => f._a_envoyer).length;
      c[t] = { total: visibles.length, attente };
    }
    setCompteurs(c);
  }, [compte]);

  useEffect(() => {
    charger();
    const s = (e: Event) => { setSync((e as CustomEvent<EtatSync>).detail); charger(); };
    window.addEventListener('or26-sync', s);
    return () => window.removeEventListener('or26-sync', s);
  }, [charger]);

  async function importer(fichiers: FileList | null) {
    if (!fichiers?.length) return;
    const res: BilanImport[] = [];
    try {
      for (const f of Array.from(fichiers)) res.push(await importerPaquet(await f.text(), f.name));
      setBilans(res);
      setMessage({ type: 'succes', texte: `${res.length} fichier(s) importé(s). Les fiches vont être envoyées à la base centrale.` });
      synchroniser();
    } catch (e) {
      setMessage({ type: 'erreur', texte: (e as Error).message });
    }
    charger();
  }

  return (
    <section>
      <p className="intro">Chaque fiche est d’abord enregistrée sur ce téléphone, puis envoyée automatiquement à la base centrale dès qu’il y a du réseau. Les fiches des autres agents arrivent de la même façon.</p>
      {message && <div className={`alerte ${message.type}`} role="status">{message.texte}</div>}

      <div className="carte synchro">
        <div>
          <h3>Base centrale</h3>
          <p className="etat-synchro">
            {sync.enCours ? 'Synchronisation en cours…'
              : sync.enAttente ? <><b>{sync.enAttente}</b> fiche(s) en attente d’envoi{navigator.onLine ? '' : ' (pas de réseau)'}</>
              : <>✓ Toutes les fiches de ce téléphone sont dans la base centrale</>}
          </p>
          <p className="aide">Dernière synchronisation : {sync.derniere ? new Date(sync.derniere).toLocaleString('fr-FR') : 'jamais'}</p>
          {sync.erreur && <div className="alerte erreur">Problème : {sync.erreur}</div>}
          {sync.renumerotes.length > 0 && (
            <div className="alerte attention">
              Codes déjà utilisés par une autre fiche, renumérotés : {sync.renumerotes.map((r) => `${r.ancien} → ${r.nouveau}`).join(' · ')}. Corrigez-les sur les fiches papier.
            </div>
          )}
        </div>
        <button className="btn principal" disabled={sync.enCours || !navigator.onLine} onClick={() => synchroniser()}>Synchroniser maintenant</button>
      </div>

      <div className="carte">
        <h3>Fiches disponibles sur ce téléphone</h3>
        <ul className="compteurs">
          {TABLES.map((t) => (
            <li key={t}><span>{NOMS_TABLES[t]}{compteurs[t]?.attente ? <span className="discret"> · {compteurs[t].attente} à envoyer</span> : null}</span><b>{compteurs[t]?.total ?? 0}</b></li>
          ))}
        </ul>
      </div>

      <div className="carte">
        <h3>Fiches vierges à imprimer</h3>
        <p className="aide">Pour la saisie sur papier quand aucun téléphone n’est disponible.</p>
        <div className="barre enveloppe">
          <BoutonPdf form={seance} valeurs={null} titre="Outil 1 - Séance de sensibilisation" nomFichier="fiche-vierge_outil1_sensibilisation.pdf" libelle="Outil 1 – Sensibilisation" />
          <BoutonPdf form={depistage} valeurs={null} titre="Outil 2 - Fiche individuelle de dépistage" nomFichier="fiche-vierge_outil2_depistage.pdf" libelle="Outil 2 – Dépistage" />
          <BoutonPdf form={reference} valeurs={null} titre="Outil 4 - Fiche de référence / contre-référence" nomFichier="fiche-vierge_outil4_reference.pdf" libelle="Outil 4 – Référence"
            enTete={[['Code bénéficiaire', ''], ['Patiente (nom, âge)', ''], ['Téléphone', ''], ['Structure qui réfère', '']]} />
          <BoutonPdf form={synthese} valeurs={null} titre="Outil 7 - Logistique et difficultés du jour" nomFichier="fiche-vierge_outil7_logistique.pdf" libelle="Outil 7 – Logistique" />
        </div>
      </div>

      <details className="carte">
        <summary><b>Sauvegarde de secours (fichier)</b></summary>
        <p className="aide">Sans réseau pendant longtemps, un agent peut créer un fichier avec ses fiches et l’envoyer par WhatsApp ou clé USB ; un administrateur l’importe et les fiches partent vers la base centrale.</p>
        <div className="barre">
          <button className="btn secondaire" onClick={async () => { const n = await exporterPaquet(compte!); setMessage({ type: 'succes', texte: `Fichier de sauvegarde créé (${n} fiches).` }); }}>Créer un fichier de sauvegarde</button>
          {admin && (
            <label className="btn secondaire fichier">
              Importer des fichiers…
              <input type="file" accept=".json,application/json" multiple onChange={(e) => { importer(e.target.files); e.target.value = ''; }} />
            </label>
          )}
        </div>
        {bilans.length > 0 && (
          <ul className="bilans">
            {bilans.map((b, i) => (
              <li key={i}>
                <b>{b.exporte_par}</b> : {b.ajoutees} nouvelle(s), {b.misesAJour} mise(s) à jour, {b.ignorees} déjà présente(s)
                {b.renumerotees.length > 0 && <div className="alerte attention">Renumérotés : {b.renumerotees.join(' · ')}</div>}
              </li>
            ))}
          </ul>
        )}
      </details>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Équipe : validation des comptes, rôles, sites (administrateur, en ligne)
// ---------------------------------------------------------------------------
export function PageEquipe() {
  const { compte: moi, sites, rafraichir } = useAuth();
  const [profils, setProfils] = useState<Compte[]>([]);
  const [choixSite, setChoixSite] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ type: 'succes' | 'erreur'; texte: string } | null>(null);
  const [nouveauSite, setNouveauSite] = useState({ code: '', nom: '', type: 'communautaire' as Site['type'] });
  const [chargement, setChargement] = useState(true);

  const charger = useCallback(async () => {
    setChargement(true);
    const { data, error } = await supabase.from('profils').select('*').order('created_at', { ascending: false });
    if (error) setMessage({ type: 'erreur', texte: navigator.onLine ? messageErreur(error) : 'La gestion de l’équipe demande du réseau.' });
    else setProfils((data ?? []) as Compte[]);
    setChargement(false);
  }, []);
  useEffect(() => { charger(); }, [charger]);

  async function maj(p: Compte, champs: Partial<Compte>, texte: string) {
    setMessage(null);
    const { error } = await supabase.from('profils').update(champs).eq('id', p.id);
    if (error) setMessage({ type: 'erreur', texte: messageErreur(error) });
    else { setMessage({ type: 'succes', texte }); charger(); if (p.id === moi?.id) rafraichir(); }
  }

  async function ajouterSite(e: React.FormEvent) {
    e.preventDefault(); setMessage(null);
    const code = nouveauSite.code.trim().toUpperCase();
    if (!/^[A-Z]{2,5}$/.test(code)) return setMessage({ type: 'erreur', texte: 'Code du site : 2 à 5 lettres (ex. GOU).' });
    if (!nouveauSite.nom.trim()) return setMessage({ type: 'erreur', texte: 'Indiquez le nom du site.' });
    const id = Math.max(0, ...sites.map((s) => s.id)) + 1;
    const { error } = await supabase.from('sites').insert({ id, code, nom: nouveauSite.nom.trim(), type: nouveauSite.type });
    if (error) return setMessage({ type: 'erreur', texte: /duplicate/.test(error.message) ? 'Ce code de site existe déjà.' : messageErreur(error) });
    setNouveauSite({ code: '', nom: '', type: 'communautaire' });
    await chargerSites(); await rafraichir();
    setMessage({ type: 'succes', texte: `Site ${code} ajouté.` });
  }

  const demandes = profils.filter((p) => !p.valide && p.actif);
  const equipe = profils.filter((p) => p.valide || !p.actif);
  const adminsActifs = profils.filter((p) => p.role === 'admin' && p.valide && p.actif).length;
  const siteDe = (p: Compte) => choixSite[p.id] ?? (p.site_souhaite != null ? String(p.site_souhaite) : '');

  return (
    <section>
      <p className="intro">Chaque personne crée son compte avec son adresse e-mail et la confirme par le lien reçu ; vous validez ensuite le compte ici et choisissez son site. Un agent rattaché à un site ne voit que les fiches nominatives de ce site.</p>
      {message && <div className={`alerte ${message.type}`}>{message.texte}</div>}
      {chargement && <p className="chargement">Chargement…</p>}

      {demandes.length > 0 && (
        <div className="carte demandes">
          <h3>Demandes de compte à valider ({demandes.length})</h3>
          <ul className="liste-demandes">
            {demandes.map((p) => (
              <li key={p.id}>
                <div>
                  <b>{p.nom_complet}</b> <span className="mono discret">{p.identifiant}</span>
                  <div className="discret">{p.telephone ? `${p.telephone} · ` : ''}demande du {dateFr(p.created_at)}</div>
                </div>
                <select aria-label={`Site de ${p.nom_complet}`} value={siteDe(p)} onChange={(e) => setChoixSite({ ...choixSite, [p.id]: e.target.value })}>
                  <option value="">Tous les sites</option>
                  {sites.map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
                </select>
                <div className="actions-demande">
                  <button className="btn principal petit" onClick={() => maj(p, { valide: true, site_id: siteDe(p) ? Number(siteDe(p)) : null }, `Compte de ${p.nom_complet} validé.`)}>Valider</button>
                  <button className="btn secondaire petit" onClick={() => { if (confirm(`Refuser la demande de ${p.nom_complet} ?`)) maj(p, { actif: false }, 'Demande refusée.'); }}>Refuser</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {equipe.length > 0 && (
        <div className="tableau-defile">
          <table>
            <thead><tr><th>Nom</th><th>E-mail</th><th>Rôle</th><th>Site</th><th>Accès</th></tr></thead>
            <tbody>
              {equipe.map((p) => {
                const dernierAdmin = p.role === 'admin' && adminsActifs <= 1;
                return (
                  <tr key={p.id}>
                    <td>{p.nom_complet}{p.id === moi?.id ? ' (vous)' : ''}<div className="discret">{p.telephone ?? ''}</div></td>
                    <td className="mono">{p.identifiant}</td>
                    <td>
                      <select value={p.role} disabled={dernierAdmin} onChange={(e) => maj(p, { role: e.target.value as Role }, 'Rôle modifié.')}>
                        {Object.entries(LIBELLES.role).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </td>
                    <td>
                      <select value={p.site_id ?? ''} onChange={(e) => maj(p, { site_id: e.target.value ? Number(e.target.value) : null }, 'Site modifié.')}>
                        <option value="">Tous les sites</option>
                        {sites.map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
                      </select>
                    </td>
                    <td>
                      {p.id === moi?.id || dernierAdmin ? <span className="pastille p-normal">Actif</span> : (
                        <button className={`btn ${p.actif && p.valide ? 'secondaire' : 'principal'} petit`}
                          onClick={() => maj(p, p.actif && p.valide ? { actif: false } : { actif: true, valide: true }, p.actif ? 'Compte désactivé.' : 'Compte réactivé.')}>
                          {p.actif && p.valide ? 'Désactiver' : 'Réactiver'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="carte">
        <h3>Sites</h3>
        <ul className="compteurs">
          {sites.map((s) => <li key={s.id}><span>{s.nom} <span className="discret">· {s.type === 'communautaire' ? 'communautaire' : 'formation sanitaire'}</span></span><b className="mono">{s.code}</b></li>)}
        </ul>
        <form className="ajout-site" onSubmit={ajouterSite}>
          <input placeholder="Code (ex. GOU)" value={nouveauSite.code} maxLength={5} onChange={(e) => setNouveauSite({ ...nouveauSite, code: e.target.value.toUpperCase() })} aria-label="Code du site" />
          <input placeholder="Nom du site" value={nouveauSite.nom} onChange={(e) => setNouveauSite({ ...nouveauSite, nom: e.target.value })} aria-label="Nom du site" />
          <select value={nouveauSite.type} onChange={(e) => setNouveauSite({ ...nouveauSite, type: e.target.value as Site['type'] })} aria-label="Type de site">
            <option value="communautaire">Communautaire</option>
            <option value="formation_sanitaire">Formation sanitaire</option>
          </select>
          <button className="btn secondaire">Ajouter le site</button>
        </form>
      </div>
    </section>
  );
}
