import { test, expect } from '@playwright/test';

async function openGame(page) {
  await page.addInitScript(() => (window.requestAnimationFrame = () => 0));
  await page.goto('/?test=1');
  await page.waitForFunction(() => window.__db?.fixtureYouth && window.__db?.tick);
}

test('every fighter advances all light and heavy animations through real queued inputs', async ({
  page,
}) => {
  await openGame(page);
  const rows = await page.evaluate(() => {
    const db = window.__db;
    const rows = [];
    for (const c of db.CHARACTERS) {
      for (const type of ['light', 'heavy']) {
        for (const distance of [8, c.id === 'gyumao' ? (type === 'heavy' ? 2 : 0.85) : 1]) {
          const [p, e] = db.fixtureYouth(c.id, 'goku', distance);
          const seen = new Set();
          const hitStages = new Set();
          for (let tick = 0; tick < 900; tick++) {
            const previous = p.attack;
            const hp = e.hp;
            db.tick(tick % 12 === 0 ? { actions: [{ type }] } : {});
            db.game.hitStop = 0;
            if (p.attack?.chainType === type) seen.add(p.attack.id);
            if (e.hp < hp && previous?.chainType === type) hitStages.add(previous.id);
            if (seen.size === c.combos[type].length && !p.attack) break;
          }
          rows.push({
            id: c.id,
            type,
            distance,
            seen: [...seen],
            expected: c.combos[type].map((a) => a.id),
            hitStages: [...hitStages],
          });
        }
      }
    }
    return rows;
  });
  const failures = rows.filter(
    (row) =>
      JSON.stringify(row.seen) !== JSON.stringify(row.expected) ||
      (row.distance < 8 && JSON.stringify(row.hitStages) !== JSON.stringify(row.expected)),
  );
  expect(failures).toEqual([]);
});

test('ox king armor survives repeated hits throughout every heavy, skill and ultimate', async ({
  page,
}) => {
  await openGame(page);
  const failures = await page.evaluate(() => {
    const db = window.__db,
      failures = [];
    const kinds = ['light', 'low', 'launcher', 'throw', 'projectile', 'ult', 'control'];
    for (const move of [
      'heavy1',
      'heavy2',
      'heavy3',
      'heavy4',
      'heavy5',
      'up',
      'down',
      'skill0',
      'skill1',
      'ult',
    ]) {
      for (const phase of ['startup', 'active', 'recovery']) {
        const [ox, foe] = db.fixtureYouth('gyumao', 'goku', 8);
        if (move.startsWith('heavy')) {
          for (let i = 0; i < Number(move.at(-1)); i++) ox.startAttack('heavy');
        } else if (['up', 'down'].includes(move)) ox.startAttack('heavy', { [move]: true });
        else if (move === 'ult') ox.startUlt();
        else ox.startSpecial({ variant: Number(move.at(-1)) });
        const a = ox.attack;
        ox.stateTimer =
          phase === 'startup' ? 0.01 : phase === 'active' ? a.hitT + 0.02 : a.dur - 0.02;
        const timer = ox.stateTimer,
          state = ox.state,
          velocity = ox.vel.toArray();
        ox.hp = 1000;
        for (const kind of kinds) {
          const hp = ox.hp;
          ox.takeHit(foe, {
            ...foe.def.combos.light[0],
            dmg: 10,
            kb: 4,
            control: kind === 'control' ? 1 : 0,
            launch: kind === 'launcher' ? 6 : undefined,
            knockdown: true,
            isThrow: kind === 'throw',
            projectile: kind === 'projectile',
            isUlt: kind === 'ult',
            level: kind === 'low' ? 'low' : 'mid',
          });
          const expected = Math.round(10 * foe.def.power * 0.6 * 10) / 10;
          if (
            Math.abs(hp - ox.hp - expected) > 1e-6 ||
            ox.attack !== a ||
            ox.stateTimer !== timer ||
            ox.state !== state ||
            ox.throwPending ||
            ox.launchFlight ||
            ox.v2.controlTime ||
            ox.vel.toArray().some((v, i) => v !== velocity[i])
          )
            failures.push({ move, phase, kind, damage: hp - ox.hp, expected, state: ox.state });
        }
      }
    }
    const [ox, foe] = db.fixtureYouth('gyumao');
    ox.startAttack('light');
    ox.takeHit(foe, foe.def.combos.light[0]);
    if (ox.attack || ox.state !== 'hit') failures.push({ lightMustBeInterruptible: true });
    return failures;
  });
  expect(failures).toEqual([]);
});

