// Stockage local (IndexedDB) : toutes les données restent sur l'appareil, avec ou sans réseau.

export const TABLES = [
  'seances_sensibilisation',
  'depistages',
  'references_cas',
  'supports_communication',
  'activites_medias',
  'leaders_impliques',
  'syntheses_journalieres',
] as const;
export type Table = (typeof TABLES)[number];

export type Fiche = Record<string, unknown> & {
  id: string;
  created_at: string;
  updated_at: string;
  supprime?: boolean;
};

const NOM = 'octobre-rose-2026';
const VERSION = 1;
let ouverture: Promise<IDBDatabase> | null = null;

function ouvrir(): Promise<IDBDatabase> {
  if (ouverture) return ouverture;
  ouverture = new Promise((resolve, reject) => {
    const req = indexedDB.open(NOM, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const t of TABLES) if (!db.objectStoreNames.contains(t)) db.createObjectStore(t, { keyPath: 'id' });
      if (!db.objectStoreNames.contains('comptes')) db.createObjectStore('comptes', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return ouverture;
}

function requete<T>(store: string, mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return ouvrir().then((db) => new Promise<T>((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const r = f(tx.objectStore(store));
    tx.oncomplete = () => resolve(r.result as T);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  }));
}

export const tout = <T = Fiche>(store: string) => requete<T[]>(store, 'readonly', (s) => s.getAll());
export const lire = <T = Fiche>(store: string, id: string) => requete<T | undefined>(store, 'readonly', (s) => s.get(id));
export const ecrire = (store: string, valeur: object) => requete<IDBValidKey>(store, 'readwrite', (s) => s.put(valeur));
export const effacer = (store: string, id: string) => requete<undefined>(store, 'readwrite', (s) => s.delete(id));

export async function ecrireLot(store: string, valeurs: object[]) {
  if (!valeurs.length) return;
  const db = await ouvrir();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const s = tx.objectStore(store);
    for (const v of valeurs) s.put(v);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export const metaLire = <T>(cle: string) => requete<T | undefined>('meta', 'readonly', (s) => s.get(cle));
export const metaEcrire = (cle: string, valeur: unknown) => requete<IDBValidKey>('meta', 'readwrite', (s) => s.put(valeur, cle));

/** Compteur atomique (numéro d'ordre, numéro de référence) */
export async function compteurSuivant(cle: string): Promise<number> {
  const db = await ouvrir();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('meta', 'readwrite');
    const s = tx.objectStore('meta');
    const g = s.get(cle);
    let n = 0;
    g.onsuccess = () => { n = (Number(g.result) || 0) + 1; s.put(n, cle); };
    tx.oncomplete = () => resolve(n);
    tx.onerror = () => reject(tx.error);
  });
}

/** Demande au navigateur de ne pas effacer les données en cas de manque d'espace */
export async function demanderPersistance() {
  try { if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist(); } catch { /* non pris en charge */ }
}
