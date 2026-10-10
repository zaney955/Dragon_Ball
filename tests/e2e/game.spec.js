import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { validSpectatorFrame } from '../../src/online/spectator-codec.js';

async function openGame(page, testMode = true, fixedOnly = false) {
  const errors = [];
  if (fixedOnly) await page.addInitScript(() => (window.requestAnimationFrame = () => 0));
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(testMode ? '/?test=1' : '/');
  await expect(page.locator('#loading')).toHaveClass('hidden');
  if (testMode)
    await page.waitForFunction(() => window.__db?.runV2SystemTests, null, { polling: 100 });
  return errors;
}

async function assertSuite(page, method, args = []) {
  const summary = await page.evaluate(
    ({ method, args }) => {
      const report = window.__db[method](...args);
      const rows = report.results.flatMap((row) =>
        row.checks
          ? row.checks.map((check) => ({
              ...check,
              attacker: row.attacker,
              defender: row.defender,
            }))
          : [row],
      );
      return {
        reportedFailed: report.failed,
        passed: rows.filter((row) => row.pass).length,
        failed: rows.filter((row) => !row.pass).length,
        total: rows.length,
        failures: rows.filter((row) => !row.pass),
      };
    },
    { method, args },
  );
  expect(summary.failures, method).toEqual([]);
  expect(summary.reportedFailed, method).toBe(0);
  expect(summary.failed, method).toBe(0);
  expect(summary.passed, method).toBe(summary.total);
  console.log(`${method}: ${summary.passed}/${summary.total}`);
  return summary;
}

test('production home, selection, fight, pause, return and guide', async ({ page }) => {
  const errors = await openGame(page, false);
  expect(await page.evaluate(() => window.__db)).toBeUndefined();
  await page.locator('#homeStart').click();
  await expect(page.locator('#charList .char-card')).toHaveCount(14);
  await expect(page.locator('#mapList .map-card')).toHaveCount(4);
  await page.locator('#moveGuideBtn').click();
  await expect(page.locator('#moveGuide')).toHaveClass(/show/);
  await page.locator('#guideClose').click();
  await page.locator('#startBtn').click();
  await expect(page.locator('#hud')).toHaveClass(/show/);
  await page.locator('#pauseBtn').click();
  await expect(page.locator('#pause')).toHaveClass(/show/);
  await page.locator('#pauseMenu').click();
  await expect(page.locator('#menu')).not.toHaveClass(/hidden/);
  expect(errors).toEqual([]);
});

