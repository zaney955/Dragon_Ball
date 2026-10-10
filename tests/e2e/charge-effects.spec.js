import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { validSpectatorFrame } from '../../src/online/spectator-codec.js';

async function openGame(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => (window.requestAnimationFrame = () => 0));
  await page.goto('/?test=1');
  await page.waitForFunction(() => window.__db?.fixtureYouth, null, { polling: 100 });
  return errors;
}

test('all fourteen fighters show an immediate fitted aura, rising particles and ground pulses, then stop on release or hit', async ({
  page,
}) => {
  const errors = await openGame(page);
  const rows = await page.evaluate(() => {
    const d = window.__db;
    return d.CHARACTERS.map((c) => {
      const [p, e] = d.fixtureYouth(c.id, 'krillin', 8);
      p.ki = 0;
      const size = { y: p.youth.normalHeight };
      for (let n = 0; n < 12; n++) {
        d.tick({ charge: true });
        p.render(d.STEP, 1);
      }
      const v = p.kiVisual;
      const immediate = v?.aura.visible && v.intensity > 0.7;
      for (let n = 0; n < 120; n++) {
        d.tick({ charge: true });
        p.render(d.STEP, 1);
      }
      const worldHeight = v.height * p.root.scale.y;
      const bodyFit = Math.abs(worldHeight - size.y) < size.y * 0.15;
      const gained = p.ki;
      const frame = () => {
        p.render(1 / 60, 1);
        e.render(1 / 60, 1);
        e.root.visible = false;
        d.renderer.setPixelRatio(1);
        d.renderer.setSize(420, 320, false);
        d.renderer.setScissorTest(false);
        d.renderer.setViewport(0, 0, 420, 320);
        d.camera.aspect = 420 / 320;
        d.camera.position.set(size.y * 1.2, size.y * 0.95, size.y * 1.75);
        d.camera.lookAt(0, size.y * 0.48, 0);
        d.camera.updateProjectionMatrix();
        d.renderer.render(d.scene, d.camera);
        return d.renderer.domElement.toDataURL('image/png');
      };
      const image = frame();
      const before = d.battleStateDigest(d.captureBattleState());
      const resources = d.renderer.info.memory.geometries;
      for (let n = 0; n < 60; n++) p.render(d.STEP, 1);
      const presentationOnly = before === d.battleStateDigest(d.captureBattleState());
      const reused = v === p.kiVisual && resources === d.renderer.info.memory.geometries;
      for (let n = 0; n < 100; n++) {
        d.tick();
        p.render(d.STEP, 1);
      }
      const released = !v.aura.visible;
      d.tick({ charge: true });
      p.render(1 / 60, 1);
      p.invulnerable = 0;
      p.takeHit(e, { ...e.def.combos.light[0], kb: 0 });
      p.render(1 / 60, 1);
      const interrupted = !v.aura.visible && v.intensity === 0;
      return {
        id: c.id,
        name: c.name,
        immediate,
        bodyFit,
        gained,
        presentationOnly,
        reused,
        released,
        interrupted,
        particles: v.positions.length / 3,
        streaks: v.streaks.length,
        image,
      };
    });
  });
  for (const row of rows) {
    expect(row, row.id).toMatchObject({
      immediate: true,
      bodyFit: true,
      presentationOnly: true,
      reused: true,
      released: true,
      interrupted: true,
    });
    expect(row.gained, row.id).toBeGreaterThan(10);
    expect(row.particles, row.id).toBeGreaterThanOrEqual(40);
    expect(row.streaks, row.id).toBeGreaterThanOrEqual(8);
  }
  const dir = 'performance/charge-effects';
  await mkdir(dir, { recursive: true });
  for (const row of rows)
    await writeFile(`${dir}/${row.id}.png`, Buffer.from(row.image.split(',')[1], 'base64'));
  await page.setViewportSize({ width: 1260, height: Math.ceil(rows.length / 3) * 350 });
  await page.setContent(
    `<body style="margin:0;background:#091424;color:#fff;font:18px system-ui;display:grid;grid-template-columns:repeat(3,420px)">${rows.map((r) => `<div style="height:350px"><div style="height:30px;text-align:center">${r.name}</div><img width="420" height="320" src="${r.image}"></div>`).join('')}</body>`,
  );
  await page.screenshot({ path: `${dir}/all-characters.png`, fullPage: true });
  expect(errors).toEqual([]);
});

