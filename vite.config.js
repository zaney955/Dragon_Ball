import { defineConfig } from 'vite';
import { resolve } from 'node:path';

const onlineProxy = {
  '/api/online': {
    target: 'http://127.0.0.1:8787',
    ws: true,
    rewrite: () => '/connect',
  },
};

export default defineConfig({
  base: './',
  server: { port: 5173, strictPort: true, proxy: onlineProxy },
  preview: { port: 4173, strictPort: true, proxy: onlineProxy },
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