test('all fourteen gallery models and three playable stages survive cleanup', async ({ page }) => {
  const errors = await openGame(page);
  await page.locator('#homeStart').click();
  await page.locator('.artOpen').click();
  await expect(page.locator('#artGallery')).toHaveClass(/show/);
  const poses = new Set();
  for (let character = 0; character < 14; character++) {
    await page.locator('#artAsset').selectOption('character:' + character);
    const geometry = await page.evaluate(() => {
      let meshes = 0;
      let vertices = 0;
      window.__db.artView.model.traverse((node) => {
        if (node.isMesh) {
          meshes++;
          vertices += node.geometry.attributes.position?.count || 0;
        }
      });
      const v = window.__db.artView;
      const floorCount = v.sc.children.filter(
        (node) => node.name === 'display-shadow-floor',
      ).length;
      return {
        meshes,
        vertices,
        pose: v.model.userData.displayPose,
        finite: [...v.model.position.toArray(), ...v.center.toArray(), v.distance].every(
          Number.isFinite,
        ),
        shadows:
          v.r.shadowMap.enabled && v.key.castShadow && !!v.key.shadow.map && v.floor.receiveShadow,
        floorCount,
      };
    });
    expect(geometry.meshes).toBeGreaterThan(0);
    expect(geometry.vertices).toBeGreaterThan(0);
    expect(geometry.finite).toBe(true);
    expect(geometry.shadows).toBe(true);
    expect(geometry.floorCount).toBe(1);
    poses.add(geometry.pose);
    await expect(page.locator('#artPose')).toHaveText(geometry.pose);
    await expect(page.locator('#artName')).not.toBeEmpty();
  }
  expect(poses.size).toBe(14);
  for (let stage = 0; stage < 3; stage++) {
    await page.locator('#artAsset').selectOption('stage:' + stage);
    expect(await page.evaluate(() => window.__db.artView.model.children.length)).toBeGreaterThan(0);
    await expect(page.locator('#artType')).toHaveText('对战舞台');
    await expect(page.locator('#artPose')).toBeEmpty();
    expect(await page.evaluate(() => window.__db.artView.floor)).toBeNull();
    const lighting = await page.evaluate(() => {
      const v = window.__db.artView;
      let casters = 0,
        receivers = 0;
      v.model.traverse((node) => {
        if (node.isMesh && node.castShadow) casters++;
        if (node.isMesh && node.receiveShadow) receivers++;
      });
      return {
        enabled: v.r.shadowMap.enabled && v.key.castShadow && !!v.key.shadow.map,
        casters,
        receivers,
        focused: v.key.shadow.camera.right - v.key.shadow.camera.left < 100,
        fill: v.fill.intensity > 0 && v.hemi.intensity > 0,
        mapWidth: v.key.shadow.map.width,
        requestedWidth: v.key.shadow.mapSize.x,
      };
    });
    expect(lighting.enabled).toBe(true);
    expect(lighting.focused).toBe(true);
    expect(lighting.fill).toBe(true);
    expect(lighting.mapWidth).toBe(lighting.requestedWidth);
    expect(lighting.casters).toBeGreaterThan(0);
    expect(lighting.receivers).toBeGreaterThan(0);
  }
  await page.locator('#artAsset').selectOption('character:0');
  expect(await page.evaluate(() => window.__db.artView.key.shadow.map.width)).toBe(1024);
  await page.locator('#artClose').click();
  await expect(page.locator('#artGallery')).not.toHaveClass(/show/);
  for (let stage = 0; stage < 3; stage++) {
    await page.locator('#mapList .map-card').nth(stage).click();
    await page.locator('#startBtn').click();
    await expect(page.locator('#hud')).toHaveClass(/show/);
    await page.locator('#pauseBtn').click();
    await page.locator('#pauseMenu').click();
    await expect(page.locator('#menu')).not.toHaveClass(/hidden/);
  }
  expect(errors).toEqual([]);
});

