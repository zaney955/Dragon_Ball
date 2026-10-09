import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Linter } from 'eslint';
import { modulePlan } from '../src/app/module-plan.js';

// Audit the actual module interfaces, so documentation cannot silently become stale.
const linter = new Linter();
const contracts = [];
for (const entry of modulePlan) {
  const file = new URL(`../src/${entry.id}.js`, import.meta.url);
  const source = await readFile(file, 'utf8');
  const messages = linter.verify(source, [
    { languageOptions: { ecmaVersion: 2022, sourceType: 'module' } },
  ]);
  const fatal = messages.find((message) => message.fatal);
  if (fatal) throw new Error(`${entry.id}: ${fatal.message}`);
  const ast = linter.getSourceCode().ast;
  const registration = ast.body.find(
    (node) => node.type === 'ExportNamedDeclaration' && node.declaration?.id?.name === 'register',
  )?.declaration;
  if (!registration) throw new Error(`Missing register() interface: ${entry.id}`);
  const aliases = new Map(
    registration.params[0].properties.map((property) => [property.value.name, property.key.name]),
  );
  const reads = new Set();
  const writes = new Set();
  function walk(node, parent) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'MemberExpression' && !node.computed && aliases.has(node.object.name)) {
      const member = `${aliases.get(node.object.name)}.${node.property.name}`;
      if (
        parent?.type === 'AssignmentExpression' &&
        parent.left === node &&
        parent.operator === '='
      )
        writes.add(member);
      else reads.add(member);
    }
    for (const [key, value] of Object.entries(node)) {
      if (
        key === 'parent' ||
        key === 'loc' ||
        key === 'range' ||
        key === 'tokens' ||
        key === 'comments'
      )
        continue;
      if (Array.isArray(value)) value.forEach((child) => walk(child, node));
      else if (value?.type) walk(value, node);
    }
  }
  walk(registration);
  contracts.push({
    module: entry.id,
    domain: entry.id.split('/')[0],
    testing: !!entry.test,
    provides: [...writes].sort(),
    requires: [...reads].sort(),
  });
}
const target = new URL('../docs/module-contracts.json', import.meta.url);
const output = JSON.stringify(contracts, null, 2) + '\n';
if (process.argv.includes('--write')) {
  await writeFile(target, output);
  console.log(`Updated ${fileURLToPath(target)} (${contracts.length} modules)`);
} else {
  if ((await readFile(target, 'utf8')) !== output)
    throw new Error(
      'Module interfaces have changed. Run npm run architecture:update and review the diff.',
    );
  console.log(`Module interfaces match source (${contracts.length} modules)`);
}
