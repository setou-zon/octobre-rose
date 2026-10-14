import { useState } from 'react';
import { Ruban } from '../components/Ruban';
import { useAuth } from '../lib/auth';
import { Installation } from '../components/Installation';

function Cadre({ children, titre, sousTitre }: { children: React.ReactNode; titre: string; sousTitre: string }) {
  return (
    <div className="connexion">
      <div className="connexion-carte">
        <Ruban className="ruban-connexion" />
        <h1>{titre}</h1>
        <p className="sous-titre">{sousTitre}</p>
        {children}
        <Installation variante="carte" />
      </div>
      <p className="pied">Association Développement par la Gouvernance · Campagne du 7 au 11 octobre 2026</p>
    </div>
  );
}

type Mode = 'connexion' | 'inscription' | 'confirmer' | 'oubli' | 'oubli_envoye';

export function PageConnexion() {
  const { connexion, inscrire, motDePasseOublie, renvoyerConfirmation, sites } = useAuth();
  const [mode, setMode] = useState<Mode>('connexion');
  const [email, setEmail] = useState('');
  const [mdp, setMdp] = useState('');
  const [mdp2, setMdp2] = useState('');
  const [nom, setNom] = useState('');
  const [telephone, setTelephone] = useState('');
  const [site, setSite] = useState('');
  const [erreur, setErreur] = useState('');
  const [info, setInfo] = useState('');
  const [envoi, setEnvoi] = useState(false);

  const aller = (m: Mode) => { setMode(m); setErreur(''); setInfo(''); };
  const executer = async (f: () => Promise<void>) => {
    setEnvoi(true); setErreur(''); setInfo('');
    try { await f(); } catch (err) { setErreur((err as Error).message); } finally { setEnvoi(false); }
  };
  const champEmail = (
    <label className="champ">Adresse e-mail
      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" autoCapitalize="none" inputMode="email" />
    </label>
  );

  if (mode === 'confirmer') {
    return (
      <Cadre titre="Vérifiez vos e-mails" sousTitre="Dernière étape">
        <p>Un e-mail a été envoyé à <b>{email}</b>. Ouvrez-le et cliquez sur le lien pour confirmer votre adresse.</p>
        <p className="aide">Pas reçu ? Regardez dans les courriers indésirables (spam), puis :</p>
        {info && <div className="alerte succes">{info}</div>}
        {erreur && <div className="alerte erreur" role="alert">{erreur}</div>}
        <button className="btn secondaire large" disabled={envoi} onClick={() => executer(async () => { await renvoyerConfirmation(email); setInfo('E-mail renvoyé.'); })}>Renvoyer l’e-mail</button>
        <p className="aide">Après confirmation, l’administrateur valide votre compte ; vous pourrez alors vous connecter.</p>
        <button className="lien" onClick={() => aller('connexion')}>Retour à la connexion</button>
      </Cadre>
    );
  }

  if (mode === 'oubli' || mode === 'oubli_envoye') {
    return (
      <Cadre titre="Mot de passe oublié" sousTitre="Recevoir un lien par e-mail">
        {mode === 'oubli_envoye' ? (
          <div className="alerte succes">Si un compte existe pour <b>{email}</b>, un e-mail avec un lien pour choisir un nouveau mot de passe vient d’être envoyé.</div>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); executer(async () => { await motDePasseOublie(email); setMode('oubli_envoye'); }); }}>
            {champEmail}
            {erreur && <div className="alerte erreur" role="alert">{erreur}</div>}
            <button className="btn principal large" disabled={envoi}>{envoi ? 'Envoi…' : 'Envoyer le lien'}</button>
          </form>
        )}
        <button className="lien" onClick={() => aller('connexion')}>Retour à la connexion</button>
      </Cadre>
    );
  }

  if (mode === 'inscription') {
    return (
      <Cadre titre="Créer mon compte" sousTitre="Confirmation par e-mail, puis validation par l’administrateur">
        <form onSubmit={(e) => { e.preventDefault(); executer(async () => {
          if (mdp !== mdp2) throw new Error('Les deux mots de passe ne sont pas identiques.');
          const aConfirmer = await inscrire({ nom, email, motDePasse: mdp, telephone, site_id: site ? Number(site) : null });
          if (aConfirmer) setMode('confirmer');
        }); }}>
          <label className="champ">Nom et prénom(s)<input value={nom} onChange={(e) => setNom(e.target.value)} required autoComplete="name" /></label>
          {champEmail}
          <label className="champ">Téléphone<input type="tel" value={telephone} onChange={(e) => setTelephone(e.target.value)} autoComplete="tel" /></label>
          <label className="champ">Site de travail
            <select value={site} onChange={(e) => setSite(e.target.value)}>
              <option value="">Sensibilisation / plusieurs sites</option>
              {sites.map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
            </select>
          </label>
          <label className="champ">Mot de passe (8 caractères minimum)<input type="password" value={mdp} onChange={(e) => setMdp(e.target.value)} required minLength={8} autoComplete="new-password" /></label>
          <label className="champ">Confirmer le mot de passe<input type="password" value={mdp2} onChange={(e) => setMdp2(e.target.value)} required autoComplete="new-password" /></label>
          {erreur && <div className="alerte erreur" role="alert">{erreur}</div>}
          <button className="btn principal large" disabled={envoi}>{envoi ? 'Patientez…' : 'Créer mon compte'}</button>
        </form>
        <button className="lien" onClick={() => aller('connexion')}>J’ai déjà un compte</button>
        <p className="aide">La création du compte et la première connexion demandent du réseau. Ensuite, l’application fonctionne sans internet.</p>
      </Cadre>
    );
  }

  return (
    <Cadre titre="Octobre Rose 2026" sousTitre="Collecte des données de la campagne">
      <form onSubmit={(e) => { e.preventDefault(); executer(() => connexion(email, mdp)); }}>
        {champEmail}
        <label className="champ">Mot de passe
          <input type="password" value={mdp} onChange={(e) => setMdp(e.target.value)} required autoComplete="current-password" />
        </label>
        {erreur && <div className="alerte erreur" role="alert">{erreur}</div>}
        {/pas encore confirmée/.test(erreur) && (
          <button type="button" className="lien" onClick={() => executer(async () => { await renvoyerConfirmation(email); setInfo('E-mail de confirmation renvoyé.'); })}>Renvoyer l’e-mail de confirmation</button>
        )}
        {info && <div className="alerte succes">{info}</div>}
        <button className="btn principal large" disabled={envoi}>{envoi ? 'Vérification…' : 'Se connecter'}</button>
      </form>
      <button className="btn secondaire large" onClick={() => aller('inscription')}>Créer mon compte</button>
      <button className="lien" onClick={() => aller('oubli')}>Mot de passe oublié ?</button>
    </Cadre>
  );
}

