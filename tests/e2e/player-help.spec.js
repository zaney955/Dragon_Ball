import { test, expect } from '@playwright/test';

async function open(page, fixed = true) {
  if (fixed) await page.addInitScript(() => (window.requestAnimationFrame = () => 0));
  await page.goto('/?test=1');
  await page.waitForFunction(() => window.__db?.getMechanicPractice);
}

test('all fourteen character exercises can be completed through combat input', async ({ page }) => {
  await open(page);
  const results = await page.evaluate(() => {
    const d = window.__db;
    const rows = [];
    const tick = (input = {}, foeInput = {}) => {
      d.tick(input, foeInput);
      d.game.hitStop = 0;
      d.updateMechanicPractice();
    };
    const wait = (n = 160) => {
      for (let i = 0; i < n; i++) tick();
    };
    const align = (distance = 1) => {
      const p = d.player,
        e = d.enemy;
      p.pos.set(0, 0, -3);
      e.pos.set(distance, 0, -3);
      p.previousPos.copy(p.pos);
      e.previousPos.copy(e.pos);
      p.facingAngle = Math.PI / 2;
      e.facingAngle = -Math.PI / 2;
    };
    const act = (input, n = 160) => {
      tick(input);
      wait(n);
    };
    for (const c of d.CHARACTERS) {
      d.fixtureYouth(c.id, 'krillin', 1);
      d.game.difficulty = 'training';
      d.game.trainingDummy = 'idle';
      d.startMechanicPractice();
      align();
      d.combatDiagnostics.enabled = true;
      d.combatEvents.history.length = 0;
      if (c.id === 'goku') {
        act({ special: true });
        act({ special: true, down: true });
      }
      if (c.id === 'roshi') {
        align(0.6);
        tick({ special: true });
        for (let i = 0; i < 8; i++) tick();
        tick({}, { light: true });
        wait();
        act({ special: true, down: true });
      }
      if (['taopaipai', 'krillin', 'piccolo'].includes(c.id)) {
        act({ special: true });
        align(c.id === 'taopaipai' ? 0.6 : 1);
        act({ special: true, down: true });
      }
      if (c.id === 'tien') {
        act({ special: true });
        act({ special: true, down: true });
      }
      if (c.id === 'yamcha') {
        tick({ special: true });
        for (let i = 0; i < 70; i++) {
          tick(d.player.youth.wolfUntil > d.game.simTime ? { special: true } : {});
        }
        wait(140);
        align();
        align(0.6);
        tick({ special: true, down: true });
        for (let i = 0; i < 8; i++) tick();
        tick({}, { light: true });
        wait();
      }
      if (c.id === 'gyumao') {
        act({ heavy: true });
        align();
        act({ special: true, down: true });
      }
      if (c.id === 'chichi') {
        act({ special: true }, 320);
        align(2);
        act({ blast: true });
      }
      if (c.id === 'bulma') {
        act({ special: true });
        align(2);
        d.player.pos.z = d.enemy.pos.z = 3;
        act({ blast: true });
        act({ special: true, down: true });
      }
      if (c.id === 'chiaotzu') {
        act({ special: true });
        act({ special: true, down: true });
      }
      if (c.id === 'oolong') {
        act({ special: true });
        act({ special: true });
        act({ special: true, down: true });
        wait(360);
        act({ special: true, down: true });
        wait(400);
      }
      if (c.id === 'korin') {
        act({ special: true, down: true });
        align();
        tick({ special: true });
        for (let i = 0; i < 15; i++) tick();
        // Keep the target within staff reach after the lateral step.
        d.enemy.pos.z = d.player.pos.z;
        d.enemy.pos.x = d.player.pos.x + 0.6;
        tick({ light: true });
        wait();
      }
      if (c.id === 'pilaf') {
        align(2);
        act({ blast: true });
        act({ special: true });
        align(1.5);
        act({ blast: true });
      }
      rows.push({
        id: c.id,
        ...d.getMechanicPractice(),
        events: d.combatEvents.history
          .filter((e) =>
            ['contact', 'counter', 'reflection', 'bladeReturn', 'attack'].includes(e.type),
          )
          .map((e) => [e.side, e.type, e.move, Number(e.time.toFixed(3))]),
        state: d.player.state,
        energy: d.player.ki,
      });
    }
    return rows;
  });
  console.log(`角色练习完成：${results.filter((row) => row.success).length}/14`);
  expect(results.filter((row) => !row.success)).toEqual([]);
});

