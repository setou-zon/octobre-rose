import type { ReactNode } from 'react';
import type { Valeurs } from '../forms/types';

export type Colonne = { titre: string; rendu: (l: Valeurs) => ReactNode; num?: boolean };

export function Tableau({ colonnes, lignes, onClic, vide = 'Aucune fiche pour le moment.' }: {
  colonnes: Colonne[]; lignes: Valeurs[]; onClic?: (l: Valeurs) => void; vide?: string;
}) {
  if (!lignes.length) return <p className="vide">{vide}</p>;
  return (
    <div className="tableau-defile">
      <table>
        <thead><tr>{colonnes.map((c) => <th key={c.titre} className={c.num ? 'num' : ''}>{c.titre}</th>)}</tr></thead>
        <tbody>
          {lignes.map((l, i) => (
            <tr key={String(l.id ?? i)} onClick={onClic ? () => onClic(l) : undefined} className={onClic ? 'cliquable' : ''}
              tabIndex={onClic ? 0 : undefined} onKeyDown={onClic ? (e) => { if (e.key === 'Enter') onClic(l); } : undefined}>
              {colonnes.map((c) => <td key={c.titre} className={c.num ? 'num' : ''}>{c.rendu(l)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