test('solar flare reverses directions and action contexts, expires and respects failed hits', async ({
  page,
}) => {
  await openGame(page);
  const result = await page.evaluate(() => {
    const db = window.__db;
    const [tien, foe] = db.fixtureYouth('tien', 'goku', 2);
    tien.startSpecial();
    db.releaseYouthAbility(tien, tien.attack);
    const initial = foe.youth.reversedTime;
    // Recover the short blind stun naturally before checking keyboard movement.
    for (let i = 0; i < 70; i++) db.tick();
    const origin = foe.pos.clone();
    for (let i = 0; i < 15; i++) db.tick({}, { up: true, moveYaw: 0 });
    const movedBackward = foe.pos.z < origin.z;
    foe.captureInput({ actions: [{ type: 'heavy', up: true, down: false }] });
    const reversedAction = foe.queue.at(-1).context;
    for (let i = 0; i < 400; i++) db.tick();
    const expired = foe.youth.reversedTime === 0;
    const normalOrigin = foe.pos.clone();
    for (let i = 0; i < 15; i++) db.tick({}, { up: true, moveYaw: 0 });
    const movedForward = foe.pos.z > normalOrigin.z;
    const misses = [];
    for (const kind of ['range', 'back', 'block', 'invulnerable']) {
      const [p, e] = db.fixtureYouth('tien', 'goku', kind === 'range' ? 8 : 2);
      if (kind === 'back') e.facingAngle = Math.PI / 2;
      if (kind === 'block') e.state = 'block';
      if (kind === 'invulnerable') e.invulnerable = 1;
      p.startSpecial();
      db.releaseYouthAbility(p, p.attack);
      misses.push(e.youth.reversedTime);
    }
    return { initial, movedBackward, reversedAction, expired, movedForward, misses };
  });
  expect(result).toEqual({
    initial: 3,
    movedBackward: true,
    reversedAction: { up: false, down: true },
    expired: true,
    movedForward: true,
    misses: [0, 0, 0, 0],
  });
});

test('short recovery gaps remain one received combo and trigger six-hit separation', async ({
  page,
}) => {
  await openGame(page);
  const result = await page.evaluate(() => {
    const db = window.__db,
      counts = [];
    const [p, e] = db.fixtureYouth('goku', 'gyumao', 1);
    for (let hit = 0; hit < 6; hit++) {
      e.takeHit(p, {
        ...p.def.combos.light[0],
        stun: 0.1,
        launch: undefined,
        knockdown: false,
        kb: 0,
      });
      counts.push(e.receivedCombo);
      if (hit < 5) for (let i = 0; i < 50; i++) db.tick();
    }
    const protectedLaunch = e.launchFlight && e.launchReason === 'combo';
    return { counts, protectedLaunch };
  });
  expect(result.counts.slice(0, 5)).toEqual([1, 2, 3, 4, 5]);
  expect(result.protectedLaunch).toBe(true);
});

test('goku pole visibly extends, swings down, retracts and matches its collision endpoints', async ({
  page,
}) => {
  await openGame(page);
  const result = await page.evaluate(() => {
    const db = window.__db,
      [p] = db.fixtureYouth('goku', 'piccolo', 2.4);
    p.startSpecial();
    const a = p.attack,
      samples = [];
    for (const t of [0, a.hitT * 0.75, a.hitT, a.hitT + a.active, a.dur - 0.02]) {
      p.stateTimer = t;
      p.render(1, 1);
      p.root.updateMatrixWorld(true);
      const rig = db.sampleCombatRig(p);
      const tip = p.parts.staff.localToWorld(p.pos.clone().set(0, -1.25, 0));
      const grip = p.parts.staff.localToWorld(p.pos.clone().set(0, 1.25, 0));
      samples.push({
        length: tip.distanceTo(grip),
        tipY: tip.y,
        gripY: grip.y,
        error: Math.max(tip.distanceTo(rig.hit[0].b), grip.distanceTo(rig.hit[0].a)),
        visible: p.parts.staff.visible,
      });
    }
    return { motion: a.motion, samples };
  });
  expect(result.motion).toBe('staffSmash');
  for (const s of result.samples) {
    expect(s.visible).toBe(true);
    expect(s.error).toBeLessThan(1e-6);
  }
  expect(result.samples[1].length).toBeGreaterThan(result.samples[0].length * 2);
  expect(result.samples[1].tipY).toBeGreaterThan(result.samples[2].tipY);
  expect(result.samples[3].tipY).toBeLessThan(result.samples[2].tipY);
  expect(result.samples.at(-1).length).toBeLessThan(result.samples[1].length / 2);
});

