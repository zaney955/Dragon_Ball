import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

async function openGame(page, testMode = true) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(testMode ? '/?test=1' : '/');
  await expect(page.locator('#loading')).toHaveClass('hidden');
  if (testMode) await page.waitForFunction(() => window.__db?.runV2SystemTests);
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

test('existing 4575 assertions and V2 system/old-four regressions', async ({ page }) => {
  const errors = await openGame(page);
  expect((await assertSuite(page, 'runTests', ['all'])).total).toBe(4575);
  expect((await assertSuite(page, 'runV2OldFourTests')).total).toBe(16);
  expect((await assertSuite(page, 'runV2SystemTests')).total).toBe(57);
  expect(errors).toEqual([]);
});

test('all seven added characters keep their ability contracts', async ({ page }) => {
  const errors = await openGame(page);
  let total = 0;
  for (let character = 7; character < 14; character++) {
    total += (await assertSuite(page, 'runV2CharacterTests', [character])).total;
  }
  expect(total).toBe(90);
  expect(errors).toEqual([]);
});

test('14 by 14 real collision and ability matrix', async ({ page }) => {
  test.setTimeout(900_000);
  test.skip(!process.env.FULL_REGRESSION, 'Run npm run test:full for the full matrix.');
  const errors = await openGame(page);
  let total = 0;
  for (let row = 0; row < 14; row++) total += (await assertSuite(page, 'runV2Matrix', [row])).total;
  expect(total).toBe(1764);
  expect(errors).toEqual([]);
});

test('mobile home and character selection remain usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = await openGame(page, false);
  await page.locator('#homeStart').click();
  await expect(page.locator('#charList .char-card')).toHaveCount(14);
  await expect(page.locator('#startBtn')).toBeVisible();
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
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (/^https?:/.test(request.url())) network.push(request.url());
  });
  const url = pathToFileURL(resolve('dist/offline/龙珠_少年武道会.html'));
  url.search = '?test=1';
  await page.goto(url.href);
  await page.waitForFunction(() => window.__db?.runV2SystemTests);
  await expect(page.locator('#loading')).toHaveClass('hidden');
  expect((await assertSuite(page, 'runV2SystemTests')).total).toBe(57);
  expect(errors).toEqual([]);
  expect(network).toEqual([]);
});
