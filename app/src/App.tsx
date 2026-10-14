import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './lib/auth';
import { supabase } from './lib/supabase';
import { etatSync, synchroniser, type EtatSync } from './lib/sync';
import { Ruban } from './components/Ruban';
import { Installation } from './components/Installation';
import { PageConnexion, PageEnAttente, PageNonConfiguree, PageNouveauMotDePasse } from './pages/Connexion';
import { PageCommunication, PageSensibilisation } from './pages/Simples';
import { PageNouvelleFiche, PageReferences, PageRegistre } from './pages/Depistage';
import { PageAccueil, PageIndicateurs, PageSynthese } from './pages/Pilotage';
import { PageDonnees, PageEquipe } from './pages/Administration';

type Page = { id: string; titre: string; court: string; outil?: string; admin?: boolean };
const PAGES: Page[] = [
  { id: 'accueil', titre: 'Tableau de bord', court: 'Tableau de bord' },
  { id: 'sensibilisation', titre: 'Séances de sensibilisation', court: 'Sensibilisation', outil: '1' },
  { id: 'fiche', titre: 'Nouvelle fiche de dépistage', court: 'Dépistage', outil: '2' },
  { id: 'registre', titre: 'Registre journalier', court: 'Registre', outil: '3' },
  { id: 'references', titre: 'Références et suivi', court: 'Références', outil: '4–5' },
  { id: 'communication', titre: 'Supports, médias et leaders', court: 'Communication', outil: '6' },
  { id: 'synthese', titre: 'Synthèse journalière', court: 'Synthèse du jour', outil: '7' },
  { id: 'indicateurs', titre: 'Indicateurs de la campagne', court: 'Indicateurs', outil: '8' },
  { id: 'donnees', titre: 'Synchronisation et téléchargements', court: 'Données' },
  { id: 'equipe', titre: 'Équipe et sites', court: 'Équipe', admin: true },
];

// les liens reçus par e-mail ajoutent « #access_token=… » : on revient alors au tableau de bord
const pageDepuisHash = () => (window.location.hash.startsWith('#/') ? window.location.hash.slice(2) : '') || 'accueil';

function Coquille() {
  const { etat, compte, deconnexion } = useAuth();
  const [page, setPage] = useState(pageDepuisHash());
  const [menu, setMenu] = useState(false);
  const [enLigne, setEnLigne] = useState(navigator.onLine);
  const [demandes, setDemandes] = useState(0);
  const [sync, setSync] = useState<EtatSync>(etatSync());
  useEffect(() => {
    if (compte?.role !== 'admin' || !navigator.onLine) return;
    supabase.from('profils').select('id', { count: 'exact', head: true }).eq('valide', false).eq('actif', true)
      .then(({ count }) => setDemandes(count ?? 0));
  }, [compte, page]);

  // synchronisation : au démarrage, au retour du réseau, puis toutes les 2 minutes
  useEffect(() => {
    if (etat !== 'connecte') return;
    const s = (e: Event) => setSync((e as CustomEvent<EtatSync>).detail);
    const go = () => { synchroniser(); };
    window.addEventListener('or26-sync', s);
    window.addEventListener('online', go);
    const t = window.setInterval(go, 120000);
    go();
    return () => { window.removeEventListener('or26-sync', s); window.removeEventListener('online', go); window.clearInterval(t); };
  }, [etat]);

  useEffect(() => {
    const h = () => { setPage(pageDepuisHash()); setMenu(false); window.scrollTo({ top: 0 }); };
    const r = () => setEnLigne(navigator.onLine);
    window.addEventListener('hashchange', h);
    window.addEventListener('online', r);
    window.addEventListener('offline', r);
    return () => { window.removeEventListener('hashchange', h); window.removeEventListener('online', r); window.removeEventListener('offline', r); };
  }, []);

  if (etat === 'chargement') return <div className="chargement"><Ruban className="ruban-chargement" />Chargement…</div>;
  if (etat === 'non_configure') return <PageNonConfiguree />;
  if (etat === 'nouveau_mot_de_passe') return <PageNouveauMotDePasse />;
  if (etat === 'deconnecte' || !compte) return <PageConnexion />;
  if (etat === 'en_attente') return <PageEnAttente />;

  const allerA = (p: string) => { window.location.hash = `#/${p}`; };
  const visibles = PAGES.filter((p) => !p.admin || compte.role === 'admin');
  const courante = visibles.find((p) => p.id === page) ?? visibles[0];

  return (
    <div className="appli">
      <header className="entete">
        <button className="burger" aria-label="Menu" aria-expanded={menu} onClick={() => setMenu(!menu)}>☰</button>
        <a className="marque" href="#/accueil"><Ruban className="ruban-entete" /> Octobre Rose 2026</a>
        <div className="etat">
          <span className={`badge ${enLigne ? 'en-ligne' : 'hors-ligne'}`} title="Les fiches sont toujours enregistrées sur l’appareil">
            {enLigne ? 'En ligne' : 'Hors ligne · saisie possible'}
          </span>
          <a className={`badge ${sync.enAttente ? 'attente' : 'en-ligne'}`} href="#/donnees"
            title={sync.derniere ? `Dernière synchronisation : ${new Date(sync.derniere).toLocaleString('fr-FR')}` : 'Jamais synchronisé'}>
            {sync.enCours ? 'Synchronisation…' : sync.enAttente ? `${sync.enAttente} à envoyer` : '✓ Synchronisé'}
          </a>
          <span className="utilisateur">{compte.nom_complet}</span>
          <button className="lien" onClick={() => {
            if (sync.enAttente && !confirm(`${sync.enAttente} fiche(s) ne sont pas encore envoyées. Elles restent sur ce téléphone et partiront à la prochaine connexion. Se déconnecter ?`)) return;
            deconnexion();
          }}>Déconnexion</button>
        </div>
      </header>
      <div className="corps">
        <nav className={`navigation${menu ? ' ouverte' : ''}`} aria-label="Outils de collecte">
          {visibles.map((p) => (
            <a key={p.id} href={`#/${p.id}`} className={p.id === courante.id ? 'actif' : ''} aria-current={p.id === courante.id ? 'page' : undefined}>
              <span className="num-outil">{p.outil ?? '•'}</span>{p.court}
              {p.id === 'equipe' && demandes > 0 && <span className="pastille p-suspect" title="Demandes de compte à valider">{demandes}</span>}
            </a>
          ))}
          <Installation />
        </nav>
        {menu && <div className="voile" onClick={() => setMenu(false)} />}
        <main className="contenu">
          {demandes > 0 && courante.id === 'accueil' && (
            <a className="alerte attention alerte-demandes" href="#/equipe">{demandes} demande(s) de compte à valider → Équipe</a>
          )}
          {courante.id !== 'accueil' && <h1>{courante.titre}{courante.outil && <span className="etiquette">Outil {courante.outil}</span>}</h1>}
          {courante.id === 'accueil' && <PageAccueil allerA={allerA} />}
          {courante.id === 'sensibilisation' && <PageSensibilisation />}
          {courante.id === 'fiche' && <PageNouvelleFiche allerA={allerA} />}
          {courante.id === 'registre' && <PageRegistre />}
          {courante.id === 'references' && <PageReferences />}
          {courante.id === 'communication' && <PageCommunication />}
          {courante.id === 'synthese' && <PageSynthese />}
          {courante.id === 'indicateurs' && <PageIndicateurs />}
          {courante.id === 'donnees' && <PageDonnees />}
          {courante.id === 'equipe' && <PageEquipe />}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return <AuthProvider><Coquille /></AuthProvider>;
}
