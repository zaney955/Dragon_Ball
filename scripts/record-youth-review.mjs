import { chromium } from '@playwright/test';
import { resolve } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
const dir = resolve('performance/youth-review');
await mkdir(dir, { recursive: true });
const b = await chromium.launch({
  channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome',
  args:
    process.platform === 'darwin' && !process.env.DB_SOFTWARE_GPU
      ? ['--use-angle=metal']
      : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const p = await b.newPage({ viewport: { width: 960, height: 540 } });
await p.addInitScript(() => (window.requestAnimationFrame = () => 0));
try {
  await p.goto((process.env.DB_PREVIEW_URL || 'http://127.0.0.1:4173') + '/?test=1', {
    waitUntil: 'domcontentloaded',
    timeout: 120_000,
  });
  await p.waitForFunction(() => window.__db?.fixtureYouth, null, {
    polling: 100,
    timeout: 120_000,
  });
  const ids = await p.evaluate(() => window.__db.CHARACTERS.map((c) => c.id));
  for (const id of ids) {
    for (const type of ['light', 'heavy']) {
      const frames = await p.evaluate(
        ({ id, type }) => {
          const db = window.__db,
            [f, e] = db.fixtureYouth(id, 'goku', 1);
          db.renderer.setPixelRatio(1);
          db.renderer.setSize(640, 360, false);
          db.renderer.shadowMap.enabled = false;
          db.camera.aspect = 640 / 360;
          db.camera.position.set(4, 3, 6);
          db.camera.lookAt(0.5, 1.7, 0);
          db.camera.updateProjectionMatrix();
          e.root.visible = false;
          db.game.simTime = 0;
          let out = [];
          const draw = () => {
            f.render(1, 1);
            db.renderer.render(db.scene, db.camera);
            out.push(db.renderer.domElement.toDataURL('image/png').split(',')[1]);
          };
          draw();
          for (let i = 0; i < f.def.combos[type].length; i++) {
            f.attack = null;
            f.state = 'idle';
            f.hitResult = i ? 'hit' : null;
            f.comboType = type;
            f.comboIdx = i - 1;
            f.comboTimer = i ? 1 : 0;
            f.startAttack(type);
            if (!f.attack) throw Error('missing ' + id + type + i);
            const dur = f.attack.dur;
            for (let t = 0; t < dur; t += 1 / 24) {
              f.stateTimer = t;
              draw();
            }
          }
          f.attack = null;
          f.state = 'idle';
          for (let n = 0; n < 6; n++) draw();
          return out;
        },
        { id, type },
      );
      const tmp = dir + '/frames-' + id + '-' + type;
      await mkdir(tmp, { recursive: true });
      for (const [n, v] of frames.entries())
        await writeFile(tmp + '/' + String(n).padStart(4, '0') + '.png', Buffer.from(v, 'base64'));
      execFileSync('ffmpeg', [
        '-hide_banner',
        '-loglevel',
        'error',
        '-y',
        '-framerate',
        '24',
        '-i',
        tmp + '/%04d.png',
        '-c:v',
        'libx264',
        '-pix_fmt',
        'yuv420p',
        dir + '/' + id + '-' + type + '.mp4',
      ]);
      await writeFile(
        dir + '/' + id + '-' + type + '.png',
        Buffer.from(frames[Math.floor(frames.length / 3)], 'base64'),
      );
      console.log('clip', id, type, frames.length);
    }
    const img = await p.evaluate((id) => {
      const db = window.__db,
        [f, e] = db.fixtureYouth(id, 'goku', 1);
      db.game.matchFinished = true;
      db.game.wins = [1, 0];
      e.hp = 0;
      db.game.timeLeft = 50;
      db.game.manualTest = true;
      db.showResult = () => {};
      db.player.hp = f.maxHp;
      /* trigger actual state transition */ db.game.timeLeft = 0;
      db.endGame();
      const v = db.getVictory();
      if (!v) throw Error('no victory');
      db.updateVictory(2.4);
      db.renderer.render(v.scene, v.camera);
      return db.renderer.domElement.toDataURL('image/png').split(',')[1];
    }, id);
    await writeFile(dir + '/' + id + '-victory.png', Buffer.from(img, 'base64'));
    console.log('victory', id);
  }
  for (const [id, form] of [
    ['goku', 'ape'],
    ['tien', 'fourArms'],
    ['pilaf', 'combined'],
    ['piccolo', 'demon'],
    ['oolong', 'ogre'],
    ['oolong', 'bat'],
    ['roshi', 'mafuba'],
  ]) {
    const img = await p.evaluate(
      ({ id, form }) => {
        const d = window.__db,
          [f, e] = d.fixtureYouth(id, id, 3);
        if (form === 'mafuba') {
          f.startUlt();
          for (let i = 0; i < 81; i++) d.tick();
        } else if (form === 'demon') {
          f.startSpecial();
          for (let i = 0; i < 110; i++) d.tick();
        } else d.setYouthBody(f, form);
        if (form !== 'mafuba') {
          f.attack = null;
          f.state = 'idle';
        }
        f.youth.formTime = 10;
        if (form === 'bat') f.pos.y = 0.8;
        f.previousPos.copy(f.pos);
        f.render(0, 1);
        e.render(0, 1);
        d.updateUltimateVisuals(1 / 60);
        d.camera.position.set(5, 4.5, 8);
        d.camera.lookAt(1.2, 1.8, 0);
        d.renderer.render(d.scene, d.camera);
        return d.renderer.domElement.toDataURL('image/png').split(',')[1];
      },
      { id, form },
    );
    await writeFile(dir + '/' + id + '-' + form + '.png', Buffer.from(img, 'base64'));
    console.log('form', id, form);
  }
  for (const mobile of [false, true]) {
    await p.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1024, height: 640 });
    await p.evaluate((mobile) => {
      const d = window.__db,
        [f, e] = d.fixtureYouth('goku', 'krillin', 1);
      d.renderer.setSize(innerWidth, innerHeight, false);
      d.game.wins = mobile ? [1, 0] : [0, 1];
      if (mobile) {
        d.setYouthBody(f, 'ape');
        e.hp = 0;
      } else f.hp = 0;
      d.endGame();
      d.updateVictory(2.4);
      d.renderGameViews();
    }, mobile);
    await p.screenshot({ path: dir + (mobile ? '/mobile-victory.png' : '/player2-victory.png') });
  }
} finally {
  await b.close();
}
