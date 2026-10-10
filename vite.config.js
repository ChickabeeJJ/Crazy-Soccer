import { defineConfig } from 'vite';

// Relative base so the build works from any sub-folder (CrazyGames hosts games in a folder).
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    target: 'es2020',
    sourcemap: false,
    chunkSizeWarningLimit: 2000,
    assetsInlineLimit: 0,
  },
  server: { host: true, port: 5173 },
});
