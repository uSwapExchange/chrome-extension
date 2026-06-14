import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.config.js';

export default defineConfig({
  plugins: [react(), crx({ manifest })],
  build: {
    target: 'es2022',
    rollupOptions: {
      input: {
        sidepanel: 'src/sidepanel/index.html',
        prompt: 'src/prompt/index.html',
        options: 'src/options/index.html',
        // Created at runtime via chrome.offscreen — not referenced from the
        // manifest, so it must be an explicit build input.
        offscreen: 'src/offscreen/offscreen.html',
        harness: 'src/dev/harness.html',
      },
    },
  },
  server: {
    port: 5190,
    strictPort: true,
    hmr: { port: 5190 },
  },
});
