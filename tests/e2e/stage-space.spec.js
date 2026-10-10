import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { validSpectatorFrame } from '../../src/online/spectator-codec.js';

for (const [index, id] of ['budokai', 'wild', 'kame', 'kami'].entries()) {
  test(`${id} expanded walkable space, swept collision, graded destruction and state recovery`, async ({
    page,
  }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(() => {
      window.requestAnimationFrame = () => 0;
    });
    await page.goto('/?test=1');
    await page.waitForFunction(() => window.__db?.damageStageObject, null, { polling: 100 });
    const result = await page.evaluate((index) => {
      const d = window.__db;
      Object.assign(d.game, {
        selectedMap: index,
        selectedChar: 0,
        opponent: 1,
        keepPair: false,
        difficulty: 'training',
        manualTest: true,
        muted: true,
      });
      d.startFight();
      d.game.ready = 0;
      let map = d.map,
        accessible = 0,
        expanded = 0,
        tested = 0;
      for (let x = -map.bounds.x; x < map.bounds.x; x += 2)
        for (let z = -map.bounds.z; z < map.bounds.z; z += 2) {
          if (!d.positionFree(x, z, 0.4, 0.2)) continue;
          const p = d.player.pos.clone().set(x, 0, z);
          const from = p.clone();
          d.moveInSpace(from, p, 0.3);
          if (p.distanceTo(from) < 0.02) accessible++;
          if (Math.abs(x) > 13.5 || Math.abs(z) > 6) expanded++;
          tested++;
        }
      const obstacles = map.destructibles.filter(
        (p) =>
          !p.tile &&
          p.collidable !== false &&
          p.bounds &&
          d.insideArea(
            map.playArea,
            p.bounds.getCenter(d.player.pos.clone()).x,
            p.bounds.getCenter(d.player.pos.clone()).z,
            0.5,
          ),
      );
      let collisions = 0,
        partial = 0,
        fullyBroken = 0,
        cleared = 0;
      const samples = [
        ...(index === 0 ? map.destructibles : obstacles).filter((p) => p.building).slice(0, 3),
        ...obstacles.filter((p) => p.tree).slice(0, 2),
        ...obstacles.filter((p) => p.kind === 'rock').slice(0, 3),
      ];
      for (const item of samples) {
        const box = item.bounds.clone(),
          center = box.getCenter(d.player.pos.clone());
        const start = center
          .clone()
          .setX(box.min.x - 1.5)
          .setY(Math.max(0, center.y - d.groundHeight(center.x, center.z)));
        const end = start.clone().setX(box.max.x + 1.5);
        const contacts = d.moveInSpace(start, end, 0.3, 1.5);
        if (contacts.length) collisions++;
        d.damageStageObject(item, { dmg: item.maxHp * 0.15 });
        if (!item.broken && item.hp < item.maxHp) partial++;
        d.damageStageObject(item, { dmg: item.maxHp * 0.7 });
        d.damageStageObject(item, { dmg: item.maxHp * 2 });
        if (item.broken && !item.mesh.visible) fullyBroken++;
        if (
          !d.stageSegmentHit(start, start.clone().setX(box.max.x + 1.5))?.item ||
          d.stageSegmentHit(start, start.clone().setX(box.max.x + 1.5))?.item !== item
        )
          cleared++;
      }
      const state = JSON.parse(JSON.stringify(d.captureBattleState()));
      const digest = d.battleStateDigest(state),
        broken = map.destructibles.filter((p) => p.broken).length;
      d.restoreBattleState(state);
      map = d.map;
      const recovered = broken === map.destructibles.filter((p) => p.broken).length;
      const sameDigest = digest === d.battleStateDigest(d.captureBattleState());
      const sameVisuals =
        JSON.stringify(state.mapTransforms) ===
        JSON.stringify(d.captureBattleState().mapTransforms);
      d.map.update(1 / 60);
      d.player.pos.set(0, 0, 0);
      d.player.spacePosition = d.player.pos.clone();
      d.enemy.pos.set(4, 0, -3);
      d.enemy.spacePosition = d.enemy.pos.clone();
      d.player.render(0, 1);
      d.enemy.render(0, 1);
      d.resetShoulderCameras();
      d.renderGameViews();
      const calls = d.renderer.info.render.calls;
      const memory = [];
      for (let n = 0; n < 3; n++) {
        d.startFight();
        for (const item of d.map.destructibles.filter((p) => !p.tile).slice(0, 20))
          d.damageStageObject(item, { dmg: 150 });
        d.map.update(1 / 60);
        d.renderGameViews();
        memory.push({ ...d.renderer.info.memory });
      }
      d.startFight();
      const fresh = d.map.destructibles.every((p) => !p.broken && p.hp === p.maxHp);
      return {
        accessible,
        expanded,
        tested,
        collisions,
        partial,
        fullyBroken,
        cleared,
        samples: samples.length,
        recovered,
        sameDigest,
        sameVisuals,
        broken,
        snapshotBytes: JSON.stringify(state).length,
        calls,
        memory,
        fresh,
        playArea: d.map.playArea,
        destructibles: d.map.destructibles.length,
      };
    }, index);
    await mkdir('performance/space', { recursive: true });
    await writeFile(`performance/space/${id}.json`, JSON.stringify(result, null, 2));
    expect(result.accessible).toBe(result.tested);
    expect(result.expanded).toBeGreaterThan(index === 0 ? 1 : 100);
    if (index !== 0) {
      expect(result.collisions).toBeGreaterThan(0);
      expect(result.partial).toBeGreaterThan(0);
      expect(result.fullyBroken).toBeGreaterThan(0);
      expect(result.cleared).toBe(result.samples);
    }
    expect(result.recovered).toBe(true);
    expect(result.sameDigest).toBe(true);
    expect(result.sameVisuals).toBe(true);
    expect(result.fresh).toBe(true);
    expect(result.memory[2].geometries).toBeLessThanOrEqual(result.memory[1].geometries + 2);
    expect(result.memory[2].textures).toBeLessThanOrEqual(result.memory[1].textures + 1);
    expect(errors).toEqual([]);
    await page.screenshot({ path: `performance/space/${id}-expanded.png` });
  });
}

