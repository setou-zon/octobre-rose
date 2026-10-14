import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const configure = Boolean(url && key);

export const supabase = createClient(url ?? 'http://localhost', key ?? 'cle-absente', {
  auth: { persistSession: true, autoRefreshToken: true },
});

/** Traduit les erreurs fréquentes en message compréhensible */
export function messageErreur(e: unknown): string {
  const m = (e as { message?: string })?.message ?? String(e);
  if (/row-level security|permission denied/i.test(m))
    return 'Accès refusé : votre compte n’a pas les droits pour cette action (compte non validé ou autre site).';
  if (/Invalid login credentials/i.test(m)) return 'Adresse e-mail ou mot de passe incorrect.';
  if (/Email not confirmed/i.test(m)) return 'Adresse e-mail non confirmée : ouvrez le lien reçu par e-mail.';
  if (/duplicate key.*site_id, date_synthese/i.test(m)) return 'Une synthèse existe déjà pour ce site et cette date.';
  if (/Failed to fetch|NetworkError/i.test(m)) return 'Pas de connexion internet. Réessayez quand le réseau revient.';
  if (/examen_avec_consentement/.test(m)) return 'Aucun examen ne peut être enregistré sans consentement.';
  return m;
}
