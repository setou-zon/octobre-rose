// Synchronisation avec la base centrale Supabase.
// Les fiches sont toujours enregistrées d'abord sur l'appareil (champ _a_envoyer = true),
// puis envoyées dès qu'il y a du réseau ; les fiches des autres agents sont ensuite récupérées.
import COLONNES from './colonnes.json';
import { TABLES, ecrire, ecrireLot, metaEcrire, metaLire, tout, type Fiche, type Table } from './db';
import { baseConfiguree, supabase } from './supabase';

const COMMUNES = ['id', 'saisi_par', 'modifie_par', 'supprime', 'created_at', 'updated_at'];
// ordre d'envoi : une référence a besoin de sa bénéficiaire
const ORDRE: Table[] = ['depistages', 'references_cas', 'seances_sensibilisation', 'supports_communication', 'activites_medias', 'leaders_impliques', 'syntheses_journalieres'];

export type EtatSync = {
  enCours: boolean;
  enAttente: number;
  derniere: string | null;
  erreur: string | null;
  renumerotes: { ancien: string; nouveau: string; le: string }[];
};

let etat: EtatSync = { enCours: false, enAttente: 0, derniere: null, erreur: null, renumerotes: [] };
const publier = () => window.dispatchEvent(new CustomEvent('or26-sync', { detail: { ...etat } }));
export const etatSync = () => etat;

export async function compterEnAttente() {
  let n = 0;
  for (const t of TABLES) n += (await tout(t)).filter((f) => f._a_envoyer).length;
  etat = { ...etat, enAttente: n, derniere: (await metaLire<string>('sync-derniere')) ?? null, renumerotes: (await metaLire<EtatSync['renumerotes']>('renumerotes')) ?? [] };
  publier();
  return n;
}

function versServeur(t: Table, f: Fiche) {
  const cols = COLONNES[t] as Record<string, string>;
  const r: Record<string, unknown> = {};
  for (const k of [...COMMUNES, ...Object.keys(cols)]) {
    let v = f[k];
    if (v === undefined || v === '') v = null;
    if (cols[k] === 'text[]' && v === null) v = [];
    r[k] = v;
  }
  r.supprime = f.supprime === true;
  return r;
}

const estReseau = (e: unknown) => /Failed to fetch|NetworkError|Load failed|fetch|timeout/i.test((e as { message?: string })?.message ?? '');

/** Code déjà utilisé sur le serveur par une autre fiche : on ajoute une lettre (…015B) */
async function renumeroter(t: Table, f: Fiche): Promise<Fiche> {
  const champ = t === 'depistages' ? 'code' : 'numero';
  const ancien = String(f.code_initial ?? f[champ]);
  const { data } = await supabase.from(t).select(champ).like(champ, `${ancien}%`);
  const pris = new Set([...(data ?? []).map((x) => String((x as Record<string, unknown>)[champ])), ...(await tout(t)).filter((x) => x.id !== f.id).map((x) => String(x[champ]))]);
  let i = 1, nouveau = '';
  do nouveau = `${ancien}${String.fromCharCode(65 + i++)}`; while (pris.has(nouveau));
  const g = { ...f, [champ]: nouveau, code_initial: ancien };
  await ecrire(t, g);
  const liste = [...((await metaLire<EtatSync['renumerotes']>('renumerotes')) ?? []), { ancien, nouveau, le: new Date().toISOString() }];
  await metaEcrire('renumerotes', liste);
  return g;
}

