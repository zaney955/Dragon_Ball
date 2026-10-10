import { test, expect } from '@playwright/test';

async function openGame(page) {
  await page.addInitScript(() => (window.requestAnimationFrame = () => 0));
  await page.goto('/?test=1');
  await page.waitForFunction(() => window.__db?.fixtureYouth && window.__db?.tick, null, {
    polling: 100,
  });
}

test('afterimages teleport behind melee and ranged attackers, expire at 200ms and have round-specific limits', async ({
  page,
}) => {
  await openGame(page);
  const result = await page.evaluate(() => {
    const d = window.__db,
      rows = [];
    for (const id of d.CHARACTERS.map((c) => c.id)) {
      const [p, e] = d.fixtureYouth(id, 'goku', 4);
      const max = p.escapeCharges;
      p.state = 'hit';
      p.stunTime = 1;
      const origin = p.pos.clone(),
        enemyForward = e.forward();
      d.tick({ actions: [{ type: 'evasion' }] });
      const behind = p.pos.clone().sub(e.pos).dot(enemyForward) < -0.5;
      const images = d.getEffects().filter((x) => x.type === 'afterimage');
      const imageAtOrigin = images.some((x) => Math.abs(x.mesh.position.x - origin.x) < 1);
      d.updateEffects(0.19);
      const retained = images.some((x) => d.getEffects().includes(x));
      d.updateEffects(0.011);
      const expired = images.every((x) => !d.getEffects().includes(x));
      e.pos.x = -8;
      p.pos.x = 8;
      for (let n = 0; n < 1190; n++) d.tick();
      const beforeTen = p.escapeCharges;
      for (let n = 0; n < 20; n++) d.tick();
      rows.push({
        id,
        max,
        behind,
        imageAtOrigin,
        retained,
        expired,
        beforeTen,
        afterTen: p.escapeCharges,
      });
    }
    const [p, e] = d.fixtureYouth('roshi', 'goku', 4);
    e.startKiBlast();
    for (let n = 0; n < 160 && p.state !== 'hit'; n++) d.tick();
    const rangedHit = p.state === 'hit';
    d.tick({ actions: [{ type: 'evasion' }] });
    return { rows, rangedHit, rangedBehind: p.pos.clone().sub(e.pos).dot(e.forward()) < -0.5 };
  });
  for (const row of result.rows) {
    expect(row, row.id).toMatchObject({
      max: row.id === 'goku' ? 3 : row.id === 'yamcha' ? 1 : 2,
      behind: true,
      imageAtOrigin: true,
      retained: true,
      expired: true,
    });
    expect(row.beforeTen, row.id).toBe(row.max - 1);
    expect(row.afterTen, row.id).toBe(row.id === 'yamcha' ? 1 : row.max - 1);
  }
  expect(result.rangedHit).toBe(true);
  expect(result.rangedBehind).toBe(true);
});

