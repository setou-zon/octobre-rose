import { LIBELLES } from '../forms/definitions';

export const dateFr = (d: unknown) =>
  d ? new Date(String(d) + (String(d).length === 10 ? 'T00:00:00' : '')).toLocaleDateString('fr-FR') : '';

export const lib = (k: string, v: unknown) => LIBELLES[k]?.[String(v)] ?? String(v ?? '');

export const nombre = (n: unknown) => Number(n ?? 0).toLocaleString('fr-FR');

export const aujourdhui = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
