import { supabase } from './supabase';
import type { Formulaire, Valeurs } from '../forms/types';

// ---------------------------------------------------------------------------
// Nettoyage des valeurs : un champ masqué est vidé avant l'enregistrement
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
      // Un oui/non masqué parce que la section est masquée doit rester faux, pas nul
      if (!visible && (c.name === 'sein_examine' || c.name === 'col_realise' || c.name === 'cr_recue')) val = false;
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
// File d'attente hors ligne (nouvelles fiches uniquement)
// ---------------------------------------------------------------------------
type EnAttente = { id: string; table: string; valeurs: Valeurs; quand: string };
const CLE = 'or26-file-attente';

function lireFile(): EnAttente[] {
  try { return JSON.parse(localStorage.getItem(CLE) ?? '[]'); } catch { return []; }
}
function ecrireFile(f: EnAttente[]) {
  try { localStorage.setItem(CLE, JSON.stringify(f)); } catch { /* stockage indisponible */ }
  window.dispatchEvent(new Event('or26-file'));
}
export const nbEnAttente = () => lireFile().length;

const estErreurReseau = (e: unknown) =>
  /Failed to fetch|NetworkError|Load failed|fetch/i.test((e as { message?: string })?.message ?? '') || !navigator.onLine;

export type Resultat = { horsLigne: true } | { horsLigne: false; ligne: Valeurs };

/** Enregistre une fiche ; sans réseau, une nouvelle fiche est mise en attente. */
export async function enregistrer(table: string, valeurs: Valeurs, id?: string): Promise<Resultat> {
  try {
    const req = id
      ? supabase.from(table).update(valeurs).eq('id', id).select().single()
      : supabase.from(table).insert(valeurs).select().single();
    const { data, error } = await req;
    if (error) throw error;
    return { horsLigne: false, ligne: data as Valeurs };
  } catch (e) {
    if (!id && estErreurReseau(e)) {
      ecrireFile([...lireFile(), { id: crypto.randomUUID(), table, valeurs, quand: new Date().toISOString() }]);
      return { horsLigne: true };
    }
    throw e;
  }
}

let syncEnCours = false;
/** Envoie les fiches en attente ; renvoie le nombre envoyé. */
export async function synchroniser(): Promise<{ envoyees: number; erreurs: string[] }> {
  if (syncEnCours || !navigator.onLine) return { envoyees: 0, erreurs: [] };
  syncEnCours = true;
  let envoyees = 0;
  const erreurs: string[] = [];
  try {
    for (const item of lireFile()) {
      const { error } = await supabase.from(item.table).insert(item.valeurs);
      if (error) {
        if (estErreurReseau(error)) break;
        erreurs.push(error.message);
        continue; // reste en file pour correction
      }
      ecrireFile(lireFile().filter((x) => x.id !== item.id));
      envoyees++;
    }
  } finally {
    syncEnCours = false;
  }
  return { envoyees, erreurs };
}

// ---------------------------------------------------------------------------
// Export CSV (séparateur « ; » pour Excel en français)
// ---------------------------------------------------------------------------
export function exporterCsv(nom: string, lignes: Valeurs[]) {
  if (!lignes.length) return;
  const cols = Object.keys(lignes[0]);
  const echap = (x: unknown) => {
    const s = Array.isArray(x) ? x.join(', ') : x === null || x === undefined ? '' : String(x);
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = '﻿' + [cols.join(';'), ...lignes.map((l) => cols.map((c) => echap(l[c])).join(';'))].join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `${nom}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}
