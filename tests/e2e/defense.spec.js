import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

async function open(page) {
  await page.addInitScript(() => {
    window.requestAnimationFrame = () => 0;
  });
  const url = process.env.OFFLINE_TEST
    ? pathToFileURL(resolve(process.env.DB_OFFLINE_FILE || 'dist/offline/龙珠_少年武道会.html'))
        .href + '?test=1'
    : '/?test=1';
  await page.goto(url);
  await page.waitForFunction(() => window.__db?.fixtureYouth, null, { polling: 100 });
}

test('real melee blocks protect life, spend defense and lead to a recoverable guard break', async ({
  page,
}) => {
  await open(page);
  const result = await page.evaluate(() => {
    const d = window.__db;
    const rows = [];
    for (const type of ['light', 'heavy']) {
      const [p, e] = d.fixtureYouth('goku', 'krillin', 0.7);
      d.game.difficulty = 'normal';
      for (let i = 0; i < 30; i++) d.tick({}, { block: true });
      p.startAttack(type);
      const hp = e.hp;
      for (let i = 0; i < 100; i++) {
        d.tick({}, { block: true });
        if (e.state === 'blockstun') {
          rows.push({ type, guard: e.guard, hp: e.hp, before: hp });
          break;
        }
      }
    }
    const [p, e] = d.fixtureYouth('goku', 'krillin', 0.7);
    d.game.difficulty = 'normal';
    for (let i = 0; i < 30; i++) d.tick({}, { block: true });
    let broken;
    for (let n = 0; n < 8 && !broken; n++) {
      p.pos.set(0, 0, 0);
      e.pos.set(0.7, 0, 0);
      p.previousPos.copy(p.pos);
      e.previousPos.copy(e.pos);
      p.facingAngle = Math.PI / 2;
      e.facingAngle = -Math.PI / 2;
      p.startAttack('heavy');
      for (let i = 0; i < 100; i++) {
        d.tick({}, { block: true });
        if (e.state === 'guardbreak') {
          d.updateExtraHUD();
          broken = {
            guard: e.guard,
            locked: e.guardBroken,
            stun: e.stunTime,
            hp: e.hp,
            maxHp: e.maxHp,
            state: document.getElementById('p2guardState').textContent,
          };
          break;
        }
      }
    }
    for (let i = 0; i < 130; i++) d.tick({}, { block: true });
    const locked = { guard: e.guard, locked: e.guardBroken, state: e.state };
    for (let i = 0; i < 230; i++) d.tick({}, { block: true });
    const unlocked = { guard: e.guard, locked: e.guardBroken, state: e.state };
    for (let i = 0; i < 500; i++) d.tick();
    const recovered = e.guard;
    return { rows, broken, locked, unlocked, recovered };
  });
  expect(result.rows).toHaveLength(2);
  expect(result.rows[0].guard).toBeCloseTo(93);
  expect(result.rows[1].guard).toBeCloseTo(86);
  for (const row of result.rows) expect(row.hp).toBe(row.before);
  expect(result.broken.guard).toBe(0);
  expect(result.broken.locked).toBe(true);
  expect(result.broken.stun).toBe(0.9);
  expect(result.broken.hp).toBeLessThan(result.broken.maxHp);
  expect(result.broken.state).toBe('破防');
  expect(result.locked.locked).toBe(true);
  expect(result.locked.state).toBe('idle');
  expect(result.unlocked.locked).toBe(false);
  expect(result.unlocked.guard).toBeGreaterThanOrEqual(25);
  expect(result.unlocked.state).toBe('block');
  expect(result.recovered).toBe(100);
});