test('goku overhead staff and extension contact short, normal and tall targets', async ({
  page,
}) => {
  await openGame(page);
  const failures = await page.evaluate(() => {
    const db = window.__db,
      failures = [];
    for (const target of ['chiaotzu', 'goku', 'gyumao', 'piccolo']) {
      for (const type of ['heavy', 'special']) {
        for (const distance of type === 'special' ? [0.55, 1, 2.4, 3.2] : [1]) {
          const [p, e] = db.fixtureYouth('goku', target, distance);
          if (type === 'heavy') {
            p.comboType = 'heavy';
            p.comboIdx = p.def.combos.heavy.length - 2;
            p.comboTimer = 1;
            p.startAttack('heavy');
          } else p.startSpecial();
          const a = p.attack;
          for (let i = 0; i < Math.ceil(a.dur / db.STEP) + 2; i++) {
            db.tick();
            db.game.hitStop = 0;
          }
          if (e.hp === e.maxHp) failures.push({ target, type, distance });
        }
      }
    }
    return failures;
  });
  expect(failures).toEqual([]);
});

test('late inputs can continue every fighter chain after full recovery', async ({ page }) => {
  await openGame(page);
  const failures = await page.evaluate(() => {
    const db = window.__db,
      failures = [];
    for (const c of db.CHARACTERS) {
      for (const type of ['light', 'heavy']) {
        const [p] = db.fixtureYouth(c.id, 'goku', 8);
        db.tick({ actions: [{ type }] });
        const a = p.attack;
        for (let i = 0; i < Math.ceil((a.dur + 0.3) / db.STEP); i++) {
          db.tick();
          db.game.hitStop = 0;
        }
        const recovered = !p.attack && p.state === 'idle';
        db.tick({ actions: [{ type }] });
        if (!recovered || p.attack?.id !== c.combos[type][1].id)
          failures.push({ id: c.id, type, stage: p.attack?.id });
      }
    }
    return failures;
  });
  expect(failures).toEqual([]);
});

test('ox king armor survives parries, counterattacks and control but can still be defeated', async ({
  page,
}) => {
  await openGame(page);
  const result = await page.evaluate(() => {
    const db = window.__db;
    let [ox, roshi] = db.fixtureYouth('gyumao', 'roshi', 1);
    ox.startAttack('heavy');
    let a = ox.attack;
    roshi.state = 'block';
    roshi.guardHeld = 0;
    roshi.takeHit(ox, a);
    const parryProtected = ox.attack === a && ox.state === 'attack';
    [ox, roshi] = db.fixtureYouth('gyumao', 'roshi', 1);
    ox.startAttack('heavy');
    a = ox.attack;
    roshi.startSpecial();
    roshi.stateTimer = roshi.attack.hitT + 0.01;
    roshi.takeHit(ox, a);
    const counterProtected = ox.attack === a && !ox.launchFlight && ox.hp < ox.maxHp;
    const controlled = db.applyControl(roshi, ox, { control: 1 });
    ox.hp = 1;
    ox.takeHit(roshi, { ...roshi.def.combos.light[0], dmg: 50 });
    db.tick();
    return {
      parryProtected,
      counterProtected,
      controlled,
      defeated: ox.hp === 0 && ox.state === 'dead' && ox.attack === null,
    };
  });
  expect(result).toEqual({
    parryProtected: true,
    counterProtected: true,
    controlled: false,
    defeated: true,
  });
});

test('all fighters have two real life bars and consume the pale reserve after the first bar', async ({
  page,
}) => {
  await openGame(page);
  const rows = await page.evaluate(() => {
    const d = window.__db,
      rows = [];
    for (const c of d.CHARACTERS) {
      const [p, e] = d.fixtureYouth(c.id, 'goku', 8);
      const max = p.maxHp;
      const widths = [],
        splitWidths = [];
      for (const fraction of [1, 0.75, 0.5, 0.25, 0]) {
        p.hp = max * fraction;
        d.updateHUD();
        d.renderGameViews();
        splitWidths.push([
          parseFloat(document.getElementById('view1HP').style.width),
          parseFloat(document.getElementById('view1Reserve').style.width),
        ]);
        widths.push([
          parseFloat(document.getElementById('p1hp').style.width),
          parseFloat(document.getElementById('p1reserve').style.width),
        ]);
      }
      p.hp = c.hp + 1;
      p.invulnerable = 0;
      p.takeHit(e, { ...e.def.combos.light[0], dmg: 10, kb: 0 });
      for (let t = 0; t < 50; t++) d.tick();
      rows.push({
        id: c.id,
        double: max === c.hp * 2,
        widths,
        splitWidths,
        alive: p.hp > 0 && p.hp < c.hp && p.state !== 'dead',
      });
    }
    return rows;
  });
  for (const row of rows) {
    expect(row.double, row.id).toBe(true);
    expect(row.widths, row.id).toEqual([
      [100, 100],
      [50, 100],
      [0, 100],
      [0, 50],
      [0, 0],
    ]);
    expect(row.splitWidths, row.id).toEqual(row.widths);
    expect(row.alive, row.id).toBe(true);
  }
});

