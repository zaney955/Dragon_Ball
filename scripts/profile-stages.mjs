import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const label = process.argv[2] || 'current';
const output = `performance/maps/${label}`;
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome',
  args: ['--enable-webgl', '--use-angle=metal'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error' && /THREE|WebGL|shader/i.test(m.text())) errors.push(m.text());
});
await page.addInitScript(() => {
  window.profileRAF = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = () => 0;
});
await page.goto(process.env.DB_PREVIEW_URL || 'http://127.0.0.1:5173/?test=1');
await page.waitForFunction(() => window.__db?.artStageBuilders?.kami, null, { polling: 100 });
const results = [];
for (const [index, id] of ['budokai', 'wild', 'kame', 'kami'].entries()) {
  const stats = await page.evaluate(async (index) => {
    const d = window.__db;
    Object.assign(d.game, {
      selectedMap: index,
      difficulty: 'training',
      manualTest: true,
      muted: true,
      keepPair: false,
      selectedChar: 0,
      opponent: 1,
    });
    const start = performance.now();
    d.startFight();
    const buildMs = performance.now() - start;
    d.game.ready = 0;
    d.player.pos.set(-2.8, 0, 4);
    d.enemy.pos.set(0.4, 0, -1.2);
    d.player.previousPos.copy(d.player.pos);
    d.enemy.previousPos.copy(d.enemy.pos);
    d.player.render(1 / 60, 1);
    d.enemy.render(1 / 60, 1);
    d.resetShoulderCameras();
    const geometries = new Set(),
      materials = new Set();
    let meshes = 0,
      casters = 0,
      triangles = 0;
    d.map.group.traverse((o) => {
      if (!o.isMesh) return;
      meshes++;
      if (o.castShadow) casters++;
      geometries.add(o.geometry);
      materials.add(o.material);
      triangles +=
        ((o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3) * (o.count ?? 1);
    });
    let geometryBytes = 0;
    for (const g of geometries) {
      for (const a of Object.values(g.attributes)) geometryBytes += a.array.byteLength;
      geometryBytes += g.index?.array.byteLength ?? 0;
    }
    const summary = (samples) => {
      samples.sort((a, b) => a - b);
      return {
        median: samples[Math.floor(samples.length / 2)],
        p95: samples[Math.floor(samples.length * 0.95)],
      };
    };
    const camera = [];
    for (let i = 0; i < 72; i++) {
      const x = [-13.5, 0, 13.5][i % 3],
        z = [-6, 0, 6][Math.floor(i / 3) % 3],
        a = (Math.floor(i / 9) * Math.PI) / 4;
      d.player.pos.set(x, 0, z);
      d.enemy.pos.set(x + Math.sin(a), 0, z + Math.cos(a));
      const t = performance.now();
      d.updateFightCamera(1 / 60, true);
      camera.push(performance.now() - t);
    }
    d.player.pos.set(-2.8, 0, 4);
    d.enemy.pos.set(0.4, 0, -1.2);
    d.resetShoulderCameras();
    const frames = [],
      submit = [],
      updates = [];
    let last;
    for (let i = 0; i < 150; i++) {
      const timestamp = await new Promise(window.profileRAF);
      if (i > 30) frames.push(timestamp - last);
      last = timestamp;
      const t = performance.now();
      d.map.update(1 / 60);
      d.updateFightCamera(1 / 60, true);
      const r = performance.now();
      d.renderGameViews();
      if (i > 30) {
        updates.push(r - t);
        submit.push(performance.now() - r);
      }
    }
    const gl = d.renderer.getContext(),
      debug = gl.getExtension('WEBGL_debug_renderer_info');
    return {
      buildMs,
      meshes,
      casters,
      materials: materials.size,
      geometryBytes,
      triangles,
      calls: d.renderer.info.render.calls,
      renderedTriangles: d.renderer.info.render.triangles,
      cameraMs: summary(camera),
      updateMs: summary(updates),
      submitMs: summary(submit),
      frameMs: summary(frames),
      gpu: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
    };
  }, index);
  await page.screenshot({ path: `${output}/${id}-combat.png` });
  await page.addStyleTag({ content: 'body > :not(#game) { visibility: hidden !important; }' });
  await page.evaluate((id) => {
    const d = window.__db;
    d.player.root.visible = d.enemy.root.visible = false;
    d.player.shadow.visible = d.enemy.shadow.visible = false;
    d.camera.position.set(...(id === 'kami' ? [10, 36, 53] : [28, 25, 43]));
    d.camera.lookAt(0, 2, -10);
    d.camera.fov = 51;
    d.camera.updateProjectionMatrix();
    d.renderer.render(d.scene, d.camera);
  }, id);
  await page.screenshot({ path: `${output}/${id}-panorama.png` });
  await page
    .locator('style')
    .last()
    .evaluate((e) => e.remove());
  results.push({ id, ...stats });
  console.log(id, JSON.stringify(stats));
}
const live = [];
for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  const fight = await browser.newPage({
    viewport,
    deviceScaleFactor: viewport.width < 500 ? 2 : 1,
  });
  fight.on('pageerror', (e) => errors.push(e.message));
  await fight.goto(process.env.DB_PREVIEW_URL || 'http://127.0.0.1:5173/?test=1');
  await fight.waitForFunction(() => window.__db?.artStageBuilders?.kame);
  for (const [index, id] of ['budokai', 'wild', 'kame'].entries()) {
    const stats = await fight.evaluate(async (index) => {
      const d = window.__db;
      Object.assign(d.game, {
        selectedMap: index,
        difficulty: 'normal',
        manualTest: false,
        muted: true,
        keepPair: false,
        selectedChar: 0,
        opponent: 1,
      });
      d.startFight();
      d.game.ready = 0;
      const frames = [];
      let last;
      for (let i = 0; i < 180; i++) {
        const t = await new Promise(requestAnimationFrame);
        if (i > 30) frames.push(t - last);
        last = t;
      }
      frames.sort((a, b) => a - b);
      return {
        median: frames[Math.floor(frames.length / 2)],
        p95: frames[Math.floor(frames.length * 0.95)],
        simTime: d.game.simTime,
        pixelRatio: d.renderer.getPixelRatio(),
      };
    }, index);
    live.push({ id, viewport, ...stats });
    console.log('LIVE', id, viewport.width, JSON.stringify(stats));
    await fight.screenshot({ path: `${output}/${id}-live-${viewport.width}.png` });
  }
  await fight.close();
}
await writeFile(`${output}/metrics.json`, JSON.stringify({ results, live, errors }, null, 2));
await browser.close();
if (errors.length) throw new Error(errors.join('\n'));