test('all four maps survive continuous destruction, keep spectator packets bounded and let AI pursue across expanded space', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    window.requestAnimationFrame = () => 0;
  });
  await page.goto('/?test=1');
  await page.waitForFunction(() => window.__db?.damageStageObject && window.__db?.aiThink, null, {
    polling: 100,
  });
  const rows = await page.evaluate(() => {
    const d = window.__db,
      rows = [];
    for (let index = 0; index < 4; index++) {
      Object.assign(d.game, {
        selectedMap: index,
        selectedChar: 0,
        opponent: 1,
        keepPair: false,
        difficulty: 'training',
        manualTest: true,
        muted: true,
      });
      d.startFight();
      d.game.ready = 0;
      const map = d.map;
      const walkable = [];
      for (let x = -map.bounds.x + 2; x < map.bounds.x - 2; x += 3)
        for (let z = -map.bounds.z + 2; z < map.bounds.z - 2; z += 3)
          if (d.positionFree(x, z, 0.5, 1)) walkable.push([x, z]);
      let pair = [walkable[0], walkable[1]],
        far = 0;
      for (const a of walkable)
        for (const b of walkable) {
          const distance = Math.hypot(a[0] - b[0], a[1] - b[1]);
          if (distance > far) {
            far = distance;
            pair = [a, b];
          }
        }
      d.player.pos.set(pair[0][0], 0, pair[0][1]);
      d.enemy.pos.set(pair[1][0], 0, pair[1][1]);
      d.enemy.isAI = true;
      d.game.difficulty = 'normal';
      d.player.spacePosition = d.player.pos.clone();
      d.enemy.spacePosition = d.enemy.pos.clone();
      let nearest = far;
      for (let n = 0; n < 5400 && nearest > 6; n++) {
        d.advanceCombat(
          d.STEP,
          () => ({}),
          () => d.aiThink(d.enemy, d.player, d.STEP),
        );
        nearest = Math.min(nearest, d.enemy.pos.distanceTo(d.player.pos));
      }
      const reachable = [d.player, d.enemy].every((f) =>
        d.insideArea(map.playArea, f.pos.x, f.pos.z, 0.29 * f.baseScale),
      );
      const debug = {
        pair,
        pos: [d.player.pos.toArray(), d.enemy.pos.toArray()],
        state: d.enemy.state,
        ki: d.enemy.ki,
        intent: d.enemy.aiIntent,
        navigation: d.enemy.navigation,
        stuck: d.enemy.stageStuck,
        over: d.game.over,
        reason: d.game.endReason,
        brainTime: d.enemy.brainTime,
        input: d.aiThink(d.enemy, d.player, d.STEP),
      };
      for (const item of map.destructibles.filter((p) => !p.tile && !p.rubble))
        d.damageStageObject(item, { dmg: 200 });
      map.update(1 / 60);
      let captured;
      const command = d.online.command;
      d.online.active = d.online.host = true;
      d.online.room = { id: 1, spectators: 1, match: { id: 'map-stress' } };
      d.online.command = (message) => {
        captured = message.frame;
      };
      d.online.spectator.publish(performance.now() + 200);
      d.online.command = command;
      d.online.stop();
      d.game.over = false;
      const state = JSON.parse(JSON.stringify(d.captureBattleState()));
      d.restoreBattleState(state);
      const restoredRubble = d.map.rubbleSlots.filter((p) => p.mesh.visible).length;
      rows.push({
        index,
        debug,
        far,
        nearest,
        reachable,
        broken: d.map.destructibles.filter((p) => p.broken).length,
        rubble: restoredRubble,
        frame: captured,
        snapshotBytes: JSON.stringify(state).length,
      });
    }
    return rows;
  });
  console.log('SPACE STRESS', JSON.stringify(rows.map(({ frame, ...r }) => r)));
  for (const row of rows) {
    expect(row.nearest, String(row.index)).toBeLessThan(6.1);
    expect(row.reachable).toBe(true);
    expect(row.broken).toBeGreaterThan(30);
    expect(row.rubble).toBeGreaterThan(0);
    expect(row.rubble).toBeLessThanOrEqual(12);
    expect(validSpectatorFrame(row.frame)).toBe(true);
    expect(JSON.stringify(row.frame).length).toBeLessThan(45000);
    expect(row.snapshotBytes).toBeLessThan(2000000);
  }
  await writeFile(
    'performance/space/stress.json',
    JSON.stringify(
      rows.map(({ frame, ...r }) => ({ ...r, spectatorBytes: JSON.stringify(frame).length })),
      null,
      2,
    ),
  );
  expect(errors).toEqual([]);
});

