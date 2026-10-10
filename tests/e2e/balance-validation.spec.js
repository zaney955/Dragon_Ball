import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

async function open(page) {
  await page.addInitScript(() => (window.requestAnimationFrame = () => 0));
  await page.goto('/?test=1');
  await page.waitForFunction(() => window.__db?.fixtureYouth && window.__db?.tick, null, {
    polling: 100,
  });
}

test('fourteen fighters can confirm a hit, stop on block and cancel queued spam into a defensive decision', async ({
  page,
}) => {
  await open(page);
  const rows = await page.evaluate(() => {
    const db = window.__db,
      rows = [];
    for (const c of db.CHARACTERS)
      for (const type of ['light', 'heavy']) {
        let [p, e] = db.fixtureYouth(c.id, 'goku', c.id === 'gyumao' && type === 'heavy' ? 2 : 1);
        db.tick({ actions: [{ type }] });
        let wait = 0;
        while (!p.hitResult && wait++ < 160) {
          db.tick();
          db.game.hitStop = 0;
        }
        const confirmed = p.hitResult === 'hit';
        // A decision 150 ms after the actual contact, not a pre-buffered attack.
        for (let n = 0; n < 18; n++) {
          db.tick();
          db.game.hitStop = 0;
        }
        db.tick({ actions: [{ type }] });
        let second = false;
        for (let n = 0; n < 160; n++) {
          if (p.attack?.chainIndex === 1) second = true;
          db.tick();
          db.game.hitStop = 0;
        }
        const damage = e.maxHp - e.hp;
        const converted = db.combatEvents.history.some(
          (event) =>
            event.type === 'contact' &&
            event.side === 0 &&
            event.chainIndex === 1 &&
            !event.blocked &&
            !event.recovered,
        );
        [p, e] = db.fixtureYouth(c.id, 'goku', 1);
        const defending = { block: true, crouch: c.combos[type][0].level === 'low' };
        e.guardHeld = 0.4;
        e.wasBlocking = true;
        db.tick({ actions: [{ type }] }, defending);
        wait = 0;
        while (!p.hitResult && wait++ < 160) {
          db.tick({}, defending);
          db.game.hitStop = 0;
        }
        const blocked = p.hitResult === 'blocked';
        const serial = p.attack?.serial;
        for (let n = 0; n < 160; n++) {
          db.tick({ block: true }, defending);
          db.game.hitStop = 0;
        }
        const stopped = !p.attack && p.queue.length === 0 && p.comboType === null;
        [p] = db.fixtureYouth(c.id, 'goku', 8);
        db.tick({ actions: [{ type }] });
        p.captureInput({ actions: [{ type }, { type }, { type }] });
        const single = p.queue.length === 1;
        for (let n = 0; n < 160; n++) {
          db.tick(defending);
          db.game.hitStop = 0;
        }
        rows.push({
          id: c.id,
          type,
          confirmed,
          second,
          converted,
          damage,
          blocked,
          stopped,
          serial,
          single,
          defensive: p.state === 'block' && !p.attack,
        });
      }
    return rows;
  });
  await mkdir('performance/neutral-balance', { recursive: true });
  await writeFile('performance/neutral-balance/confirm.json', JSON.stringify(rows, null, 2));
  expect(
    rows.filter(
      (r) =>
        !r.confirmed ||
        !r.second ||
        !r.converted ||
        !r.blocked ||
        !r.stopped ||
        !r.single ||
        !r.defensive,
    ),
  ).toEqual([]);
});

test('ox king whiff can be punished through actual inputs at midrange and at the wall', async ({
  page,
}) => {
  await open(page);
  const rows = await page.evaluate(() => {
    const d = window.__db,
      rows = [];
    for (const move of ['heavy', 'skill0', 'skill1', 'ult'])
      for (const wall of [false, true]) {
        const [ox, foe] = d.fixtureYouth('gyumao', 'goku', 2.4);
        if (wall) {
          ox.pos.x = 10.8;
          foe.pos.x = 13.2;
          ox.previousPos.copy(ox.pos);
          foe.previousPos.copy(foe.pos);
        }
        if (move === 'heavy') ox.startAttack('heavy');
        else if (move === 'ult') ox.startUlt();
        else ox.startSpecial({ variant: Number(move.at(-1)) });
        const a = ox.attack;
        const ground = ['skill1', 'ult'].includes(move);
        const dodgeAt = ground ? Math.ceil((a.hitT - 0.25) / d.STEP) : 18;
        for (let n = 0; n < Math.ceil((a.hitT + a.active + 0.02) / d.STEP); n++) {
          const defense =
            n === dodgeAt
              ? ground
                ? { actions: [{ type: 'jump' }] }
                : { left: true, moveYaw: -Math.PI / 2, actions: [{ type: 'dash' }] }
              : {};
          d.tick({}, defense);
          d.game.hitStop = 0;
        }
        const avoided = foe.hp === foe.maxHp;
        for (let n = 0; n < 18; n++) {
          d.tick();
          d.game.hitStop = 0;
        }
        d.tick({}, { actions: [{ type: 'special' }] });
        for (let n = 0; n < 90; n++) {
          d.tick();
          d.game.hitStop = 0;
        }
        const contacts = d.combatEvents.history.filter(
          (e) => e.type === 'contact' && e.side === 1 && e.target === 0,
        );
        rows.push({
          move,
          wall,
          avoided,
          punished: contacts.some((e) => e.punish && !e.armored),
          damage: ox.maxHp - ox.hp,
          defenderDamage: foe.maxHp - foe.hp,
        });
      }
    return rows;
  });
  await mkdir('performance/neutral-balance', { recursive: true });
  await writeFile('performance/neutral-balance/ox-counter.json', JSON.stringify(rows, null, 2));
  expect(rows.filter((r) => !r.avoided || !r.punished)).toEqual([]);
});

