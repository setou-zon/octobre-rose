import type { Formulaire, Valeurs } from '../forms/types';
import type { Compte, Site } from './auth';
import { TABLES, compteurSuivant, ecrire, ecrireLot, lire, metaEcrire, metaLire, tout, type Fiche, type Table } from './db';
import { programmerSynchro } from './sync';

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
const signaler = () => { window.dispatchEvent(new Event('or26-donnees')); programmerSynchro(); };

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
export async function enregistrer(table: Table, valeurs: Valeurs, ctx: { compte: Compte; sites: Site[] }, id?: string): Promise<Fiche> {
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
      saisi_par: ctx.compte.nom_complet,
    };
    if (table === 'depistages') {
      const site = ctx.sites.find((s) => s.id === Number(valeurs.site_id));
      if (!site) throw new Error('Choisissez le site.');
      const date = String(valeurs.date_depistage);
      // numéro suivant : on repart du plus grand numéro déjà connu (fiches importées comprises)
      const existants = (await tout('depistages')).filter((x) => x.site_id === site.id && x.date_depistage === date);
      let n = Math.max(await compteurSuivant(`ordre-${site.code}-${date}`), ...existants.map((x) => Number(x.numero_ordre) + 1 || 1));
      const pris = new Set(existants.map((x) => x.code));
      const fabriquer = (k: number) => `OR${date.slice(2, 4)}-${site.code}-${date.slice(8, 10)}-${String(k).padStart(3, '0')}`;
      while (pris.has(fabriquer(n))) n++;
      await metaEcrire(`ordre-${site.code}-${date}`, n);
      fiche.numero_ordre = n;
      fiche.code = fabriquer(n);
    }
    if (table === 'references_cas') {
      const annee = String(valeurs.date_reference ?? maintenant).slice(2, 4);
      const existants = new Set((await tout('references_cas')).map((r) => r.numero));
      let n = await compteurSuivant('reference');
      while (existants.has(`R${annee}-${String(n).padStart(4, '0')}`)) n++;
      await metaEcrire('reference', n);
      fiche.numero = `R${annee}-${String(n).padStart(4, '0')}`;
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

  fiche._a_envoyer = true;
  await ecrire(table, fiche);
  signaler();
  return fiche;
}

/** Suppression : la fiche est marquée supprimée pour que l'import d'un autre appareil ne la fasse pas revenir */
export async function supprimer(table: Table, id: string, compte: Compte) {
  const f = await lire(table, id);
  if (!f) return;
  await ecrire(table, { ...f, supprime: true, _a_envoyer: true, updated_at: new Date().toISOString(), modifie_par: compte.nom_complet });
  if (table === 'depistages') {
    const refs = (await tout('references_cas')).filter((r) => r.depistage_id === id && !r.supprime);
    await ecrireLot('references_cas', refs.map((r) => ({ ...r, supprime: true, _a_envoyer: true, updated_at: new Date().toISOString() })));
  }
  signaler();
}

// ---------------------------------------------------------------------------
// Consolidation : export d'un paquet et import (fusion par fiche, la plus récente gagne)
// ---------------------------------------------------------------------------
export const FORMAT_PAQUET = 'octobre-rose-2026/v1';

export async function exporterPaquet(compte: Compte) {
  const donnees = {} as Record<Table, Fiche[]>;
  for (const t of TABLES) {
    // le paquet contient aussi les suppressions, pour les propager
    const visibles = await liste(t, compte);
    const ids = new Set(visibles.map((f) => f.id));
    donnees[t] = (await tout(t)).filter((f) => ids.has(f.id) || (f.supprime && (compte.role === 'admin' || t !== 'depistages' || f.site_id === compte.site_id)));
  }
  const paquet = { format: FORMAT_PAQUET, exporte_par: compte.nom_complet, exporte_le: new Date().toISOString(), sites: await metaLire('sites'), donnees };
  const nb = Object.values(donnees).reduce((s, l) => s + l.filter((f) => !f.supprime).length, 0);
  const date = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
  const qui = compte.identifiant.replace(/[^a-z0-9_-]/gi, '') || 'agent';
  telecharger(`octobre-rose_${qui}_${date}.json`, JSON.stringify(paquet), 'application/json');
  await metaEcrire('derniere-sauvegarde', new Date().toISOString());
  signaler();
  return nb;
}

export type BilanImport = { ajoutees: number; misesAJour: number; ignorees: number; exporte_par: string; fichier: string; renumerotees: string[] };

export async function importerPaquet(texte: string, fichier = ''): Promise<BilanImport> {
  let p: { format?: string; exporte_par?: string; sites?: Site[]; donnees?: Record<string, Fiche[]> };
  try { p = JSON.parse(texte); } catch { throw new Error('Ce fichier n’est pas un export de l’application.'); }
  if (p.format !== FORMAT_PAQUET || !p.donnees) throw new Error('Ce fichier n’est pas un export Octobre Rose 2026.');
  const bilan: BilanImport = { ajoutees: 0, misesAJour: 0, ignorees: 0, exporte_par: p.exporte_par ?? '?', fichier, renumerotees: [] };
  for (const t of TABLES) {
    const entrants = (p.donnees[t] ?? []).filter((f) => f && typeof f.id === 'string' && typeof f.updated_at === 'string');
    const locaux = new Map((await tout(t)).map((f) => [f.id, f]));
    const aEcrire: Fiche[] = [];
    // Deux téléphones ont pu donner le même code le même jour : la fiche importée reçoit une lettre (B, C…)
    const champCode = t === 'depistages' ? 'code' : t === 'references_cas' ? 'numero' : null;
    const codesPris = new Map<string, string>();
    if (champCode) for (const l of locaux.values()) if (l[champCode]) codesPris.set(String(l[champCode]), l.id);
    for (const f0 of entrants) {
      let f = f0;
      const l = locaux.get(f.id);
      // fiche déjà renumérotée lors d'un import précédent : elle garde son nouveau code
      if (champCode && l?.code_initial && l.code_initial === f[champCode]) f = { ...f, [champCode]: l[champCode], code_initial: l.code_initial };
      if (champCode && f[champCode]) {
        const code = String(f[champCode]);
        const proprietaire = codesPris.get(code);
        if (proprietaire && proprietaire !== f.id) {
          let i = 1, nouveau = '';
          do nouveau = `${code}${String.fromCharCode(65 + i++)}`; while (codesPris.has(nouveau));
          f = { ...f, [champCode]: nouveau, code_initial: code };
          if (!f.supprime) bilan.renumerotees.push(`${code} → ${nouveau}`);
        }
        codesPris.set(String(f[champCode]), f.id);
      }
      if (!l) { aEcrire.push({ ...f, _a_envoyer: true }); bilan.ajoutees++; }
      else if (f.updated_at > l.updated_at) { aEcrire.push({ ...f, _a_envoyer: true }); bilan.misesAJour++; }
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
