import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { modulePlan } from '../../src/app/module-plan.js';
import { REVISION } from 'three';

test('composition plan and documented modules agree', async () => {
  const contracts = JSON.parse(
    await readFile(new URL('../../docs/module-contracts.json', import.meta.url)),
  );
  assert.deepEqual(
    modulePlan.map((entry) => entry.id),
    contracts.map((entry) => entry.module),
  );
  assert.equal(new Set(modulePlan.map((entry) => entry.id)).size, modulePlan.length);
  for (const entry of modulePlan) {
    if (!entry.test) assert.equal(typeof entry.register, 'function', entry.id);
    else assert.equal(entry.register, undefined);
  }
});

test('page structure has only an external application script and external CSS', async () => {
  const html = await readFile(new URL('../../index.html', import.meta.url), 'utf8');
  assert.equal((html.match(/<script\b/g) ?? []).length, 1);
  assert.match(html, /<script type="module" src="\.\/src\/main.js"><\/script>/);
  assert.doesNotMatch(html, /<style\b|data:image\/png;base64/);
});

test('Three.js remains on the verified original revision', () => {
  assert.equal(REVISION, '160');
});
