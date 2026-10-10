import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const output = 'performance/budokai';
async function openBudokai(page, fixed = true) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  if (fixed)
    await page.addInitScript(() => {
      window.requestAnimationFrame = () => 0;
    });
  await page.goto('/?test=1');
  await page.waitForFunction(() => window.__db?.artStageBuilders?.budokai, null, { polling: 100 });
  await page.evaluate((fixed) => {
    const d = window.__db;
    Object.assign(d.game, {
      selectedMap: 0,
      difficulty: 'normal',
      manualTest: fixed,
      muted: true,
      keepPair: false,
      selectedChar: 0,
      opponent: 1,
    });
    d.startFight();
    d.game.ready = 0;
  }, fixed);
  return errors;
}

test('budokai real render: panorama, front, details, side, shoulder and three lighting presets', async ({
  page,
}) => {
  await mkdir(output, { recursive: true });
  await page.setViewportSize({ width: 1600, height: 1000 });
  const errors = await openBudokai(page);
  const hide = await page.addStyleTag({
    content: 'body > :not(#game) { visibility: hidden !important; }',
  });
  await page.evaluate(() => {
    for (const f of [window.__db.player, window.__db.enemy]) {
      f.root.visible = false;
      f.shadow.visible = false;
    }
  });
  const views = [
    ['panorama', [8, 22, 40], [0, 2, -12], 51],
    ['hall-front', [0, 7.5, 9], [0, 5, -19], 51],
    ['gate-detail', [8, 4.7, -4.5], [2.5, 3, -15], 48],
    ['arena-and-grandstands', [30, 14, 23], [0, 2, -9], 54],
  ];
  for (const [name, position, target, fov] of views) {
    await page.evaluate(
      ({ position, target, fov }) => {
        const d = window.__db;
        d.camera.position.fromArray(position);
        d.camera.lookAt(...target);
        d.camera.fov = fov;
        d.camera.updateProjectionMatrix();
        d.renderer.render(d.scene, d.camera);
      },
      { position, target, fov },
    );
    await page.screenshot({ path: `${output}/${name}.png` });
  }
  const metrics = await page.evaluate(() => {
    const d = window.__db;
    d.renderer.info.reset();
    d.renderer.render(d.scene, d.camera);
    const geometries = new Set(),
      materials = new Set();
    d.map.group.traverse((o) => {
      if (o.geometry) geometries.add(o.geometry);
      if (o.material) materials.add(o.material);
    });
    let bytes = 0;
    for (const g of geometries) {
      for (const a of Object.values(g.attributes)) bytes += a.array.byteLength;
      bytes += g.index?.array.byteLength ?? 0;
    }
    return {
      calls: d.renderer.info.render.calls,
      triangles: d.renderer.info.render.triangles,
      geometryBytes: bytes,
      materials: materials.size,
      objects: d.map.group.userData.budokai,
    };
  });
  expect(metrics.calls).toBeLessThan(400);
  expect(metrics.geometryBytes).toBeLessThan(48 * 1024 * 1024);
  for (const light of ['sunset', 'moon']) {
    await page.evaluate((light) => {
      const d = window.__db;
      const select = document.querySelector('#lighting');
      select.value = light;
      select.dispatchEvent(new Event('change'));
      d.camera.position.set(8, 22, 40);
      d.camera.lookAt(0, 2, -12);
      d.camera.fov = 51;
      d.camera.updateProjectionMatrix();
      d.renderer.render(d.scene, d.camera);
    }, light);
    await page.screenshot({ path: `${output}/${light}.png` });
  }
  await hide.evaluate((e) => e.remove());
  await page.evaluate(() => {
    const d = window.__db;
    document.querySelector('#lighting').value = 'day';
    document.querySelector('#lighting').dispatchEvent(new Event('change'));
    for (const f of [d.player, d.enemy]) {
      f.root.visible = true;
      f.shadow.visible = true;
    }
    d.player.pos.set(-2.8, 0, 4);
    d.enemy.pos.set(0.4, 0, -1.2);
    d.player.previousPos.copy(d.player.pos);
    d.enemy.previousPos.copy(d.enemy.pos);
    d.player.facingAngle = Math.atan2(3.2, -5.2);
    d.enemy.facingAngle = d.player.facingAngle + Math.PI;
    d.player.visualAngle = d.player.facingAngle;
    d.enemy.visualAngle = d.enemy.facingAngle;
    d.player.render(1 / 60, 1);
    d.enemy.render(1 / 60, 1);
    d.updateHUD();
    d.resetShoulderCameras();
    d.renderGameViews();
  });
  await page.screenshot({ path: `${output}/shoulder-combat.png` });
  await writeFile(`${output}/render-metrics.json`, JSON.stringify(metrics, null, 2));
  console.log('BUDOKAI RENDER', JSON.stringify(metrics));
  expect(errors).toEqual([]);
});

