import { useCallback, useEffect, useState, type ReactNode } from 'react';
import type { Formulaire, Valeurs } from '../forms/types';
import { exporterCsv } from '../lib/data';
import { messageErreur, supabase } from '../lib/supabase';
import { FormRenderer } from './FormRenderer';

export type Colonne = { titre: string; rendu: (l: Valeurs) => ReactNode; num?: boolean };

type Props = {
  form: Formulaire;
  colonnes: Colonne[];
  ordre: string;
  select?: string;
  intro?: ReactNode;
  libelleNouveau: string;
  nomExport: string;
};

/** Liste + saisie / modification d'une table simple */
export function PageListe({ form, colonnes, ordre, select = '*', intro, libelleNouveau, nomExport }: Props) {
  const [lignes, setLignes] = useState<Valeurs[]>([]);
  const [edition, setEdition] = useState<Valeurs | 'nouveau' | null>(null);
  const [erreur, setErreur] = useState('');
  const [info, setInfo] = useState('');

  const charger = useCallback(async () => {
    const { data, error } = await supabase.from(form.table).select(select).order(ordre, { ascending: false }).limit(1000);
    if (error) setErreur(messageErreur(error)); else setLignes((data ?? []) as unknown as Valeurs[]);
  }, [form.table, select, ordre]);

  useEffect(() => { charger(); }, [charger]);

  if (edition) {
    const existant = edition === 'nouveau' ? undefined : edition;
    return (
      <section>
        <h2>{existant ? `Modifier – ${form.titre}` : libelleNouveau}</h2>
        <FormRenderer form={form} initial={existant} id={existant?.id as string | undefined}
          onAnnuler={() => setEdition(null)}
          onEnregistre={(l) => {
            setInfo(l ? 'Fiche enregistrée.' : 'Pas de réseau : fiche gardée sur cet appareil, elle sera envoyée automatiquement.');
            setEdition(null); charger();
          }} />
      </section>
    );
  }

  return (
    <section>
      {intro}
      {info && <div className="alerte succes" role="status">{info}</div>}
      {erreur && <div className="alerte erreur" role="alert">{erreur}</div>}
      <div className="barre">
        <button className="btn principal" onClick={() => { setInfo(''); setEdition('nouveau'); }}>+ {libelleNouveau}</button>
        <button className="btn secondaire" disabled={!lignes.length} onClick={() => exporterCsv(nomExport, lignes)}>Exporter (CSV)</button>
        <span className="compteur">{lignes.length} fiche{lignes.length > 1 ? 's' : ''}</span>
      </div>
      <Tableau colonnes={colonnes} lignes={lignes} onClic={(l) => { setInfo(''); setEdition(l); }} />
    </section>
  );
}

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

export const dateFr = (d: unknown) => (d ? new Date(String(d) + (String(d).length === 10 ? 'T00:00:00' : '')).toLocaleDateString('fr-FR') : '');