test('passive energy, random rock-paper-scissors, automatic moon transformation and ape armor skills', async ({
  page,
}) => {
  await openGame(page);
  const result = await page.evaluate(() => {
    const d = window.__db;
    let [p, e] = d.fixtureYouth('pilaf', 'goku', 8);
    p.ki = 10;
    p.state = 'hit';
    p.stunTime = 3;
    for (let n = 0; n < 120; n++) d.tick();
    const passive = p.ki;
    [p, e] = d.fixtureYouth('goku', 'krillin', 1);
    const choices = new Set(),
      damage = [];
    for (let n = 0; n < 90; n++) {
      p.state = 'idle';
      p.attack = null;
      p.youth.cooldowns[1] = 0;
      p.ki = 100;
      p.startSpecial({ down: true });
      choices.add(p.attack.name);
      damage.push({ dmg: p.attack.dmg, ki: p.ki });
    }
    const contacts = [];
    for (let n = 0; n < 36; n++) {
      const [a, b] = d.fixtureYouth('goku', ['goku', 'chiaotzu', 'gyumao'][n % 3], 1.2);
      d.setCombatSeed((0x9e3779b9 * (n + 1)) >>> 0);
      a.startSpecial({ down: true });
      const name = a.attack.name;
      for (let t = 0; t < 180; t++) d.tick();
      contacts.push({ name, target: b.def.id, damage: b.maxHp - b.hp });
    }
    [p, e] = d.fixtureYouth('goku', 'krillin', 1);
    p.attack = null;
    p.state = 'idle';
    e.pos.x = 8;
    p.hp = p.maxHp * 0.49;
    for (let n = 0; n < 150; n++) d.tick();
    const daylight = !p.youth.form;
    d.game.lightPreset = 'moon';
    p.hp = p.maxHp * 0.5;
    d.tick();
    const threshold = !p.attack;
    p.hp -= 1;
    p.ki = 0;
    d.tick();
    const animation = p.attack?.autoApe && p.attack.startup === 1;
    for (let n = 0; n < 140; n++) d.tick();
    const automatic = p.youth.form === 'ape' && p.youth.apeUsed && p.ki < 2;
    const skills = [];
    for (const kind of ['heavy', 'primary', 'secondary', 'ult']) {
      p.attack = null;
      p.state = 'idle';
      p.ki = 100;
      p.youth.cooldowns = [0, 0];
      if (kind === 'heavy') p.startAttack('heavy');
      else if (kind === 'ult') p.startUlt();
      else p.startSpecial({ down: kind === 'secondary' });
      const a = p.attack;
      p.takeHit(e, { ...e.def.combos.light[0], dmg: 10 });
      skills.push({ kind, slow: a.startup >= 0.4, armor: a.superArmor, preserved: p.attack === a });
    }
    return {
      passive,
      contacts,
      choices: [...choices],
      damage,
      daylight,
      threshold,
      animation,
      automatic,
      skills,
    };
  });
  expect(result.passive).toBeCloseTo(13, 5);
  expect(result.choices.sort()).toEqual(['猜拳·剪刀', '猜拳·布', '猜拳·石头'].sort());
  expect(result.damage.every((x) => x.dmg === 30 && x.ki === 60)).toBe(true);
  expect(result.contacts.filter((x) => x.damage <= 0)).toEqual([]);
  expect(new Set(result.contacts.map((x) => x.name)).size).toBe(3);
  expect(result).toMatchObject({
    daylight: true,
    threshold: true,
    animation: true,
    automatic: true,
  });
  expect(result.skills.every((s) => s.slow && s.armor && s.preserved)).toBe(true);
});

test('roshi muscle buffs and weakness, assassin back attacks and once-per-match regeneration', async ({
  page,
}) => {
  await openGame(page);
  const result = await page.evaluate(() => {
    const d = window.__db;
    let [p] = d.fixtureYouth('roshi', 'goku', 8);
    const speedBefore = d.mobilitySpeed(p);
    p.startSpecial({ down: true });
    d.releaseYouthAbility(p, p.attack);
    const speedBuff = d.mobilitySpeed(p) / speedBefore;
    p.attack = null;
    p.state = 'idle';
    p.startAttack('light');
    const buff = p.attack.dmg / p.def.combos.light[0].dmg;
    p.ki = 20;
    d.tickYouthFighter(p, 1);
    const drain = p.ki;
    d.endYouthForm(p);
    const weakness = p.youth.weakTime === 2 && p.state === 'landing' && p.stunTime === 2;
    const damages = [];
    for (const back of [false, true]) {
      const [a, b] = d.fixtureYouth('taopaipai', 'goku', 1);
      b.facingAngle = back ? Math.PI / 2 : -Math.PI / 2;
      b.takeHit(a, { ...a.def.combos.light[0], dmg: 20, kb: 0 });
      damages.push(b.maxHp - b.hp);
    }
    let [pic, foe] = d.fixtureYouth('piccolo', 'goku', 8);
    pic.hp = 1;
    pic.ki = 50;
    pic.takeHit(foe, { ...foe.def.combos.light[0], dmg: 100, kb: 0 });
    const regen = {
      hp: pic.hp,
      expected: pic.maxHp * 0.1,
      ki: pic.ki,
      used: pic.youth.regenerated,
    };
    pic.state = 'idle';
    pic.attack = null;
    pic.ki = 100;
    const ultBlocked = !pic.startUlt();
    d.game.keepPair = true;
    d.startFight();
    const persists = d.player.youth.regenerated;
    pic = d.player;
    foe = d.enemy;
    pic.hp = 1;
    pic.ki = 100;
    pic.invulnerable = 0;
    pic.takeHit(foe, { ...foe.def.combos.light[0], dmg: 100, kb: 0 });
    const once = pic.hp === 0;
    [pic, foe] = d.fixtureYouth('piccolo', 'goku', 8);
    pic.hp = 1;
    pic.ki = 49;
    pic.takeHit(foe, { ...foe.def.combos.light[0], dmg: 100, kb: 0 });
    const charge = [];
    for (const regenerated of [false, true]) {
      const [f] = d.fixtureYouth('piccolo', 'goku', 8);
      f.ki = 0;
      f.youth.regenerated = regenerated;
      for (let n = 0; n < 120; n++) d.tick({ charge: true });
      charge.push(f.ki);
    }
    return {
      buff,
      speedBuff,
      charge,
      drain,
      weakness,
      damages,
      regen,
      ultBlocked,
      persists,
      once,
      insufficient: pic.hp === 0,
    };
  });
  expect(result.buff).toBeCloseTo(1.3, 5);
  expect(result.speedBuff).toBeCloseTo(1.3, 5);
  expect(result.charge[1] / result.charge[0]).toBeCloseTo(0.5, 5);
  expect(result.drain).toBe(15);
  expect(result.weakness).toBe(true);
  expect(result.damages[1] / result.damages[0]).toBeCloseTo(1.5, 5);
  expect(result.regen.hp).toBe(result.regen.expected);
  expect(result.regen).toMatchObject({ ki: 0, used: true });
  expect(result).toMatchObject({
    ultBlocked: true,
    persists: true,
    once: true,
    insufficient: true,
  });
});

