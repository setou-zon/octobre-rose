// Génère la liste des colonnes de chaque table à partir des fiches (definitions.ts)
import { build } from 'esbuild';
import { writeFileSync } from 'node:fs';
const r = await build({ entryPoints: ['src/forms/definitions.ts'], bundle: true, format: 'esm', write: false, platform: 'node' });
const mod = await import('data:text/javascript;base64,' + Buffer.from(r.outputFiles[0].text).toString('base64'));
const TYPES = { text: 'text', tel: 'text', textarea: 'text', date: 'date', time: 'time', number: 'numeric', choix: 'text', multi: 'text[]', ouinon: 'boolean', ouinonnsp: 'text', site: 'smallint' };
const formes = { seances_sensibilisation: mod.seance, depistages: mod.depistage, references_cas: mod.reference, supports_communication: mod.support, activites_medias: mod.media, leaders_impliques: mod.leader, syntheses_journalieres: mod.synthese };
const EXTRA = {
  seances_sensibilisation: { total_femmes: 'integer', total_hommes: 'integer', total: 'integer' },
  depistages: { code: 'text', numero_ordre: 'integer', code_initial: 'text' },
  references_cas: { numero: 'text', depistage_id: 'uuid', code_initial: 'text' },
};
const sortie = {};
for (const [t, f] of Object.entries(formes)) {
  const cols = {};
  for (const s of f.sections) for (const c of s.champs) cols[c.name] = TYPES[c.type];
  Object.assign(cols, EXTRA[t] ?? {});
  sortie[t] = cols;
}
writeFileSync('src/lib/colonnes.json', JSON.stringify(sortie, null, 1));
console.log(Object.fromEntries(Object.entries(sortie).map(([t, c]) => [t, Object.keys(c).length])));
