import { useEffect, useState } from 'react';
import { SessionProvider, useSession } from './lib/session';
import { configure, supabase } from './lib/supabase';
import { nbEnAttente, synchroniser } from './lib/data';
import { PageConnexion } from './pages/Connexion';
import { PageCommunication, PageSensibilisation } from './pages/Simples';
import { PageNouvelleFiche, PageReferences, PageRegistre } from './pages/Depistage';
import { PageAccueil, PageEquipe, PageIndicateurs, PageSynthese } from './pages/Pilotage';

type Page = { id: string; titre: string; court: string; outil?: string; coord?: boolean };
const PAGES: Page[] = [
  { id: 'accueil', titre: 'Tableau de bord', court: 'Accueil' },
  { id: 'sensibilisation', titre: 'Séances de sensibilisation', court: 'Sensibilisation', outil: '1' },
  { id: 'fiche', titre: 'Nouvelle fiche de dépistage', court: 'Dépistage', outil: '2' },
  { id: 'registre', titre: 'Registre journalier', court: 'Registre', outil: '3' },
  { id: 'references', titre: 'Références et suivi', court: 'Références', outil: '4–5' },
  { id: 'communication', titre: 'Supports, médias et leaders', court: 'Communication', outil: '6' },
  { id: 'synthese', titre: 'Synthèse journalière', court: 'Synthèse', outil: '7' },
  { id: 'indicateurs', titre: 'Indicateurs de la campagne', court: 'Indicateurs', outil: '8' },
  { id: 'equipe', titre: 'Équipe', court: 'Équipe', coord: true },
];

const pageDepuisHash = () => window.location.hash.replace('#/', '') || 'accueil';

function Coquille() {
  const { session, profil, chargement, recharger } = useSession();
  const [page, setPage] = useState(pageDepuisHash());
  const [menu, setMenu] = useState(false);
  const [attente, setAttente] = useState(nbEnAttente());
  const [enLigne, setEnLigne] = useState(navigator.onLine);

  useEffect(() => {
    const h = () => { setPage(pageDepuisHash()); setMenu(false); window.scrollTo({ top: 0 }); };
    const f = () => setAttente(nbEnAttente());
    const sync = async () => { setEnLigne(navigator.onLine); if (navigator.onLine) { await synchroniser(); f(); } };
    window.addEventListener('hashchange', h);
    window.addEventListener('or26-file', f);
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    const t = window.setInterval(sync, 60000);
    sync();
    return () => {
      window.removeEventListener('hashchange', h); window.removeEventListener('or26-file', f);
      window.removeEventListener('online', sync); window.removeEventListener('offline', sync); window.clearInterval(t);
    };
  }, [session]);

  const allerA = (p: string) => { window.location.hash = `#/${p}`; };

  if (!configure) {
    return (
      <div className="connexion"><div className="connexion-carte">
        <h1>Configuration manquante</h1>
        <p>Renseignez <code>VITE_SUPABASE_URL</code> et <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> (voir le README).</p>
      </div></div>
    );
  }
  if (chargement) return <div className="chargement">Chargement…</div>;
  if (!session) return <PageConnexion />;
  if (!profil?.valide) {
    return (
      <div className="connexion"><div className="connexion-carte">
        <div className="ruban" aria-hidden>🎗</div>
        <h1>Compte en attente</h1>
        <p>Votre compte <b>{session.user.email}</b> est créé. La coordination ADG doit le valider avant que vous puissiez saisir des données.</p>
        <button className="btn principal large" onClick={recharger}>Vérifier à nouveau</button>
        <button className="lien" onClick={() => supabase.auth.signOut()}>Se déconnecter</button>
      </div></div>
    );
  }

  const visibles = PAGES.filter((p) => !p.coord || profil.role === 'coordination');
  const courante = visibles.find((p) => p.id === page) ?? visibles[0];

  return (
    <div className="appli">
      <header className="entete">
        <button className="burger" aria-label="Menu" aria-expanded={menu} onClick={() => setMenu(!menu)}>☰</button>
        <a className="marque" href="#/accueil"><span aria-hidden>🎗</span> Octobre Rose 2026</a>
        <div className="etat">
          {!enLigne && <span className="badge hors-ligne">Hors ligne</span>}
          {attente > 0 && <span className="badge attente" title="Fiches gardées sur cet appareil">{attente} en attente</span>}
          <span className="utilisateur">{profil.nom_complet || session.user.email}</span>
          <button className="lien" onClick={() => supabase.auth.signOut()}>Déconnexion</button>
        </div>
      </header>
      <div className="corps">
        <nav className={`navigation${menu ? ' ouverte' : ''}`}>
          {visibles.map((p) => (
            <a key={p.id} href={`#/${p.id}`} className={p.id === courante.id ? 'actif' : ''} aria-current={p.id === courante.id ? 'page' : undefined}>
              {p.outil && <span className="num-outil">{p.outil}</span>}{p.court}
            </a>
          ))}
        </nav>
        <main className="contenu">
          <h1>{courante.titre}{courante.outil && <span className="etiquette">Outil {courante.outil}</span>}</h1>
          {courante.id === 'accueil' && <PageAccueil allerA={allerA} />}
          {courante.id === 'sensibilisation' && <PageSensibilisation />}
          {courante.id === 'fiche' && <PageNouvelleFiche allerA={allerA} />}
          {courante.id === 'registre' && <PageRegistre />}
          {courante.id === 'references' && <PageReferences />}
          {courante.id === 'communication' && <PageCommunication />}
          {courante.id === 'synthese' && <PageSynthese />}
          {courante.id === 'indicateurs' && <PageIndicateurs />}
          {courante.id === 'equipe' && <PageEquipe />}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return <SessionProvider><Coquille /></SessionProvider>;
}
