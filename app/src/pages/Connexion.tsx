import { useState } from 'react';
import { Ruban } from '../components/Ruban';
import { useAuth } from '../lib/auth';

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
  const { connexion, inscrire, sites } = useAuth();
  const [mode, setMode] = useState<'connexion' | 'inscription'>('connexion');
  const [identifiant, setIdentifiant] = useState('');
  const [mdp, setMdp] = useState('');
  const [mdp2, setMdp2] = useState('');
  const [nom, setNom] = useState('');
  const [telephone, setTelephone] = useState('');
  const [site, setSite] = useState('');
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);

  const executer = async (f: () => Promise<void>) => {
    setEnvoi(true); setErreur('');
    try { await f(); } catch (err) { setErreur((err as Error).message); } finally { setEnvoi(false); }
  };

  if (mode === 'inscription') {
    return (
      <Cadre titre="Créer mon compte" sousTitre="Il sera actif après validation par l’administrateur">
        <form onSubmit={(e) => { e.preventDefault(); executer(async () => {
          if (mdp !== mdp2) throw new Error('Les deux mots de passe ne sont pas identiques.');
          await inscrire({ nom, identifiant, motDePasse: mdp, telephone, site_id: site ? Number(site) : null });
        }); }}>
          <label className="champ">Nom et prénom(s)<input value={nom} onChange={(e) => setNom(e.target.value)} required autoComplete="name" /></label>
          <label className="champ">Téléphone<input type="tel" value={telephone} onChange={(e) => setTelephone(e.target.value)} autoComplete="tel" /></label>
          <label className="champ">Site de travail
            <select value={site} onChange={(e) => setSite(e.target.value)}>
              <option value="">Sensibilisation / plusieurs sites</option>
              {sites.map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
            </select>
          </label>
          <label className="champ">Identifiant de connexion
            <input value={identifiant} onChange={(e) => setIdentifiant(e.target.value.toLowerCase())} required autoCapitalize="none" autoComplete="username" placeholder="ex. mariam.kabore" />
            <small className="aide">Lettres, chiffres et points, sans espace ni accent.</small>
          </label>
          <label className="champ">Mot de passe (8 caractères minimum)<input type="password" value={mdp} onChange={(e) => setMdp(e.target.value)} required minLength={8} autoComplete="new-password" /></label>
          <label className="champ">Confirmer le mot de passe<input type="password" value={mdp2} onChange={(e) => setMdp2(e.target.value)} required autoComplete="new-password" /></label>
          {erreur && <div className="alerte erreur" role="alert">{erreur}</div>}
          <button className="btn principal large" disabled={envoi}>{envoi ? 'Patientez…' : 'Envoyer ma demande'}</button>
        </form>
        <button className="lien" onClick={() => { setMode('connexion'); setErreur(''); }}>J’ai déjà un compte</button>
        <p className="aide">La création du compte et la première connexion demandent du réseau. Ensuite, l’application fonctionne sans internet.</p>
      </Cadre>
    );
  }

  return (
    <Cadre titre="Octobre Rose 2026" sousTitre="Collecte des données de la campagne">
      <form onSubmit={(e) => { e.preventDefault(); executer(() => connexion(identifiant, mdp)); }}>
        <label className="champ">Identifiant
          <input value={identifiant} onChange={(e) => setIdentifiant(e.target.value)} required autoComplete="username" autoCapitalize="none" />
        </label>
        <label className="champ">Mot de passe
          <input type="password" value={mdp} onChange={(e) => setMdp(e.target.value)} required autoComplete="current-password" />
        </label>
        {erreur && <div className="alerte erreur" role="alert">{erreur}</div>}
        <button className="btn principal large" disabled={envoi}>{envoi ? 'Vérification…' : 'Se connecter'}</button>
      </form>
      <button className="btn secondaire large" onClick={() => { setMode('inscription'); setErreur(''); }}>Créer mon compte</button>
      <p className="aide">Mot de passe oublié ? Adressez-vous à l’administrateur.</p>
    </Cadre>
  );
}

export function PageEnAttente() {
  const { compte, rafraichir, deconnexion } = useAuth();
  const [verif, setVerif] = useState(false);
  const refuse = compte && !compte.actif;
  return (
    <Cadre titre={refuse ? 'Accès refusé' : 'Compte en attente'} sousTitre={compte?.nom_complet ?? ''}>
      {refuse
        ? <p>Votre compte a été désactivé par l’administrateur.</p>
        : <p>Votre compte <b>{compte?.identifiant}</b> est créé. Un administrateur doit le valider : prévenez la coordination, puis appuyez sur « Vérifier ».</p>}
      <button className="btn principal large" disabled={verif} onClick={async () => { setVerif(true); await rafraichir(); setVerif(false); }}>
        {verif ? 'Vérification…' : 'Vérifier'}
      </button>
      <button className="lien" onClick={deconnexion}>Se déconnecter</button>
    </Cadre>
  );
}

export function PageNonConfiguree() {
  return (
    <Cadre titre="Configuration manquante" sousTitre="Base de données non reliée">
      <p>L’adresse de la base Supabase n’est pas renseignée dans cette version de l’application.</p>
    </Cadre>
  );
}
