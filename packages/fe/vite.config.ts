/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  // Relative base so asset URLs are emitted without root slash; runtime base script may override routing context.
  base: './',
  root: __dirname,
  build: {
    outDir: '../../dist/packages/fe',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
  cacheDir: '../../node_modules/.vite/fe',

  server: {
    port: 4200,
    host: true,
    fs: {
      allow: ['../../node_modules/@fontsource'],
    },
    headers: {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'deny',
      //Content Security Policy cannot be set locally, but should be in production
    },
  },

  preview: {
    port: 4300,
    host: 'localhost',
  },

  plugins: [react(), nxViteTsPaths(), visualizer()],

  // Uncomment this if you are using workers.
  // worker: {
  //  plugins: [
  //    viteTsConfigPaths({
  //      root: '../../',
  //    }),
  //  ],
  // },
});
