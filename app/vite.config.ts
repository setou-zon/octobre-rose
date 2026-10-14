import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base relative : fonctionne sur GitHub Pages (/octobre-rose/) comme en local
export default defineConfig({
  plugins: [react()],
  base: './',
  build: { chunkSizeWarningLimit: 700 },
});
