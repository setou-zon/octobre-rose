import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { demanderPersistance, metaEcrire, metaLire } from './db';
import { baseConfiguree, emailDe, messageErreur, supabase } from './supabase';

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

type Etat = 'chargement' | 'non_configure' | 'deconnecte' | 'en_attente' | 'connecte';
type Ctx = {
  etat: Etat;
  compte: Compte | null;
  sites: Site[];
  connexion: (identifiant: string, motDePasse: string) => Promise<void>;
  deconnexion: () => Promise<void>;
  inscrire: (p: { nom: string; identifiant: string; motDePasse: string; telephone: string; site_id: number | null }) => Promise<void>;
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
    const p = await chargerProfil(id);
    setCompte(p);
    setEtat(!p ? 'deconnecte' : p.valide && p.actif ? 'connecte' : 'en_attente');
  }, []);

  useEffect(() => {
    demanderPersistance();
    rafraichir().catch(() => setEtat('deconnecte'));
    const { data } = supabase.auth.onAuthStateChange((evt) => {
      if (evt === 'SIGNED_OUT') { setCompte(null); setEtat('deconnecte'); }
    });
    return () => data.subscription.unsubscribe();
  }, [rafraichir]);

  async function connexion(identifiant: string, motDePasse: string) {
    const { error } = await supabase.auth.signInWithPassword({ email: emailDe(identifiant), password: motDePasse });
    if (error) throw new Error(messageErreur(error));
    await rafraichir();
  }

  async function inscrire(p: { nom: string; identifiant: string; motDePasse: string; telephone: string; site_id: number | null }) {
    const err = verifierRegles(p.motDePasse); if (err) throw new Error(err);
    const identifiant = p.identifiant.trim().toLowerCase();
    if (!/^[a-z0-9._-]{3,30}$/.test(identifiant)) throw new Error('Identifiant : 3 à 30 lettres, chiffres, points ou tirets, sans espace ni accent.');
    if (!p.nom.trim()) throw new Error('Indiquez votre nom.');
    const { error } = await supabase.auth.signUp({
      email: emailDe(identifiant), password: p.motDePasse,
      options: { data: { identifiant, nom_complet: p.nom.trim(), telephone: p.telephone.trim(), site_souhaite: p.site_id ?? '' } },
    });
    if (error) throw new Error(messageErreur(error));
    await rafraichir();
  }

  async function deconnexion() {
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
    setCompte(null); setEtat('deconnecte');
  }

  return (
    <AuthCtx.Provider value={{ etat, compte, sites, connexion, deconnexion, inscrire, rafraichir }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
