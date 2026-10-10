import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

test('complete JSON snapshots preserve fourteen fighters, active abilities and future replay', async ({
  page,
}) => {
  test.setTimeout(300000);
  await page.addInitScript(() => (window.requestAnimationFrame = () => 0));
  await page.goto('/?test=1');
  await page.waitForFunction(() => window.__db?.captureBattleState, null, { polling: 100 });
  const rows = await page.evaluate(() => {
    const d = window.__db,
      rows = [];
    const run = (id, move, elapsed = 0.1) => {
      const row = { id, move, elapsed };
      try {
        const [p] = d.fixtureYouth(id, 'goku', 6);
        p.ki = 100;
        if (move === 'heavy') p.startAttack('heavy');
        else if (move === 'ult') p.startUlt();
        else if (move.startsWith('form:')) d.setYouthBody(p, move.slice(5));
        else if (move === 'blast') p.startKiBlast();
        else p.startSpecial({ variant: move === 'skill1' ? 1 : 0 });
        for (let n = 0; n < Math.ceil(elapsed / d.STEP); n++) d.tick();
        p.captureInput({ actions: [{ type: 'light' }] });
        const saved = JSON.parse(JSON.stringify(d.captureBattleState()));
        row.bytes = JSON.stringify(saved).length;
        row.before = d.battleStateDigest(saved);
        const step = () => {
          for (let n = 0; n < 150; n++)
            d.tick(n === 40 ? { actions: [{ type: 'light' }] } : {}, { block: n > 90 });
          return d.battleStateDigest(d.captureBattleState());
        };
        row.future = step();
        row.restored = d.restoreBattleState(saved);
        row.replayed = step();
      } catch (error) {
        row.error = error.message;
      }
      rows.push(row);
    };
    for (const c of d.CHARACTERS)
      for (const move of ['heavy', 'skill0', 'skill1', 'ult'])
        for (const elapsed of [0.1, 0.6]) run(c.id, move, elapsed);
    for (const [id, form] of [
      ['goku', 'ape'],
      ['roshi', 'muscle'],
      ['tien', 'fourArms'],
      ['oolong', 'ogre'],
      ['oolong', 'bat'],
      ['pilaf', 'armor'],
    ])
      run(id, 'form:' + form);
    run('goku', 'blast', 0.25);
    return rows;
  });
  await mkdir('performance/completion-audit', { recursive: true });
  await writeFile(
    'performance/completion-audit/state-recovery.json',
    JSON.stringify(rows, null, 2),
  );
  expect(
    rows.filter((row) => row.error || row.before !== row.restored || row.future !== row.replayed),
  ).toEqual([]);
});

test('snapshots preserve linked controls, throws, cover, terrain and bean clocks with measured restore cost', async ({
  page,
}) => {
  await page.addInitScript(() => (window.requestAnimationFrame = () => 0));
  await page.goto('/?test=1');
  await page.waitForFunction(() => window.__db?.captureBattleState, null, { polling: 100 });
  const rows = await page.evaluate(() => {
    const d = window.__db,
      rows = [];
    for (const scenario of ['grab', 'control', 'cover', 'terrain', 'bean', 'kami', 'building']) {
      const row = { scenario };
      try {
        let [p, e] = d.fixtureYouth(
          scenario === 'cover' ? 'bulma' : scenario === 'control' ? 'chiaotzu' : 'goku',
          'krillin',
          1,
        );
        if (scenario === 'grab') {
          p.startThrow();
          e.takeHit(p, p.attack);
        }
        if (scenario === 'control') {
          p.startSpecial();
          d.releaseYouthAbility(p, p.attack);
        }
        if (scenario === 'cover') {
          p.startSpecial({ variant: 1 });
          d.releaseYouthAbility(p, p.attack);
        }
        if (scenario === 'terrain') {
          p.startUlt();
          for (let n = 0; n < 100; n++) d.tick();
        }
        if (scenario === 'kami') {
          d.game.selectedMap = 3;
          d.startFight();
          d.game.ready = 0;
          p = d.player;
          e = d.enemy;
          p.ki = 100;
          p.startUlt();
          for (let n = 0; n < 100; n++) d.tick();
        }
        if (scenario === 'building') {
          const prop = d.map.destructibles.find((x) => x.building && x.kind !== 'roof');
          if (!prop) throw new Error('No building fixture');
          for (let n = 0; n < 3; n++)
            d.damageStage(p, { dmg: 120 }, prop.bounds.getCenter(p.pos.clone()));
          row.brokenParts = d.map.brokenBuildingParts;
          if (!row.brokenParts) throw new Error('Building was not actually destroyed');
        }
        if (scenario === 'bean') {
          d.game.matchRule = 'senzu';
          d.map.senzuTime = 24.99;
          d.tick();
        }
        const at = performance.now(),
          saved = JSON.parse(JSON.stringify(d.captureBattleState()));
        row.captureMs = performance.now() - at;
        row.bytes = JSON.stringify(saved).length;
        row.before = d.battleStateDigest(saved);
        const future = () => {
          for (let n = 0; n < 180; n++) d.tick();
          return d.battleStateDigest(d.captureBattleState());
        };
        row.future = future();
        const restoreAt = performance.now();
        row.restored = d.restoreBattleState(saved);
        row.restoreMs = performance.now() - restoreAt;
        row.replayed = future();
        if (scenario === 'bean')
          row.beanVisible = d.map.senzus.filter((b) => b.active).every((b) => b.group.visible);
      } catch (error) {
        row.error = error.message;
      }
      rows.push(row);
    }
    return rows;
  });
  await mkdir('performance/completion-audit', { recursive: true });
  await writeFile(
    'performance/completion-audit/state-recovery-linked.json',
    JSON.stringify(rows, null, 2),
  );
  console.log('LINKED STATE', JSON.stringify(rows));
  expect(
    rows.filter(
      (r) =>
        r.error || r.before !== r.restored || r.future !== r.replayed || r.beanVisible === false,
    ),
  ).toEqual([]);
});
