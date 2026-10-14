import { useState } from 'react';
import { Ruban } from '../components/Ruban';
import { useAuth } from '../lib/auth';
import { CODE_APPAREIL, importerConfiguration } from '../lib/configuration';

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
  const { connexion } = useAuth();
  const [identifiant, setIdentifiant] = useState('');
  const [mdp, setMdp] = useState('');
  const [rester, setRester] = useState(false);
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);

  async function soumettre(e: React.FormEvent) {
    e.preventDefault();
    setEnvoi(true); setErreur('');
    try { await connexion(identifiant, mdp, rester); } catch (err) { setErreur((err as Error).message); } finally { setEnvoi(false); }
  }

  return (
    <Cadre titre="Octobre Rose 2026" sousTitre="Collecte des données de la campagne">
      <form onSubmit={soumettre}>
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
  const [appareil, setAppareil] = useState('A');
  const [fichier, setFichier] = useState<File | null>(null);
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);

  const champAppareil = (
    <label className="champ">Code de cet appareil (1 ou 2 caractères)
      <input value={appareil} maxLength={2} onChange={(e) => setAppareil(e.target.value.toUpperCase())} required />
      <small className="aide">Chaque téléphone ou ordinateur doit avoir un code différent (A, B, C…). Il figure dans les codes bénéficiaires.</small>
    </label>
  );

  async function creer(e: React.FormEvent) {
    e.preventDefault(); setErreur('');
    if (!CODE_APPAREIL.test(appareil)) return setErreur('Code appareil : une lettre, éventuellement suivie d’une lettre ou d’un chiffre.');
    if (mdp !== mdp2) return setErreur('Les deux mots de passe ne sont pas identiques.');
    setEnvoi(true);
    try { await initialiser({ nom, identifiant, motDePasse: mdp, appareil }); } catch (err) { setErreur((err as Error).message); } finally { setEnvoi(false); }
  }

  async function importer(e: React.FormEvent) {
    e.preventDefault(); setErreur('');
    if (!CODE_APPAREIL.test(appareil)) return setErreur('Code appareil : une lettre, éventuellement suivie d’une lettre ou d’un chiffre.');
    if (!fichier) return setErreur('Choisissez le fichier de configuration reçu de la coordination.');
    setEnvoi(true);
    try { await importerConfiguration(await fichier.text(), appareil); await rafraichir(); } catch (err) { setErreur((err as Error).message); } finally { setEnvoi(false); }
  }

  if (mode === 'choix') {
    return (
      <Cadre titre="Bienvenue" sousTitre="Première utilisation sur cet appareil">
        <button className="btn principal large" onClick={() => setMode('creer')}>Créer le compte administrateur</button>
        <button className="btn secondaire large" onClick={() => setMode('importer')}>Installer la configuration de la coordination</button>
        <p className="aide">La coordination crée l’administrateur sur son appareil, puis transmet le fichier de configuration aux autres appareils.</p>
      </Cadre>
    );
  }

  return (
    <Cadre titre={mode === 'creer' ? 'Compte administrateur' : 'Installer la configuration'} sousTitre="Première utilisation sur cet appareil">
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
        {champAppareil}
        {erreur && <div className="alerte erreur" role="alert">{erreur}</div>}
        <button className="btn principal large" disabled={envoi}>{envoi ? 'Patientez…' : mode === 'creer' ? 'Créer et commencer' : 'Installer'}</button>
      </form>
      <button className="lien" onClick={() => { setMode('choix'); setErreur(''); }}>Retour</button>
    </Cadre>
  );
}
