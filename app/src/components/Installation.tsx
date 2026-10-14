import { useEffect, useState } from 'react';
import { estInstallee, inviteDisponible, lancerInstallation, plateforme } from '../lib/installation';

type Props = { variante?: 'entete' | 'banniere' | 'carte' | 'menu' };

/** Bouton « Installer l'application », avec la marche à suivre quand le navigateur ne propose pas l'installation directe */
export function Installation({ variante = 'carte' }: Props) {
  const [installee, setInstallee] = useState(estInstallee());
  const [, setTic] = useState(0);
  const [aide, setAide] = useState(false);

  useEffect(() => {
    const maj = () => { setInstallee(estInstallee()); setTic((t) => t + 1); };
    window.addEventListener('or26-installation', maj);
    const m = window.matchMedia('(display-mode: standalone)');
    m.addEventListener?.('change', maj);
    return () => { window.removeEventListener('or26-installation', maj); m.removeEventListener?.('change', maj); };
  }, []);

  if (installee) return null;

  const classe = {
    entete: 'installer-entete',
    banniere: 'btn contour-blanc',
    carte: 'btn secondaire large',
    menu: 'installer',
  }[variante];

  return (
    <>
      <button type="button" className={classe} onClick={async () => { if (!(await lancerInstallation())) setAide(true); }}
        title="Installer l’application sur cet appareil">
        <span aria-hidden>⤓</span> {variante === 'entete' ? 'Installer' : 'Installer l’application'}
      </button>
      {aide && <AideInstallation fermer={() => setAide(false)} directe={inviteDisponible()} />}
    </>
  );
}

function AideInstallation({ fermer, directe }: { fermer: () => void; directe: boolean }) {
  const p = plateforme();
  return (
    <div className="fenetre-fond" role="dialog" aria-modal="true" aria-labelledby="titre-installation" onClick={fermer}>
      <div className="fenetre" onClick={(e) => e.stopPropagation()}>
        <h2 id="titre-installation">Installer Octobre Rose 2026</h2>
        <p>Une fois installée, l’application s’ouvre depuis l’écran d’accueil comme les autres et fonctionne sans internet.</p>
        {p === 'ios' && (
          <ol>
            <li>Ouvrez cette page dans <b>Safari</b>.</li>
            <li>Touchez le bouton <b>Partager</b> (carré avec une flèche vers le haut).</li>
            <li>Choisissez <b>Sur l’écran d’accueil</b>, puis <b>Ajouter</b>.</li>
          </ol>
        )}
        {p === 'android' && (
          <ol>
            <li>Ouvrez cette page dans <b>Chrome</b>.</li>
            <li>Touchez le menu <b>⋮</b> en haut à droite.</li>
            <li>Choisissez <b>Installer l’application</b> (ou <b>Ajouter à l’écran d’accueil</b>), puis confirmez.</li>
          </ol>
        )}
        {p === 'ordinateur' && (
          <ol>
            <li>Ouvrez cette page dans <b>Chrome</b> ou <b>Edge</b>.</li>
            <li>Cliquez sur l’icône d’installation <b>⊕</b> à droite de la barre d’adresse,</li>
            <li>ou ouvrez le menu <b>⋮</b> → <b>Installer Octobre Rose</b>.</li>
          </ol>
        )}
        {!directe && <p className="aide">Si l’option n’apparaît pas, rechargez la page une fois puis réessayez.</p>}
        <button className="btn principal large" onClick={fermer}>J’ai compris</button>
      </div>
    </div>
  );
}