test('all fourteen ultimates deal worthwhile real total damage, including the ox king slam', async ({
  page,
}) => {
  await openGame(page);
  const rows = await page.evaluate(() => {
    const d = window.__db,
      rows = [];
    for (const c of d.CHARACTERS) {
      const [p, e] = d.fixtureYouth(c.id, 'gyumao', c.id === 'gyumao' ? 2.5 : 1);
      e.hp = 10000;
      const hp = e.hp;
      p.startUlt();
      for (let t = 0; t < 600; t++) {
        d.tick();
        d.game.hitStop = 0;
      }
      rows.push({ id: c.id, damage: Math.round((hp - e.hp) * 10) / 10, cost: 100 - p.ki });
    }
    return rows;
  });
  expect(rows.filter((r) => r.damage < 110 || r.damage > 250)).toEqual([]);
});

test('yamcha side step dodges real attacks and skills, teleports behind and launches a counter', async ({
  page,
}) => {
  await openGame(page);
  const rows = await page.evaluate(() => {
    const d = window.__db,
      rows = [];
    for (const kind of ['melee', 'beam', 'projectile', 'solar', 'whiff', 'throw', 'late']) {
      const [p, e] = d.fixtureYouth(
        'yamcha',
        kind === 'beam' ? 'taopaipai' : kind === 'solar' ? 'tien' : 'goku',
        kind === 'whiff' ? 8 : 1,
      );
      const hp = p.hp,
        targetHp = e.hp;
      p.startSpecial({ down: true });
      for (let i = 0; i < 6; i++) {
        d.tick();
        d.game.hitStop = 0;
      }
      if (kind === 'late') {
        for (let i = 0; i < 65; i++) {
          d.tick();
          d.game.hitStop = 0;
        }
      }
      if (kind === 'beam' || kind === 'solar') e.startSpecial();
      else if (kind === 'projectile') e.startKiBlast();
      else if (kind === 'throw') e.startThrow();
      else e.startAttack('light');
      let behind = false,
        counter = false,
        launched = false;
      for (let i = 0; i < 160; i++) {
        d.tick();
        d.game.hitStop = 0;
        if (p.attack?.youthDodgeCounter) {
          counter = true;
          behind ||= p.pos.clone().sub(e.pos).dot(e.forward()) < -0.2;
        }
        launched ||= e.launchFlight;
      }
      rows.push({
        kind,
        dodged: p.hp === hp,
        reversed: p.youth.reversedTime,
        damage: targetHp - e.hp,
        behind,
        counter,
        launched,
        result: e.hitResult,
      });
    }
    return rows;
  });
  for (const row of rows) {
    if (['melee', 'beam', 'projectile', 'solar'].includes(row.kind)) {
      expect(row, row.kind).toMatchObject({
        dodged: true,
        behind: true,
        counter: true,
        launched: true,
      });
      expect(row.damage).toBeGreaterThan(0);
      expect(row.reversed).toBe(0);
      if (row.kind === 'projectile') expect(row.result).toBe('dodged');
    } else expect(row.counter, row.kind).toBe(false);
  }
});

test('goku ape form also completes five-hit light and heavy chains', async ({ page }) => {
  await openGame(page);
  const rows = await page.evaluate(() => {
    const d = window.__db,
      rows = [];
    for (const type of ['light', 'heavy']) {
      const [p, e] = d.fixtureYouth('goku', 'goku', 1);
      d.game.lightPreset = 'moon';
      p.hp = p.maxHp * 0.25;
      p.startSpecial({ down: true });
      for (let i = 0; i < 180; i++) {
        d.tick();
        d.game.hitStop = 0;
      }
      const seen = new Set(),
        hit = new Set();
      for (let i = 0; i < 1200; i++) {
        const previous = p.attack,
          hp = e.hp;
        d.tick(i % 12 === 0 ? { actions: [{ type }] } : {});
        d.game.hitStop = 0;
        if (p.attack?.chainType === type) seen.add(p.attack.id);
        if (e.hp < hp && previous?.chainType === type) hit.add(previous.id);
        if (seen.size === 5 && !p.attack) break;
      }
      rows.push({ type, seen: [...seen], hit: [...hit] });
    }
    return rows;
  });
  for (const row of rows) {
    expect(row.seen).toEqual([1, 2, 3, 4, 5].map((i) => row.type[0] + i));
    expect(row.hit).toEqual(row.seen);
  }
});
