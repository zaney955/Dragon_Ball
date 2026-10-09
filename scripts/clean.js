import { rm } from 'node:fs/promises';

// Keep installed dependencies and local credentials; remove generated project output only.
const generatedPaths = [
  'dist',
  'test-results',
  'playwright-report',
  'blob-report',
  'coverage',
  '.cache',
  '.wrangler/tmp',
  'node_modules/.vite',
];
for (const path of generatedPaths) {
  await rm(new URL(`../${path}`, import.meta.url), { recursive: true, force: true });
}
console.log('Removed build output, test reports and local build caches.');
