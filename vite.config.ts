import { defineConfig } from 'vite';

export default defineConfig({
  server: { host: true },
  build: {
    target: 'es2022',
    // three.js alone is ~700 kB minified; one chunk is fine for a local game.
    chunkSizeWarningLimit: 2000,
  },
});
