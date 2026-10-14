import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import '@fontsource/eb-garamond/latin-400.css';
import '@fontsource/eb-garamond/latin-500.css';
import '@fontsource/eb-garamond/latin-600.css';
import '@fontsource/eb-garamond/latin-700.css';
import '@fontsource/eb-garamond/latin-400-italic.css';
import './index.css';
import App from './App';
import { ecouterInstallation } from './lib/installation';

// à capter avant l'affichage : le navigateur ne propose l'installation qu'une fois
ecouterInstallation();

// Service worker : l'application s'ouvre et fonctionne sans réseau après la première visite
registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
