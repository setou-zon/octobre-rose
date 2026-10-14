import { useCallback, useEffect, useState, type ReactNode } from 'react';
import type { Formulaire, Valeurs } from '../forms/types';
import { useAuth } from '../lib/auth';
import type { Fiche, Table } from '../lib/db';
import { exporterCsv, liste, supprimer } from '../lib/store';
import { FormRenderer } from './FormRenderer';
import { BoutonPdf } from './BoutonPdf';
import { Tableau, type Colonne } from './Tableau';

type Props = {
  form: Formulaire;
  colonnes: Colonne[];
  ordre: string;
  intro?: ReactNode;
  libelleNouveau: string;
  nomExport: string;
};

/** Liste + saisie / modification d'une table simple */
export function PageListe({ form, colonnes, ordre, intro, libelleNouveau, nomExport }: Props) {
  const { compte } = useAuth();
  const [lignes, setLignes] = useState<Fiche[]>([]);
  const [edition, setEdition] = useState<Fiche | 'nouveau' | null>(null);
  const [info, setInfo] = useState('');
  const table = form.table as Table;

  const charger = useCallback(async () => {
    const l = await liste(table, compte);
    setLignes(l.sort((a, b) => String(b[ordre] ?? '').localeCompare(String(a[ordre] ?? ''))));
  }, [table, compte, ordre]);

  useEffect(() => { charger(); }, [charger]);

  if (edition) {
    const existant = edition === 'nouveau' ? undefined : edition;
    return (
      <section>
        <h2>{existant ? `Modifier – ${form.titre}` : libelleNouveau}</h2>
        {existant && (
          <div className="barre">
            <BoutonPdf form={form} valeurs={existant} nomFichier={`${nomExport}_${String(existant.date_seance ?? existant.date_activite ?? existant.updated_at).slice(0, 10)}.pdf`} />
          </div>
        )}
        <FormRenderer form={form} initial={existant} id={existant?.id}
          onAnnuler={() => setEdition(null)}
          onSupprimer={existant && compte?.role === 'admin' ? async () => {
            if (!confirm('Supprimer définitivement cette fiche ?')) return;
            await supprimer(table, existant.id, compte); setInfo('Fiche supprimée.'); setEdition(null); charger();
          } : undefined}
          onEnregistre={() => { setInfo('Fiche enregistrée sur cet appareil.'); setEdition(null); charger(); }} />
      </section>
    );
  }

  return (
    <section>
      {intro}
      {info && <div className="alerte succes" role="status">{info}</div>}
      <div className="barre">
        <button className="btn principal" onClick={() => { setInfo(''); setEdition('nouveau'); }}>+ {libelleNouveau}</button>
        <button className="btn secondaire" disabled={!lignes.length} onClick={() => exporterCsv(nomExport, lignes as Valeurs[], ['supprime'])}>Télécharger (CSV)</button>
        <span className="compteur">{lignes.length} fiche{lignes.length > 1 ? 's' : ''}</span>
      </div>
      <Tableau colonnes={colonnes} lignes={lignes} onClic={(l) => { setInfo(''); setEdition(l as Fiche); }} />
    </section>
  );
}
