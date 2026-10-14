import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { demanderPersistance, ecrire, metaEcrire, metaLire, tout } from './db';

export type Role = 'admin' | 'agent';
export type Compte = {
  id: string;
  identifiant: string;
  nom_complet: string;
  role: Role;
  site_id: number | null;
  actif: boolean;
  sel: string;
  empreinte: string;
  created_at: string;
};
export type Site = { id: number; code: string; nom: string; type: 'formation_sanitaire' | 'communautaire' };

export const SITES_DEFAUT: Site[] = [
  { id: 1, code: 'CBP', nom: 'Clinique Blaise Pascal', type: 'formation_sanitaire' },
  { id: 2, code: 'CEN', nom: 'CENOU', type: 'formation_sanitaire' },
];

// ---------------------------------------------------------------------------
// Mots de passe : jamais stockés en clair (PBKDF2-SHA256, 210 000 itérations)
// ---------------------------------------------------------------------------
const hex = (b: ArrayBuffer | Uint8Array) => Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, '0')).join('');
const deHex = (h: string) => new Uint8Array(h.match(/../g)!.map((x) => parseInt(x, 16)));

async function deriver(motDePasse: string, selHex: string) {
  const cle = await crypto.subtle.importKey('raw', new TextEncoder().encode(motDePasse), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: deHex(selHex), iterations: 210000 }, cle, 256);
  return hex(bits);
}

export async function preparerMotDePasse(motDePasse: string) {
  const sel = hex(crypto.getRandomValues(new Uint8Array(16)));
  return { sel, empreinte: await deriver(motDePasse, sel) };
}

export function verifierRegles(motDePasse: string): string | null {
  if (motDePasse.length < 8) return 'Le mot de passe doit faire au moins 8 caractères.';
  return null;
}

// ---------------------------------------------------------------------------
// Session (8 heures, ou jusqu'à la fermeture du navigateur)
// ---------------------------------------------------------------------------
const CLE_SESSION = 'or26-session';
const DUREE = 8 * 3600 * 1000;

function lireSession(): string | null {
  try {
    const s = JSON.parse(sessionStorage.getItem(CLE_SESSION) ?? localStorage.getItem(CLE_SESSION) ?? 'null');
    if (!s || s.expire < Date.now()) return null;
    return s.id as string;
  } catch { return null; }
}
function ecrireSession(id: string | null, rester = false) {
  try {
    sessionStorage.removeItem(CLE_SESSION); localStorage.removeItem(CLE_SESSION);
    if (id) (rester ? localStorage : sessionStorage).setItem(CLE_SESSION, JSON.stringify({ id, expire: Date.now() + DUREE }));
  } catch { /* stockage indisponible */ }
}

// ---------------------------------------------------------------------------
type Etat = 'chargement' | 'initialisation' | 'deconnecte' | 'connecte';
type Ctx = {
  etat: Etat;
  compte: Compte | null;
  sites: Site[];
  appareil: string;
  connexion: (identifiant: string, motDePasse: string, rester: boolean) => Promise<void>;
  deconnexion: () => void;
  initialiser: (p: { nom: string; identifiant: string; motDePasse: string; appareil: string }) => Promise<void>;
  rafraichir: () => Promise<void>;
};
const AuthCtx = createContext<Ctx>(null as unknown as Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [etat, setEtat] = useState<Etat>('chargement');
  const [compte, setCompte] = useState<Compte | null>(null);
  const [sites, setSites] = useState<Site[]>(SITES_DEFAUT);
  const [appareil, setAppareil] = useState('');

  const rafraichir = useCallback(async () => {
    const [comptes, s, a] = await Promise.all([tout<Compte>('comptes'), metaLire<Site[]>('sites'), metaLire<string>('appareil')]);
    setSites(s?.length ? s : SITES_DEFAUT);
    setAppareil(a ?? '');
    if (!comptes.length) { setEtat('initialisation'); setCompte(null); return; }
    const id = lireSession();
    const c = comptes.find((x) => x.id === id && x.actif) ?? null;
    setCompte(c);
    setEtat(c ? 'connecte' : 'deconnecte');
  }, []);

  useEffect(() => { rafraichir().catch(() => setEtat('deconnecte')); demanderPersistance(); }, [rafraichir]);

  async function connexion(identifiant: string, motDePasse: string, rester: boolean) {
    const comptes = await tout<Compte>('comptes');
    const c = comptes.find((x) => x.identifiant.toLowerCase() === identifiant.trim().toLowerCase());
    // même temps de calcul que le compte existe ou non
    const essai = await deriver(motDePasse, c?.sel ?? '00'.repeat(16));
    if (!c || essai !== c.empreinte) throw new Error('Identifiant ou mot de passe incorrect.');
    if (!c.actif) throw new Error('Ce compte est désactivé. Adressez-vous à l’administrateur.');
    ecrireSession(c.id, rester);
    setCompte(c); setEtat('connecte');
  }

  function deconnexion() { ecrireSession(null); setCompte(null); setEtat('deconnecte'); }

  async function initialiser(p: { nom: string; identifiant: string; motDePasse: string; appareil: string }) {
    if ((await tout('comptes')).length) throw new Error('Un administrateur existe déjà sur cet appareil.');
    const err = verifierRegles(p.motDePasse); if (err) throw new Error(err);
    const c: Compte = {
      id: crypto.randomUUID(), identifiant: p.identifiant.trim(), nom_complet: p.nom.trim(), role: 'admin',
      site_id: null, actif: true, created_at: new Date().toISOString(), ...(await preparerMotDePasse(p.motDePasse)),
    };
    await metaEcrire('appareil', p.appareil.trim().toUpperCase());
    if (!(await metaLire('sites'))) await metaEcrire('sites', SITES_DEFAUT);
    await ecrire('comptes', c);
    ecrireSession(c.id);
    await rafraichir();
  }

  return (
    <AuthCtx.Provider value={{ etat, compte, sites, appareil, connexion, deconnexion, initialiser, rafraichir }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
