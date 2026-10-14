import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { demanderPersistance, metaEcrire, metaLire } from './db';
import { adresseRetour, baseConfiguree, messageErreur, supabase } from './supabase';

export type Role = 'admin' | 'agent';
/** Profil d'un membre de l'équipe (table « profils » de la base centrale) */
export type Compte = {
  id: string;
  identifiant: string;
  nom_complet: string;
  telephone?: string | null;
  role: Role;
  site_id: number | null;
  site_souhaite?: number | null;
  valide: boolean;
  actif: boolean;
  created_at?: string;
};
export type Site = { id: number; code: string; nom: string; type: 'formation_sanitaire' | 'communautaire' };

export const SITES_DEFAUT: Site[] = [
  { id: 1, code: 'CBP', nom: 'Clinique Blaise Pascal', type: 'formation_sanitaire' },
  { id: 2, code: 'CEN', nom: 'CENOU', type: 'formation_sanitaire' },
];

export function verifierRegles(motDePasse: string): string | null {
  if (motDePasse.length < 8) return 'Le mot de passe doit faire au moins 8 caractères.';
  return null;
}

// Lien « mot de passe oublié » : repéré avant que Supabase ne nettoie l'adresse
let recuperation = typeof window !== 'undefined' && /type=recovery/.test(window.location.hash);

type Etat = 'chargement' | 'non_configure' | 'deconnecte' | 'en_attente' | 'connecte' | 'nouveau_mot_de_passe';
type Ctx = {
  etat: Etat;
  compte: Compte | null;
  sites: Site[];
  connexion: (email: string, motDePasse: string) => Promise<void>;
  deconnexion: () => Promise<void>;
  /** Renvoie true si un e-mail de confirmation a été envoyé (compte à confirmer) */
  inscrire: (p: { nom: string; email: string; motDePasse: string; telephone: string; site_id: number | null }) => Promise<boolean>;
  motDePasseOublie: (email: string) => Promise<void>;
  changerMotDePasse: (motDePasse: string) => Promise<void>;
  renvoyerConfirmation: (email: string) => Promise<void>;
  rafraichir: () => Promise<void>;
};
const AuthCtx = createContext<Ctx>(null as unknown as Ctx);

/** Profil et sites : depuis le serveur si possible, sinon depuis la copie gardée sur l'appareil */
async function chargerProfil(id: string): Promise<Compte | null> {
  try {
    const { data, error } = await supabase.from('profils').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    if (data) await metaEcrire(`profil-${id}`, data);
    return (data as Compte) ?? null;
  } catch {
    return (await metaLire<Compte>(`profil-${id}`)) ?? null; // hors ligne
  }
}

export async function chargerSites(): Promise<Site[]> {
  try {
    const { data, error } = await supabase.from('sites').select('id, code, nom, type').order('id');
    if (error) throw error;
    if (data?.length) { await metaEcrire('sites', data); return data as Site[]; }
  } catch { /* hors ligne */ }
  return (await metaLire<Site[]>('sites')) ?? SITES_DEFAUT;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [etat, setEtat] = useState<Etat>(baseConfiguree ? 'chargement' : 'non_configure');
  const [compte, setCompte] = useState<Compte | null>(null);
  const [sites, setSites] = useState<Site[]>(SITES_DEFAUT);

  const rafraichir = useCallback(async () => {
    if (!baseConfiguree) return;
    setSites(await chargerSites());
    const { data } = await supabase.auth.getSession();
    const id = data.session?.user.id;
    if (!id) { setCompte(null); setEtat('deconnecte'); return; }
    if (recuperation) { setEtat('nouveau_mot_de_passe'); return; }
    const p = await chargerProfil(id);
    setCompte(p);
    setEtat(!p ? 'deconnecte' : p.valide && p.actif ? 'connecte' : 'en_attente');
  }, []);

  useEffect(() => {
    demanderPersistance();
    rafraichir().catch(() => setEtat('deconnecte'));
    const { data } = supabase.auth.onAuthStateChange((evt) => {
      if (evt === 'SIGNED_OUT') { setCompte(null); setEtat('deconnecte'); }
      // retour du lien « mot de passe oublié »
      if (evt === 'PASSWORD_RECOVERY') { recuperation = true; setEtat('nouveau_mot_de_passe'); }
      // retour du lien de confirmation de l'adresse e-mail
      if (evt === 'SIGNED_IN') setTimeout(() => { rafraichir().catch(() => {}); }, 0);
    });
    return () => data.subscription.unsubscribe();
  }, [rafraichir]);

  async function connexion(email: string, motDePasse: string) {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: motDePasse });
    if (error) throw new Error(messageErreur(error));
    await rafraichir();
  }

  async function inscrire(p: { nom: string; email: string; motDePasse: string; telephone: string; site_id: number | null }) {
    const err = verifierRegles(p.motDePasse); if (err) throw new Error(err);
    const email = p.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Adresse e-mail invalide.');
    if (!p.nom.trim()) throw new Error('Indiquez votre nom.');
    const { data, error } = await supabase.auth.signUp({
      email, password: p.motDePasse,
      options: {
        emailRedirectTo: adresseRetour(),
        data: { identifiant: email, nom_complet: p.nom.trim(), telephone: p.telephone.trim(), site_souhaite: p.site_id ?? '' },
      },
    });
    if (error) throw new Error(messageErreur(error));
    // Supabase ne signale pas une adresse déjà inscrite : il renvoie un compte sans identité
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      throw new Error('Un compte existe déjà avec cette adresse e-mail. Connectez-vous ou utilisez « Mot de passe oublié ».');
    }
    if (data.session) { await rafraichir(); return false; }
    return true;
  }

  async function motDePasseOublie(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: adresseRetour() });
    if (error) throw new Error(messageErreur(error));
  }

  async function changerMotDePasse(motDePasse: string) {
    const err = verifierRegles(motDePasse); if (err) throw new Error(err);
    const { error } = await supabase.auth.updateUser({ password: motDePasse });
    if (error) throw new Error(messageErreur(error));
    recuperation = false;
    await rafraichir();
  }

  async function renvoyerConfirmation(email: string) {
    const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim().toLowerCase(), options: { emailRedirectTo: adresseRetour() } });
    if (error) throw new Error(messageErreur(error));
  }

  async function deconnexion() {
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
    setCompte(null); setEtat('deconnecte');
  }

  return (
    <AuthCtx.Provider value={{ etat, compte, sites, connexion, deconnexion, inscrire, motDePasseOublie, changerMotDePasse, renvoyerConfirmation, rafraichir }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
