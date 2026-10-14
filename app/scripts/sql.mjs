// Génère la migration Supabase à partir de src/lib/colonnes.json
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const cols = JSON.parse(readFileSync('src/lib/colonnes.json', 'utf8'));
const COMMUNES = `  id uuid primary key,
  saisi_par text,
  modifie_par text,
  saisi_par_id uuid default auth.uid() references public.profils (id) on delete set null,
  supprime boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  synced_at timestamptz not null default now()`;
let tables = '';
for (const [t, c] of Object.entries(cols)) {
  const lignes = Object.entries(c).map(([n, ty]) => {
    let def = `  ${n} ${ty}`;
    if (n === 'site_id') def += ' references public.sites (id)';
    if (n === 'depistage_id') def += ' not null references public.depistages (id) on delete cascade';
    return def;
  });
  tables += `\ncreate table public.${t} (\n${COMMUNES},\n${lignes.join(',\n')}\n);\n`;
  tables += `create index on public.${t} (synced_at);\ncreate index on public.${t} (saisi_par_id);\n`;
  if (c.site_id) tables += `create index on public.${t} (site_id);\n`;
  if (c.depistage_id) tables += `create index on public.${t} (depistage_id);\n`;
  tables += `create trigger horodatage before insert or update on public.${t} for each row execute function private.horodater();\n`;
}
const tete = readFileSync('scripts/sql-entete.sql', 'utf8');
const pied = readFileSync('scripts/sql-regles.sql', 'utf8');
mkdirSync('../supabase/migrations', { recursive: true });
writeFileSync('../supabase/migrations/20261014000000_base_centrale.sql', tete + tables + pied);
console.log('ok');