for (const width of [1024, 390])
  for (let stage = 0; stage < 3; stage++)
    test(`enriched stage ${stage} animates, breaks and resets at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 720 });
      const errors = await openGame(page, true, true);
      const result = await page.evaluate((stage) => {
        const d = window.__db;
        Object.assign(d.game, {
          manualTest: true,
          muted: true,
          selectedMap: stage,
          selectedChar: 0,
          opponent: 1,
          difficulty: 'normal',
        });
        document.getElementById('homeStart').click();
        d.startFight();
        d.game.ready = 0;
        const map = d.map,
          atmosphere = map.group.getObjectByName('stage-atmosphere-' + d.MAPS[stage].id),
          before = atmosphere.children.map((child) =>
            child.position.toArray().concat(child.rotation.toArray().slice(0, 3)),
          );
        map.update(1);
        const animated = atmosphere.children.some((child, i) =>
          child.position
            .toArray()
            .concat(child.rotation.toArray().slice(0, 3))
            .some((value, j) => value !== before[i][j]),
        );
        const prop = map.destructibles.find((item) => !item.tile && !item.building),
          buildingParts = map.destructibles.filter((item) => item.building),
          buildingHp = buildingParts.map((item) => item.hp);
        d.damageStage(d.player, { dmg: 20, landingImpact: true }, prop.mesh.position);
        const target = buildingParts
            .map((item) => item.bounds.getCenter(item.mesh.position.clone()))
            .reduce((nearest, center) =>
              !nearest || Math.abs(center.x) < Math.abs(nearest.x) ? center : nearest,
            ),
          from = target.clone().setZ(-map.bounds.z);
        d.damageStageProjectile(d.player, { dmg: 80 }, from, target, 0.2);
        d.player.pos.set(0, 0, 0);
        d.player.facingAngle = Math.PI / 2;
        d.damageStage(d.player, { dmg: 120, isUlt: true, shape: 'beam', range: 10 });
        d.renderGameViews();
        const destroyed = map.destroyedProps,
          buildingDamaged = buildingParts.some(
            (item, index) => item.broken || item.hp < buildingHp[index],
          ),
          brokenBuildingParts = map.brokenBuildingParts,
          scars = map.scars.length,
          calls = d.renderer.info.render.calls,
          bounds = { ...map.bounds };
        d.startFight();
        d.map.update(0.5);
        d.renderGameViews();
        return {
          animated,
          destroyed,
          buildingDamaged,
          brokenBuildingParts,
          scars,
          calls,
          bounds,
          buildings: d.map.buildings.length,
          buildingParts: d.map.destructibles.filter((item) => item.building).length,
          props: d.map.destructibles.filter((item) => !item.tile && !item.building).length,
          reset:
            d.map.damageEvents === 0 &&
            d.map.scars.length === 0 &&
            d.map.destructibles.every((item) => !item.broken),
          scenes: d.scene.children.filter((child) => child.name.startsWith('reconstructed-stage-'))
            .length,
        };
      }, stage);
      expect(result.animated).toBe(true);
      expect(result.destroyed).toBeGreaterThan(0);
      expect(result.buildings).toBeGreaterThan(0);
      expect(result.buildingParts).toBeGreaterThan(3);
      expect(result.buildingDamaged).toBe(true);
      expect(result.brokenBuildingParts).toBeGreaterThan(0);
      expect(result.scars).toBeGreaterThanOrEqual(3);
      expect(result.calls).toBeLessThan(400);
      expect(result.bounds).toEqual({ x: 13.5, z: 6 });
      expect(result.props).toBe(12);
      expect(result.reset).toBe(true);
      expect(result.scenes).toBe(1);
      expect(errors).toEqual([]);
    });

test('core combat, complete youth rules and retained system regressions', async ({ page }) => {
  const errors = await openGame(page, true, true);
  expect((await assertSuite(page, 'runTests', ['legacy'])).total).toBe(91);
  expect((await assertSuite(page, 'runYouthTests')).total).toBeGreaterThanOrEqual(37);
  expect((await assertSuite(page, 'runV2OldFourTests')).total).toBe(16);
  expect((await assertSuite(page, 'runV2SystemTests')).total).toBe(57);
  expect(errors).toEqual([]);
});

test('dynamic cover blocks real shoulder-camera rays and detaches cleanly', async ({ page }) => {
  const errors = await openGame(page, true, true);
  expect((await assertSuite(page, 'runTests', ['camera'])).total).toBe(1);
  expect(errors).toEqual([]);
});

test('all seven added characters keep their ability contracts', async ({ page }) => {
  const errors = await openGame(page, true, true);
  let total = 0;
  for (let character = 7; character < 14; character++) {
    total += (await assertSuite(page, 'runV2CharacterTests', [character])).total;
  }
  expect(total).toBe(90);
  expect(errors).toEqual([]);
});

test('all fourteen fighters display valid HUD resources and skill text', async ({ page }) => {
  const errors = await openGame(page, true, true);
  const rows = await page.evaluate(() => {
    const d = window.__db;
    return d.CHARACTERS.map((c) => {
      const [f] = d.fixtureYouth(c.id, c.id, 2);
      d.updateExtraHUD();
      d.renderGameViews();
      const idle =
        document.getElementById('hud').textContent +
        document.getElementById('splitOverlay').textContent;
      f.startSpecial();
      d.updateExtraHUD();
      const skill =
        document.getElementById('actionState').textContent +
        document.getElementById('specialState').textContent;
      return {
        id: c.id,
        resource: c.resource,
        role: c.role,
        idle,
        skill,
        guide: c.tactics.resource,
      };
    });
  });
  expect(rows).toHaveLength(14);
  for (const row of rows) {
    expect(row.resource).toBeTruthy();
    expect(row.role).toBeTruthy();
    expect(row.idle).toContain(row.resource);
    expect(row.idle + row.skill + row.guide, row.id).not.toMatch(/undefined|undifined|NaN|null/);
  }
  expect(errors).toEqual([]);
});

test('spectator snapshots render all fourteen fighters, attacks and special bodies', async ({
  page,
}) => {
  const errors = await openGame(page, true, true);
  const frames = await page.evaluate(() => {
    const db = window.__db,
      online = db.online,
      frames = [];
    const command = online.command;
    let captured,
      now = performance.now();
    online.command = (packet) => {
      captured = structuredClone(packet.frame);
    };
    const cases = db.CHARACTERS.flatMap((c) =>
      ['idle', 'light', 'heavy', 'ult'].map((action) => ({ id: c.id, action })),
    );
    cases.push(
      ...[
        ['goku', 'ape'],
        ['roshi', 'muscle'],
        ['tien', 'fourArms'],
        ['oolong', 'ogre'],
        ['oolong', 'bat'],
        ['pilaf', 'combined'],
      ].map(([id, form]) => ({ id, form })),
    );
    try {
      for (const { id, action, form } of cases) {
        online.active = online.host = true;
        online.room = { id: 1, spectators: 1, match: { id: 'visual-fixture' } };
        const [host] = db.fixtureYouth(id, 'oxking', 8);
        if (form) {
          db.setYouthBody(host, form);
          host.youth.formTime = 5;
        } else if (action === 'ult') host.startUlt();
        else if (action !== 'idle') host.startAttack(action);
        if (host.attack) host.stateTimer = host.attack.hitT;
        host.render(0.016, 1);
        db.enemy.render(0.016, 1);
        captured = null;
        online.spectator.publish((now += 120));
        if (!captured) throw Error(`${id} ${action ?? form}: missing snapshot`);
        online.stop();
        // A fresh observer starts with human models, independent of the sender's body/attack.
        db.fixtureYouth(id, 'oxking', 8);
        online.active = online.spectating = true;
        db.game.online = db.game.spectating = true;
        online.spectator.start();
        online.spectator.receive({ room: 1, match: 'visual-fixture', frame: captured });
        db.player.render(0.016, 1);
        db.enemy.render(0.016, 1);
        db.renderGameViews();
        if (online.spectator.stats.received !== 1 || db.player.youth.form !== (form ?? null))
          throw Error(`${id}: missing observer body`);
        frames.push(captured);
        online.stop();
      }
    } finally {
      online.command = command;
      online.stop();
    }
    return frames;
  });
  expect(frames).toHaveLength(62);
  for (const frame of frames) expect(validSpectatorFrame(frame)).toBe(true);
  expect(errors).toEqual([]);
});

test('14 by 14 real collision and ability matrix', async ({ page }) => {
  test.setTimeout(900_000);
  test.skip(!process.env.FULL_REGRESSION, 'Run npm run test:full for the full matrix.');
  const errors = await openGame(page, true, true);
  let total = 0;
  for (let row = 0; row < 14; row++)
    total += (await assertSuite(page, 'runYouthMatrix', [row])).total;
  expect(total).toBe(1568);
  expect(errors).toEqual([]);
});

for (const width of [390, 320])
  test(`mobile ${width}px selection and all controls remain usable`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    const errors = await openGame(page, false);
    await page.locator('#homeStart').click();
    await expect(page.locator('#charList .char-card')).toHaveCount(14);
    await expect(page.locator('#startBtn')).toBeVisible();
    await page.locator('#charList .char-card').nth(12).click();
    await page.locator('.settingsDisclosure summary').click();
    await page.locator('#lighting').selectOption('moon');
    await page.locator('#moveGuideBtn').click();
    await expect(page.locator('#moveGuide')).toHaveClass(/show/);
    await page.locator('#guideClose').click();
    await page.locator('#startBtn').click();
    await expect(page.locator('#secondarySkill')).toBeVisible();
    await expect(page.locator('#secondarySkill')).toContainText('仙豆');
    const rect = await page.locator('#secondarySkill').boundingBox();
    expect(rect.x).toBeGreaterThanOrEqual(0);
    expect(rect.x + rect.width).toBeLessThanOrEqual(width);
    await expect(page.locator('#touch .touchGroup:not(.move) button')).toHaveCount(12);
    await page.screenshot({ path: `performance/youth-review/mobile-controls-${width}.png` });
    await page.locator('#pauseBtn').click();
    await expect(page.locator('#pause')).toHaveClass(/show/);
    expect(errors).toEqual([]);
  });

for (const width of [1024, 390])
  test(`global music toggle persists and does not mute effects at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 720 });
    // This fixture disables animation frames; async audio waits must use timer polling.
    const errors = await openGame(page, true, true);
    const toggle = page.locator('#musicBtn');
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await toggle.click();
    await expect(toggle).toHaveText('音乐：关');
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await page.waitForFunction(() => window.__db.musicDiagnostics().context === 'running', null, {
      polling: 100,
    });
    expect(await page.evaluate(() => window.__db.game.muted)).toBe(false);
    expect(await page.evaluate(() => window.__db.musicDiagnostics().musicEnabled)).toBe(false);
    await toggle.click();
    await page.waitForFunction(() => window.__db.musicDiagnostics().track === 'global', null, {
      polling: 100,
    });
    expect((await page.evaluate(() => window.__db.musicDiagnostics())).looping).toBe(1);
    await page.locator('#homeStart').click();
    await expect(toggle).toBeVisible();
    await page.locator('#startBtn').click();
    await expect(toggle).toBeVisible();
    await page.waitForFunction(() => window.__db.musicDiagnostics().voices === 1, null, {
      polling: 100,
    });
    await page.locator('#pauseBtn').click();
    await expect(toggle).toBeVisible();
    await page.locator('#pauseMenu').click();
    expect((await page.evaluate(() => window.__db.musicDiagnostics())).voices).toBe(1);
    await toggle.click();
    await page.reload();
    await expect(page.locator('#loading')).toHaveClass('hidden');
    await expect(toggle).toHaveText('音乐：关');
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await page.locator('#homeStart').click();
    expect((await page.evaluate(() => window.__db.musicDiagnostics())).voices).toBe(0);
    await toggle.click();
    await page.waitForFunction(() => window.__db.musicDiagnostics().track === 'global', null, {
      polling: 100,
    });
    expect(errors).toEqual([]);
  });

