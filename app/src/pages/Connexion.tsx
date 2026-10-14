import { useState } from 'react';
import { messageErreur, supabase } from '../lib/supabase';

export function PageConnexion() {
  const [mode, setMode] = useState<'connexion' | 'inscription'>('connexion');
  const [email, setEmail] = useState('');
  const [mdp, setMdp] = useState('');
  const [nom, setNom] = useState('');
  const [msg, setMsg] = useState<{ type: 'erreur' | 'succes'; texte: string } | null>(null);
  const [envoi, setEnvoi] = useState(false);

  async function soumettre(e: React.FormEvent) {
    e.preventDefault();
    setEnvoi(true); setMsg(null);
    try {
      if (mode === 'connexion') {
        const { error } = await supabase.auth.signInWithPassword({ email, password: mdp });
        if (error) throw error;
      } else {
        if (mdp.length < 8) throw new Error('Le mot de passe doit faire au moins 8 caractères.');
        const { data, error } = await supabase.auth.signUp({
          email, password: mdp,
          options: { data: { nom_complet: nom }, emailRedirectTo: window.location.origin + window.location.pathname },
        });
        if (error) throw error;
        setMsg({ type: 'succes', texte: data.session
          ? 'Compte créé. La coordination doit maintenant valider votre accès.'
          : 'Compte créé. Confirmez votre adresse via l’e-mail reçu, puis attendez la validation par la coordination.' });
      }
    } catch (err) {
      setMsg({ type: 'erreur', texte: messageErreur(err) });
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className="connexion">
      <div className="connexion-carte">
        <div className="ruban" aria-hidden>🎗</div>
        <h1>Octobre Rose 2026</h1>
        <p className="sous-titre">Collecte des données de la campagne · ADG</p>
        <form onSubmit={soumettre}>
          {mode === 'inscription' && (
            <label className="champ">Nom et prénom(s)
              <input value={nom} onChange={(e) => setNom(e.target.value)} required autoComplete="name" />
            </label>
          )}
          <label className="champ">Adresse e-mail
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </label>
          <label className="champ">Mot de passe
            <input type="password" value={mdp} onChange={(e) => setMdp(e.target.value)} required
              autoComplete={mode === 'connexion' ? 'current-password' : 'new-password'} />
          </label>
          {msg && <div className={`alerte ${msg.type}`}>{msg.texte}</div>}
          <button className="btn principal large" disabled={envoi}>
            {envoi ? 'Patientez…' : mode === 'connexion' ? 'Se connecter' : 'Créer mon compte'}
          </button>
        </form>
        <button className="lien" onClick={() => { setMode(mode === 'connexion' ? 'inscription' : 'connexion'); setMsg(null); }}>
          {mode === 'connexion' ? 'Première fois ? Créer un compte' : 'J’ai déjà un compte'}
        </button>
      </div>
    </div>
  );
}
