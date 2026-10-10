import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
for (const viewport of [
  { width: 390, height: 844 },
  { width: 844, height: 390 },
]) {
  test(`phone simulation reads real shoulder actions and accepts touch at ${viewport.width}x${viewport.height}`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport,
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 1,
    });
    const page = await context.newPage(),
      errors = [],
      rows = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(() => (window.requestAnimationFrame = () => 0));
    await page.goto('/?test=1');
    await page.waitForFunction(() => window.__db?.updateFightCamera, null, { polling: 100 });
    await mkdir('performance/completion-audit/mobile', { recursive: true });
    for (const scene of ['ox-small', 'yamcha-back', 'launch-pursuit', 'wall-cover']) {
      await page.evaluate((scene) => {
        const d = window.__db;
        const [p, e] = d.fixtureYouth(
          scene === 'ox-small' ? 'gyumao' : scene === 'wall-cover' ? 'bulma' : 'goku',
          scene === 'ox-small' ? 'chiaotzu' : scene === 'yamcha-back' ? 'yamcha' : 'krillin',
          1.3,
        );
        d.game.difficulty = 'training';
        if (scene === 'wall-cover') {
          p.pos.set(12.7, 0, 3);
          e.pos.set(11.4, 0, 3);
          p.previousPos.copy(p.pos);
          e.previousPos.copy(e.pos);
          p.startSpecial({ variant: 1 });
          d.releaseYouthAbility(p, { ...p.attack, ability: 'cover' });
        }
        d.resetShoulderCameras();
        if (scene === 'ox-small') e.startAttack('heavy');
        if (scene === 'yamcha-back') {
          e.startSpecial({ variant: 1 });
          p.startAttack('light');
        }
        if (scene === 'launch-pursuit') d.launchKnockback(e, p);
        window.__cameraScene = { scene, frames: [] };
      }, scene);
      for (let frame = 0; frame < 150; frame++) {
        await page.evaluate((frame) => {
          const d = window.__db,
            data = window.__cameraScene;
          d.tick(
            data.scene === 'launch-pursuit' && frame === 25 ? { actions: ['pursuit'] } : {},
            {},
          );
          d.game.hitStop = 0;
          d.player.render(d.STEP, 1);
          d.enemy.render(d.STEP, 1);
          d.scene.updateMatrixWorld(true);
          const oldYaw = d.shoulderStates[0].yaw;
          d.updateFightCamera(d.STEP);
          const worldHead = d.enemy.parts.head.getWorldPosition(d.enemy.pos.clone());
          const ray = d.cameraRay,
            toHead = worldHead.clone().sub(d.camera.position),
            distance = toHead.length();
          ray.set(d.camera.position, toHead.normalize());
          ray.far = Math.max(0, distance - 0.15);
          const selfOccluded = ray.intersectObject(d.player.root, true).length > 0;
          const head = worldHead.clone().project(d.camera);
          const x = (head.x * 0.5 + 0.5) * innerWidth,
            y = (0.5 - head.y * 0.5) * innerHeight;
          const covered = [...document.querySelectorAll('#touch button')].some((b) => {
            const r = b.getBoundingClientRect();
            return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
          });
          data.frames.push({
            frame,
            visible:
              Math.abs(head.x) < 0.95 && Math.abs(head.y) < 0.92 && head.z > -1 && head.z < 1,
            covered,
            selfOccluded,
            x,
            y,
            turn: Math.abs(d.shoulderStates[0].yaw - oldYaw),
            state: d.enemy.state,
            attack: !!d.enemy.attack,
            launch: d.enemy.launchFlight,
          });
          d.updateHUD();
          d.updateExtraHUD();
          if ([0, 24, 60, 149].includes(frame)) d.renderGameViews();
        }, frame);
        if ([0, 24, 60, 149].includes(frame))
          await page.screenshot({
            path: `performance/completion-audit/mobile/${viewport.width}-${scene}-${frame}.png`,
          });
      }
      rows.push(await page.evaluate(() => window.__cameraScene));
    }
    await page.evaluate(() => {
      const d = window.__db;
      d.fixtureYouth('goku', 'tien', 1.5);
      d.game.difficulty = 'training';
      d.resetShoulderCameras();
      d.updateHUD();
      d.updateExtraHUD();
      d.renderGameViews();
    });
    await page.locator('[data-key="KeyJ"]').first().tap();
    await page.evaluate(() => window.__db.tick(window.__db.readPlayerInput()));
    expect(await page.evaluate(() => !!window.__db.player.attack)).toBe(true);
    await page.evaluate(() => {
      const d = window.__db;
      d.player.attack = null;
      d.player.state = 'idle';
      d.enemy.startSpecial();
      d.releaseYouthAbility(d.enemy, d.enemy.attack);
      for (let n = 0; n < 60; n++) d.tick();
      for (let n = 0; n < 180 && d.player.state === 'hit'; n++) d.tick();
      d.updateHUD();
      d.updateExtraHUD();
    });
    expect(await page.evaluate(() => window.__db.player.youth.reversedTime)).toBeGreaterThan(2);
    const cdp = await context.newCDPSession(page);
    const point = async (key) => {
      const r = await page.locator(`[data-key="${key}"]`).first().boundingBox();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    };
    const up = await point('KeyW'),
      heavy = await point('KeyK');
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ ...up, id: 1 }],
    });
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [
        { ...up, id: 1 },
        { ...heavy, id: 2 },
      ],
    });
    await page.evaluate(() => window.__db.tick(window.__db.readPlayerInput()));
    expect(await page.evaluate(() => window.__db.player.attack?.motion)).toBe(
      await page.evaluate(() => window.__db.player.def.directionMoves[1].motion),
    );
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.evaluate(() => {
      const d = window.__db;
      d.player.attack = null;
      d.player.state = 'idle';
      d.player.clearQueue();
    });
    const block = await point('KeyL');
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ ...block, id: 1 }],
    });
    await page.evaluate(() => window.__db.tick(window.__db.readPlayerInput()));
    expect(await page.evaluate(() => window.__db.player.state)).toBe('block');
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.evaluate(() => {
      window.__db.updateHUD();
      window.__db.updateExtraHUD();
      window.__db.renderGameViews();
    });
    await page.screenshot({
      path: `performance/completion-audit/mobile/${viewport.width}-solar.png`,
    });
    await writeFile(
      `performance/completion-audit/mobile/${viewport.width}-camera.json`,
      JSON.stringify(rows, null, 2),
    );
    console.log(
      'CAMERA',
      JSON.stringify(
        rows.map((r) => ({
          scene: r.scene,
          visible: r.frames.filter((f) => f.visible).length,
          covered: r.frames.filter((f) => f.covered).length,
          selfOccluded: r.frames.filter((f) => f.selfOccluded).length,
          maxTurn: Math.max(...r.frames.map((f) => f.turn)),
        })),
      ),
    );
    expect(errors).toEqual([]);
    const ox = rows.find((r) => r.scene === 'ox-small');
    expect(ox.frames.filter((f) => f.attack && f.selfOccluded)).toEqual([]);
    for (const row of rows)
      expect(
        row.frames.filter((f) => !f.visible || f.covered),
        row.scene,
      ).toEqual([]);
    for (const row of rows)
      expect(Math.max(...row.frames.map((f) => f.turn))).toBeLessThanOrEqual(4.5 / 120 + 1e-6);
    await context.close();
  });
}