test('tracks decode, global music survives combat changes and pause preserves playback', async ({
  page,
}) => {
  const errors = await openGame(page, true, true);
  await page.mouse.click(4, 4);
  await page.evaluate(() => document.querySelector('#homeStart').click());
  for (const id of ['menu', 'arena', 'wild', 'island', 'crisis', 'win', 'lose', 'draw']) {
    await page.evaluate((id) => window.__db.playBGM(id, 0.01), id);
    const audio = await page.evaluate(() => window.__db.musicDiagnostics());
    expect(audio.decoded).toContain(id);
    expect(audio.error).toBeNull();
    expect(audio.looping).toBeLessThanOrEqual(1);
  }
  await page.evaluate(() => {
    const d = window.__db;
    d.game.manualTest = false;
    d.game.muted = false;
    d.game.difficulty = 'local';
    d.startFight();
    d.game.ready = 0;
    d.player.hp = d.player.maxHp * 0.25;
    d.updateBGM();
  });
  await page.waitForFunction(() => window.__db.musicDiagnostics().track === 'global', null, {
    polling: 100,
  });
  await page.evaluate(() => {
    const d = window.__db;
    d.player.hp = d.player.maxHp;
    d.updateBGM();
    d.setPaused(true);
    d.updateBGM();
  });
  await page.waitForFunction(() => window.__db.musicDiagnostics().context === 'suspended', null, {
    polling: 100,
  });
  expect((await page.evaluate(() => window.__db.musicDiagnostics())).track).toBe('global');
  await page.evaluate(() => {
    window.__db.setPaused(false);
    window.__db.updateBGM();
  });
  await page.waitForFunction(() => window.__db.musicDiagnostics().context === 'running', null, {
    polling: 100,
  });
  await page.evaluate(() => {
    for (const [id, value] of [
      ['bgmVolume', 37],
      ['sfxVolume', 73],
    ]) {
      const slider = document.getElementById(id);
      slider.value = value;
      slider.dispatchEvent(new Event('input'));
    }
    window.__db.game.muted = true;
    window.__db.updateBGM();
  });
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('dragon-ball-audio')))).toEqual({
    bgm: 0.37,
    sfx: 0.73,
    musicEnabled: true,
  });
  await page.waitForFunction(() => window.__db.musicDiagnostics().context === 'suspended', null, {
    polling: 100,
  });
  await page.evaluate(() => {
    window.__db.game.muted = false;
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  expect(await page.evaluate(() => window.__db.game.paused)).toBe(true);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForFunction(() => window.__db.musicDiagnostics().context === 'running', null, {
    polling: 100,
  });
  expect(await page.evaluate(() => window.__db.game.paused)).toBe(false);
  expect(errors).toEqual([]);
});

