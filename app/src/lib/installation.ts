// Installation de l'application (PWA).
// Le navigateur envoie « beforeinstallprompt » une seule fois, souvent avant l'affichage des écrans :
// on le capte dès le chargement pour pouvoir le proposer partout.
export type InviteInstallation = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

let invite: InviteInstallation | null = null;
const prevenir = () => window.dispatchEvent(new Event('or26-installation'));

export const estInstallee = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;

export const inviteDisponible = () => invite !== null;

export function ecouterInstallation() {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); invite = e as InviteInstallation; prevenir(); });
  window.addEventListener('appinstalled', () => { invite = null; prevenir(); });
}

/** Ouvre la fenêtre d'installation du navigateur ; renvoie false si elle n'est pas disponible */
export async function lancerInstallation(): Promise<boolean> {
  if (!invite) return false;
  await invite.prompt();
  await invite.userChoice;
  invite = null;
  prevenir();
  return true;
}

export type Plateforme = 'ios' | 'android' | 'ordinateur';
export function plateforme(): Plateforme {
  const ua = navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  if (/android/i.test(ua)) return 'android';
  return 'ordinateur';
}
