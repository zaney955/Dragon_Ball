import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const output = process.env.DB_OFFLINE_FILE
  ? 'performance/maps/offline-acceptance'
  : 'performance/maps/acceptance';
async function open(page, index, fixed = true) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error' && /THREE|WebGL|shader/i.test(msg.text())) errors.push(msg.text());
  });
  if (fixed)
    await page.addInitScript(() => {
      window.requestAnimationFrame = () => 0;
    });
  await page.goto(
    process.env.DB_OFFLINE_FILE
      ? pathToFileURL(resolve(process.env.DB_OFFLINE_FILE)).href + '?test=1'
      : '/?test=1',
  );
  await page.waitForFunction(() => window.__db?.artStageBuilders?.kame, null, { polling: 100 });
  await page.evaluate(
    ({ index, fixed }) => {
      const d = window.__db;
      Object.assign(d.game, {
        selectedMap: index,
        difficulty: 'training',
        manualTest: fixed,
        muted: true,
        keepPair: false,
        selectedChar: 0,
        opponent: 1,
      });
      d.startFight();
      d.game.ready = 0;
    },
    { index, fixed },
  );
  return errors;
}
for (const [index, id] of [
  [1, 'wild'],
  [2, 'kame'],
]) {
  test(`${id} production views, lighting, camera apron and render budget`, async ({ page }) => {
    await mkdir(output, { recursive: true });
    await page.setViewportSize({ width: 1440, height: 900 });
    const errors = await open(page, index);
    const style = await page.addStyleTag({
      content: 'body > :not(#game) { visibility: hidden !important; }',
    });
    await page.evaluate(() => {
      const d = window.__db;
      d.player.root.visible = d.enemy.root.visible = false;
      d.player.shadow.visible = d.enemy.shadow.visible = false;
    });
    const views =
      id === 'wild'
        ? [
            ['overview', [34, 38, 74], [0, 9, -23]],
            ['valley', [0, 5, 16], [0, 9, -32]],
            ['cottage', [24, 8, -5], [13, 4.6, -27]],
            ['waterfall', [2, 8, -13], [-8, 10, -36]],
          ]
        : [
            ['overview', [30, 33, 55], [0, 1, -8]],
            ['house', [8, 7, -6], [-4, 4.6, -24]],
            ['shore', [34, 5, 18], [7, 1, -9]],
            ['pier', [39, 4, 1], [29, 0.4, -9]],
          ];
    for (const [name, position, target] of views) {
      await page.evaluate(
        ({ position, target }) => {
          const d = window.__db;
          d.camera.position.fromArray(position);
          d.camera.lookAt(...target);
          d.camera.fov = 53;
          d.camera.updateProjectionMatrix();
          d.map.update(1 / 60);
          d.renderer.render(d.scene, d.camera);
        },
        { position, target },
      );
      await page.screenshot({ path: `${output}/${id}-${name}.png` });
    }
    for (const preset of ['sunset', 'moon']) {
      await page.evaluate(
        ({ preset, position, target }) => {
          const d = window.__db,
            select = document.querySelector('#lighting');
          select.value = preset;
          select.dispatchEvent(new Event('change'));
          d.camera.position.fromArray(position);
          d.camera.lookAt(...target);
          d.renderer.render(d.scene, d.camera);
        },
        { preset, position: views[0][1], target: views[0][2] },
      );
      await page.screenshot({ path: `${output}/${id}-${preset}.png` });
    }
    await style.evaluate((e) => e.remove());
    const report = await page.evaluate(() => {
      const d = window.__db;
      document.querySelector('#lighting').value = 'day';
      document.querySelector('#lighting').dispatchEvent(new Event('change'));
      d.player.root.visible =
        d.enemy.root.visible =
        d.player.shadow.visible =
        d.enemy.shadow.visible =
          true;
      let minimumBack = Infinity,
        samples = 0,
        maximumCameraMs = 0;
      for (const mode of ['training', 'local'])
        for (const x of [-13.5, 0, 13.5])
          for (const z of [-6, 0, 6])
            for (let i = 0; i < 8; i++) {
              d.game.difficulty = mode;
              d.player.pos.set(x, 0, z);
              d.enemy.pos.set(x + Math.sin((i * Math.PI) / 4), 0, z + Math.cos((i * Math.PI) / 4));
              const t = performance.now();
              d.resetShoulderCameras();
              maximumCameraMs = Math.max(maximumCameraMs, performance.now() - t);
              minimumBack = Math.min(minimumBack, d.camera.position.distanceTo(d.player.pos));
              samples++;
            }
      d.game.difficulty = 'training';
      d.player.pos.set(-2.8, 0, 4);
      d.enemy.pos.set(0.4, 0, -1.2);
      d.player.render(1 / 60, 1);
      d.enemy.render(1 / 60, 1);
      d.resetShoulderCameras();
      d.renderGameViews();
      return {
        minimumBack,
        samples,
        maximumCameraMs,
        calls: d.renderer.info.render.calls,
        triangles: d.renderer.info.render.triangles,
      };
    });
    expect(report.minimumBack).toBeGreaterThan(4.5);
    expect(report.samples).toBe(144);
    expect(report.calls).toBeLessThan(220);
    await page.screenshot({ path: `${output}/${id}-combat.png` });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => {
      window.__db.resetShoulderCameras();
      window.__db.renderGameViews();
    });
    await page.screenshot({ path: `${output}/${id}-mobile.png` });
    await page.evaluate(() => {
      const d = window.__db;
      d.game.difficulty = 'local';
      d.resetShoulderCameras();
      d.renderGameViews();
    });
    await expect(page.locator('body')).toHaveClass(/splitMode/);
    await page.screenshot({ path: `${output}/${id}-split.png` });
    await writeFile(`${output}/${id}-render.json`, JSON.stringify(report, null, 2));
    expect(errors).toEqual([]);
  });
  test(`${id} destruction, healing, snapshot recovery, gallery and map resource disposal`, async ({
    page,
  }) => {
    const errors = await open(page, index);
    const report = await page.evaluate((index) => {
      const d = window.__db,
        map = d.map,
        part = map.destructibles.find((p) => p.building),
        pos = part.bounds.getCenter(d.player.pos.clone());
      d.damageStageProjectile(
        d.player,
        { dmg: 80 },
        pos.clone().setZ(pos.z + 5),
        pos.clone().setZ(pos.z - 5),
      );
      const buildingDamage = map.brokenBuildingParts;
      const snapshot = JSON.parse(JSON.stringify(d.captureBattleState()));
      d.restoreBattleState(snapshot);
      d.map.update(1 / 60);
      d.renderGameViews();
      const recovered = d.map.brokenBuildingParts === buildingDamage;
      d.player.hp = d.player.maxHp * 0.3;
      d.enemy.pos.set(12, 0, 5);
      d.updateSenzu(25);
      const bean = d.map.senzus.find((b) => b.active),
        hp = d.player.hp;
      d.player.pos.set(bean.x, 0, bean.z);
      d.player.state = 'idle';
      d.player.attack = null;
      d.updateSenzu(1 / 120);
      const healed = d.player.hp > hp;
      let disposed = 0;
      d.map.group.traverse((o) => {
        if (o.geometry) o.geometry.addEventListener('dispose', () => disposed++);
      });
      const memories = [];
      for (let n = 0; n < 3; n++) {
        for (const selectedMap of [0, 1, 2, 3, index]) {
          d.game.selectedMap = selectedMap;
          d.startFight();
          d.renderGameViews();
        }
        memories.push({ ...d.renderer.info.memory });
      }
      const fresh = d.map.brokenBuildingParts === 0 && d.map.destructibles.every((p) => !p.broken);
      d.backToMenu();
      d.openArtGallery();
      const select = document.querySelector('#artAsset');
      select.value = `stage:${index}`;
      select.dispatchEvent(new Event('change'));
      const title = document.querySelector('#artName').textContent;
      d.closeArtGallery();
      return { buildingDamage, recovered, healed, disposed, memories, fresh, title };
    }, index);
    expect(report.buildingDamage).toBeGreaterThan(0);
    expect(report.recovered).toBe(true);
    expect(report.healed).toBe(true);
    expect(report.fresh).toBe(true);
    expect(report.disposed).toBeGreaterThan(60);
    expect(report.memories[2].geometries).toBeLessThanOrEqual(report.memories[1].geometries + 2);
    expect(report.memories[2].textures).toBeLessThanOrEqual(report.memories[1].textures + 1);
    expect(report.title).toBe(index === 1 ? '包子山荒野' : '龟仙屋');
    expect(errors).toEqual([]);
  });
  test(`${id} live game accepts movement on desktop and portrait viewport`, async ({ page }) => {
    const errors = await open(page, index, false),
      before = await page.evaluate(() => window.__db.player.pos.toArray());
    await page.keyboard.down('KeyW');
    await page.waitForFunction(
      (before) =>
        window.__db.game.simTime > 1 &&
        window.__db.player.pos.distanceTo({ x: before[0], y: before[1], z: before[2] }) > 0.5,
      before,
    );
    await page.keyboard.up('KeyW');
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('#hud')).toHaveClass(/show/);
    await page.screenshot({ path: `${output}/${id}-live-mobile.png` });
    expect(errors).toEqual([]);
  });
}