for (const width of [1024, 390])
  test(`victory ${width}px keeps subtitles and result below the portrait`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 640 });
    const errors = await openGame(page, true, true);
    await page.evaluate((mobile) => {
      const d = window.__db,
        [f, e] = d.fixtureYouth('goku', 'krillin', 1);
      d.game.wins = mobile ? [1, 0] : [0, 1];
      if (mobile) {
        d.setYouthBody(f, 'ape');
        e.hp = 0;
      } else f.hp = 0;
      d.endGame();
      d.updateVictory(2.4);
      d.renderGameViews();
    }, width === 390);
    await page.waitForFunction(
      () => getComputedStyle(document.querySelector('#result')).opacity === '1',
      null,
      { polling: 100 },
    );
    const card = await page.locator('#result .dialogCard').boundingBox(),
      subtitle = await page.locator('#victorySubtitle').boundingBox();
    expect(card.y).toBeGreaterThan(width === 390 ? 844 * 0.6 : 640 * 0.55);
    expect(subtitle.y + subtitle.height <= card.y || card.y + card.height <= subtitle.y).toBe(true);
    const music = await page.locator('#musicBtn').boundingBox();
    for (const id of ['exportCombatStats', 'againBtn', 'menuBtn']) {
      const button = await page.locator('#' + id).boundingBox();
      expect(
        music.x + music.width <= button.x ||
          button.x + button.width <= music.x ||
          music.y + music.height <= button.y ||
          button.y + button.height <= music.y,
        `${id} remains unobstructed by the music control`,
      ).toBe(true);
    }
    await expect(page.locator('#resultTitle')).toContainText(width === 390 ? '1P' : '2P');
    await expect(page.locator('#victorySubtitle')).toContainText(
      width === 390 ? '刚才发生什么事' : '明天送牛奶',
    );
    await page.screenshot({
      path: `performance/youth-review/${width === 390 ? 'mobile' : 'player2'}-victory.png`,
    });
    expect(errors).toEqual([]);
  });

