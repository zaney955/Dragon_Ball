import { test, expect } from '@playwright/test';

async function openGame(page) {
  await page.addInitScript(() => (window.requestAnimationFrame = () => 0));
  await page.goto('/?test=1');
  await page.waitForFunction(() => window.__db?.ultimateAvailability && window.__db?.aiThink);
}

test('unavailable skill or sealed ultimate cannot consume a valid confirmed combo input', async ({
  page,
}) => {
  await openGame(page);
  const rows = await page.evaluate(() => {
    const d = window.__db;
    return ['cost', 'cooldown', 'sealed'].map((kind) => {
      const [p, e] = d.fixtureYouth(kind === 'sealed' ? 'piccolo' : 'goku', 'pilaf', 2);
      p.startAttack('light');
      p.hasHit = true;
      p.hitResult = 'hit';
      p.stateTimer = p.attack.hitT + p.attack.confirmWindow;
      if (kind === 'cost') p.ki = 35;
      if (kind === 'cooldown') p.youth.cooldowns[1] = 3;
      if (kind === 'sealed') p.youth.regenerated = true;
      p.captureInput({
        actions: [{ type: kind === 'sealed' ? 'ult' : 'special', down: true }, { type: 'heavy' }],
      });
      const ki = p.ki;
      p.updateAttack(d.STEP, e, {});
      return { kind, chain: p.attack.chainType, kiUnchanged: p.ki === ki };
    });
  });
  for (const row of rows)
    expect(row, row.kind).toMatchObject({ chain: 'heavy', kiUnchanged: true });
});

test('free wolf followup uses the same availability rule and cannot restart during hitstun', async ({
  page,
}) => {
  await openGame(page);
  const result = await page.evaluate(() => {
    const d = window.__db;
    const [p] = d.fixtureYouth('yamcha');
    p.startSpecial();
    p.youth.wolfUntil = d.game.simTime + 0.25;
    p.ki = 0;
    const info = d.skillAvailability(p, 0, { cancel: true });
    const started = p.startSpecial();
    const move = p.attack.name;
    p.youth.wolfUntil = d.game.simTime + 0.25;
    p.state = 'hit';
    const stopped = !p.startSpecial();
    return { cost: info.cost, available: info.available, started, move, stopped };
  });
  expect(result).toEqual({
    cost: 0,
    available: true,
    started: true,
    move: '狼牙终掌',
    stopped: true,
  });
});

test('AI world movement toward positive Z keeps pursuit while player retreat still backflips', async ({
  page,
}) => {
  await openGame(page);
  const rows = await page.evaluate(() => {
    const d = window.__db;
    return [false, true].map((isAI) => {
      const [p, e] = d.fixtureYouth('goku', 'pilaf', 6);
      p.isAI = isAI;
      e.pos.set(0, 0, 6);
      d.tick({ down: true, actions: [{ type: 'pursuit', down: false }] });
      return { isAI, kind: p.dashKind, ki: p.ki };
    });
  });
  expect(rows[0]).toMatchObject({ kind: 'backflip', ki: 88 });
  expect(rows[1]).toMatchObject({ kind: 'pursuit', ki: 88 });
});

test('returning blade reaches a moving owner away from origin and emits real return feedback', async ({
  page,
}) => {
  await openGame(page);
  const result = await page.evaluate(() => {
    const d = window.__db;
    const [p] = d.fixtureYouth('chichi', 'goku', 8);
    p.pos.set(7, 0, 3);
    p.startSpecial();
    d.releaseYouthAbility(p, p.attack);
    const blade = d.v2Projectiles.find((b) => b.kind === 'blade');
    blade.returning = true;
    const target = p.pos.clone();
    target.y += d.stature(p);
    blade.pos.copy(target).x += 0.3;
    // One simulation step travels past the old 0.25m threshold at this speed.
    d.updateV2Abilities(0.04);
    return {
      returned: !p.v2.bladeOut && !d.v2Projectiles.includes(blade),
      event: d.combatEvents.history.some((e) => e.type === 'bladeReturn'),
      owner: p.pos.toArray(),
    };
  });
  expect(result).toEqual({ returned: true, event: true, owner: [7, 0, 3] });
});

test('flight uses character capabilities for every body and expires within the documented two seconds', async ({
  page,
}) => {
  await openGame(page);
  const rows = await page.evaluate(() => {
    const d = window.__db;
    return ['goku', 'tien', 'piccolo', 'chiaotzu', 'krillin'].map((id) => {
      const [p] = d.fixtureYouth(id, 'pilaf', 8);
      for (let n = 0; n < 60; n++) d.tick({ flight: true });
      const airborne = p.flightMode && p.pos.y > 0.1;
      for (let n = 0; n < 181; n++) d.tick({ flight: true });
      const locked = !!p.airLocked;
      for (let n = 0; n < 600; n++) d.tick();
      return { id, airborne, locked, landed: p.pos.y === 0 && !p.flightMode };
    });
  });
  for (const row of rows)
    expect(row, row.id).toMatchObject({
      airborne: row.id !== 'krillin',
      locked: row.id !== 'krillin',
      landed: true,
    });
});

test('authored technology ultimate reaches stage impact once instead of being suppressed by anatomy', async ({
  page,
}) => {
  await openGame(page);
  const result = await page.evaluate(() => {
    const d = window.__db;
    const [p] = d.fixtureYouth('chichi', 'goku', 8);
    const before = d.map.damageEvents;
    p.startUlt();
    const attack = p.attack;
    for (let n = 0; n < 300 && !p.stageFired; n++) d.tick();
    return {
      fired: p.stageFired,
      active: attack.activeFired,
      released: attack.v2Released,
      impacts: d.map.damageEvents - before,
    };
  });
  expect(result).toEqual({ fired: true, active: true, released: true, impacts: 1 });
});

test('old control-to-blast shortcut cannot bypass authored cancel restrictions', async ({
  page,
}) => {
  await openGame(page);
  const result = await page.evaluate(() => {
    const d = window.__db;
    const [p, e] = d.fixtureYouth('chiaotzu', 'pilaf', 2);
    p.startSpecial();
    const attack = p.attack;
    p.hasHit = true;
    p.hitResult = 'hit';
    p.stateTimer = attack.hitT + 0.06;
    p.captureInput({ actions: [{ type: 'blast' }] });
    const ki = p.ki;
    p.updateAttack(d.STEP, e, {});
    return { sameAttack: p.attack === attack, kiUnchanged: p.ki === ki, control: attack.control };
  });
  expect(result.control).toBeGreaterThan(0);
  expect(result).toMatchObject({ sameAttack: true, kiUnchanged: true });
});

test('equipment projectiles use the selected stage extent instead of the old sixteen-metre limit', async ({
  page,
}) => {
  await openGame(page);
  const result = await page.evaluate(() => {
    const d = window.__db;
    const [p, e] = d.fixtureYouth('chichi', 'goku', 8);
    d.map.bounds = { x: 35, z: 34 };
    p.pos.set(20, 0, 20);
    e.pos.set(-20, 0, -20);
    p.startSpecial();
    d.releaseYouthAbility(p, p.attack);
    const blade = d.v2Projectiles.find((b) => b.kind === 'blade');
    d.updateV2Abilities(d.STEP);
    return { active: d.v2Projectiles.includes(blade), x: blade.pos.x, z: blade.pos.z };
  });
  expect(result.active).toBe(true);
  expect(result.x).toBeGreaterThan(16);
  expect(result.z).toBeGreaterThan(10);
});
