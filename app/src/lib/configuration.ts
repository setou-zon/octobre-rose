import type { Compte, Site } from './auth';
import { ecrireLot, metaEcrire, metaLire, tout } from './db';
import { telecharger } from './store';

// Fichier de configuration : comptes (mots de passe chiffrés), sites et cibles,
// pour installer un nouvel appareil avec les mêmes comptes.
export const FORMAT_CONFIG = 'octobre-rose-2026/configuration-v1';

export async function exporterConfiguration() {
  const config = {
    format: FORMAT_CONFIG,
    exporte_le: new Date().toISOString(),
    comptes: await tout<Compte>('comptes'),
    sites: (await metaLire<Site[]>('sites')) ?? [],
    cibles: (await metaLire('cibles')) ?? {},
  };
  telecharger(`octobre-rose_configuration_${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(config), 'application/json');
}

export async function importerConfiguration(texte: string, appareil?: string) {
  let c: { format?: string; comptes?: Compte[]; sites?: Site[]; cibles?: Record<string, number | null> };
  try { c = JSON.parse(texte); } catch { throw new Error('Ce fichier n’est pas un fichier de configuration.'); }
  if (c.format !== FORMAT_CONFIG || !Array.isArray(c.comptes)) throw new Error('Ce fichier n’est pas une configuration Octobre Rose 2026.');
  const comptes = c.comptes.filter((x) => x && x.id && x.identifiant && x.empreinte && x.sel);
  if (!comptes.some((x) => x.role === 'admin' && x.actif)) throw new Error('La configuration ne contient aucun administrateur actif.');
  // fusion : les comptes du fichier remplacent ceux de même identifiant interne
  await ecrireLot('comptes', comptes);
  if (Array.isArray(c.sites) && c.sites.length) await metaEcrire('sites', c.sites);
  if (c.cibles) await metaEcrire('cibles', c.cibles);
  if (appareil) await metaEcrire('appareil', appareil.trim().toUpperCase());
  return comptes.length;
}

export const CODE_APPAREIL = /^[A-Z][A-Z0-9]?$/;