test('all fourteen guides show matching moves, costs and input labels', async ({ page }) => {
  await open(page);
  await page.locator('#homeGuide').click();
  await expect(page.locator('#guideCharacter option')).toHaveCount(14);
  const roster = await page.evaluate(() =>
    window.__db.CHARACTERS.map((c) => ({
      name: c.name,
      skills: c.skills.map((s) => ({ name: s.name, cost: s.kiCost })),
      ultimate: c.ultName,
    })),
  );
  await page.locator('#characterTab').click();
  for (const [index, c] of roster.entries()) {
    await page.locator('#guideCharacter').selectOption(String(index));
    await expect(page.locator('#characterGuide > h3')).toHaveText(c.name);
    await expect(page.locator('.helpMove')).toHaveCount(5);
    for (const [i, s] of c.skills.entries()) {
      await expect(page.locator('.helpMove').nth(i + 2)).toContainText(s.name);
      await expect(page.locator('.helpMove').nth(i + 2)).toContainText(`${s.cost} 能量`);
    }
    await expect(page.locator('.helpMove').last()).toContainText(c.ultimate);
    await expect(page.locator('#characterGuide')).not.toContainText(/undefined|NaN/);
    await page.locator('#framesTab').click();
    await expect(page.locator('#characterMoves tbody')).toContainText(c.skills[0].name);
    await page.locator('#characterTab').click();
    await page.locator('#guideInput').selectOption('two');
    await expect(page.locator('.helpMove kbd').nth(2)).toHaveText('小键盘 +');
    await expect(page.locator('.helpMove kbd').nth(3)).toHaveText('↓ + 小键盘 +');
    await page.locator('#guideInput').selectOption('touch');
    await expect(page.locator('.helpMove kbd').nth(3)).toHaveText('第二技能按钮');
    await expect(page.locator('#characterGuide')).not.toContainText(/\bF\b|S \+ R/);
    await page.locator('#guideInput').selectOption('one');
  }
  await page.locator('#guideClose').click();
  expect(await page.evaluate(() => window.__db.refreshMoveTable())).toBeUndefined();
});

test('live actions explain weapon switching, missing energy and guest ownership', async ({
  page,
}) => {
  await open(page);
  await page.evaluate(() => {
    const d = window.__db;
    d.fixtureYouth('pilaf', 'korin', 2);
    d.updateExtraHUD();
  });
  await expect(page.locator('.skillSlot').first()).toContainText('导弹');
  await page.evaluate(() => {
    const d = window.__db;
    d.tick({ special: true });
    for (let i = 0; i < 160; i++) d.tick();
    d.updateExtraHUD();
  });
  await expect(page.locator('.skillSlot').first()).toContainText('喷火');
  await expect(page.locator('.skillSlot').first()).toContainText('12 能量');
  await page.evaluate(() => {
    const d = window.__db;
    d.player.ki = 4;
    d.updateExtraHUD();
  });
  await expect(page.locator('.skillSlot').first()).toContainText('能量不足，还差8');
  await expect(page.locator('#specialState')).toContainText('聚气');
  await page.evaluate(() => {
    const d = window.__db;
    d.game.online = true;
    d.game.onlineSeat = 1;
    d.updateExtraHUD();
  });
  await expect(page.locator('.skillSlot').first()).toContainText('没有远程攻击');
  await expect(page.locator('#secondarySkill')).toContainText('仙豆');
  await page.locator('#fightGuide').click();
  await expect(page.locator('#characterGuide > h3')).toHaveText('猫仙人');
  await expect(page.locator('#guideInput')).toHaveValue('one');
  await expect(page.locator('#guidePractice')).toBeHidden();
  await page.locator('#guideClose').click();
});