async function envoyer(): Promise<string[]> {
  const erreurs: string[] = [];
  for (const t of ORDRE) {
    const fiches = (await tout(t)).filter((f) => f._a_envoyer);
    for (let i = 0; i < fiches.length; i += 50) {
      const lot = fiches.slice(i, i + 50);
      const { error } = await supabase.from(t).upsert(lot.map((f) => versServeur(t, f)), { onConflict: 'id' });
      if (!error) {
        await ecrireLot(t, lot.map((f) => ({ ...f, _a_envoyer: false })));
        continue;
      }
      if (estReseau(error)) throw error;
      // le lot a échoué : on envoie fiche par fiche pour isoler le problème
      for (let f of lot) {
        for (let essai = 0; essai < 3; essai++) {
          const r = await supabase.from(t).upsert(versServeur(t, f), { onConflict: 'id' });
          if (!r.error) { await ecrire(t, { ...f, _a_envoyer: false }); break; }
          if (estReseau(r.error)) throw r.error;
          if (r.error.code === '23505' && (t === 'depistages' || t === 'references_cas')) { f = await renumeroter(t, f); continue; }
          erreurs.push(`${t} ${String(f.code ?? f.numero ?? f.id).slice(0, 20)} : ${r.error.message}`);
          break;
        }
      }
    }
  }
  return erreurs;
}

async function recevoir() {
  for (const t of ORDRE) {
    let depuis = (await metaLire<string>(`sync-${t}`)) ?? '1970-01-01T00:00:00Z';
    for (;;) {
      const { data, error } = await supabase.from(t).select('*').gt('synced_at', depuis).order('synced_at').limit(500);
      if (error) throw error;
      if (!data?.length) break;
      const locaux = new Map((await tout(t)).map((f) => [f.id, f]));
      const aEcrire: Fiche[] = [];
      for (const d of data as Fiche[]) {
        const l = locaux.get(d.id);
        // une modification locale plus récente, pas encore envoyée, est gardée
        if (l?._a_envoyer && String(l.updated_at) > String(d.updated_at)) continue;
        aEcrire.push({ ...d, _a_envoyer: false });
      }
      await ecrireLot(t, aEcrire);
      depuis = String((data[data.length - 1] as Fiche).synced_at);
      await metaEcrire(`sync-${t}`, depuis);
      if (data.length < 500) break;
    }
  }
  // cibles des indicateurs
  const { data: c } = await supabase.from('cibles').select('indicateur, cible');
  if (c) await metaEcrire('cibles', Object.fromEntries(c.map((x) => [x.indicateur, x.cible])));
}

let promesse: Promise<void> | null = null;

/** Envoie puis récupère. Sans réseau ou sans compte validé, ne fait rien (les fiches restent en attente). */
export function synchroniser(): Promise<void> {
  if (promesse) return promesse;
  promesse = (async () => {
    if (!baseConfiguree || !navigator.onLine) { await compterEnAttente(); return; }
    const { data } = await supabase.auth.getSession();
    if (!data.session) { await compterEnAttente(); return; }
    // autre utilisateur sur ce téléphone : on reprend la récupération depuis le début (droits différents)
    if ((await metaLire<string>('sync-utilisateur')) !== data.session.user.id) {
      await oublierPosition();
      await metaEcrire('sync-utilisateur', data.session.user.id);
    }
    etat = { ...etat, enCours: true, erreur: null }; publier();
    try {
      const erreurs = await envoyer();
      await recevoir();
      await metaEcrire('sync-derniere', new Date().toISOString());
      etat = { ...etat, erreur: erreurs.length ? erreurs.slice(0, 3).join(' · ') : null };
      window.dispatchEvent(new Event('or26-donnees'));
    } catch (e) {
      etat = { ...etat, erreur: estReseau(e) ? null : (e as Error).message };
    } finally {
      etat = { ...etat, enCours: false };
      await compterEnAttente();
    }
  })().finally(() => { promesse = null; });
  return promesse;
}

/** Envoi rapide après chaque enregistrement (regroupé sur 2 secondes) */
let minuteur: number | undefined;
export function programmerSynchro() {
  window.clearTimeout(minuteur);
  minuteur = window.setTimeout(() => { synchroniser(); }, 2000);
}

/** À la déconnexion : on oublie la position de synchronisation, pas les fiches */
export async function oublierPosition() {
  for (const t of TABLES) await metaEcrire(`sync-${t}`, null);
}
