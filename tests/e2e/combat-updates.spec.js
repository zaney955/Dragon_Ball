import { test, expect } from '@playwright/test';

async function openGame(page) {
  await page.addInitScript(() => (window.requestAnimationFrame = () => 0));
  await page.goto('/?test=1');
  await page.waitForFunction(() => window.__db?.fixtureYouth && window.__db?.tick, null, {
    polling: 100,
  });
}

test('depleted life gauges shatter once, promote the reserve, fade at KO and reset after healing', async ({
  page,
}) => {
  await openGame(page);
  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.evaluate(() => {
      const d = window.__db;
      const [p] = d.fixtureYouth('pilaf', 'goku', 8);
      d.game.difficulty = 'local';
      d.updateHUD();
      d.renderGameViews();
      p.hp = p.maxHp / 2 - 10;
      d.updateHUD();
      d.renderGameViews();
      d.updateHUD();
      d.renderGameViews();
    });
    for (const id of ['p1hp', 'view1HP']) {
      const stack = page.locator(`#${id}`).locator('../..');
      await expect(stack).toHaveClass(/primaryDepleted/);
      await expect(stack.locator('.healthShatter i')).toHaveCount(8);
    }
    await expect(page.locator('.healthShatter')).toHaveCount(0);
    const states = await page.evaluate(() =>
      ['p1hp', 'view1HP'].map((id) => {
        const main = document.getElementById(id).parentElement;
        const reserve = main.nextElementSibling;
        return {
          hidden: +getComputedStyle(main).opacity === 0,
          promoted: parseFloat(getComputedStyle(reserve).top) === 0,
          green: +getComputedStyle(reserve.firstElementChild, '::after').opacity === 1,
          width: parseFloat(reserve.firstElementChild.style.width),
        };
      }),
    );
    expect(
      states.every((s) => s.hidden && s.promoted && s.green && s.width < 100 && s.width > 0),
    ).toBe(true);
    await page.evaluate(() => {
      const d = window.__db;
      d.player.hp = 0;
      d.updateHUD();
      d.renderGameViews();
    });
    await expect(page.locator('#p1reserve').locator('..')).toHaveCSS('opacity', '0');
    await expect(page.locator('#view1Reserve').locator('..')).toHaveCSS('opacity', '0');
    await page.evaluate(() => {
      const d = window.__db;
      d.player.hp = d.player.maxHp;
      d.updateHUD();
      d.renderGameViews();
    });
    await expect(page.locator('#p1hp').locator('../..')).not.toHaveClass(/Depleted/);
  }
});

test('startup intercepts and recovery punish hits double damage once after combo scaling', async ({
  page,
}) => {
  await openGame(page);
  const rows = await page.evaluate(() => {
    const d = window.__db;
    const rows = [];
    for (const combo of [0, 2])
      for (const phase of ['idle', 'startup', 'active', 'recovery', 'charge', 'block']) {
        const [p, e] = d.fixtureYouth('pilaf', 'goku', 2);
        if (['startup', 'active', 'recovery', 'block'].includes(phase)) {
          p.startAttack('heavy');
          const a = p.attack;
          p.stateTimer =
            phase === 'startup' || phase === 'block'
              ? a.hitT / 2
              : phase === 'active'
                ? a.hitT + a.active / 2
                : a.hitT + a.active + 0.01;
        }
        if (phase === 'charge') p.state = 'charge';
        if (phase === 'block') {
          p.state = 'block';
          p.guardHeld = 1;
        }
        p.receivedCombo = combo;
        p.takeHit(e, { ...e.def.combos.light[0], dmg: 10, damagePower: 1, kb: 0, stun: 0.2 });
        rows.push({ phase, combo, damage: p.lastDamage, feedback: p.lastHitText });
      }
    return rows;
  });
  for (const combo of [0, 2]) {
    const rowsForCombo = rows.filter((r) => r.combo === combo);
    const base = rowsForCombo.find((r) => r.phase === 'idle').damage;
    for (const phase of ['startup', 'recovery', 'charge']) {
      const row = rowsForCombo.find((r) => r.phase === phase);
      expect(row.damage, JSON.stringify(row)).toBeCloseTo(base * 2, 5);
      expect(row.feedback).toBe(phase === 'recovery' ? '后摇惩罚' : '截击');
    }
    expect(rowsForCombo.find((r) => r.phase === 'active').damage).toBe(base);
    expect(rowsForCombo.find((r) => r.phase === 'block').feedback).toBe('格挡');
    expect(rowsForCombo.find((r) => r.phase === 'block').damage).toBeLessThan(base);
  }
});

test('oolong mimic ultimate emits white smoke on both transformation and normal or interrupted return', async ({
  page,
}) => {
  await openGame(page);
  const rows = await page.evaluate(() => {
    const d = window.__db;
    return ['finished', 'interrupted'].map((ending) => {
      const [p, e] = d.fixtureYouth('oolong', 'goku', 8);
      d.setCombatSeed(73);
      p.startUlt();
      for (let n = 0; n < 200 && !p.youth.form?.startsWith('mimic:'); n++) d.tick();
      const form = p.youth.form;
      const smoke = () => d.getEffects().filter((x) => x.kind === 'transformSmoke');
      const entered = smoke().length;
      const white = smoke().every((x) => x.mesh.material.color.getHex() === 0xffffff);
      d.updateEffects(1);
      if (ending === 'interrupted') {
        // Ensure this is an ordinary copied ultimate without an active armor window.
        p.attack.superArmor = false;
        p.invulnerable = 0;
        p.takeHit(e, { ...e.def.combos.light[0], kb: 0 });
      } else for (let n = 0; n < 1600 && p.youth.form; n++) d.tick();
      return {
        ending,
        form,
        entered,
        white,
        returned: p.youth.form === null,
        smokeOnReturn: smoke().length,
      };
    });
  });
  for (const row of rows) {
    expect(row.form).toMatch(/^mimic:/);
    expect(row.entered).toBe(27);
    expect(row.white && row.returned, JSON.stringify(row)).toBe(true);
    expect(row.smokeOnReturn).toBe(27);
  }
});

