export type Valeurs = Record<string, unknown>;

export type Option = { v: string; l: string };

type Base = {
  name: string;
  label: string;
  required?: boolean;
  aide?: string;
  /** Affiche le champ seulement si la condition est vraie */
  si?: (v: Valeurs) => boolean;
  /** Largeur : 1 = une colonne, 2 = pleine largeur */
  large?: boolean;
};

export type Champ =
  | (Base & { type: 'text' | 'tel' | 'textarea' | 'date' | 'time' })
  | (Base & { type: 'number'; min?: number; max?: number; step?: number; zero?: boolean })
  | (Base & { type: 'choix'; options: Option[] })
  | (Base & { type: 'multi'; options: Option[] })
  | (Base & { type: 'ouinon' })
  | (Base & { type: 'ouinonnsp' })
  | (Base & { type: 'site' });

export type Section = { titre: string; aide?: string; champs: Champ[]; si?: (v: Valeurs) => boolean };

export type Formulaire = {
  table: string;
  titre: string;
  sections: Section[];
  /** Valeurs par défaut d'une nouvelle fiche */
  defaut?: () => Valeurs;
  /** Contrôles de cohérence avant enregistrement ; renvoie des messages d'erreur */
  verifier?: (v: Valeurs) => string[];
};

export const o = (pairs: [string, string][]): Option[] => pairs.map(([v, l]) => ({ v, l }));
