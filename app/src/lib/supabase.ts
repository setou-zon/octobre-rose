import { createClient } from '@supabase/supabase-js';

// Adresse et clé publique du projet Supabase « octobre rose ».
// La clé « publishable » est faite pour être publique : la sécurité repose sur les règles d'accès de la base.
const URL_PAR_DEFAUT = 'https://didtcctmmkhostpwccpq.supabase.co';
const CLE_PAR_DEFAUT = 'sb_publishable_jVKCNJE9bVhBlkYKx60kmA__1iOnhnb';

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || URL_PAR_DEFAUT;
const cle = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) || CLE_PAR_DEFAUT;

export const baseConfiguree = Boolean(url && cle);

export const supabase = createClient(url || 'http://localhost:54321', cle || 'cle-absente', {
  // « implicit » : le lien de confirmation reçu par e-mail fonctionne même s'il est ouvert sur un autre appareil
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'or26-auth', flowType: 'implicit', detectSessionInUrl: true },
});

/** Adresse de retour des liens envoyés par e-mail (confirmation, mot de passe oublié) */
export const adresseRetour = () => window.location.origin + window.location.pathname;

export function messageErreur(e: unknown): string {
  const m = (e as { message?: string })?.message ?? String(e);
  if (/Invalid login credentials/i.test(m)) return 'Adresse e-mail ou mot de passe incorrect.';
  if (/already registered|already been registered|User already/i.test(m)) return 'Un compte existe déjà avec cette adresse e-mail. Connectez-vous ou utilisez « Mot de passe oublié ».';
  if (/Email not confirmed/i.test(m)) return 'Adresse e-mail pas encore confirmée : ouvrez le lien reçu par e-mail (pensez aux courriers indésirables).';
  if (/sending (confirmation|recovery)|send.*email|Email address not authorized/i.test(m)) return 'L’e-mail n’a pas pu être envoyé. L’administrateur doit configurer l’envoi d’e-mails dans Supabase (SMTP).';
  if (/invalid.*email|Unable to validate email/i.test(m)) return 'Adresse e-mail invalide.';
  if (/Password should be/i.test(m)) return 'Mot de passe trop court (8 caractères minimum).';
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'Pas de connexion internet. La première connexion sur un téléphone demande du réseau.';
  if (/row-level security|permission denied/i.test(m)) return 'Action refusée : droits insuffisants.';
  if (/rate limit/i.test(m)) return 'Trop de tentatives, réessayez dans quelques minutes.';
  return m;
}