test('pilaf flame follows movement, permits melee, lasts two seconds and burns for three five-point ticks', async ({
  page,
}) => {
  await openGame(page);
  const result = await page.evaluate(() => {
    const d = window.__db;
    const [p, e] = d.fixtureYouth('pilaf', 'krillin', 1.5);
    p.youth.weapon = 'flame';
    p.startKiBlast();
    const stream = () => d.youthEntities.find((x) => x.kind === 'flameStream');
    for (let n = 0; n < 100 && !stream(); n++) d.tick();
    const fire = stream();
    const directDamage = e.maxHp - e.hp;
    const ignited = !!e.youth.burn;
    // Step the status separately after leaving the fire to measure exact tick boundaries.
    e.pos.set(8, 0, 8);
    const burnHp = e.hp;
    const burnTicks = [];
    for (const duration of [0.99, 0.01, 1, 1, 1]) {
      d.tickYouthFighter(e, duration);
      burnTicks.push(burnHp - e.hp);
    }
    const origin = p.pos.clone();
    for (let n = 0; n < 30; n++) d.tick({ right: true });
    const moved = p.pos.distanceTo(origin) > 0.1;
    const follows = fire.pos.distanceTo(p.pos) < 1e-8;
    const ki = p.ki;
    const duplicateRejected = !p.attack && !p.startKiBlast() && p.ki === ki;
    d.tick({ actions: [{ type: 'light' }] });
    const attacking = p.attack?.chainType === 'light' && !!stream();
    const visibleParticles = fire.mesh.children.filter((x) => x.material.opacity > 0.1).length;
    let remainingSteps = 0;
    while (stream() && remainingSteps++ < 300) d.tick();
    const duration = fire.elapsed;
    return {
      directDamage,
      ignited,
      burnTicks,
      moved,
      follows,
      attacking,
      visibleParticles,
      duplicateRejected,
      duration,
      expired: !stream(),
      burnEnded: !e.youth.burn,
    };
  });
  expect(result.directDamage).toBeGreaterThan(0);
  expect(result).toMatchObject({
    ignited: true,
    moved: true,
    follows: true,
    attacking: true,
    duplicateRejected: true,
    expired: true,
    burnEnded: true,
  });
  expect(result.burnTicks).toEqual([0, 5, 10, 15, 15]);
  expect(result.visibleParticles).toBeGreaterThan(12);
  expect(result.duration).toBeCloseTo(2, 5);
});

test('flame passes above low cover, respects ox king immunity and deals only one guarded chip hit', async ({
  page,
}) => {
  await openGame(page);
  const rows = await page.evaluate(() => {
    const d = window.__db;
    return ['immune', 'cover', 'guard'].map((scenario) => {
      const [p, e] = d.fixtureYouth('pilaf', scenario === 'immune' ? 'gyumao' : 'bulma', 1.5);
      p.youth.weapon = 'flame';
      if (scenario === 'cover') {
        e.startSpecial({ variant: 1 });
        d.releaseYouthAbility(e, { ...e.attack, ability: 'cover' });
        e.attack = null;
        e.state = 'idle';
        const cover = d.youthEntities.find((x) => x.kind === 'cover');
        cover.pos.copy(p.pos).lerp(e.pos, 0.5);
      }
      const hp = e.hp;
      p.startKiBlast();
      for (let n = 0; n < 300; n++) d.tick({}, scenario === 'guard' ? { block: true } : {});
      return {
        scenario,
        damage: hp - e.hp,
        burning: !!e.youth.burn,
        height: p.anatomy.hip + p.anatomy.armY,
      };
    });
  });
  for (const row of rows) {
    if (row.scenario === 'cover') {
      // Pilaf's muzzle is at 2m; Bulma's 1.3m cover leaves this stream above it.
      expect(row.height).toBeGreaterThan(1.6);
      expect(row.burning && row.damage > 0).toBe(true);
      continue;
    }
    expect(row.burning, JSON.stringify(row)).toBe(false);
    if (row.scenario === 'guard') expect(row.damage).toBeLessThan(3);
    else expect(row.damage, row.scenario).toBe(0);
  }
});

test('active flame and burn survive a JSON battle snapshot with identical future damage', async ({
  page,
}) => {
  await openGame(page);
  const result = await page.evaluate(() => {
    const d = window.__db;
    const [p] = d.fixtureYouth('pilaf', 'krillin', 1.5);
    p.youth.weapon = 'flame';
    p.startKiBlast();
    for (let n = 0; n < 50; n++) d.tick();
    const saved = JSON.parse(JSON.stringify(d.captureBattleState()));
    const before = d.battleStateDigest(saved);
    const step = () => {
      d.enemy.pos.set(8, 0, 8);
      for (let n = 0; n < 400; n++) d.tick();
      return d.battleStateDigest(d.captureBattleState());
    };
    const future = step();
    const restored = d.restoreBattleState(saved);
    const burning = !!d.enemy.youth.burn;
    const active = d.youthEntities.some((x) => x.kind === 'flameStream');
    return { before, restored, future, replay: step(), burning, active };
  });
  expect(result.before).toBe(result.restored);
  expect(result.future).toBe(result.replay);
  expect(result.burning && result.active).toBe(true);
});
