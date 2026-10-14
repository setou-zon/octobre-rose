import { useState } from 'react';
import type { Formulaire, Valeurs } from '../forms/types';
import { useAuth } from '../lib/auth';
import { telechargerFichePdf } from '../lib/pdf';

type Props = {
  form: Formulaire;
  valeurs: Valeurs | null;
  titre?: string;
  code?: string;
  enTete?: [string, string][];
  confidentiel?: boolean;
  nomFichier: string;
  libelle?: string;
  classe?: string;
};

/** Télécharge la fiche (remplie ou vierge) en PDF */
export function BoutonPdf({ form, valeurs, titre, code, enTete, confidentiel, nomFichier, libelle = 'Télécharger la fiche (PDF)', classe = 'secondaire' }: Props) {
  const { sites } = useAuth();
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState('');
  return (
    <>
      <button type="button" className={`btn ${classe}`} disabled={occupe} onClick={async () => {
        setOccupe(true); setErreur('');
        try {
          await telechargerFichePdf({ form, valeurs, sites, titre: titre ?? form.titre, code, enTete, confidentiel, nomFichier });
        } catch (e) { setErreur(`Le PDF n’a pas pu être créé : ${(e as Error).message}`); } finally { setOccupe(false); }
      }}>
        {occupe ? 'Préparation du PDF…' : `⤓ ${libelle}`}
      </button>
      {erreur && <span className="alerte erreur">{erreur}</span>}
    </>
  );
}
