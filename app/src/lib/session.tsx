import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

export type Profil = {
  id: string;
  nom_complet: string;
  email: string | null;
  role: 'agent' | 'responsable_site' | 'coordination';
  site_id: number | null;
  valide: boolean;
};
export type Site = { id: number; code: string; nom: string; type: string; actif: boolean };

type Ctx = {
  session: Session | null;
  profil: Profil | null;
  sites: Site[];
  chargement: boolean;
  recharger: () => Promise<void>;
};

const SessionCtx = createContext<Ctx>({ session: null, profil: null, sites: [], chargement: true, recharger: async () => {} });

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profil, setProfil] = useState<Profil | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [chargement, setChargement] = useState(true);

  async function chargerProfil(s: Session | null) {
    if (!s) { setProfil(null); setSites([]); setChargement(false); return; }
    const [{ data: p }, { data: st }] = await Promise.all([
      supabase.from('profils').select('*').eq('id', s.user.id).maybeSingle(),
      supabase.from('sites').select('*').order('nom'),
    ]);
    setProfil((p as Profil) ?? null);
    setSites((st as Site[]) ?? []);
    setChargement(false);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); chargerProfil(data.session); });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      // différé pour ne pas bloquer le client d'authentification
      setTimeout(() => chargerProfil(s), 0);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return (
    <SessionCtx.Provider value={{ session, profil, sites, chargement, recharger: () => chargerProfil(session) }}>
      {children}
    </SessionCtx.Provider>
  );
}

export const useSession = () => useContext(SessionCtx);