test('charging fits alternate bodies and remains visible in mobile, split views and spectator snapshots', async ({
  page,
}) => {
  const errors = await openGame(page);
  const result = await page.evaluate(() => {
    const d = window.__db;
    const rows = [];
    for (const [id, form] of [
      ['goku', 'ape'],
      ['roshi', 'muscle'],
      ['tien', 'fourArms'],
      ['oolong', 'ogre'],
      ['oolong', 'mimic:gyumao'],
      ['bulma', 'capsuleMech'],
      ['pilaf', 'combined'],
    ]) {
      const [p] = d.fixtureYouth(id, 'krillin', 8);
      d.setYouthBody(p, form);
      p.state = 'charge';
      p.chargeHeld = 0.5;
      p.render(0.1, 1);
      const v = p.kiVisual;
      rows.push({
        id,
        form,
        visible: v.aura.visible,
        finite: Number.isFinite(v.height) && Number.isFinite(v.radius),
        bodyRoot: v.aura.parent === p.root,
      });
    }
    const [p, e] = d.fixtureYouth('pilaf', 'oolong', 8);
    for (let n = 0; n < 150; n++) {
      d.tick({ charge: true }, { charge: true });
      p.render(d.STEP, 1);
      e.render(d.STEP, 1);
    }
    const hostHeld = p.chargeHeld;
    const online = d.online;
    const command = online.command;
    let frame;
    online.active = online.host = true;
    online.acceptedActions = [[], []];
    online.serialInputs = new Map();
    online.room = { id: 1, spectators: 1, match: { id: 'charge-fixture' } };
    online.command = (packet) => {
      frame = structuredClone(packet.frame);
    };
    online.spectator.publish(performance.now() + 200);
    online.stop();
    const [observer] = d.fixtureYouth('pilaf', 'oolong', 8);
    online.active = online.spectating = true;
    d.game.online = d.game.spectating = true;
    online.spectator.start();
    online.spectator.receive({ room: 1, match: 'charge-fixture', frame });
    observer.render(1 / 60, 1);
    const result = {
      rows,
      frame,
      hostHeld,
      spectatorHeld: observer.chargeHeld,
      spectatorAura: observer.kiVisual.aura.visible,
    };
    online.command = command;
    online.stop();
    return result;
  });
  for (const row of result.rows)
    expect(row, row.id + row.form).toMatchObject({ visible: true, finite: true, bodyRoot: true });
  expect(validSpectatorFrame(result.frame)).toBe(true);
  expect(result.spectatorHeld).toBe(result.hostHeld);
  expect(result.spectatorAura).toBe(true);
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 1024, height: 640 },
  ]) {
    await page.setViewportSize(viewport);
    const visible = await page.evaluate(() => {
      const d = window.__db;
      document.getElementById('charge-capture')?.remove();
      d.renderer.domElement.style.visibility = '';
      d.renderer.setPixelRatio(1);
      d.renderer.setSize(innerWidth, innerHeight);
      const [p, e] = d.fixtureYouth('gyumao', 'korin', 8);
      for (let n = 0; n < 100; n++) {
        d.tick({ charge: true }, { charge: true });
        p.render(d.STEP, 1);
        e.render(d.STEP, 1);
      }
      d.updateFightCamera(1 / 60, true);
      d.renderGameViews();
      // Freeze the rendered frame before WebGL clears its non-preserved buffer.
      // This leaves the actual phone/split cameras and HUD intact for the capture.
      const image = document.createElement('img');
      image.id = 'charge-capture';
      image.src = d.renderer.domElement.toDataURL('image/png');
      image.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none';
      d.renderer.domElement.parentElement.appendChild(image);
      d.renderer.domElement.style.visibility = 'hidden';
      return [p, e].every((f) => f.kiVisual?.aura.visible);
    });
    expect(visible).toBe(true);
    await mkdir('performance/charge-effects', { recursive: true });
    await page.screenshot({ path: `performance/charge-effects/split-${viewport.width}.png` });
  }
  expect(errors).toEqual([]);
});
