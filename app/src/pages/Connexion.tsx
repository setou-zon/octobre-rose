import { useState } from 'react';
import { Ruban } from '../components/Ruban';
import { useAuth, type Compte } from '../lib/auth';
import { importerConfiguration } from '../lib/configuration';

function Cadre({ children, titre, sousTitre }: { children: React.ReactNode; titre: string; sousTitre: string }) {
  return (
    <div className="connexion">
      <div className="connexion-carte">
        <Ruban className="ruban-connexion" />
        <h1>{titre}</h1>
        <p className="sous-titre">{sousTitre}</p>
        {children}
      </div>
      <p className="pied">Association Développement par la Gouvernance · Campagne du 7 au 11 octobre 2026</p>
    </div>
  );
}

export function PageConnexion() {
  const { connexion, inscrire, validerSurPlace, sites } = useAuth();
  const [mode, setMode] = useState<'connexion' | 'inscription' | 'attente'>('connexion');
  const [identifiant, setIdentifiant] = useState('');
  const [mdp, setMdp] = useState('');
  const [mdp2, setMdp2] = useState('');
  const [nom, setNom] = useState('');
  const [telephone, setTelephone] = useState('');
  const [site, setSite] = useState('');
  const [rester, setRester] = useState(false);
  const [demande, setDemande] = useState<Compte | null>(null);
  const [adminId, setAdminId] = useState('');
  const [adminMdp, setAdminMdp] = useState('');
  const [erreur, setErreur] = useState('');
  const [succes, setSucces] = useState('');
  const [envoi, setEnvoi] = useState(false);

  const executer = async (f: () => Promise<void>) => {
    setEnvoi(true); setErreur('');
    try { await f(); } catch (err) { setErreur((err as Error).message); } finally { setEnvoi(false); }
  };

  if (mode === 'attente' && demande) {
    return (
      <Cadre titre="Compte créé" sousTitre="En attente de validation">
        <p>Bonjour <b>{demande.nom_complet}</b>, votre demande est enregistrée sur ce téléphone. Un administrateur doit la valider avant votre première connexion.</p>
        <form onSubmit={(e) => { e.preventDefault(); executer(async () => {
          await validerSurPlace({ demande, identifiantAdmin: adminId, motDePasseAdmin: adminMdp, site_id: site ? Number(site) : null });
          setSucces('Compte validé. Vous pouvez vous connecter.'); setMode('connexion'); setIdentifiant(demande.identifiant); setMdp(''); setAdminMdp('');
        }); }}>
          <p className="aide">L’administrateur est à côté de vous ? Il peut valider ici :</p>
          <label className="champ">Identifiant administrateur<input value={adminId} onChange={(e) => setAdminId(e.target.value)} autoCapitalize="none" required /></label>
          <label className="champ">Mot de passe administrateur<input type="password" value={adminMdp} onChange={(e) => setAdminMdp(e.target.value)} required autoComplete="off" /></label>
          {erreur && <div className="alerte erreur" role="alert">{erreur}</div>}
          <button className="btn principal large" disabled={envoi}>Valider ce compte</button>
        </form>
        <button className="lien" onClick={() => { setMode('connexion'); setErreur(''); }}>Plus tard</button>
      </Cadre>
    );
  }

  if (mode === 'inscription') {
    return (
      <Cadre titre="Créer mon compte" sousTitre="Il sera actif après validation par l’administrateur">
        <form onSubmit={(e) => { e.preventDefault(); executer(async () => {
          if (mdp !== mdp2) throw new Error('Les deux mots de passe ne sont pas identiques.');
          const c = await inscrire({ nom, identifiant, motDePasse: mdp, telephone, site_id: site ? Number(site) : null });
          setDemande(c); setMode('attente');
        }); }}>
          <label className="champ">Nom et prénom(s)<input value={nom} onChange={(e) => setNom(e.target.value)} required autoComplete="name" /></label>
          <label className="champ">Téléphone<input type="tel" value={telephone} onChange={(e) => setTelephone(e.target.value)} autoComplete="tel" /></label>
          <label className="champ">Site de travail
            <select value={site} onChange={(e) => setSite(e.target.value)}>
              <option value="">Sensibilisation / plusieurs sites</option>
              {sites.map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
            </select>
          </label>
          <label className="champ">Identifiant de connexion<input value={identifiant} onChange={(e) => setIdentifiant(e.target.value)} required autoCapitalize="none" autoComplete="username" /></label>
          <label className="champ">Mot de passe (8 caractères minimum)<input type="password" value={mdp} onChange={(e) => setMdp(e.target.value)} required minLength={8} autoComplete="new-password" /></label>
          <label className="champ">Confirmer le mot de passe<input type="password" value={mdp2} onChange={(e) => setMdp2(e.target.value)} required autoComplete="new-password" /></label>
          {erreur && <div className="alerte erreur" role="alert">{erreur}</div>}
          <button className="btn principal large" disabled={envoi}>{envoi ? 'Patientez…' : 'Envoyer ma demande'}</button>
        </form>
        <button className="lien" onClick={() => { setMode('connexion'); setErreur(''); }}>J’ai déjà un compte</button>
      </Cadre>
    );
  }

  return (
    <Cadre titre="Octobre Rose 2026" sousTitre="Collecte des données de la campagne">
      {succes && <div className="alerte succes" role="status">{succes}</div>}
      <form onSubmit={(e) => { e.preventDefault(); executer(() => connexion(identifiant, mdp, rester)); }}>
        <label className="champ">Identifiant
          <input value={identifiant} onChange={(e) => setIdentifiant(e.target.value)} required autoComplete="username" autoCapitalize="none" />
        </label>
        <label className="champ">Mot de passe
          <input type="password" value={mdp} onChange={(e) => setMdp(e.target.value)} required autoComplete="current-password" />
        </label>
        <label className="case"><input type="checkbox" checked={rester} onChange={(e) => setRester(e.target.checked)} /> Rester connecté(e) 8 heures</label>
        {erreur && <div className="alerte erreur" role="alert">{erreur}</div>}
        <button className="btn principal large" disabled={envoi}>{envoi ? 'Vérification…' : 'Se connecter'}</button>
      </form>
      <button className="btn secondaire large" onClick={() => { setMode('inscription'); setErreur(''); setSucces(''); }}>Créer mon compte</button>
      <p className="aide">Mot de passe oublié ? Demandez à l’administrateur de le réinitialiser.</p>
    </Cadre>
  );
}

/** Premier lancement sur un appareil : créer l'administrateur ou importer la configuration */
export function PageInitialisation() {
  const { initialiser, rafraichir } = useAuth();
  const [mode, setMode] = useState<'choix' | 'creer' | 'importer'>('choix');
  const [nom, setNom] = useState('');
  const [identifiant, setIdentifiant] = useState('');
  const [mdp, setMdp] = useState('');
  const [mdp2, setMdp2] = useState('');
  const [fichier, setFichier] = useState<File | null>(null);
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);

  async function creer(e: React.FormEvent) {
    e.preventDefault(); setErreur('');
    if (mdp !== mdp2) return setErreur('Les deux mots de passe ne sont pas identiques.');
    setEnvoi(true);
    try { await initialiser({ nom, identifiant, motDePasse: mdp }); } catch (err) { setErreur((err as Error).message); } finally { setEnvoi(false); }
  }

  async function importer(e: React.FormEvent) {
    e.preventDefault(); setErreur('');
    if (!fichier) return setErreur('Choisissez le fichier de configuration reçu de la coordination.');
    setEnvoi(true);
    try { await importerConfiguration(await fichier.text()); await rafraichir(); } catch (err) { setErreur((err as Error).message); } finally { setEnvoi(false); }
  }

  if (mode === 'choix') {
    return (
      <Cadre titre="Bienvenue" sousTitre="Première utilisation sur ce téléphone ou cet ordinateur">
        <button className="btn principal large" onClick={() => setMode('importer')}>Installer la configuration de la coordination</button>
        <button className="btn secondaire large" onClick={() => setMode('creer')}>Je suis l’administrateur : créer mon compte</button>
        <p className="aide">Agents : installez le fichier de configuration reçu de la coordination, puis créez votre compte. L’administrateur le validera.</p>
      </Cadre>
    );
  }

  return (
    <Cadre titre={mode === 'creer' ? 'Compte administrateur' : 'Installer la configuration'} sousTitre="Première utilisation">
      <form onSubmit={mode === 'creer' ? creer : importer}>
        {mode === 'creer' ? (
          <>
            <label className="champ">Nom et prénom(s)<input value={nom} onChange={(e) => setNom(e.target.value)} required autoComplete="name" /></label>
            <label className="champ">Identifiant de connexion<input value={identifiant} onChange={(e) => setIdentifiant(e.target.value)} required autoCapitalize="none" autoComplete="username" /></label>
            <label className="champ">Mot de passe (8 caractères minimum)<input type="password" value={mdp} onChange={(e) => setMdp(e.target.value)} required minLength={8} autoComplete="new-password" /></label>
            <label className="champ">Confirmer le mot de passe<input type="password" value={mdp2} onChange={(e) => setMdp2(e.target.value)} required autoComplete="new-password" /></label>
          </>
        ) : (
          <label className="champ">Fichier de configuration (.json)
            <input type="file" accept=".json,application/json" onChange={(e) => setFichier(e.target.files?.[0] ?? null)} />
          </label>
        )}
        {erreur && <div className="alerte erreur" role="alert">{erreur}</div>}
        <button className="btn principal large" disabled={envoi}>{envoi ? 'Patientez…' : mode === 'creer' ? 'Créer et commencer' : 'Installer'}</button>
      </form>
      <button className="lien" onClick={() => { setMode('choix'); setErreur(''); }}>Retour</button>
    </Cadre>
  );
}
