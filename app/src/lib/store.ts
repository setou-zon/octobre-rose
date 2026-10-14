import type { Formulaire, Valeurs } from '../forms/types';
import type { Compte, Site } from './auth';
import { TABLES, compteurSuivant, ecrire, ecrireLot, lire, metaEcrire, metaLire, tout, type Fiche, type Table } from './db';

// ---------------------------------------------------------------------------
// Nettoyage et contrôle des valeurs d'un formulaire
// ---------------------------------------------------------------------------
export function nettoyer(f: Formulaire, v: Valeurs): Valeurs {
  const sortie: Valeurs = {};
  for (const s of f.sections) {
    const sectionVisible = !s.si || s.si(v);
    for (const c of s.champs) {
      const visible = sectionVisible && (!c.si || c.si(v));
      let val = v[c.name];
      if (!visible) val = c.type === 'multi' ? [] : null;
      if (val === '' || val === undefined) val = c.type === 'multi' ? [] : null;
      if (c.type === 'number') val = val === null ? (c.zero ? 0 : null) : Number(val);
      if (val === null && ['sein_examine', 'col_realise', 'cr_recue'].includes(c.name)) val = false;
      sortie[c.name] = val;
    }
  }
  return sortie;
}

export function champsManquants(f: Formulaire, v: Valeurs): string[] {
  const manquants: string[] = [];
  for (const s of f.sections) {
    if (s.si && !s.si(v)) continue;
    for (const c of s.champs) {
      if (!c.required || (c.si && !c.si(v))) continue;
      const val = v[c.name];
      if (val === null || val === undefined || val === '' || (Array.isArray(val) && val.length === 0)) manquants.push(c.label);
    }
  }
  return manquants;
}

// ---------------------------------------------------------------------------
// Événement de mise à jour (le tableau de bord se rafraîchit tout seul)
// ---------------------------------------------------------------------------
const signaler = () => window.dispatchEvent(new Event('or26-donnees'));

// ---------------------------------------------------------------------------
// Lecture avec droits : un agent ne voit les fiches nominatives que de son site
// ---------------------------------------------------------------------------
export function peutVoir(compte: Compte | null, table: Table, f: Fiche, depistagesVisibles?: Set<string>) {
  if (!compte || f.supprime) return false;
  if (compte.role === 'admin' || compte.site_id == null) return true;
  if (table === 'depistages' || table === 'syntheses_journalieres') return f.site_id === compte.site_id;
  if (table === 'references_cas') return depistagesVisibles?.has(String(f.depistage_id)) ?? false;
  return true;
}

export async function liste(table: Table, compte: Compte | null): Promise<Fiche[]> {
  const fiches = await tout(table);
  let visibles: Set<string> | undefined;
  if (table === 'references_cas') {
    visibles = new Set((await tout('depistages')).filter((d) => peutVoir(compte, 'depistages', d)).map((d) => d.id));
  }
  return fiches.filter((f) => peutVoir(compte, table, f, visibles));
}

/** Toutes les données visibles, en une fois (tableau de bord, exports) */
export async function toutesLesDonnees(compte: Compte | null) {
  const r = {} as Record<Table, Fiche[]>;
  for (const t of TABLES) r[t] = await liste(t, compte);
  return r;
}

// ---------------------------------------------------------------------------
// Enregistrement
// ---------------------------------------------------------------------------
export async function enregistrer(table: Table, valeurs: Valeurs, ctx: { compte: Compte; sites: Site[]; appareil: string }, id?: string): Promise<Fiche> {
  const maintenant = new Date().toISOString();
  let fiche: Fiche;

  if (id) {
    const ancien = await lire(table, id);
    if (!ancien) throw new Error('Fiche introuvable.');
    fiche = { ...ancien, ...valeurs, id, updated_at: maintenant, modifie_par: ctx.compte.nom_complet };
    // le code, le site et la date d'une bénéficiaire ne changent plus
    for (const k of ['code', 'numero_ordre', 'site_id', 'date_depistage', 'numero', 'depistage_id', 'created_at']) {
      if (k in ancien) fiche[k] = ancien[k];
    }
  } else {
    fiche = {
      ...valeurs, id: crypto.randomUUID(), created_at: maintenant, updated_at: maintenant,
      saisi_par: ctx.compte.nom_complet, appareil: ctx.appareil,
    };
    if (table === 'depistages') {
      const site = ctx.sites.find((s) => s.id === Number(valeurs.site_id));
      if (!site) throw new Error('Choisissez le site.');
      const date = String(valeurs.date_depistage);
      const n = await compteurSuivant(`ordre-${site.code}-${date}`);
      fiche.numero_ordre = n;
      // Le code appareil évite que deux appareils donnent le même code le même jour
      fiche.code = `OR${date.slice(2, 4)}-${site.code}-${date.slice(8, 10)}-${ctx.appareil}${String(n).padStart(3, '0')}`;
    }
    if (table === 'references_cas') {
      const n = await compteurSuivant('reference');
      fiche.numero = `R${String(valeurs.date_reference ?? maintenant).slice(2, 4)}-${ctx.appareil}${String(n).padStart(4, '0')}`;
    }
    if (table === 'syntheses_journalieres') {
      const existe = (await tout(table)).find((s) => !s.supprime && s.site_id === valeurs.site_id && s.date_synthese === valeurs.date_synthese);
      if (existe) throw new Error('Une synthèse existe déjà pour ce site et cette date : modifiez-la.');
    }
  }

  if (table === 'depistages') {
    if (fiche.consentement !== true && (fiche.sein_examine || fiche.col_realise)) throw new Error('Aucun examen ne peut être enregistré sans consentement.');
  }
  if (table === 'seances_sensibilisation') {
    const f = ['f_moins15', 'f_15_24', 'f_25_49', 'f_50plus'].reduce((s, k) => s + (Number(fiche[k]) || 0), 0);
    const h = ['h_moins15', 'h_15_24', 'h_25_49', 'h_50plus'].reduce((s, k) => s + (Number(fiche[k]) || 0), 0);
    Object.assign(fiche, { total_femmes: f, total_hommes: h, total: f + h });
  }

  await ecrire(table, fiche);
  signaler();
  return fiche;
}

