import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  base: './',
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
  build: {
    target: 'es2022',
    rolldownOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        legacy: resolve(import.meta.dirname, '龙珠_少年武道会.html'),
      },
    },
  },
});
