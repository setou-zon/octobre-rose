import { createClient } from '@supabase/supabase-js';

// Adresse et clé publique du projet Supabase « octobre rose ».
// La clé « publishable » est faite pour être publique : la sécurité repose sur les règles d'accès de la base.
const URL_PAR_DEFAUT = 'https://didtcctmmkhostpwccpq.supabase.co';
const CLE_PAR_DEFAUT = 'sb_publishable_jVKCNJE9bVhBlkYKx60kmA__1iOnhnb';

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || URL_PAR_DEFAUT;
const cle = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) || CLE_PAR_DEFAUT;

export const baseConfiguree = Boolean(url && cle);

export const supabase = createClient(url || 'http://localhost:54321', cle || 'cle-absente', {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'or26-auth' },
});

/** Les comptes utilisent un identifiant ; Supabase demande une adresse : on en fabrique une. */
export const DOMAINE_COMPTES = 'agents.octobre-rose-adg.org';
export const emailDe = (identifiant: string) => `${identifiant.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '')}@${DOMAINE_COMPTES}`;

export function messageErreur(e: unknown): string {
  const m = (e as { message?: string })?.message ?? String(e);
  if (/Invalid login credentials/i.test(m)) return 'Identifiant ou mot de passe incorrect.';
  if (/already registered|already been registered|User already/i.test(m)) return 'Cet identifiant est déjà pris, choisissez-en un autre.';
  if (/Email not confirmed/i.test(m)) return 'Compte pas encore activé côté serveur (confirmation e-mail activée dans Supabase).';
  if (/Password should be/i.test(m)) return 'Mot de passe trop court (8 caractères minimum).';
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'Pas de connexion internet. La première connexion sur un téléphone demande du réseau.';
  if (/row-level security|permission denied/i.test(m)) return 'Action refusée : droits insuffisants.';
  if (/rate limit/i.test(m)) return 'Trop de tentatives, réessayez dans quelques minutes.';
  return m;
}