test('four arms speed and duration, kikoho tradeoff, third eye frequency and perfect guard counter', async ({
  page,
}) => {
  await openGame(page);
  const result = await page.evaluate(() => {
    const d = window.__db;
    let [p, e] = d.fixtureYouth('tien', 'goku', 8);
    p.startSpecial({ down: true });
    d.releaseYouthAbility(p, p.attack);
    p.attack = null;
    p.state = 'idle';
    p.startAttack('light');
    const speed = p.def.combos.light[0].dur / p.attack.dur;
    const duration = p.youth.formTime;
    p.attack = null;
    p.state = 'idle';
    p.ki = 100;
    const hp = p.hp;
    p.startUlt();
    const lifeCost = (hp - p.hp) / p.maxHp;
    const damage = p.def.ult.dmg;
    d.endYouthForm(p, false);
    let procs = 0,
      chargesPreserved = true;
    for (let n = 0; n < 10000; n++) {
      p.hp = p.maxHp;
      p.invulnerable = 0;
      p.state = 'idle';
      p.attack = null;
      p.receivedCombo = 0;
      p.launchFlight = false;
      const charges = p.escapeCharges;
      p.takeHit(e, { ...e.def.combos.light[0], dmg: 1, kb: 0 });
      if (p.lastHitText === '第三只眼 · 自动残像') procs++;
      chargesPreserved &&= p.escapeCharges === charges;
      d.updateEffects(0.3);
    }
    [p, e] = d.fixtureYouth('tien', 'goku', 1);
    d.setCombatSeed(1);
    p.takeHit(e, e.def.throwMove);
    const throwDodged = !p.throwPending && p.lastHitText === '第三只眼 · 自动残像';
    [p, e] = d.fixtureYouth('tien', 'goku', 8);
    p.hp = p.maxHp * 0.1;
    p.startUlt();
    const lowLifeCost = p.hp === 0 && p.ki === 0;
    d.tick();
    const selfDefeated = p.state === 'dead' && !p.attack;
    [p, e] = d.fixtureYouth('krillin', 'goku', 1);
    p.state = 'block';
    p.guardHeld = 0;
    p.takeHit(e, e.def.combos.light[0]);
    const counter = p.attack?.counterResponse && p.attack.name === '完美防御·自动反击';
    for (let n = 0; n < 100; n++) d.tick();
    return {
      speed,
      duration,
      lifeCost,
      damage,
      procs,
      chargesPreserved,
      throwDodged,
      lowLifeCost,
      selfDefeated,
      counter,
      counterDamage: e.maxHp - e.hp,
    };
  });
  expect(result.speed).toBeCloseTo(1.3, 5);
  expect(result.duration).toBe(10);
  expect(result.lifeCost).toBeCloseTo(0.2, 5);
  expect(result.damage).toBe(186);
  expect(result.procs).toBeGreaterThan(240);
  expect(result.procs).toBeLessThan(360);
  expect(result.chargesPreserved).toBe(true);
  expect(result.throwDodged).toBe(true);
  expect(result.lowLifeCost).toBe(true);
  expect(result.selfDefeated).toBe(true);
  expect(result.counter).toBe(true);
  expect(result.counterDamage).toBeGreaterThan(0);
});

