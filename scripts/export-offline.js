import { build } from 'vite';
import { mkdtemp, readFile, writeFile, mkdir, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, dirname, extname, join } from 'node:path';

// An optional distribution artifact. All editable code remains in src/.
const scratch = await mkdtemp(join(tmpdir(), 'dragon-ball-offline-'));
try {
  await build({
    configFile: false,
    base: './',
    build: {
      outDir: scratch,
      emptyOutDir: true,
      target: 'es2022',
      modulePreload: false,
      chunkSizeWarningLimit: 1000,
      rolldownOptions: {
        input: resolve('index.html'),
        output: { codeSplitting: false },
      },
    },
  });
  let html = await readFile(join(scratch, 'index.html'), 'utf8');
  const script = html.match(/<script[^>]+src="([^"]+)"[^>]*><\/script>/);
  const stylesheet = html.match(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"[^>]*>/);
  if (!script || !stylesheet) throw new Error('Expected one bundled script and stylesheet');
  let javascript = await readFile(resolve(scratch, script[1]), 'utf8');
  for (const name of await readdir(join(scratch, 'assets'))) {
    if (!name.endsWith('.mp3')) continue;
    const bytes = await readFile(join(scratch, 'assets', name));
    const embedded = 'data:audio/mpeg;base64,' + bytes.toString('base64');
    javascript = javascript
      .replaceAll('./assets/' + name, embedded)
      .replaceAll('/assets/' + name, embedded)
      .replaceAll(name, embedded);
  }
  const cssPath = resolve(scratch, stylesheet[1]);
  let css = await readFile(cssPath, 'utf8');
  const assets = [...css.matchAll(/url\((['"]?)([^)'"\s]+)\1\)/g)];
  for (const asset of assets) {
    if (asset[2].startsWith('data:')) continue;
    const image = await readFile(resolve(dirname(cssPath), asset[2]));
    const mime = extname(asset[2]) === '.png' ? 'image/png' : null;
    if (!mime) throw new Error(`Unsupported offline asset: ${asset[2]}`);
    css = css.replace(asset[0], `url("data:${mime};base64,${image.toString('base64')}")`);
  }
  html = html.replace(
    script[0],
    () => `<script type="module">${javascript.replace(/<\/script/gi, '<\\/script')}</script>`,
  );
  html = html.replace(
    stylesheet[0],
    () => `<style>${css.replace(/<\/style/gi, '<\\/style')}</style>`,
  );
  const destination = resolve('dist/offline/龙珠_少年武道会.html');
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, html);
  console.log(`Offline game: ${destination}`);
} finally {
  await rm(scratch, { recursive: true, force: true });
}
