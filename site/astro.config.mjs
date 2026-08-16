// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  // Deployed to GitHub Pages under the custom domain https://rlg.floip.ch/
  site: 'https://rlg.floip.ch',
  base: '/',
  // Bind to all interfaces so the dev server is reachable through
  // WSL / Dev Container port forwarding (which connects via 127.0.0.1).
  server: {
    host: true,
    port: 4321,
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
