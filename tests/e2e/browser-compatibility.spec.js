import { test, expect, firefox, webkit } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
for (const engine of [firefox, webkit])
  test(`${engine.name()} viewport simulation boots combat, guard and snapshot replay`, async () => {
    test.skip(!process.env.DB_BROWSER_COMPAT, 'Run with installed Firefox/WebKit test engines.');
    const browser = await engine.launch({
      headless: true,
      args: [],
      ...(engine === firefox ? { firefoxUserPrefs: { 'webgl.force-enabled': true } } : {}),
    });
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
    });
    const page = await context.newPage(),
      errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(() => (window.requestAnimationFrame = () => 0));
    try {
      await page.goto((process.env.DB_PREVIEW_URL || 'http://127.0.0.1:4190') + '/?test=1');
      await page.waitForFunction(() => window.__db?.fixtureYouth, null, {
        polling: 100,
        timeout: 30000,
      });
      const report = await page.evaluate(() => {
        const d = window.__db,
          [, e] = d.fixtureYouth('goku', 'tien', 1);
        d.game.difficulty = 'training';
        d.resetShoulderCameras();
        d.tick({ actions: ['light'] });
        for (let n = 0; n < 30; n++) d.tick();
        const damage = e.maxHp - e.hp;
        const snapshot = JSON.parse(JSON.stringify(d.captureBattleState()));
        const before = d.battleStateDigest(snapshot),
          restored = d.restoreBattleState(snapshot);
        for (let n = 0; n < 100; n++) d.tick({ block: true });
        d.updateHUD();
        d.updateExtraHUD();
        d.renderGameViews();
        return {
          damage,
          before,
          restored,
          guard: d.player.state,
          userAgent: navigator.userAgent,
          renderer: d.renderer.getContext().getParameter(d.renderer.getContext().VERSION),
        };
      });
      await mkdir('performance/completion-audit/browsers', { recursive: true });
      await page.screenshot({ path: `performance/completion-audit/browsers/${engine.name()}.png` });
      await writeFile(
        `performance/completion-audit/browsers/${engine.name()}.json`,
        JSON.stringify(report, null, 2),
      );
      expect(report.damage).toBeGreaterThan(0);
      expect(report.before).toBe(report.restored);
      expect(report.guard).toBe('block');
      expect(errors).toEqual([]);
    } finally {
      await browser.close();
    }
  });
