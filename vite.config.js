import { defineConfig } from 'vite';

// Relative base so the build works from any sub-folder (CrazyGames hosts games in a folder).
// The source page is game.html; the build turns it into index.html, and tools/postbuild.mjs copies
// the finished game to the repo root so a plain GitHub "Download ZIP" is a playable upload.
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    target: 'es2020',
    sourcemap: false,
    chunkSizeWarningLimit: 2000,
    assetsInlineLimit: 0,
    rollupOptions: { input: 'game.html' },
  },
  server: { host: true, port: 5173, open: '/game.html' },
});
