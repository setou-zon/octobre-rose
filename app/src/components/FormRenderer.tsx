import { useState } from 'react';
import type { Champ, Formulaire, Valeurs } from '../forms/types';
import { champsManquants, enregistrer, nettoyer } from '../lib/store';
import { useAuth } from '../lib/auth';
import type { Table } from '../lib/db';

type Props = {
  form: Formulaire;
  initial?: Valeurs;
  id?: string;
  /** Valeurs ajoutées à l'enregistrement (ex. depistage_id d'une référence) */
  extra?: Valeurs;
  onEnregistre: (ligne: Valeurs) => void;
  onAnnuler?: () => void;
  /** Bouton de suppression (administrateur) */
  onSupprimer?: () => void;
};

export function FormRenderer({ form, initial, id, extra, onEnregistre, onAnnuler, onSupprimer }: Props) {
  const { compte, sites, appareil } = useAuth();
  const [v, setV] = useState<Valeurs>(() => ({
    ...(form.defaut?.() ?? {}),
    ...(compte?.site_id && !initial ? { site_id: compte.site_id } : {}),
    ...(initial ?? {}),
  }));
  const [erreurs, setErreurs] = useState<string[]>([]);
  const [envoi, setEnvoi] = useState(false);

  const maj = (name: string, val: unknown) => setV((p) => ({ ...p, [name]: val }));

  async function soumettre(e: React.FormEvent) {
    e.preventDefault();
    const manquants = champsManquants(form, v).map((l) => `Champ obligatoire : ${l}`);
    const coherence = form.verifier?.(v) ?? [];
    if (manquants.length || coherence.length) {
      setErreurs([...manquants, ...coherence]);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setErreurs([]);
    setEnvoi(true);
    try {
      const ligne = await enregistrer(form.table as Table, { ...nettoyer(form, v), ...(extra ?? {}) }, { compte: compte!, sites, appareil }, id);
      onEnregistre(ligne);
    } catch (err) {
      setErreurs([(err as Error).message ?? String(err)]);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <form className="fiche" onSubmit={soumettre} noValidate>
      {erreurs.length > 0 && (
        <div className="alerte erreur" role="alert">
          <strong>À corriger avant d’enregistrer :</strong>
          <ul>{erreurs.map((e) => <li key={e}>{e}</li>)}</ul>
        </div>
      )}
      {form.sections.filter((s) => !s.si || s.si(v)).map((s) => (
        <fieldset key={s.titre} className="section">
          <legend>{s.titre}</legend>
          {s.aide && <p className="aide">{s.aide}</p>}
          <div className="grille">
            {s.champs.filter((c) => !c.si || c.si(v)).map((c) => (
              <ChampSaisie key={c.name} c={c} val={v[c.name]} maj={maj} sites={sites} />
            ))}
          </div>
        </fieldset>
      ))}
      <div className="actions-fiche">
        {onAnnuler && <button type="button" className="btn secondaire" onClick={onAnnuler}>Annuler</button>}
        {onSupprimer && <button type="button" className="btn danger" onClick={onSupprimer}>Supprimer</button>}
        <button type="submit" className="btn principal" disabled={envoi}>
          {envoi ? 'Enregistrement…' : id ? 'Enregistrer les modifications' : 'Enregistrer la fiche'}
        </button>
      </div>
    </form>
  );
}

function ChampSaisie({ c, val, maj, sites }: {
  c: Champ; val: unknown; maj: (n: string, v: unknown) => void; sites: { id: number; nom: string; code: string }[];
}) {
  const idc = `c-${c.name}`;
  const libelle = <>{c.label}{c.required && <span className="obligatoire" aria-hidden> *</span>}</>;
  const classe = `champ${c.large ? ' large' : ''}`;
  const aide = c.aide ? <small className="aide">{c.aide}</small> : null;

  if (c.type === 'choix' || c.type === 'ouinon' || c.type === 'ouinonnsp') {
    const options = c.type === 'choix' ? c.options
      : c.type === 'ouinon' ? [{ v: 'true', l: 'Oui' }, { v: 'false', l: 'Non' }]
      : [{ v: 'oui', l: 'Oui' }, { v: 'non', l: 'Non' }, { v: 'nsp', l: 'Ne sait pas' }];
    const courant = c.type === 'ouinon' ? (val === true ? 'true' : val === false ? 'false' : '') : String(val ?? '');
    return (
      <div className={classe} role="radiogroup" aria-labelledby={idc}>
        <span id={idc} className="libelle">{libelle}</span>
        <div className="puces">
          {options.map((op) => (
            <button type="button" key={op.v} role="radio" aria-checked={courant === op.v}
              className={`puce${courant === op.v ? ' active' : ''}`}
              onClick={() => maj(c.name, courant === op.v ? null : c.type === 'ouinon' ? op.v === 'true' : op.v)}>
              {op.l}
            </button>
          ))}
        </div>
        {aide}
      </div>
    );
  }

  if (c.type === 'multi') {
    const sel = Array.isArray(val) ? (val as string[]) : [];
    return (
      <div className={classe} role="group" aria-labelledby={idc}>
        <span id={idc} className="libelle">{libelle}</span>
        <div className="puces">
          {c.options.map((op) => {
            const actif = sel.includes(op.v);
            return (
              <button type="button" key={op.v} aria-pressed={actif} className={`puce${actif ? ' active' : ''}`}
                onClick={() => maj(c.name, actif ? sel.filter((x) => x !== op.v) : [...sel, op.v])}>
                {actif ? '✓ ' : ''}{op.l}
              </button>
            );
          })}
        </div>
        {aide}
      </div>
    );
  }

  if (c.type === 'site') {
    return (
      <label className={classe} htmlFor={idc}>
        <span className="libelle">{libelle}</span>
        <select id={idc} value={String(val ?? '')} onChange={(e) => maj(c.name, e.target.value ? Number(e.target.value) : null)}>
          <option value="">— Choisir —</option>
          {sites.map((s) => <option key={s.id} value={s.id}>{s.nom} ({s.code})</option>)}
        </select>
        {aide}
      </label>
    );
  }

  if (c.type === 'textarea') {
    return (
      <label className={classe} htmlFor={idc}>
        <span className="libelle">{libelle}</span>
        <textarea id={idc} rows={3} value={String(val ?? '')} onChange={(e) => maj(c.name, e.target.value)} />
        {aide}
      </label>
    );
  }

  return (
    <label className={classe} htmlFor={idc}>
      <span className="libelle">{libelle}</span>
      <input id={idc} type={c.type} inputMode={c.type === 'number' ? 'decimal' : undefined}
        min={c.type === 'number' ? c.min : undefined} max={c.type === 'number' ? c.max : undefined}
        step={c.type === 'number' ? c.step : undefined}
        value={val === null || val === undefined ? '' : String(val)}
        onChange={(e) => maj(c.name, e.target.value)} />
      {aide}
    </label>
  );
}