test('projectiles and ultimates retain chip damage while parries, low attacks and throws obey their defense rules', async ({
  page,
}) => {
  await open(page);
  const result = await page.evaluate(() => {
    const d = window.__db;
    const hit = (attack, props = {}) => {
      const [p, e] = d.fixtureYouth('goku', 'krillin', 0.7);
      e.state = 'block';
      e.guardHeld = 0.4;
      Object.assign(e, props);
      const before = e.hp;
      e.takeHit(p, { dmg: 10, kb: 1, stun: 0.3, level: 'mid', ...attack });
      return { guard: e.guard, damage: before - e.hp, state: e.state, result: p.hitResult };
    };
    return {
      projectile: hit({ isKiBlast: true, projectile: true, kiCost: 5 }),
      charged: hit({ isKiBlast: true, projectile: true, kiCost: 15 }),
      ultimate: hit({ isUlt: true }),
      low: hit({ level: 'low' }),
      crouch: hit({ level: 'low' }, { crouching: true }),
      overhead: hit({ level: 'overhead' }, { crouching: true }),
      back: hit({}, { facingAngle: Math.PI / 2 }),
      parry: hit({}, { guard: 70, guardHeld: 0.04 }),
      throw: hit({ isThrow: true }),
    };
  });
  expect(result.projectile.guard).toBe(94);
  expect(result.projectile.damage).toBeCloseTo(1);
  expect(result.charged.guard).toBe(82);
  expect(result.ultimate.guard).toBe(55);
  expect(result.ultimate.damage).toBeCloseTo(2);
  for (const key of ['low', 'overhead', 'back']) expect(result[key].damage).toBe(10);
  expect(result.crouch.damage).toBe(0);
  expect(result.parry.damage).toBe(0);
  expect(result.parry.guard).toBe(78);
  expect(result.parry.result).toBe('parried');
  expect(result.throw.state).toBe('grabbed');
});

for (const width of [1024, 390, 320]) {
  test(`defense HUD keeps values and states visible in single and split views at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: width === 1024 ? 640 : 844 });
    await open(page);
    const rows = await page.evaluate(() => {
      const d = window.__db;
      d.fixtureYouth('goku', 'krillin', 3);
      const rows = [];
      for (const mode of ['normal', 'local']) {
        d.game.difficulty = mode;
        for (const [state, guard, broken, delay] of [
          ['idle', 100, false, 0],
          ['block', 70, false, 0.6],
          ['idle', 60, false, 0],
          ['idle', 24, false, 0.6],
          ['guardbreak', 0, true, 1.5],
          ['idle', 16, true, 0],
          ['idle', 60, false, 1.2],
        ]) {
          Object.assign(d.player, { state, guard, guardBroken: broken, guardDelay: delay });
          Object.assign(d.enemy, { state, guard, guardBroken: broken, guardDelay: delay });
          d.updateExtraHUD();
          d.renderGameViews();
          for (const prefix of mode === 'normal' ? ['p1', 'p2'] : ['view1', 'view2']) {
            const el = document.getElementById(prefix + 'guardResource');
            const bar = el.querySelector('.guardBar');
            const box = el.getBoundingClientRect();
            const label = el.querySelector('.guardLabel').getBoundingClientRect();
            const value = el.querySelector('.guardValue').getBoundingClientRect();
            rows.push({
              mode,
              status: el.dataset.state,
              label: document.getElementById(prefix + 'guardState').textContent,
              value: document.getElementById(prefix + 'guardValue').textContent,
              number: bar.getAttribute('aria-valuenow'),
              fits:
                el.scrollWidth <= el.clientWidth &&
                box.left >= 0 &&
                box.right <= innerWidth &&
                label.right <= value.left,
              width: bar.getBoundingClientRect().width,
            });
          }
        }
      }
      return rows;
    });
    for (const row of rows) {
      expect(row.fits, JSON.stringify(row)).toBe(true);
      expect(row.width).toBeGreaterThan(60);
      expect(row.value).toBe(row.number + '%');
    }
    expect(new Set(rows.map((r) => r.status))).toEqual(
      new Set(['ready', 'blocking', 'recovering', 'low', 'broken', 'locked', 'waiting']),
    );
  });
}
