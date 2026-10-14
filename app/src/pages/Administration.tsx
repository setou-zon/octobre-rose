import { useCallback, useEffect, useState } from 'react';
import { LIBELLES, depistage, reference, seance, synthese } from '../forms/definitions';
import { BoutonPdf } from '../components/BoutonPdf';
import { preparerMotDePasse, useAuth, verifierRegles, type Compte, type Role, type Site } from '../lib/auth';
import { exporterConfiguration } from '../lib/configuration';
import { TABLES, ecrire, effacer, metaEcrire, metaLire, tout } from '../lib/db';
import { dateFr } from '../lib/format';
import { exporterPaquet, importerPaquet, liste, type BilanImport } from '../lib/store';

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
// Données : envoi à la coordination, import, sauvegarde
// ---------------------------------------------------------------------------
export function PageDonnees() {
  const { compte } = useAuth();
  const admin = compte?.role === 'admin';
  const [compteurs, setCompteurs] = useState<Record<string, number>>({});
  const [derniere, setDerniere] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'succes' | 'erreur'; texte: string } | null>(null);
  const [bilans, setBilans] = useState<BilanImport[]>([]);

  const charger = useCallback(async () => {
    const c: Record<string, number> = {};
    for (const t of TABLES) c[t] = (await liste(t, compte)).length;
    setCompteurs(c);
    setDerniere((await metaLire<string>('derniere-sauvegarde')) ?? null);
  }, [compte]);
  useEffect(() => { charger(); }, [charger]);

  async function exporter() {
    const n = await exporterPaquet(compte!);
    setMessage({ type: 'succes', texte: `Fichier créé avec ${n} fiche(s). Envoyez-le à la coordination (WhatsApp, e-mail, clé USB).` });
    charger();
  }

  async function importer(fichiers: FileList | null) {
    if (!fichiers?.length) return;
    const res: BilanImport[] = [];
    try {
      for (const f of Array.from(fichiers)) res.push(await importerPaquet(await f.text(), f.name));
      setBilans(res);
      setMessage({ type: 'succes', texte: `${res.length} fichier(s) importé(s).` });
    } catch (e) {
      setMessage({ type: 'erreur', texte: (e as Error).message });
    }
    charger();
  }

  const total = Object.values(compteurs).reduce((s, n) => s + n, 0);
  const ancienne = !derniere || Date.now() - new Date(derniere).getTime() > 24 * 3600 * 1000;

  return (
    <section>
      <p className="intro">Les fiches sont enregistrées sur cet appareil, même sans internet. Pour regrouper les données de tous les appareils, chaque agent envoie son fichier à la coordination, qui l’importe.</p>
      {message && <div className={`alerte ${message.type}`} role="status">{message.texte}</div>}

      <div className="deux-colonnes">
        <div className="carte">
          <h3>1. Envoyer mes fiches à la coordination</h3>
          <p>Crée un fichier avec toutes les fiches de cet appareil. À faire chaque soir.</p>
          {total > 0 && ancienne && <div className="alerte attention">{derniere ? `Dernier fichier créé le ${dateFr(derniere)}.` : 'Aucun fichier créé pour l’instant.'} Pensez à le faire aujourd’hui : il sert aussi de sauvegarde.</div>}
          <button className="btn principal" onClick={exporter} disabled={!total}>Créer le fichier d’envoi</button>
        </div>
        {admin && (
          <div className="carte">
            <h3>2. Importer les fichiers des agents</h3>
            <p>Sélectionnez un ou plusieurs fichiers reçus. Une fiche déjà présente n’est jamais dupliquée : la version la plus récente est gardée.</p>
            <label className="btn secondaire fichier">
              Choisir les fichiers…
              <input type="file" accept=".json,application/json" multiple onChange={(e) => { importer(e.target.files); e.target.value = ''; }} />
            </label>
            {bilans.length > 0 && (
              <ul className="bilans">
                {bilans.map((b, i) => (
                  <li key={i}>
                    <b>{b.exporte_par}</b> : {b.ajoutees} nouvelle(s), {b.misesAJour} mise(s) à jour, {b.ignorees} déjà à jour
                    {b.renumerotees.length > 0 && (
                      <div className="alerte attention">Codes déjà utilisés par une autre fiche, renumérotés : {b.renumerotees.join(' · ')}. Corrigez-les sur les fiches papier.</div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
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

      <div className="carte">
        <h3>Fiches sur cet appareil</h3>
        <ul className="compteurs">
          {TABLES.map((t) => <li key={t}><span>{NOMS_TABLES[t]}</span><b>{compteurs[t] ?? 0}</b></li>)}
        </ul>
        <p className="aide">Les données restent dans ce navigateur. Ne videz pas les données du navigateur et ne désinstallez pas l’application sans avoir créé un fichier d’envoi.</p>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Équipe : comptes, sites, configuration (administrateur)
// ---------------------------------------------------------------------------
export function PageEquipe() {
  const { compte: moi, sites, rafraichir } = useAuth();
  const [comptes, setComptes] = useState<Compte[]>([]);
  const [formulaire, setFormulaire] = useState<Partial<Compte> & { mdp?: string } | null>(null);
  const [message, setMessage] = useState<{ type: 'succes' | 'erreur'; texte: string } | null>(null);
  const [nouveauSite, setNouveauSite] = useState({ code: '', nom: '', type: 'communautaire' as Site['type'] });

  const charger = useCallback(async () => {
    setComptes((await tout<Compte>('comptes')).sort((a, b) => a.nom_complet.localeCompare(b.nom_complet)));
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const adminsActifs = comptes.filter((c) => c.role === 'admin' && c.actif && !c.en_attente);
  const demandes = comptes.filter((c) => c.en_attente);
  const [choixSite, setChoixSite] = useState<Record<string, string>>({});

  async function valider(c: Compte) {
    const site = choixSite[c.id] ?? (c.site_souhaite != null ? String(c.site_souhaite) : '');
    await ecrire('comptes', { ...c, actif: true, en_attente: false, site_id: site ? Number(site) : null });
    setMessage({ type: 'succes', texte: `Compte de ${c.nom_complet} validé : la personne peut se connecter sur cet appareil.` });
    charger();
  }
  async function refuser(c: Compte) {
    if (!confirm(`Refuser et supprimer la demande de ${c.nom_complet} ?`)) return;
    await effacer('comptes', c.id);
    setMessage({ type: 'succes', texte: 'Demande refusée.' });
    charger();
  }

  async function enregistrerCompte(e: React.FormEvent) {
    e.preventDefault(); setMessage(null);
    const f = formulaire!;
    try {
      const identifiant = (f.identifiant ?? '').trim();
      if (!identifiant || !(f.nom_complet ?? '').trim()) throw new Error('Nom et identifiant obligatoires.');
      if (comptes.some((c) => c.identifiant.toLowerCase() === identifiant.toLowerCase() && c.id !== f.id)) throw new Error('Cet identifiant est déjà utilisé.');
      const existant = comptes.find((c) => c.id === f.id);
      if (!existant && !f.mdp) throw new Error('Choisissez un mot de passe.');
      if (f.mdp) { const err = verifierRegles(f.mdp); if (err) throw new Error(err); }
      if (existant?.role === 'admin' && (f.role !== 'admin' || !f.actif) && adminsActifs.length === 1) throw new Error('Il doit rester au moins un administrateur actif.');
      const c: Compte = {
        ...(existant ?? { id: crypto.randomUUID(), created_at: new Date().toISOString(), sel: '', empreinte: '' }),
        identifiant, nom_complet: f.nom_complet!.trim(), role: (f.role ?? 'agent') as Role,
        site_id: f.site_id ?? null, actif: f.actif ?? true, en_attente: false,
        ...(f.mdp ? await preparerMotDePasse(f.mdp) : {}),
      };
      await ecrire('comptes', c);
      setFormulaire(null);
      setMessage({ type: 'succes', texte: `Compte « ${c.identifiant} » enregistré. Pensez à exporter la configuration pour les autres appareils.` });
      charger();
      if (c.id === moi?.id) rafraichir();
    } catch (err) { setMessage({ type: 'erreur', texte: (err as Error).message }); }
  }

  async function ajouterSite(e: React.FormEvent) {
    e.preventDefault(); setMessage(null);
    const code = nouveauSite.code.trim().toUpperCase();
    if (!/^[A-Z]{2,5}$/.test(code)) return setMessage({ type: 'erreur', texte: 'Code du site : 2 à 5 lettres (ex. GOU).' });
    if (sites.some((s) => s.code === code)) return setMessage({ type: 'erreur', texte: 'Ce code de site existe déjà.' });
    if (!nouveauSite.nom.trim()) return setMessage({ type: 'erreur', texte: 'Indiquez le nom du site.' });
    const liste = (await metaLire<Site[]>('sites')) ?? sites;
    await metaEcrire('sites', [...liste, { id: Math.max(0, ...liste.map((s) => s.id)) + 1, code, nom: nouveauSite.nom.trim(), type: nouveauSite.type }]);
    setNouveauSite({ code: '', nom: '', type: 'communautaire' });
    await rafraichir();
    setMessage({ type: 'succes', texte: `Site ${code} ajouté.` });
  }

  if (formulaire) {
    const nouveau = !formulaire.id;
    return (
      <section>
        <h2>{nouveau ? 'Nouveau compte' : `Modifier ${formulaire.identifiant}`}</h2>
        {message && <div className={`alerte ${message.type}`}>{message.texte}</div>}
        <form className="fiche" onSubmit={enregistrerCompte}>
          <fieldset className="section">
            <legend>Compte</legend>
            <div className="grille">
              <label className="champ">Nom et prénom(s)<input value={formulaire.nom_complet ?? ''} onChange={(e) => setFormulaire({ ...formulaire, nom_complet: e.target.value })} required /></label>
              <label className="champ">Identifiant de connexion<input value={formulaire.identifiant ?? ''} autoCapitalize="none" onChange={(e) => setFormulaire({ ...formulaire, identifiant: e.target.value })} required /></label>
              <label className="champ">Rôle
                <select value={formulaire.role ?? 'agent'} onChange={(e) => setFormulaire({ ...formulaire, role: e.target.value as Role })}>
                  {Object.entries(LIBELLES.role).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </label>
              <label className="champ">Site
                <select value={formulaire.site_id ?? ''} onChange={(e) => setFormulaire({ ...formulaire, site_id: e.target.value ? Number(e.target.value) : null })}>
                  <option value="">Tous les sites</option>
                  {sites.map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
                </select>
                <small className="aide">Un agent rattaché à un site ne voit que les fiches nominatives de ce site.</small>
              </label>
              <label className="champ">{nouveau ? 'Mot de passe (8 caractères minimum)' : 'Nouveau mot de passe (laisser vide pour ne pas changer)'}
                <input type="text" autoComplete="new-password" value={formulaire.mdp ?? ''} onChange={(e) => setFormulaire({ ...formulaire, mdp: e.target.value })} />
              </label>
              <label className="case"><input type="checkbox" checked={formulaire.actif ?? true} onChange={(e) => setFormulaire({ ...formulaire, actif: e.target.checked })} /> Compte actif</label>
            </div>
          </fieldset>
          <div className="actions-fiche">
            <button type="button" className="btn secondaire" onClick={() => { setFormulaire(null); setMessage(null); }}>Annuler</button>
            <button className="btn principal">Enregistrer le compte</button>
          </div>
        </form>
      </section>
    );
  }

  return (
    <section>
      <p className="intro">Chaque personne crée son compte depuis l’écran de connexion ; vous le validez ici. Les comptes sont enregistrés sur chaque téléphone : pour retrouver les mêmes comptes ailleurs, exportez la configuration et installez-la sur les autres téléphones.</p>
      {message && <div className={`alerte ${message.type}`}>{message.texte}</div>}
      {demandes.length > 0 && (
        <div className="carte demandes">
          <h3>Demandes de compte à valider ({demandes.length})</h3>
          <ul className="liste-demandes">
            {demandes.map((c) => (
              <li key={c.id}>
                <div>
                  <b>{c.nom_complet}</b> <span className="mono discret">{c.identifiant}</span>
                  <div className="discret">{c.telephone ? `${c.telephone} · ` : ''}demande du {dateFr(c.created_at)}</div>
                </div>
                <select aria-label={`Site de ${c.nom_complet}`} value={choixSite[c.id] ?? (c.site_souhaite != null ? String(c.site_souhaite) : '')}
                  onChange={(e) => setChoixSite({ ...choixSite, [c.id]: e.target.value })}>
                  <option value="">Tous les sites</option>
                  {sites.map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
                </select>
                <div className="actions-demande">
                  <button className="btn principal petit" onClick={() => valider(c)}>Valider</button>
                  <button className="btn secondaire petit" onClick={() => refuser(c)}>Refuser</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="barre">
        <button className="btn principal" onClick={() => { setMessage(null); setFormulaire({ role: 'agent', actif: true, site_id: null }); }}>+ Nouveau compte</button>
        <button className="btn secondaire" onClick={exporterConfiguration}>Exporter la configuration</button>
      </div>
      <div className="tableau-defile">
        <table>
          <thead><tr><th>Nom</th><th>Identifiant</th><th>Rôle</th><th>Site</th><th>État</th></tr></thead>
          <tbody>
            {comptes.filter((c) => !c.en_attente).map((c) => (
              <tr key={c.id} className="cliquable" tabIndex={0} onClick={() => { setMessage(null); setFormulaire({ ...c, mdp: '' }); }}
                onKeyDown={(e) => { if (e.key === 'Enter') setFormulaire({ ...c, mdp: '' }); }}>
                <td>{c.nom_complet}{c.id === moi?.id ? ' (vous)' : ''}</td>
                <td className="mono">{c.identifiant}</td>
                <td>{LIBELLES.role[c.role]}</td>
                <td>{sites.find((s) => s.id === c.site_id)?.nom ?? 'Tous'}</td>
                <td>{c.actif ? <span className="pastille p-normal">Actif</span> : <span className="pastille p-neutre">Désactivé</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