test('local second player and mobile selection show their actual inputs', async ({
  page,
  browser,
}) => {
  await open(page);
  await page.locator('#homeStart').click();
  await page.locator('#difficulty').selectOption('local');
  await page.locator('#pickP2').click();
  await page.locator('#heroGuide').click();
  await expect(page.locator('#guideInput')).toHaveValue('two');
  await expect(page.locator('.helpMove kbd').nth(2)).toHaveText('小键盘 +');
  for (const width of [320, 390, 844]) {
    const context = await browser.newContext({
      viewport: { width, height: width === 844 ? 390 : 844 },
      hasTouch: true,
      isMobile: true,
    });
    const mobile = await context.newPage();
    await open(mobile);
    await mobile.locator('#homeStart').click();
    await mobile.locator('#charList .char-card').nth(13).click();
    await expect(mobile.locator('#heroSummary')).toContainText('远程按钮');
    await mobile.locator('#startBtn').click();
    await mobile.evaluate(() => {
      window.__db.game.ready = 0;
      window.__db.updateExtraHUD();
    });
    const layout = await mobile.locator('#touch button').evaluateAll((buttons) =>
      buttons.map((button) => {
        const b = button.getBoundingClientRect();
        return {
          label: button.textContent,
          left: b.left,
          right: b.right,
          top: b.top,
          bottom: b.bottom,
          width: b.width,
          height: b.height,
        };
      }),
    );
    for (const [i, b] of layout.entries()) {
      expect(b.left, b.label).toBeGreaterThanOrEqual(0);
      expect(b.right, b.label).toBeLessThanOrEqual(width);
      expect(b.width, b.label).toBeGreaterThanOrEqual(44);
      expect(b.height, b.label).toBeGreaterThanOrEqual(44);
      for (const other of layout.slice(i + 1))
        expect(
          b.left < other.right &&
            b.right > other.left &&
            b.top < other.bottom &&
            b.bottom > other.top,
          `${b.label} / ${other.label}`,
        ).toBe(false);
    }
    await expect(mobile.locator('#touch [data-key="KeyF"]')).toHaveText('导弹');
    await expect(mobile.locator('#touchStatus')).not.toContainText('就绪');
    await expect(mobile.locator('#touchStatus')).toContainText('必杀：能量不足，还差70');
    await mobile.evaluate(() => {
      window.__db.player.ki = 100;
      window.__db.updateExtraHUD();
    });
    await expect(mobile.locator('#touchStatus')).toHaveText('');
    await mobile.locator('#fightGuide').click();
    await expect(mobile.locator('#guideInput')).toHaveValue('touch');
    await expect(mobile.locator('#guideClose')).toBeInViewport();
    await context.close();
  }
});

test('selection and guide practice entries prepare the chosen character and transformation conditions', async ({
  page,
}) => {
  await open(page, false);
  await page.locator('#homeStart').click();
  await page.locator('#heroPractice').click();
  await expect(page.locator('#trainingPanel')).toBeVisible();
  await expect(page.locator('#v2Goal')).toContainText('1/2：');
  await page.locator('#fightGuide').click();
  await expect(page.locator('#guideConditions [data-met="true"]')).toHaveCount(6);
  await expect(page.locator('#guideConditions [data-met="false"]')).toHaveCount(0);
  const firstRound = await page.evaluate(() => window.__db.game.round);
  await page.locator('#guideCharacter').selectOption('13');
  await page.locator('#guidePractice').click();
  await expect(page.locator('#p1name')).toHaveText('皮尔夫大王');
  await expect(page.locator('#v2Goal')).toContainText('1/3：');
  await expect(page.locator('#v2Goal')).toContainText('导弹命中');
  const round = await page.evaluate(() => window.__db.game.round);
  expect(round).toBeGreaterThan(firstRound);
  await page.locator('#v2GoalStop').click();
  await expect(page.locator('#v2GoalStart')).toHaveText('开始');
  expect(await page.evaluate(() => window.__db.getMechanicPractice())).toBeNull();
});

test('a follow-up window waits through hitstun and still allows its free action after recovery', async ({
  page,
}) => {
  await open(page);
  await page.evaluate(() => {
    const d = window.__db;
    d.fixtureYouth('yamcha', 'krillin', 1);
    d.player.youth.wolfUntil = d.game.simTime + 0.25;
    d.player.state = 'hit';
    d.updateExtraHUD();
  });
  await expect(page.locator('.skillSlot').nth(1)).toContainText('追加终掌');
  await expect(page.locator('.skillSlot').nth(1)).toContainText('等待动作结束');
  await page.evaluate(() => {
    const d = window.__db;
    d.player.state = 'idle';
    d.player.ki = 0;
    d.updateExtraHUD();
  });
  await expect(page.locator('.skillSlot').nth(1)).toContainText('就绪');
  const followup = await page.evaluate(() => {
    const d = window.__db;
    d.tick({ special: true });
    return { move: d.player.attack?.name, energy: d.player.ki };
  });
  expect(followup.move).toBe('狼牙终掌');
  expect(followup.energy).toBeLessThan(1);
});