test('budokai camera apron, destruction, senzu healing, training and split-screen', async ({
  page,
}) => {
  const errors = await openBudokai(page);
  const result = await page.evaluate(() => {
    const d = window.__db,
      map = d.map;
    const tile = map.destructibles.find((p) => p.tile);
    d.player.pos.copy(tile.mesh.position).setY(0);
    d.damageStage(d.player, { dmg: 32, landingImpact: true }, d.player.pos.clone());
    const crown = map.destructibles.find((p) => p.building),
      target = crown.bounds.getCenter(d.player.pos.clone());
    d.damageStageProjectile(
      d.player,
      { dmg: 60 },
      target.clone().setZ(target.z + 4),
      target.clone().setZ(target.z - 4),
    );
    d.game.difficulty = 'training';
    d.game.ready = 0;
    d.game.over = false;
    d.player.hp = d.player.maxHp * 0.3;
    d.enemy.pos.set(12, 0, 5);
    d.updateSenzu(25);
    const bean = map.senzus.find((b) => b.active),
      hp = d.player.hp;
    d.player.pos.set(bean.x, 0, bean.z);
    d.player.state = 'idle';
    d.player.attack = null;
    d.updateSenzu(1 / 120);
    const healed = d.player.hp > hp;
    let minimumBack = Infinity,
      samples = 0;
    for (const mode of ['normal', 'local', 'training']) {
      d.game.difficulty = mode;
      for (const x of [-13.5, 0, 13.5])
        for (const z of [-6, 0, 6])
          for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
            d.player.pos.set(x, 0, z);
            d.enemy.pos.set(x + Math.sin(angle), 0, z + Math.cos(angle));
            d.resetShoulderCameras();
            minimumBack = Math.min(minimumBack, d.camera.position.distanceTo(d.player.pos));
            samples++;
          }
      d.player.render(1 / 60, 1);
      d.enemy.render(1 / 60, 1);
      d.renderGameViews();
    }
    return {
      tiles: map.brokenTiles,
      crowns: map.brokenBuildingParts,
      scars: map.scars.length,
      healed,
      pickups: map.senzuPickups.length,
      minimumBack,
      samples,
      bounds: map.bounds,
      split: document.body.classList.contains('splitMode'),
    };
  });
  expect(result.tiles).toBeGreaterThan(0);
  expect(result.crowns).toBeGreaterThan(0);
  expect(result.scars).toBeGreaterThan(0);
  expect(result.healed).toBe(true);
  expect(result.pickups).toBe(1);
  expect(result.minimumBack).toBeGreaterThan(4.5);
  expect(result.samples).toBe(108);
  expect(result.bounds).toEqual({ x: 13.5, z: 6 });
  await page.evaluate(() => {
    window.__db.game.difficulty = 'local';
    window.__db.resetShoulderCameras();
    window.__db.renderGameViews();
  });
  await expect(page.locator('body')).toHaveClass(/splitMode/);
  await page.screenshot({ path: `${output}/split-screen.png` });
  console.log('BUDOKAI GAMEPLAY', JSON.stringify(result));
  expect(errors).toEqual([]);
});

test('budokai map switching disposes instance buffers and geometry and remains available in the gallery', async ({
  page,
}) => {
  const errors = await openBudokai(page);
  const result = await page.evaluate(() => {
    const d = window.__db;
    let disposed = 0,
      geometryDisposals = 0;
    d.map.group.traverse((o) => {
      if (o.isInstancedMesh) o.addEventListener('dispose', () => disposed++);
      if (o.geometry) o.geometry.addEventListener('dispose', () => geometryDisposals++);
    });
    const memories = [];
    for (let i = 0; i < 3; i++) {
      for (const selectedMap of [1, 2, 3, 0]) {
        d.game.selectedMap = selectedMap;
        d.startFight();
        d.renderGameViews();
      }
      memories.push({ ...d.renderer.info.memory });
    }
    const snapshot = d.captureBattleState?.();
    if (snapshot) d.restoreBattleState(JSON.parse(JSON.stringify(snapshot)));
    const restored = !snapshot || d.map.group.userData.budokai.spectators === 192;
    d.backToMenu();
    d.openArtGallery();
    const select = document.querySelector('#artAsset');
    select.value = 'stage:0';
    select.dispatchEvent(new Event('change'));
    const title = document.querySelector('#artName').textContent;
    d.closeArtGallery();
    return { disposed, geometryDisposals, memories, title, restored, count: d.MAPS.length };
  });
  expect(result.disposed).toBeGreaterThan(5);
  expect(result.geometryDisposals).toBeGreaterThan(80);
  expect(result.memories[2].geometries).toBeLessThanOrEqual(result.memories[1].geometries + 2);
  expect(result.memories[2].textures).toBeLessThanOrEqual(result.memories[1].textures + 1);
  expect(result.restored).toBe(true);
  expect(result.title).toBe('天下一武道会');
  expect(result.count).toBe(4);
  console.log('BUDOKAI LIFECYCLE', JSON.stringify(result));
  expect(errors).toEqual([]);
});

test('budokai live single-player combat advances and responds to movement on desktop and mobile', async ({
  page,
}) => {
  const errors = await openBudokai(page, false);
  const before = await page.evaluate(() => window.__db.player.pos.toArray());
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
  await page.screenshot({ path: `${output}/mobile-combat.png` });
  expect(errors).toEqual([]);
});