test('ogre creates spacing but guard, startup, jump, range and armor resist the feint', async ({
  page,
}) => {
  await open(page);
  const rows = await page.evaluate(() => {
    const d = window.__db,
      rows = [];
    for (const defense of ['idle', 'block', 'attack', 'jump', 'far', 'armor']) {
      const [p, e] = d.fixtureYouth(
        'oolong',
        defense === 'armor' ? 'gyumao' : 'goku',
        defense === 'far' ? 4 : 1.5,
      );
      if (defense === 'block') e.state = 'block';
      if (defense === 'attack' || defense === 'armor') e.startAttack('heavy');
      if (defense === 'jump') e.pos.y = 1;
      const hp = e.hp,
        before = e.pos.clone();
      p.startSpecial();
      d.releaseYouthAbility(p, p.attack);
      rows.push({
        defense,
        displacement: before.distanceTo(e.pos),
        hpSame: e.hp === hp,
        form: p.youth.form,
        state: e.state,
      });
    }
    return rows;
  });
  expect(rows[0].displacement).toBeGreaterThan(1);
  expect(rows[0].state).toBe('idle');
  for (const r of rows.slice(1)) expect(r.displacement, r.defense).toBe(0);
  for (const r of rows) expect(r.hpSame).toBe(true);
});

test('result advice comes from actual armor contacts and opens the existing matching drill', async ({
  page,
}) => {
  await open(page);
  const result = await page.evaluate(() => {
    const d = window.__db,
      [p, e] = d.fixtureYouth('goku', 'gyumao', 1);
    d.game.collectTestStats = true;
    for (let n = 0; n < 3; n++) {
      e.startAttack('heavy');
      e.takeHit(p, { ...p.def.combos.light[0], serial: n + 1 });
    }
    e.hp = 0;
    d.endGame();
    d.updateVictory(2.4);
    d.renderGameViews();
    return d.getStats().rounds.at(-1);
  });
  expect(result.review[0].armoredContacts).toBe(3);
  await expect(page.locator('#resultAdvice')).toContainText('3次攻击撞上霸体');
  await expect(page.locator('#resultPractice')).toBeVisible();
  const download = page.waitForEvent('download');
  await page.locator('#exportCombatStats').click();
  expect((await download).suggestedFilename()).toBe('武道会-对局记录.json');
  await page.locator('#resultPractice').click();
  const practice = await page.evaluate(() => ({
    kind: window.__db.drillSystem.current?.kind,
    character: window.__db.player.def.id,
    foe: window.__db.enemy.def.id,
  }));
  expect(practice).toEqual({ kind: 'whiff', character: 'goku', foe: 'gyumao' });
});

test('every fighter completes seeded two-bar AI rounds under both bean and competitive rules', async ({
  page,
}) => {
  test.setTimeout(300000);
  await open(page);
  const rounds = await page.evaluate(() => {
    const d = window.__db,
      rows = [];
    for (const c of d.CHARACTERS)
      for (const rule of ['competitive', 'senzu']) {
        const [p, e] = d.fixtureYouth(c.id, 'goku', 6);
        d.game.matchRule = rule;
        d.game.difficulty = 'hard';
        d.game.collectTestStats = true;
        d.game.wins = [0, 0];
        p.isAI = e.isAI = true;
        const seed = 271828 + d.CHARACTERS.indexOf(c) * 971 + (rule === 'senzu' ? 1 : 0);
        d.setCombatSeed(seed);
        for (let frame = 0; frame < 6000 && !d.game.over; frame++) {
          d.advanceCombat(
            1 / 30,
            () => d.aiThink(p, e, d.STEP),
            () => d.aiThink(e, p, d.STEP),
          );
          d.updateEffects(1 / 30);
        }
        const stats = d.getStats().rounds.at(-1);
        rows.push({
          id: c.id,
          rule,
          seed,
          finished: d.game.over,
          duration: 180 - d.game.timeLeft,
          hp: [p.hp, e.hp],
          maxHp: [p.maxHp, e.maxHp],
          stats,
        });
      }
    d.game.collectTestStats = false;
    return rows;
  });
  await mkdir('performance/neutral-balance', { recursive: true });
  await writeFile('performance/neutral-balance/rounds.json', JSON.stringify(rounds, null, 2));
  expect(rounds.filter((r) => !r.finished || !r.stats)).toEqual([]);
});