test('yamcha protection, ox fire damage and immunity, chichi F-only resistance and psychic drain', async ({
  page,
}) => {
  await openGame(page);
  const result = await page.evaluate(() => {
    const d = window.__db,
      protection = [];
    for (const id of ['goku', 'yamcha']) {
      const [p, e] = d.fixtureYouth(id, 'krillin', 1);
      let hits = 0;
      while (!p.launchFlight && hits < 8) {
        p.takeHit(e, { ...e.def.combos.light[0], dmg: 1, kb: 0 });
        hits++;
      }
      protection.push({ id, hits, speed: p.vel.length() });
    }
    let [ox, e] = d.fixtureYouth('gyumao', 'goku', 1.2);
    ox.startAttack('heavy');
    d.releaseYouthAbility(ox, ox.attack);
    const fire = d.youthEntities.find((x) => x.kind === 'fire');
    e.pos.copy(fire.pos);
    const hp = e.hp;
    ox.pos.copy(fire.pos);
    const oxHp = ox.hp;
    ox.attack = null;
    ox.state = 'idle';
    e.attack = null;
    e.state = 'idle';
    for (let n = 0; n < 120; n++) {
      d.updateYouthEntities(d.STEP);
      d.game.simTime += d.STEP;
    }
    const burn = hp - e.hp,
      immune = ox.hp === oxHp;
    ox.takeHit(e, { ...e.def.combos.light[0], dmg: 100, fireDamage: true });
    const flameImmune = ox.hp === oxHp;
    const damages = [];
    for (const kind of ['F', 'skill', 'ult']) {
      const [a, b] = d.fixtureYouth('goku', 'chichi', 2);
      b.takeHit(a, {
        ...a.def.combos.light[0],
        dmg: 20,
        equipment: kind === 'F' ? 'ki' : undefined,
        projectile: true,
        isUlt: kind === 'ult',
      });
      damages.push(b.maxHp - b.hp);
    }
    let [p, target] = d.fixtureYouth('chiaotzu', 'goku', 2);
    p.ki = 20;
    target.ki = 50;
    d.applyControl(p, target, { control: 1.15 });
    d.tickYouthFighter(p, 1);
    const drain = { own: p.ki, target: target.ki };
    target.v2.controlTime = 0;
    d.tickYouthFighter(p, 1);
    return {
      protection,
      fire: !!fire,
      burn,
      immune,
      flameImmune,
      damages,
      drain,
      stopped: target.ki === drain.target,
    };
  });
  expect(result.protection[0]).toMatchObject({ hits: 6, speed: 11.5 });
  expect(result.protection[1]).toMatchObject({ hits: 4, speed: 15 });
  expect(result.fire).toBe(true);
  expect(result.burn).toBeCloseTo(2, 5);
  expect(result.immune && result.flameImmune).toBe(true);
  expect(result.damages[0] * 2).toBeCloseTo(result.damages[1], 5);
  expect(result.damages[1]).toBe(result.damages[2]);
  expect(result.drain).toEqual({ own: 32, target: 38 });
  expect(result.stopped).toBe(true);
});

