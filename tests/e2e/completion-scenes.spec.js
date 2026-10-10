import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
async function open(page) {
  await page.addInitScript(() => (window.requestAnimationFrame = () => 0));
  await page.goto('/?test=1');
  await page.waitForFunction(() => window.__db?.fixtureYouth, null, { polling: 100 });
}

test('real pressure ends in a defensive action and six-hit protection survives wall pursuit', async ({
  page,
}) => {
  await open(page);
  const report = await page.evaluate(() => {
    const d = window.__db,
      pressure = [],
      protection = [];
    for (const c of d.CHARACTERS)
      for (const type of ['light', 'heavy']) {
        const [p, e] = d.fixtureYouth(c.id, 'goku', 1);
        e.wasBlocking = true;
        e.guardHeld = 0.4;
        const defense = { block: true, crouch: c.combos[type][0].level === 'low' };
        d.tick({ actions: [{ type }] }, defense);
        let contactAt, actedAt;
        for (let n = 0; n < 240; n++) {
          d.tick(
            {},
            contactAt === undefined
              ? defense
              : { actions: ['dash'], left: true, moveYaw: -Math.PI / 2 },
          );
          d.game.hitStop = 0;
          if (p.hitResult === 'blocked' && contactAt === undefined) contactAt = n;
          if (e.dashTime > 0) {
            actedAt = n;
            break;
          }
        }
        pressure.push({
          id: c.id,
          type,
          blocked: contactAt !== undefined,
          regained: actedAt !== undefined,
          wait: (actedAt - contactAt) * d.STEP,
          guard: e.guard,
        });
      }
    for (const wall of [false, true])
      for (const choice of ['block', 'evasion', 'breaker']) {
        const [p, e] = d.fixtureYouth('goku', 'krillin', 1);
        if (wall) {
          p.pos.x = 12;
          e.pos.x = 13;
          p.previousPos.copy(p.pos);
          e.previousPos.copy(e.pos);
        }
        d.tick({ actions: ['light'] });
        let lastSerial = 0,
          queued = false,
          launchedAt,
          pursuitAt,
          escaped = false,
          regainedAt,
          hits = 0;
        for (let n = 0; n < 1800; n++) {
          let attack = {},
            defense = {};
          if (p.hitResult === 'hit' && p.attack && p.attack.serial !== lastSerial) {
            lastSerial = p.attack.serial;
            queued = false;
          }
          if (
            p.hitResult === 'hit' &&
            !queued &&
            p.attack &&
            d.game.simTime - p.attack.resolvedAt >= 0.15 &&
            launchedAt === undefined
          ) {
            attack = { actions: ['light'] };
            queued = true;
          }
          if (e.launchFlight && launchedAt === undefined) {
            launchedAt = n;
            hits = e.damageTotal;
          }
          if (launchedAt !== undefined) {
            if (n === launchedAt + 25) {
              attack = { actions: ['pursuit'] };
              pursuitAt = n;
            }
            if (p.dashKind === 'pursuit' && p.dashTime <= 0 && !p.attack && n < launchedAt + 170)
              attack = { actions: ['light'] };
            if (choice === 'evasion' && n === launchedAt + 35) defense = { actions: ['evasion'] };
            else if (choice === 'breaker' && n === launchedAt + 35)
              defense = { block: true, actions: ['dash'] };
            else if (choice === 'block') defense = { block: true };
          }
          d.tick(attack, defense);
          d.game.hitStop = 0;
          if (
            launchedAt !== undefined &&
            (e.dashTime > 0 || e.invulnerable > 0.5 || e.escapeCooldown > 0)
          )
            escaped = true;
          if (
            launchedAt !== undefined &&
            n > launchedAt + 35 &&
            ['idle', 'block', 'walk'].includes(e.state) &&
            !e.launchFlight &&
            e.pos.y <= 0.1
          ) {
            regainedAt = n;
            break;
          }
        }
        protection.push({
          wall,
          choice,
          launched: launchedAt !== undefined,
          pursuit: pursuitAt !== undefined,
          regained: regainedAt !== undefined,
          lostAfterLaunch: (regainedAt - launchedAt) * d.STEP,
          escaped,
          hits,
          defenderKi: e.ki,
          damage: e.maxHp - e.hp,
        });
      }
    return { pressure, protection };
  });
  await mkdir('performance/completion-audit', { recursive: true });
  await writeFile(
    'performance/completion-audit/attack-defense-loops.json',
    JSON.stringify(report, null, 2),
  );
  console.log('LOOPS', JSON.stringify(report));
  expect(report.pressure.filter((r) => !r.blocked || !r.regained)).toEqual([]);
  expect(report.protection.filter((r) => !r.launched || !r.regained)).toEqual([]);
});
