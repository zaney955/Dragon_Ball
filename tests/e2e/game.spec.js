import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

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
  await expect(page.locator('#mapList .map-card')).toHaveCount(3);
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
      return { meshes, vertices };
    });
    expect(geometry.meshes).toBeGreaterThan(0);
    expect(geometry.vertices).toBeGreaterThan(0);
    await expect(page.locator('#artName')).not.toBeEmpty();
  }
  for (let stage = 0; stage < 3; stage++) {
    await page.locator('#artAsset').selectOption('stage:' + stage);
    expect(await page.evaluate(() => window.__db.artView.model.children.length)).toBeGreaterThan(0);
    await expect(page.locator('#artType')).toHaveText('对战舞台');
  }
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

test('core combat, complete youth rules and retained system regressions', async ({ page }) => {
  const errors = await openGame(page, true, true);
  expect((await assertSuite(page, 'runTests', ['legacy'])).total).toBe(91);
  expect((await assertSuite(page, 'runYouthTests')).total).toBeGreaterThanOrEqual(37);
  expect((await assertSuite(page, 'runV2OldFourTests')).total).toBe(16);
  expect((await assertSuite(page, 'runV2SystemTests')).total).toBe(57);
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

test('eight original tracks decode, crisis latches and pause preserves playback', async ({
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
  await page.waitForFunction(() => window.__db.musicDiagnostics().track === 'crisis', null, {
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
  expect((await page.evaluate(() => window.__db.musicDiagnostics())).track).toBe('crisis');
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
    await d.playBGM('menu', 0.01);
  });
  for (const id of ['arena', 'wild', 'island', 'crisis', 'win', 'lose', 'draw'])
    await page.evaluate((id) => window.__db.playBGM(id, 0.01), id);
  expect((await page.evaluate(() => window.__db.musicDiagnostics())).decoded).toHaveLength(8);
  expect((await page.evaluate(() => window.__db.musicDiagnostics())).error).toBeNull();
  expect(errors).toEqual([]);
  expect(network).toEqual([]);
});