test('capsules include all five functional effects, oolong copies every other ultimate and korin stores enhanced beans', async ({
  page,
}) => {
  await openGame(page);
  const result = await page.evaluate(() => {
    const d = window.__db,
      effects = new Set(),
      forms = new Set(),
      copied = [],
      finished = [];
    let [p] = d.fixtureYouth('bulma', 'goku', 8);
    for (let n = 0; n < 100; n++) {
      d.releaseYouthAbility(p, p.def.skills[0]);
      effects.add(p.youth.capsule);
      if (p.youth.capsule === 'mech') forms.add(p.youth.form);
      d.cleanupYouthEntities(p);
    }
    for (let n = 0; n < 100; n++) {
      const [o, e] = d.fixtureYouth('oolong', 'gyumao', 1);
      d.setCombatSeed((0x9e3779b9 * (n + 1)) >>> 0);
      e.hp = 10000;
      o.startUlt();
      d.releaseYouthAbility(o, o.attack);
      const form = o.youth.form;
      const id = form.slice(6),
        target = d.CHARACTERS.find((c) => c.id === id);
      copied.push({ id, name: o.attack.name, expected: target.ult.name, cost: o.ki });
      for (let t = 0; t < 600; t++) d.tick();
      finished.push(!o.youth.form && e.hp < 10000);
    }
    [p] = d.fixtureYouth('korin', 'goku', 8);
    const initial = p.youth.heals;
    d.game.matchRule = 'senzu';
    const bean = d.map.senzus[0];
    bean.active = true;
    bean.x = p.pos.x;
    bean.z = p.pos.z;
    bean.expiresAt = Infinity;
    d.updateSenzu(d.STEP);
    const stored = p.youth.heals;
    bean.active = true;
    d.updateSenzu(d.STEP);
    const cap = p.youth.heals === 2 && bean.active;
    bean.active = false;
    p.hp = p.maxHp * 0.5;
    p.startSpecial({ down: true });
    d.releaseYouthAbility(p, p.attack);
    const heal = p.hp / p.maxHp - 0.5;
    return {
      effects: [...effects],
      forms: [...forms],
      copied,
      finished,
      initial,
      stored,
      cap,
      heal,
      left: p.youth.heals,
    };
  });
  expect(result.effects.sort()).toEqual(
    ['mech', 'tranquilizer', 'bomb', 'hoverboard', 'rpg'].sort(),
  );
  expect(result.forms).toEqual(['capsuleMech']);
  expect(new Set(result.copied.map((x) => x.id)).size).toBe(13);
  expect(
    result.copied.every((x) => x.id !== 'oolong' && x.name === x.expected && x.cost === 0),
  ).toBe(true);
  expect(result.finished.every(Boolean)).toBe(true);
  expect(result).toMatchObject({ initial: 1, stored: 2, cap: true, left: 1 });
  expect(result.heal).toBeCloseTo(0.195, 5);
});

test('new character flags, capsule forms, mimic ultimates and fire survive authoritative save and replay', async ({
  page,
}) => {
  await openGame(page);
  const rows = await page.evaluate(() => {
    const d = window.__db,
      rows = [];
    for (const scenario of ['regeneration', 'capsuleMech', 'mimic', 'fire', 'stock']) {
      const [p] = d.fixtureYouth(
        scenario === 'regeneration'
          ? 'piccolo'
          : scenario === 'capsuleMech'
            ? 'bulma'
            : scenario === 'mimic'
              ? 'oolong'
              : scenario === 'fire'
                ? 'gyumao'
                : 'korin',
        'goku',
        8,
      );
      p.escapeCharges = Math.max(0, p.escapeMax - 1);
      if (scenario === 'regeneration') {
        p.youth.regenerated = true;
        p.ki = 25;
      }
      if (scenario === 'capsuleMech') {
        d.setYouthBody(p, 'capsuleMech');
        p.youth.capsule = 'mech';
        p.youth.formTime = p.youth.capsuleTime = 8;
      }
      if (scenario === 'mimic') {
        p.startUlt();
        d.releaseYouthAbility(p, p.attack);
      }
      if (scenario === 'fire') {
        p.startAttack('heavy');
        d.releaseYouthAbility(p, p.attack);
      }
      if (scenario === 'stock') p.youth.heals = 2;
      const snapshot = JSON.parse(JSON.stringify(d.captureBattleState()));
      const restored = d.restoreBattleState(snapshot);
      const equal = restored === d.battleStateDigest(snapshot);
      for (let n = 0; n < 30; n++) d.tick();
      const expected = d.battleStateDigest(d.captureBattleState());
      d.restoreBattleState(snapshot);
      for (let n = 0; n < 30; n++) d.tick();
      rows.push({
        scenario,
        equal,
        replay: d.battleStateDigest(d.captureBattleState()) === expected,
      });
    }
    return rows;
  });
  for (const row of rows) expect(row, row.scenario).toMatchObject({ equal: true, replay: true });
});
