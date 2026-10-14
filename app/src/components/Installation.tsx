import { useEffect, useState } from 'react';

type InviteInstallation = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/** Bouton « Installer l'application » (Android / ordinateur) et aide pour iPhone */
export function Installation() {
  const [invite, setInvite] = useState<InviteInstallation | null>(null);
  const [installee, setInstallee] = useState(
    window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true,
  );
  const [aideIos, setAideIos] = useState(false);
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);

  useEffect(() => {
    const avant = (e: Event) => { e.preventDefault(); setInvite(e as InviteInstallation); };
    const apres = () => { setInstallee(true); setInvite(null); };
    window.addEventListener('beforeinstallprompt', avant);
    window.addEventListener('appinstalled', apres);
    return () => { window.removeEventListener('beforeinstallprompt', avant); window.removeEventListener('appinstalled', apres); };
  }, []);

  if (installee) return null;
  if (invite) {
    return (
      <button className="installer" onClick={async () => { await invite.prompt(); await invite.userChoice; setInvite(null); }}>
        ⤓ Installer l’application
      </button>
    );
  }
  if (ios) {
    return (
      <div className="installer-ios">
        <button className="installer" onClick={() => setAideIos(!aideIos)}>⤓ Installer sur iPhone</button>
        {aideIos && <p>Dans Safari, touchez <b>Partager</b> puis <b>Sur l’écran d’accueil</b>.</p>}
      </div>
    );
  }
  return null;
}