test('original filename preserves route, query and test interface', async ({ page }) => {
  await page.goto('/龙珠_少年武道会.html?test=1');
  await expect(page).toHaveURL(/\/(?:index\.html)?\?test=1$/);
  await page.waitForFunction(() => window.__db?.runV2SystemTests);
});

test('offline export opens directly without network dependencies', async ({ page }) => {
  test.skip(!process.env.OFFLINE_TEST, 'Run npm run test:offline to verify the offline build.');
  const errors = [];
  const network = [];
  await page.addInitScript(() => (window.requestAnimationFrame = () => 0));
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (/^https?:/.test(request.url())) network.push(request.url());
  });
  const url = pathToFileURL(
    resolve(process.env.DB_OFFLINE_FILE || 'dist/offline/龙珠_少年武道会.html'),
  );
  url.search = '?test=1';
  await page.goto(url.href);
  await page.waitForFunction(() => window.__db?.runV2SystemTests, null, { polling: 100 });
  await expect(page.locator('#loading')).toHaveClass('hidden');
  expect((await assertSuite(page, 'runV2SystemTests')).total).toBe(57);
  expect((await assertSuite(page, 'runYouthTests')).total).toBeGreaterThanOrEqual(37);
  await page.mouse.click(4, 4);
  await page.evaluate(async () => {
    const d = window.__db;
    d.game.manualTest = false;
    d.game.muted = false;
    document.querySelector('#homeStart').click();
    await d.playBGM('global', 0.01);
  });
  for (const id of ['menu', 'arena', 'wild', 'island', 'crisis', 'win', 'lose', 'draw'])
    await page.evaluate((id) => window.__db.playBGM(id, 0.01), id);
  expect((await page.evaluate(() => window.__db.musicDiagnostics())).decoded).toHaveLength(9);
  expect((await page.evaluate(() => window.__db.musicDiagnostics())).error).toBeNull();
  expect(errors).toEqual([]);
  expect(network).toEqual([]);
});