test('a fast actual projectile hits cover before the protected fighter on every map', async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.requestAnimationFrame = () => 0;
  });
  await page.goto('/?test=1');
  await page.waitForFunction(() => window.__db?.damageStageObject, null, { polling: 100 });
  const rows = await page.evaluate(() => {
    const d = window.__db,
      rows = [];
    for (let index = 0; index < 4; index++) {
      Object.assign(d.game, {
        selectedMap: index,
        selectedChar: 0,
        opponent: 1,
        keepPair: false,
        difficulty: 'training',
        manualTest: true,
        muted: true,
      });
      d.startFight();
      d.game.ready = 0;
      const item = d.map.destructibles.find(
        (p) =>
          p.building &&
          p.bounds.max.y - p.bounds.min.y > 1.1 &&
          p.bounds.max.x - p.bounds.min.x < 6,
      );
      if (!item)
        throw new Error(
          'No wall at map ' +
            index +
            ' ' +
            JSON.stringify(
              d.map.destructibles
                .filter((p) => p.building)
                .map((p) => [p.bounds.min.y, p.bounds.max.y]),
            ),
        );
      const center = item.bounds.getCenter(d.player.pos.clone());
      const from = center.clone().setX(item.bounds.min.x - 1);
      const to = center.clone().setX(item.bounds.max.x + 1);
      d.player.pos.copy(from).setY(Math.max(0, center.y - d.groundHeight(from.x, from.z) - 1.2));
      d.enemy.pos.copy(to).setY(Math.max(0, center.y - d.groundHeight(to.x, to.z) - 1.2));
      d.player.previousPos.copy(d.player.pos);
      d.enemy.previousPos.copy(d.enemy.pos);
      d.enemy.invulnerable = 0;
      const hp = d.enemy.hp,
        coverHp = d.map.destructibles.reduce((sum, p) => sum + p.hp, 0);
      const mesh = d.player.root.clone(false);
      d.scene.add(mesh);
      d.v2Projectiles.push({
        owner: d.player,
        attack: { ...d.player.def.combos.light[0], dmg: 4, projectile: true, range: 30, serial: 1 },
        source: {},
        kind: 'bullet',
        mesh,
        pos: from.clone(),
        previous: from.clone(),
        direction: to.clone().sub(from).normalize(),
        speed: from.distanceTo(to) * 10,
        life: 1,
        distance: 0,
        r: 0.08,
        hits: new Set(),
      });
      d.updateV2Abilities(0.1);
      rows.push({
        index,
        protected: d.enemy.hp === hp,
        damaged: d.map.destructibles.reduce((sum, p) => sum + p.hp, 0) < coverHp,
        consumed: d.v2Projectiles.length === 0,
      });
    }
    return rows;
  });
  for (const row of rows)
    expect(row, String(row.index)).toMatchObject({
      protected: true,
      damaged: true,
      consumed: true,
    });
});
