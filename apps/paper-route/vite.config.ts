import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  // Operators may embed in sandboxed iframes (opaque origin), which need CORS for module scripts and assets.
  server: { cors: { origin: '*' } },
  preview: { cors: { origin: '*' } },
  build: { target: 'es2022' },
});