/** Suppression : la fiche est marquée supprimée pour que l'import d'un autre appareil ne la fasse pas revenir */
export async function supprimer(table: Table, id: string, compte: Compte) {
  const f = await lire(table, id);
  if (!f) return;
  await ecrire(table, { ...f, supprime: true, updated_at: new Date().toISOString(), modifie_par: compte.nom_complet });
  if (table === 'depistages') {
    const refs = (await tout('references_cas')).filter((r) => r.depistage_id === id && !r.supprime);
    await ecrireLot('references_cas', refs.map((r) => ({ ...r, supprime: true, updated_at: new Date().toISOString() })));
  }
  signaler();
}

// ---------------------------------------------------------------------------
// Consolidation : export d'un paquet et import (fusion par fiche, la plus récente gagne)
// ---------------------------------------------------------------------------
export const FORMAT_PAQUET = 'octobre-rose-2026/v1';

export async function exporterPaquet(compte: Compte, appareil: string) {
  const donnees = {} as Record<Table, Fiche[]>;
  for (const t of TABLES) {
    // le paquet contient aussi les suppressions, pour les propager
    const visibles = await liste(t, compte);
    const ids = new Set(visibles.map((f) => f.id));
    donnees[t] = (await tout(t)).filter((f) => ids.has(f.id) || (f.supprime && (compte.role === 'admin' || t !== 'depistages' || f.site_id === compte.site_id)));
  }
  const paquet = { format: FORMAT_PAQUET, appareil, exporte_par: compte.nom_complet, exporte_le: new Date().toISOString(), sites: await metaLire('sites'), donnees };
  const nb = Object.values(donnees).reduce((s, l) => s + l.filter((f) => !f.supprime).length, 0);
  const date = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
  telecharger(`octobre-rose_appareil-${appareil}_${date}.json`, JSON.stringify(paquet), 'application/json');
  await metaEcrire('derniere-sauvegarde', new Date().toISOString());
  signaler();
  return nb;
}

export type BilanImport = { ajoutees: number; misesAJour: number; ignorees: number; appareil: string; exporte_par: string };

export async function importerPaquet(texte: string): Promise<BilanImport> {
  let p: { format?: string; appareil?: string; exporte_par?: string; sites?: Site[]; donnees?: Record<string, Fiche[]> };
  try { p = JSON.parse(texte); } catch { throw new Error('Ce fichier n’est pas un export de l’application.'); }
  if (p.format !== FORMAT_PAQUET || !p.donnees) throw new Error('Ce fichier n’est pas un export Octobre Rose 2026.');
  const bilan: BilanImport = { ajoutees: 0, misesAJour: 0, ignorees: 0, appareil: p.appareil ?? '?', exporte_par: p.exporte_par ?? '?' };
  for (const t of TABLES) {
    const entrants = (p.donnees[t] ?? []).filter((f) => f && typeof f.id === 'string' && typeof f.updated_at === 'string');
    const locaux = new Map((await tout(t)).map((f) => [f.id, f]));
    const aEcrire: Fiche[] = [];
    for (const f of entrants) {
      const l = locaux.get(f.id);
      if (!l) { aEcrire.push(f); bilan.ajoutees++; }
      else if (f.updated_at > l.updated_at) { aEcrire.push(f); bilan.misesAJour++; }
      else bilan.ignorees++;
    }
    await ecrireLot(t, aEcrire);
  }
  // nouveaux sites connus de l'autre appareil
  if (Array.isArray(p.sites)) {
    const locaux = (await metaLire<Site[]>('sites')) ?? [];
    const manquants = p.sites.filter((s) => s && s.code && !locaux.some((l) => l.code === s.code));
    if (manquants.length) {
      let max = Math.max(0, ...locaux.map((s) => s.id));
      // si l'identifiant est déjà pris, le site reçoit un nouvel identifiant
      await metaEcrire('sites', [...locaux, ...manquants.map((s) => (locaux.some((l) => l.id === s.id) ? { ...s, id: ++max } : s))]);
    }
  }
  signaler();
  return bilan;
}

// ---------------------------------------------------------------------------
// Téléchargements
// ---------------------------------------------------------------------------
export function telecharger(nom: string, contenu: string, type: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([contenu], { type }));
  a.download = nom;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/** CSV avec « ; » et BOM : s'ouvre correctement dans Excel en français */
export function exporterCsv(nom: string, lignes: Valeurs[], colonnesExclues: string[] = []) {
  if (!lignes.length) return;
  const cols = Array.from(lignes.reduce((s, l) => { Object.keys(l).forEach((k) => s.add(k)); return s; }, new Set<string>()))
    .filter((c) => !colonnesExclues.includes(c));
  const echap = (x: unknown) => {
    const s = Array.isArray(x) ? x.join(', ') : x === null || x === undefined ? '' : typeof x === 'boolean' ? (x ? 'oui' : 'non') : String(x);
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = '﻿' + [cols.join(';'), ...lignes.map((l) => cols.map((c) => echap(l[c])).join(';'))].join('\r\n');
  telecharger(`${nom}_${new Date().toISOString().slice(0, 10)}.csv`, csv, 'text/csv;charset=utf-8');
}
