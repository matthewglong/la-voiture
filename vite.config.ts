import { defineConfig } from 'vite';

export default defineConfig({
  // A fixed port avoids colliding with other local Vite projects on 5173.
  server: { host: true, port: 5199, strictPort: true },
  build: {
    target: 'es2022',
    // three.js alone is ~700 kB minified; one chunk is fine for a local game.
    chunkSizeWarningLimit: 2000,
  },
});