export function PageNouveauMotDePasse() {
  const { changerMotDePasse } = useAuth();
  const [mdp, setMdp] = useState('');
  const [mdp2, setMdp2] = useState('');
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);
  return (
    <Cadre titre="Nouveau mot de passe" sousTitre="Choisissez votre nouveau mot de passe">
      <form onSubmit={async (e) => {
        e.preventDefault(); setErreur('');
        if (mdp !== mdp2) return setErreur('Les deux mots de passe ne sont pas identiques.');
        setEnvoi(true);
        try { await changerMotDePasse(mdp); window.location.hash = '#/accueil'; } catch (err) { setErreur((err as Error).message); } finally { setEnvoi(false); }
      }}>
        <label className="champ">Nouveau mot de passe (8 caractères minimum)<input type="password" value={mdp} onChange={(e) => setMdp(e.target.value)} required minLength={8} autoComplete="new-password" /></label>
        <label className="champ">Confirmer<input type="password" value={mdp2} onChange={(e) => setMdp2(e.target.value)} required autoComplete="new-password" /></label>
        {erreur && <div className="alerte erreur" role="alert">{erreur}</div>}
        <button className="btn principal large" disabled={envoi}>{envoi ? 'Enregistrement…' : 'Enregistrer'}</button>
      </form>
    </Cadre>
  );
}

export function PageEnAttente() {
  const { compte, rafraichir, deconnexion } = useAuth();
  const [verif, setVerif] = useState(false);
  const refuse = compte && !compte.actif;
  return (
    <Cadre titre={refuse ? 'Accès refusé' : 'Compte en attente de validation'} sousTitre={compte?.nom_complet ?? ''}>
      {refuse
        ? <p>Votre compte a été désactivé par l’administrateur.</p>
        : <p>Votre adresse <b>{compte?.identifiant}</b> est confirmée. Un administrateur doit maintenant valider votre compte : prévenez la coordination, puis appuyez sur « Vérifier ».</p>}
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
