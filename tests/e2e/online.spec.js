import { test, expect } from '@playwright/test';
import { spectatorFixture } from '../fixtures/spectator.js';

test.skip(!process.env.ONLINE_TEST, 'Run npm run test:online for the multiplayer runtime.');

async function pauseClock(page) {
  // Freeze Date before pausing so a slow GPU cannot overtake the pause timestamp
  // between two protocol calls. Restore normal Date progression while paused.
  const time = Date.now();
  await page.clock.setFixedTime(time);
  await page.clock.pauseAt(time);
  await page.clock.setSystemTime(time);
}

async function lobby(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(noDraw => window.__dbNetworkNoDraw = noDraw, !!process.env.DB_NETWORK_NO_DRAW);
  await page.addInitScript(
    (softwareGPU) => {
      const raf = window.requestAnimationFrame;
      window.requestAnimationFrame = (callback) =>
        raf.call(window, (at) => {
          const renderer = window.__db?.renderer;
          if (renderer) {
            renderer.setPixelRatio(softwareGPU ? 0.25 : 0.5);
            if (softwareGPU) {
              renderer.shadowMap.enabled = false;
              const draw = renderer.render.bind(renderer);
              let lastDraw = -Infinity;
              renderer.render = (...args) => {
                const now = performance.now();
                if (now - lastDraw < 1000) return;
                lastDraw = now;
                return draw(...args);
              };
            }
            if (window.__dbNetworkNoDraw) renderer.render = () => {};
            window.requestAnimationFrame = raf;
          }
          callback(at);
        });
    },
    process.platform !== 'darwin' || !!process.env.DB_SOFTWARE_GPU,
  );
  await page.goto('/?test=1');
  await expect(page.locator('#loading')).toHaveClass('hidden', { timeout: 30000 });
  await page.locator('#homeOnline').click();
  await expect(page.locator('.onlineRoomCard')).toHaveCount(3, { timeout: 15000 });
  await expect(page.locator('[data-room="1"]')).toBeEnabled();
  return errors;
}

test('real Worker enforces concurrent capacity, readiness and disconnect cleanup', async ({
  page,
}) => {
  test.skip(
    !!process.env.ONLINE_BASE_URL,
    'Capacity stress test runs against isolated local backend.',
  );
  await lobby(page);
  const result = await page.evaluate(async (frame) => {
    const sockets = [];
    async function connect() {
      const socket = new WebSocket(window.__db.online.transport.url);
      const client = { socket, state: null, error: null };
      sockets.push(client);
      socket.onmessage = ({ data }) => {
        const message = JSON.parse(data);
        if (message.type === 'state') client.state = message;
        if (message.type === 'error') client.error = message.message;
        if (message.type === 'spectator-frame') client.frame = message.frame;
        if (message.type === 'peer') client.peer = message.packet;
      };
      await wait(() => client.state);
      return client;
    }
    async function wait(predicate) {
      const deadline = Date.now() + 6000;
      while (!predicate()) {
        if (Date.now() > deadline) throw Error('Socket state timeout');
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
    }
    const send = (client, message) => client.socket.send(JSON.stringify(message));
    try {
      const clients = await Promise.all(Array.from({ length: 5 }, () => connect()));
      for (let i = 0; i < 3; i++) send(clients[i], { type: 'create', room: i + 1 });
      await wait(() => clients[0].state.rooms.every((room) => room.players.length === 1));
      send(clients[3], { type: 'create', room: 4 });
      await wait(() => clients[3].error);
      const fourthDenied = clients[3].state.rooms.filter((r) => r.players.length).length === 3;
      send(clients[3], { type: 'join', room: 1 });
      await wait(() => clients[0].state.rooms[0].players.length === 2);
      send(clients[4], { type: 'join', room: 1 });
      await wait(() => clients[4].error);
      send(clients[0], {
        type: 'ready',
        ready: true,
        revision: clients[0].state.rooms[0].revision,
      });
      await wait(() => clients[0].state.rooms[0].players[0].ready);
      const noEarlyStart = !clients[0].state.rooms[0].match;
      send(clients[3], {
        type: 'ready',
        ready: true,
        revision: clients[0].state.rooms[0].revision,
      });
      await wait(() => clients[0].state.rooms[0].match);
      const started = !!clients[0].state.rooms[0].match.id;
      const thirdPlayerDenied = !!clients[4].error;
      clients[4].error = null;
      send(clients[4], { type: 'watch', room: 1 });
      await wait(() => clients[4].error);
      const connectingNotWatchable = !clients[4].state.watching;
      const id = clients[0].state.rooms[0].match.id;
      send(clients[0], { type: 'playing', match: id });
      await wait(() => clients[4].state.rooms[0].match.playing);
      const observer = await connect();
      for (const viewer of [clients[4], observer]) send(viewer, { type: 'watch', room: 1 });
      await wait(() => observer.state.rooms[0].spectators === 2);
      const observersSeparate = observer.state.rooms[0].players.length === 2;
      send(clients[0], { type: 'spectator-frame', match: id, frame });
      await wait(() => observer.frame?.seq === 1 && clients[4].frame?.seq === 1);
      send(clients[3], { type: 'spectator-frame', match: id, frame: { ...frame, seq: 2 } });
      send(observer, { type: 'relay', match: id, packet: { kind: 'input', data: [0, 0, []] } });
      await new Promise((resolve) => setTimeout(resolve, 100));
      const isolated = observer.frame.seq === 1 && !clients[0].peer && !clients[3].peer;
      send(clients[4], { type: 'unwatch' });
      await wait(() => observer.state.rooms[0].spectators === 1);
      send(clients[0], { type: 'ended', match: id });
      await wait(() => observer.state.watching === 0);
      const endedClearsWatching =
        observer.state.rooms[0].players.length === 2 &&
        observer.state.rooms[0].spectators === 0 &&
        !observer.state.rooms[0].match.playing;
      send(clients[0], { type: 'finish', match: id });
      await wait(() => !clients[0].state.rooms[0].match);
      for (const client of [clients[0], clients[3]])
        send(client, { type: 'ready', ready: true, revision: client.state.rooms[0].revision });
      await wait(() => clients[0].state.rooms[0].match);
      send(clients[0], { type: 'playing', match: clients[0].state.rooms[0].match.id });
      await wait(() => observer.state.rooms[0].match.playing);
      send(observer, { type: 'watch', room: 1 });
      await wait(() => observer.state.watching === 1);
      clients[0].socket.close();
      await wait(() => clients[3].state.rooms[0].players.length === 1);
      const promoted =
        clients[3].state.rooms[0].players[0].seat === 0 && !clients[3].state.rooms[0].match;
      clients[3].socket.close();
      await wait(() => clients[4].state.rooms[0].players.length === 0);
      return {
        fourthDenied,
        noEarlyStart,
        started,
        promoted,
        thirdPlayerDenied,
        connectingNotWatchable,
        observersSeparate,
        isolated,
        endedClearsWatching,
        departureClearsWatching: observer.state.watching === 0,
        emptyClosed: true,
      };
    } finally {
      sockets.forEach(({ socket }) => socket.close());
    }
  }, spectatorFixture());
  expect(Object.values(result).every(Boolean)).toBe(true);
  await page.locator('#onlineHome').click();
});

for (const mode of ['direct', 'relay'])
  test(`two players fight with ${mode} transport, synchronized input and no lobby polling`, async ({
    browser,
  }) => {
    // Only the automated loopback test grants media permissions: Chrome then exposes local
    // candidates instead of relying on macOS mDNS. No camera/microphone is opened by the game.
    const contextOptions = {
      viewport: { width: 960, height: 600 },
      permissions: mode === 'direct' ? ['camera', 'microphone'] : [],
    };
    const contexts = await Promise.all([
      browser.newContext(contextOptions),
      browser.newContext(contextOptions),
    ]);
    const [host, guest] = await Promise.all(contexts.map((c) => c.newPage()));
    if (mode === 'relay') await guest.setViewportSize({ width: 390, height: 844 });
    try {
      if (mode === 'relay')
        for (const page of [host, guest])
          await page.addInitScript(() => {
            window.RTCPeerConnection = undefined;
          });
      const errors = await Promise.all([lobby(host), lobby(guest)]);
      await host.locator('[data-room="1"]').click();
      await expect(guest.locator('[data-room="1"]')).toHaveText('加入对战');
      await guest.locator('[data-room="1"]').click();
      await expect(host.locator('#onlineRoomTitle')).toContainText('房间 1');
      await expect.poll(() => host.evaluate(() => window.__db.online.room.players.length)).toBe(2);
      for (const page of [host, guest]) {
        await expect(page.locator('#onlineRoomInfo')).toBeVisible();
        await expect(page.locator('#startBtn')).toBeVisible();
        const boxes = await Promise.all([
          page.locator('#onlineRoomInfo').boundingBox(),
          page.locator('#startBtn').boundingBox(),
        ]);
        expect(Math.abs(boxes[0].height - boxes[1].height)).toBeLessThan(1);
        expect(boxes[0].x + boxes[0].width).toBeLessThan(boxes[1].x);
        expect(Math.abs(boxes[0].y - boxes[1].y)).toBeLessThan(1);
      }
      await host.locator('#charList .char-card').nth(0).click();
      await guest.locator('#charList .char-card').nth(5).click();
      await expect(guest.locator('#charList .char-card').nth(5)).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      await expect(host.locator('#onlinePlayers')).toContainText(
        await guest.locator('#heroName').textContent(),
      );
      await host.locator('.artOpen').click();
      await expect(host.locator('#artGallery')).toHaveClass(/show/);
      await host.locator('#artClose').click();
      await guest.locator('#moveGuideBtn').click();
      await guest.locator('#guideClose').click();
      expect(await guest.locator('#menu').evaluate((node) => node.inert)).toBe(false);
      await guest.locator('#mapList .map-card').nth(1).click();
      await expect(host.locator('#mapList .map-card').nth(1)).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      await host.locator('#mapList .map-card').nth(0).click();
      await expect(guest.locator('#mapList .map-card').nth(0)).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      for (const page of [host, guest]) await page.locator('.settingsDisclosure summary').click();
      await host.locator('#startBtn').click();
      await expect(host.locator('#startBtn')).toHaveText('取消准备');
      await guest.locator('#matchRule').selectOption('competitive');
      await expect(host.locator('#matchRule')).toHaveValue('competitive');
      await expect(host.locator('#startBtn')).toHaveText('准备对战');
      await guest.locator('#lighting').selectOption('sunset');
      await expect(host.locator('#lighting')).toHaveValue('sunset');
      await host.locator('#lighting').selectOption('day');
      await expect(guest.locator('#lighting')).toHaveValue('day');
      await host.locator('#ringOption').check();
      await expect(guest.locator('#ringOption')).toBeChecked();
      await guest.locator('#ringOption').uncheck();
      await expect(host.locator('#ringOption')).not.toBeChecked();
      if (mode === 'direct')
        await Promise.all(
          [host, guest].map((p) =>
            p.waitForFunction(
              () => window.__db.online.transport.channel?.readyState === 'open',
              null,
              {
                timeout: 15000,
              },
            ),
          ),
        );
      const before = await host.evaluate(() => window.__db.online.transport.stats.controlMessages);
      await host.waitForTimeout(1000);
      expect(await host.evaluate(() => window.__db.online.transport.stats.controlMessages)).toBe(
        before,
      );
      await host.locator('#startBtn').click();
      await expect(host.locator('#startBtn')).toHaveText('取消准备');
      await expect(host.locator('#hud')).not.toHaveClass(/show/);
      await guest.locator('#startBtn').click();
      await Promise.all(
        [host, guest].map((p) => expect(p.locator('#hud')).toHaveClass(/show/, { timeout: 20000 })),
      );
      await guest.waitForFunction(
        () => window.__db.game.ready <= 0 && window.__db.online.remoteSequence > 5,
        null,
        { timeout: 20000 },
      );
      const guestStart = await guest.evaluate(() => window.__db.enemy.pos.toArray());
      await guest.keyboard.down('KeyW');
      try {
        await guest.waitForFunction(
          (start) =>
            Math.hypot(window.__db.enemy.pos.x - start[0], window.__db.enemy.pos.z - start[2]) >= 2,
          guestStart,
          { timeout: 20000 },
        );
      } finally {
        await guest.keyboard.up('KeyW');
      }
      await host.waitForFunction(() => window.__db.enemy.vel.length() < 0.02, null, {
        timeout: 20000,
      });
      const stoppedSequence = await host.evaluate(() => window.__db.online.sequence);
      await guest.waitForFunction(
        (seq) => window.__db.online.remoteSequence > seq,
        stoppedSequence,
        { timeout: 20000 },
      );
      const pos = await Promise.all(
        [host, guest].map((p) =>
          p.evaluate(() => [window.__db.enemy.pos.x, window.__db.enemy.pos.z]),
        ),
      );
      expect(Math.hypot(pos[0][0] - pos[1][0], pos[0][1] - pos[1][1])).toBeLessThan(0.5);
      await host.keyboard.down('KeyW');
      try {
        await host.waitForFunction(
          () => window.__db.player.pos.distanceTo(window.__db.enemy.pos) <= 1.2,
          null,
          { timeout: 20000 },
        );
      } finally {
        await host.keyboard.up('KeyW');
      }
      for (let i = 0; i < 8; i++) {
        await guest.keyboard.press('KeyJ');
        await host.keyboard.press('KeyJ');
        await host.waitForTimeout(140);
      }
      await host.waitForTimeout(500);
      expect(await host.evaluate(() => window.__db.online.active)).toBe(true);
      expect(await guest.evaluate(() => window.__db.online.active)).toBe(true);
      const health = await host.evaluate(() =>
        [window.__db.player, window.__db.enemy].map((f) => ({ hp: f.hp, max: f.maxHp })),
      );
      expect(health.some((f) => f.hp < f.max)).toBe(true);
      const stats = await host.evaluate(() => window.__db.online.transport.stats);
      if (mode === 'direct') {
        expect(stats.directMessages).toBeGreaterThan(10);
        expect(stats.relayMessages).toBe(0);
      } else expect(stats.relayMessages).toBeGreaterThan(10);
      expect(errors.flat()).toEqual([]);
      const previousMatch = await host.evaluate(() => window.__db.online.room.match.id);
      await guest.keyboard.press('Escape');
      await expect(host.locator('#menu.onlineSelection')).toBeVisible();
      await expect(guest.locator('#menu.onlineSelection')).toBeVisible();
      expect(await guest.evaluate(() => window.__db.game.menuPage)).toBe('online');
      await expect(guest.locator('#startBtn')).toHaveText('准备对战');
      await host.locator('#startBtn').click();
      await guest.locator('#startBtn').click();
      await Promise.all(
        [host, guest].map((p) => expect(p.locator('#hud')).toHaveClass(/show/, { timeout: 20000 })),
      );
      expect(await host.evaluate(() => window.__db.online.room.match.id)).not.toBe(previousMatch);
      await guest.locator('#pauseBtn').click();
      await expect(host.locator('#menu.onlineSelection')).toBeVisible();
      await expect(guest.locator('#menu.onlineSelection')).toBeVisible();
      await guest.locator('#backHome').click();
      await expect(host.locator('#onlineRoomTitle')).toContainText('房间 1');
      await host.locator('#backHome').click();
      await expect(host.locator('[data-room="1"]')).toHaveText('创建房间');
      console.log(JSON.stringify({ mode, stats, position: pos, health, rematch: true }));
    } finally {
      await Promise.all(contexts.map((c) => c.close()));
    }
  });

test('mobile multiplayer entry and all three room buttons remain visible', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = await lobby(page);
  for (let room = 1; room <= 3; room++)
    await expect(page.locator(`[data-room="${room}"]`)).toBeVisible();
  await page.locator('#onlineHome').click();
  await expect(page.locator('#homeOnline')).toBeVisible();
  expect(errors).toEqual([]);
});

test('a stalled connection shows a retry button and a retry loads all three rooms', async ({
  page,
}) => {
  let attempts = 0;
  await page.routeWebSocket('**/api/online', (socket) => {
    if (++attempts > 1) socket.connectToServer();
  });
  await page.goto('/?test=1');
  await expect(page.locator('#loading')).toHaveClass('hidden');
  await page.locator('#homeOnline').click();
  await expect(page.locator('#onlineStatus')).toHaveText('连接超时，请重试', { timeout: 15000 });
  await expect(page.locator('#onlineRetry')).toBeVisible();
  expect(attempts).toBe(1);
  await page.locator('#onlineRetry').click();
  await expect(page.locator('.onlineRoomCard')).toHaveCount(3);
  await expect(page.locator('#onlineRetry')).toBeHidden();
  expect(attempts).toBe(2);
  expect(await page.evaluate(() => new URL(window.__db.online.transport.url).host)).toBe(
    new URL(page.url()).host,
  );
  await page.locator('#onlineHome').click();
});

test('guest movement responds locally while authoritative frames are delayed', async ({
  browser,
}) => {
  const contexts = await Promise.all([
    browser.newContext({ viewport: { width: 960, height: 600 } }),
    browser.newContext({ viewport: { width: 960, height: 600 } }),
  ]);
  const [host, guest] = await Promise.all(contexts.map((context) => context.newPage()));
  try {
    for (const page of [host, guest])
      await page.addInitScript(() => {
        window.RTCPeerConnection = undefined;
      });
    // Advance real game callbacks at 60 Hz during the short measurement windows.
    // SwiftShader can take longer than 50 ms to draw one frame on a CI runner.
    await guest.clock.install();
    await Promise.all([lobby(host), lobby(guest)]);
    await host.locator('[data-room="2"]').click();
    await expect(guest.locator('[data-room="2"]')).toHaveText('加入对战');
    await guest.locator('[data-room="2"]').click();
    for (const page of [host, guest])
      await expect.poll(() => page.evaluate(() => window.__db.online.room?.players.length)).toBe(2);
    await host.locator('#startBtn').click();
    await guest.locator('#startBtn').click();
    await guest.waitForFunction(() => window.__db.online.active && window.__db.game.ready <= 0);
    await pauseClock(guest);
    await guest.evaluate(() => {
      const { online, enemy } = window.__db;
      const receive = online.transport.onPacket;
      online.transport.onPacket = (packet) => {
        if (packet.kind === 'frames') setTimeout(() => receive(packet), 150);
        else receive(packet);
      };
      window.__latencyStart = [enemy.root.position.x, enemy.root.position.z];
      online.lastFlush = performance.now();
      window.__inputBefore = online.transport.stats.relayMessages;
    });
    await guest.keyboard.down('KeyW');
    const immediateInput = await guest.evaluate(() => {
      window.__db.online.frame();
      return window.__db.online.transport.stats.relayMessages > window.__inputBefore;
    });
    await guest.clock.runFor(50);
    const localDistance = await guest.evaluate(() => {
      const { enemy } = window.__db;
      return Math.hypot(
        enemy.root.position.x - window.__latencyStart[0],
        enemy.root.position.z - window.__latencyStart[1],
      );
    });
    console.log(JSON.stringify({ immediateInput, localDistance, delayedFramesMs: 150 }));
    expect(immediateInput).toBe(true);
    expect(localDistance).toBeGreaterThan(0.02);
    await guest.keyboard.up('KeyW');
    await guest.clock.resume();
    await guest.waitForTimeout(700);
    expect(await guest.evaluate(() => window.__db.online.active)).toBe(true);
    await guest.waitForFunction(() => window.__db.enemy.state === 'idle');
    await pauseClock(guest);
    await guest.keyboard.press('KeyJ');
    await guest.clock.runFor(40);
    const attackPreview = await guest.evaluate(() => ({
      displayed: window.__db.enemy.onlineVisualAction?.type === 'light',
      authoritativeAttack: !!window.__db.enemy.attack,
    }));
    console.log(JSON.stringify({ attackPreview }));
    expect(attackPreview.displayed).toBe(true);
    expect(attackPreview.authoritativeAttack).toBe(false);
    await guest.clock.resume();
    await guest.waitForTimeout(500);
    expect(await guest.evaluate(() => window.__db.online.active)).toBe(true);
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});

test('late spectators watch without seats or inputs, follow both fighters, and cleanly rejoin', async ({
  browser,
}, testInfo) => {
  const contexts = await Promise.all([
    browser.newContext({ viewport: { width: 960, height: 600 } }),
    browser.newContext({ viewport: { width: 960, height: 600 } }),
    browser.newContext({ viewport: { width: 960, height: 600 } }),
    browser.newContext({ viewport: { width: 390, height: 844 } }),
  ]);
  const [host, guest, viewer, mobile] = await Promise.all(contexts.map((c) => c.newPage()));
  try {
    for (const page of [host, guest])
      await page.addInitScript(() => {
        window.RTCPeerConnection = undefined;
      });
    const errors = await Promise.all([host, guest, viewer, mobile].map(lobby));
    await expect(viewer.locator('[data-watch-room]')).toHaveCount(0);
    await host.locator('[data-room="3"]').click();
    await expect(guest.locator('[data-room="3"]')).toHaveText('加入对战');
    await guest.locator('[data-room="3"]').click();
    await expect.poll(() => host.evaluate(() => window.__db.online.room.players.length)).toBe(2);
    await host.locator('#charList .char-card').nth(4).click();
    await expect(viewer.locator('[data-watch-room]')).toHaveCount(0);
    await host.locator('#startBtn').click();
    await guest.locator('#startBtn').click();
    // The button stays absent during the relay handshake and only appears on actual battle start.
    await expect.poll(() => viewer.evaluate(() => !!window.__db.online.rooms[2].match)).toBe(true);
    await expect(viewer.locator('[data-watch-room]')).toHaveCount(0);
    await expect(viewer.locator('[data-watch-room="3"]')).toBeVisible({ timeout: 20000 });
    await guest.waitForFunction(
      () => window.__db.game.ready <= 0 && window.__db.online.remoteSequence > 5,
    );
    await host.keyboard.down('KeyD');
    await host.waitForTimeout(500);
    await host.keyboard.up('KeyD');
    await host.keyboard.down('KeyI');
    await host.waitForFunction(() => window.__db.player.ki >= 90, null, { timeout: 60000 });
    await host.keyboard.up('KeyI');
    await host.waitForFunction(() => window.__db.player.state !== 'charge');
    await host.keyboard.down('KeyS');
    await host.keyboard.press('KeyR');
    await host.keyboard.up('KeyS');
    // Hold the timed form while slow software-GPU pages join and inspect its snapshots.
    // The real RAF, Worker and spectator publishing continue while combat is paused.
    await host.waitForFunction(
      () => {
        const db = window.__db;
        if (db.player.youth.form !== 'fourArms') return false;
        db.game.paused = true;
        return true;
      },
      null,
      { timeout: 10000 },
    );
    await viewer.locator('[data-watch-room="3"]').click();
    await viewer.waitForFunction(
      () => window.__db.online.spectating && window.__db.online.spectator.stats.received >= 3,
    );
    await mobile.locator('[data-watch-room="3"]').click();
    await mobile.waitForFunction(() => window.__db.online.spectator.stats.received >= 3);
    await expect.poll(() => host.evaluate(() => window.__db.online.room.spectators)).toBe(2);
    for (const page of [viewer, mobile]) {
      await expect(page.locator('#touch')).toBeHidden();
      await expect(page.locator('#singleTarget')).toBeHidden();
      await expect(page.locator('#splitOverlay')).toBeHidden();
      await expect(page.locator('#pauseBtn')).toHaveText('退出观战');
      expect(await page.evaluate(() => window.__db.player.youth.form)).toBe('fourArms');
      expect(await page.evaluate(() => window.__db.player.parts.extraArms.length)).toBe(2);
    }
    await host.evaluate(() => (window.__db.game.paused = false));
    const participantHealth = await host.evaluate(() => [
      window.__db.player.hp,
      window.__db.enemy.hp,
    ]);
    for (const page of [viewer, mobile]) {
      await page.keyboard.down('KeyW');
      for (const key of ['KeyJ', 'KeyK', 'KeyR', 'KeyF', 'KeyU', 'KeyO'])
        await page.keyboard.press(key);
      await page.keyboard.up('KeyW');
      const stats = await page.evaluate(() => window.__db.online.transport.stats);
      expect(stats.directMessages + stats.relayMessages + stats.spectatorMessages).toBe(0);
    }
    expect(await host.evaluate(() => [window.__db.player.hp, window.__db.enemy.hp])).toEqual(
      participantHealth,
    );
    await host.keyboard.down('KeyA');
    await host.waitForTimeout(400);
    await host.keyboard.up('KeyA');
    await host.waitForTimeout(600);
    const owner = await host.evaluate(() => [
      window.__db.player.pos.toArray(),
      window.__db.enemy.pos.toArray(),
    ]);
    for (const page of [viewer, mobile]) {
      const view = await page.evaluate(() => {
        const db = window.__db;
        return {
          positions: [db.player.pos.toArray(), db.enemy.pos.toArray()],
          target: db.online.spectator.stats.cameraTarget.toArray(),
          projected: [db.player, db.enemy].map((f) =>
            f.parts.head.getWorldPosition(f.pos.clone()).project(db.camera).toArray(),
          ),
          seats: db.online.room.players.length,
          observerSeat: db.online.room.players.some((p) => p.id === db.online.you),
        };
      });
      expect(view.seats).toBe(2);
      expect(view.observerSeat).toBe(false);
      for (let i = 0; i < 2; i++)
        expect(Math.hypot(...view.positions[i].map((p, j) => p - owner[i][j]))).toBeLessThan(0.5);
      for (const axis of [0, 2])
        expect(
          Math.abs(view.target[axis] - (view.positions[0][axis] + view.positions[1][axis]) / 2),
        ).toBeLessThan(0.2);
      for (const projected of view.projected) {
        expect(Math.abs(projected[0])).toBeLessThan(0.95);
        expect(Math.abs(projected[1])).toBeLessThan(0.95);
        expect(projected[2]).toBeGreaterThan(-1);
        expect(projected[2]).toBeLessThan(1);
      }
    }
    await viewer.screenshot({ path: testInfo.outputPath('spectator-desktop.png') });
    await mobile.screenshot({ path: testInfo.outputPath('spectator-mobile.png') });
    await host.keyboard.press('KeyF');
    await expect
      .poll(() => viewer.evaluate(() => window.__db.online.spectator.objects.size), {
        intervals: [30],
        timeout: 3000,
      })
      .toBeGreaterThan(0);
    await viewer.locator('#pauseBtn').click();
    await expect(viewer.locator('#onlineLobby')).toBeVisible();
    await expect.poll(() => host.evaluate(() => window.__db.online.room.spectators)).toBe(1);
    expect(
      await host.evaluate(
        () => window.__db.online.active && window.__db.online.room.players.length === 2,
      ),
    ).toBe(true);
    expect(await viewer.evaluate(() => window.__db.online.spectator.objects.size)).toBe(0);
    await viewer.locator('[data-watch-room="3"]').click();
    await viewer.waitForFunction(() => window.__db.online.spectator.stats.received >= 2);
    await contexts[3].close();
    await expect.poll(() => host.evaluate(() => window.__db.online.room.spectators)).toBe(1);
    await host.locator('#pauseBtn').click();
    await expect(viewer.locator('#onlineLobby')).toBeVisible();
    await expect(viewer.locator('[data-watch-room]')).toHaveCount(0);
    expect(
      await viewer.evaluate(() => window.__db.online.active || window.__db.online.spectating),
    ).toBe(false);
    expect(await viewer.evaluate(() => window.__db.online.spectator.objects.size)).toBe(0);
    await expect(host.locator('#startBtn')).toHaveText('准备对战');
    await expect(guest.locator('#startBtn')).toHaveText('准备对战');
    await host.locator('#startBtn').click();
    await guest.locator('#startBtn').click();
    await expect(viewer.locator('[data-watch-room="3"]')).toBeVisible({ timeout: 20000 });
    await viewer.locator('[data-watch-room="3"]').click();
    await viewer.waitForFunction(() => window.__db.online.spectator.stats.received >= 2);
    // Closing a participant ends viewing; closing a spectator above did not disturb the match.
    await contexts[0].close();
    await expect(viewer.locator('#onlineLobby')).toBeVisible();
    await expect(viewer.locator('[data-watch-room]')).toHaveCount(0);
    expect(await viewer.evaluate(() => window.__db.online.spectator.objects.size)).toBe(0);
    expect(errors.flat()).toEqual([]);
  } catch (error) {
    const diagnostics = await Promise.all(
      [host, guest, viewer, mobile].map(async (page) => {
        try {
          return await page.evaluate(() => ({
            status: document.querySelector('#onlineStatus')?.textContent,
            diagnostics: window.__db?.online.exportDiagnostics(),
          }));
        } catch {
          return { closed: true };
        }
      }),
    );
    await testInfo.attach('online-diagnostics', {
      body: JSON.stringify(diagnostics, null, 2),
      contentType: 'application/json',
    });
    console.log(
      'SPECTATOR FAILURE',
      JSON.stringify(
        diagnostics.map((entry) => ({
          status: entry.status,
          delivery: entry.diagnostics?.delivery,
          events: entry.diagnostics?.events.filter((event) =>
            /error|recovery|state-|transport-switch/.test(event.kind),
          ),
        })),
      ),
    );
    throw error;
  } finally {
    await Promise.all(contexts.map((c) => c.close()));
  }
});

test('solar reversal and ox king armor replay identically on both multiplayer endpoints', async ({
  browser,
}) => {
  const contexts = await Promise.all([browser.newContext(), browser.newContext()]);
  const [host, guest] = await Promise.all(contexts.map((context) => context.newPage()));
  try {
    for (const page of [host, guest])
      await page.addInitScript(() => {
        window.RTCPeerConnection = undefined;
      });
    const errors = await Promise.all([lobby(host), lobby(guest)]);
    await host.locator('[data-room="2"]').click();
    await expect(guest.locator('[data-room="2"]')).toHaveText('加入对战');
    await guest.locator('[data-room="2"]').click();
    await expect.poll(() => host.evaluate(() => window.__db.online.room.players.length)).toBe(2);
    await host.locator('#charList .char-card').nth(4).click();
    await guest.locator('#charList .char-card').nth(7).click();
    await host.locator('#startBtn').click();
    await guest.locator('#startBtn').click();
    await guest.waitForFunction(
      () => window.__db.game.ready <= 0 && window.__db.online.remoteSequence > 5,
    );
    await host.keyboard.down('KeyW');
    try {
      await host.waitForFunction(
        () => window.__db.player.pos.distanceTo(window.__db.enemy.pos) < 2.5,
      );
    } finally {
      await host.keyboard.up('KeyW');
    }
    await host.keyboard.press('KeyR');
    await host.waitForFunction(() => window.__db.enemy.youth.reversedTime > 1);
    await guest.waitForFunction(() => window.__db.enemy.youth.reversedTime > 1);
    await guest.keyboard.down('KeyW');
    try {
      await host.waitForFunction(
        () => window.__db.enemy.lastInput.down && !window.__db.enemy.lastInput.up,
      );
      await guest.waitForFunction(
        () => window.__db.enemy.lastInput.down && !window.__db.enemy.lastInput.up,
      );
    } finally {
      await guest.keyboard.up('KeyW');
    }
    await guest.waitForFunction(() => window.__db.enemy.youth.reversedTime === 0);
    await guest.keyboard.press('KeyK');
    await host.waitForFunction(() => window.__db.enemy.attack?.superArmor === true);
    await guest.waitForFunction(() => window.__db.enemy.attack?.superArmor === true);
    expect(await host.evaluate(() => window.__db.online.active)).toBe(true);
    expect(await guest.evaluate(() => window.__db.online.active)).toBe(true);
    expect(errors.flat()).toEqual([]);
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});

test('yamcha dodge counter and double health bars replay across a real relay match', async ({
  browser,
}) => {
  const contexts = await Promise.all([browser.newContext(), browser.newContext()]);
  const [host, guest] = await Promise.all(contexts.map((c) => c.newPage()));
  try {
    for (const page of [host, guest])
      await page.addInitScript(() => {
        window.RTCPeerConnection = undefined;
      });
    const errors = await Promise.all([lobby(host), lobby(guest)]);
    await host.locator('[data-room="3"]').click();
    await expect(guest.locator('[data-room="3"]')).toHaveText('加入对战');
    await guest.locator('[data-room="3"]').click();
    await expect.poll(() => host.evaluate(() => window.__db.online.room.players.length)).toBe(2);
    await host.locator('#charList .char-card').nth(0).click();
    await guest.locator('#charList .char-card').nth(6).click();
    await host.locator('#startBtn').click();
    await guest.locator('#startBtn').click();
    await guest.waitForFunction(
      () => window.__db.game.ready <= 0 && window.__db.online.remoteSequence > 5,
    );
    for (const page of [host, guest]) {
      expect(
        await page.evaluate(() =>
          [window.__db.player, window.__db.enemy].every(
            (f) => f.hp === f.def.hp * 2 && f.maxHp === f.def.hp * 2,
          ),
        ),
      ).toBe(true);
      await expect(page.locator('#p1reserve')).toBeVisible();
      await expect(page.locator('#p2reserve')).toBeVisible();
    }
    await host.bringToFront();
    await host.keyboard.down('KeyW');
    try {
      await host.waitForFunction(
        () => window.__db.player?.pos.distanceTo(window.__db.enemy.pos) < 1.3,
        null,
        { timeout: 15000 },
      );
    } finally {
      await host.keyboard.up('KeyW');
    }
    await guest.keyboard.down('KeyS');
    await guest.keyboard.press('KeyR');
    await guest.keyboard.up('KeyS');
    await host.waitForFunction(() => window.__db.enemy.attack?.ability === 'sidestep');
    await host.bringToFront();
    await host.keyboard.press('KeyJ');
    await host.waitForFunction(() => window.__db.player.launchFlight);
    await guest.waitForFunction(() => window.__db.player.launchFlight);
    await host.waitForFunction(() => window.__db.player.state === 'idle');
    const sequence = await host.evaluate(() => window.__db.online.sequence);
    await guest.waitForFunction((seq) => window.__db.online.remoteSequence > seq, sequence);
    const states = await Promise.all(
      [host, guest].map((page) =>
        page.evaluate(() => ({
          active: window.__db.online.active,
          hp: [window.__db.player.hp, window.__db.enemy.hp],
        })),
      ),
    );
    expect(states[0].active && states[1].active).toBe(true);
    expect(states[0].hp).toEqual(states[1].hp);
    expect(states[0].hp[0]).toBeLessThan(480);
    expect(states[0].hp[1]).toBe(480);
    expect(errors.flat()).toEqual([]);
  } finally {
    await Promise.all(contexts.map((c) => c.close()));
  }
});

for (const mode of ['direct', 'relay']) {
  test(`defense fatigue, real guard breaks and recovery stay synchronized over ${mode}`, async ({
    browser,
  }) => {
    const contexts = await Promise.all([
      browser.newContext({ permissions: mode === 'direct' ? ['camera', 'microphone'] : [] }),
      browser.newContext({ permissions: mode === 'direct' ? ['camera', 'microphone'] : [] }),
    ]);
    const [host, guest] = await Promise.all(contexts.map((c) => c.newPage()));
    try {
      if (mode === 'relay')
        for (const page of [host, guest])
          await page.addInitScript(() => {
            window.RTCPeerConnection = undefined;
          });
      const errors = await Promise.all([lobby(host), lobby(guest)]);
      await host.locator('[data-room="1"]').click();
      await guest.locator('[data-room="1"]').click();
      await expect.poll(() => host.evaluate(() => window.__db.online.room.players.length)).toBe(2);
      await host.locator('#charList .char-card').nth(0).click();
      await guest.locator('#charList .char-card').nth(5).click();
      await host.locator('#startBtn').click();
      await guest.locator('#startBtn').click();
      await guest.waitForFunction(
        () => window.__db.game.ready <= 0 && window.__db.online.remoteSequence > 5,
        null,
        { timeout: 20000 },
      );
      await guest.keyboard.down('KeyL');
      for (const page of [host, guest])
        await page.waitForFunction(() => window.__db.enemy.guard < 88, null, { timeout: 15000 });
      for (const page of [host, guest]) {
        expect(await page.evaluate(() => window.__db.enemy.hp === window.__db.enemy.maxHp)).toBe(
          true,
        );
        await expect(page.locator('#p2guardResource')).toHaveAttribute('data-state', 'blocking');
      }
      await guest.keyboard.up('KeyL');
      for (const page of [host, guest])
        await page.waitForFunction(() => window.__db.enemy.guard === 100, null, { timeout: 15000 });
      await host.keyboard.down('KeyW');
      await host.waitForFunction(
        () => window.__db.player.pos.distanceTo(window.__db.enemy.pos) < 1.2,
        null,
        { timeout: 15000 },
      );
      await guest.keyboard.down('KeyL');
      await host.waitForFunction(() => window.__db.enemy.guardHeld > 0.15, null, {
        timeout: 10000,
      });
      let stop = false;
      const attacks = (async () => {
        for (let i = 0; i < 20 && !stop; i++) {
          await host.keyboard.press('KeyK');
          await host.waitForTimeout(400);
        }
      })();
      try {
        await host.waitForFunction(() => window.__db.enemy.guardBroken, null, { timeout: 15000 });
        stop = true;
        await attacks;
        await host.keyboard.up('KeyW');
        await guest.waitForFunction(() => window.__db.enemy.guardBroken, null, { timeout: 10000 });
      } finally {
        stop = true;
        await attacks;
        await host.keyboard.up('KeyW');
      }
      for (const page of [host, guest]) {
        expect(await page.evaluate(() => window.__db.enemy.hp < window.__db.enemy.maxHp)).toBe(
          true,
        );
        expect(await page.evaluate(() => window.__db.enemy.guard < 30)).toBe(true);
      }
      // Inspect both peers while defense is broken, before waiting for either
      // peer to recover (the authoritative recovery advances both peers).
      for (const page of [host, guest]) {
        await page.waitForFunction(
          () => !window.__db.enemy.guardBroken && window.__db.enemy.state === 'block',
          null,
          { timeout: 15000 },
        );
      }
      await guest.keyboard.up('KeyL');
      for (const page of [host, guest])
        await page.waitForFunction(() => window.__db.enemy.guard === 100, null, { timeout: 15000 });
      for (const page of [host, guest])
        expect(await page.evaluate(() => window.__db.online.active)).toBe(true);
      expect(errors.flat()).toEqual([]);
    } finally {
      await Promise.all(contexts.map((c) => c.close()));
    }
  });
}

test('mismatched combat versions return both players to the room before simulation', async ({
  browser,
}) => {
  const contexts = await Promise.all([browser.newContext(), browser.newContext()]);
  const [host, guest] = await Promise.all(contexts.map((c) => c.newPage()));
  try {
    for (const page of [host, guest])
      await page.addInitScript(() => {
        window.RTCPeerConnection = undefined;
      });
    const errors = await Promise.all([lobby(host), lobby(guest)]);
    await host.locator('[data-room="2"]').click();
    await expect(guest.locator('[data-room="2"]')).toHaveText('加入对战');
    await guest.locator('[data-room="2"]').click();
    await host.waitForFunction(() => window.__db.online.room?.players.length === 2);
    await guest.waitForFunction(() => window.__db.online.room?.players.length === 2);
    await guest.evaluate(() => {
      const transport = window.__db.online.transport;
      const raw = Object.getPrototypeOf(transport).packet;
      transport.packet = (data) =>
        raw.call(transport, { ...data, protocol: -1, ruleset: 'older-build' });
    });
    await host.locator('#startBtn').click();
    await guest.locator('#startBtn').click();
    await expect(host.locator('#onlineStatus')).toContainText('对战版本不同', { timeout: 15000 });
    await host.waitForFunction(() => !window.__db.online.active && !window.__db.online.room.match);
    await guest.waitForFunction(() => !window.__db.online.active && !window.__db.online.room.match);
    expect(
      await host.evaluate(() =>
        window.__db.online.diagnostics.some((e) => e.kind === 'version-mismatch'),
      ),
    ).toBe(true);
    expect(errors.flat()).toEqual([]);
  } finally {
    await Promise.all(contexts.map((c) => c.close()));
  }
});

async function startDeliveryPair(browser, relay = false) {
  const contexts = await Promise.all(
    [0, 1].map(() =>
      browser.newContext({
        permissions: relay ? [] : ['camera', 'microphone'],
      }),
    ),
  );
  try {
    const [host, guest] = await Promise.all(contexts.map((c) => c.newPage()));
    if (relay)
      for (const page of [host, guest])
        await page.addInitScript(() => {
          window.RTCPeerConnection = undefined;
        });
    const errors = await Promise.all([lobby(host), lobby(guest)]);
    await host.locator('[data-room="2"]').click();
    await expect(guest.locator('[data-room="2"]')).toHaveText('加入对战');
    await guest.locator('[data-room="2"]').click();
    for (const page of [host, guest])
      await page.waitForFunction(() => window.__db.online.room?.players.length === 2);
    if (!relay)
      for (const page of [host, guest])
        await page.waitForFunction(
          () => window.__db.online.transport.channel?.readyState === 'open',
        );
    await host.locator('#startBtn').click();
    await guest.locator('#startBtn').click();
    await guest.waitForFunction(() => window.__db.online.active && window.__db.game.ready <= 0);
    return { host, guest, errors, close: () => Promise.all(contexts.map((c) => c.close())) };
  } catch (error) {
    await Promise.all(contexts.map((context) => context.close()));
    throw error;
  }
}

test('new host simulation is flushed in the same frame before the next input phase', async ({
  browser,
}) => {
  const pair = await startDeliveryPair(browser);
  try {
    await pair.host.evaluate(() => {
      const online = window.__db.online;
      const frame = online.frame;
      window.__flushSample = [];
      online.frame = () => {
        window.__flushSample.push(online.pendingFrames.length);
        return frame();
      };
    });
    await pair.host.waitForFunction(() => window.__flushSample.length >= 30);
    const sample = await pair.host.evaluate(() => window.__flushSample);
    expect(sample.slice(1).every((count) => count === 0)).toBe(true);
    expect(await pair.guest.evaluate(() => window.__db.online.active)).toBe(true);
    expect(pair.errors.flat()).toEqual([]);
  } finally {
    await pair.close();
  }
});

test('real DC to relay handoff fills a frame gap and deduplicates late input actions', async ({
  browser,
}) => {
  const pair = await startDeliveryPair(browser);
  const { host, guest } = pair;
  try {
    const before = await guest.evaluate(() => window.__db.online.remoteSequence);
    await host.evaluate(() => {
      const online = window.__db.online,
        channel = online.transport.channel;
      const send = channel.send.bind(channel);
      window.__heldFrame = null;
      channel.send = (raw) => {
        if (!window.__heldFrame && JSON.parse(raw).packet.kind === 'frames') {
          window.__heldFrame = raw;
          Object.defineProperty(channel, 'bufferedAmount', {
            configurable: true,
            get: () => 65536,
          });
          setTimeout(() => {
            if (channel.readyState === 'open') send(raw);
          }, 350);
          return;
        }
        send(raw);
      };
      const receive = online.transport.onPacket;
      window.__receivedLight = 0;
      online.transport.onPacket = (packet) => {
        if (packet.kind === 'input')
          window.__receivedLight += packet.data[2].filter((action) => action[0] === 0).length;
        return receive(packet);
      };
    });
    await guest.waitForFunction((seq) => window.__db.online.remoteSequence > seq + 15, before);
    for (const page of [host, guest])
      expect(await page.evaluate(() => window.__db.online.transport.forceRelay)).toBe(true);
    // Duplicate a real input envelope through WS. Delivery must filter it before
    // session.js consumes the action or applies an older held state.
    await guest.evaluate(() => {
      const socket = window.__db.online.transport.ws,
        send = socket.send.bind(socket);
      let duplicated = false;
      socket.send = (raw) => {
        send(raw);
        const message = JSON.parse(raw);
        if (!duplicated && message.packet?.kind === 'input' && message.packet.data[2].length) {
          duplicated = true;
          setTimeout(() => send(raw), 150);
        }
      };
    });
    await guest.keyboard.down('KeyA');
    await guest.keyboard.press('KeyJ');
    await guest.keyboard.up('KeyA');
    await expect.poll(() => host.evaluate(() => window.__receivedLight)).toBe(1);
    await guest.waitForTimeout(700);
    expect(await host.evaluate(() => window.__receivedLight)).toBe(1);
    expect(await host.evaluate(() => window.__db.online.remote.left)).toBe(false);
    for (const page of [host, guest]) {
      expect(await page.evaluate(() => window.__db.online.active)).toBe(true);
      expect(
        await page.evaluate(() =>
          window.__db.online.diagnostics.filter((e) => /error/.test(e.kind)),
        ),
      ).toEqual([]);
    }
    expect(
      await guest.evaluate(() => window.__db.online.transport.delivery.stats.duplicates),
    ).toBeGreaterThan(0);
    expect(pair.errors.flat()).toEqual([]);
  } finally {
    await pair.close();
  }
});

test('30 Hz relay and live spectator frames stay within the real Worker message budget', async ({
  browser,
}) => {
  const pair = await startDeliveryPair(browser, true);
  const viewer = await browser.newPage();
  try {
    const viewerErrors = await lobby(viewer);
    await viewer.locator('[data-watch-room="2"]').click();
    await viewer.waitForFunction(() => window.__db.online.spectator.stats.received >= 2);
    const sample = await pair.host.evaluate(async () => {
      const o = window.__db.online,
        from = o.sequence,
        at = performance.now();
      await new Promise((resolve) => setTimeout(resolve, 3500));
      return { hz: ((o.sequence - from) * 1000) / (performance.now() - at), active: o.active };
    });
    expect(sample.active).toBe(true);
    expect(sample.hz).toBeGreaterThan(24);
    expect(sample.hz).toBeLessThan(34);
    expect(await pair.guest.evaluate(() => window.__db.online.active)).toBe(true);
    expect(
      await viewer.evaluate(() => window.__db.online.spectator.stats.received),
    ).toBeGreaterThan(20);
    expect([...pair.errors.flat(), ...viewerErrors]).toEqual([]);
  } finally {
    await viewer.close();
    await pair.close();
  }
});

for (const mode of ['direct', 'relay'])
  test(`kami fourth map synchronizes real ${mode} combat, damage and senzu`, async ({
    browser,
  }) => {
    test.setTimeout(90000);
    const contexts = await Promise.all([browser.newContext(), browser.newContext()]);
    const [host, guest] = await Promise.all(contexts.map((c) => c.newPage()));
    try {
      if (mode === 'relay')
        for (const page of [host, guest])
          await page.addInitScript(() => {
            window.RTCPeerConnection = undefined;
          });
      const errors = await Promise.all([lobby(host), lobby(guest)]);
      await host.locator('[data-room="2"]').click();
      await expect(guest.locator('[data-room="2"]')).toHaveText('加入对战');
      await guest.locator('[data-room="2"]').click();
      await expect.poll(() => host.evaluate(() => window.__db.online.room.players.length)).toBe(2);
      await host.locator('#mapList .map-card').nth(3).click();
      await expect(guest.locator('#mapList .map-card').nth(3)).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      await host.locator('#startBtn').click();
      await guest.locator('#startBtn').click();
      for (const page of [host, guest])
        await expect(page.locator('#hud')).toHaveClass(/show/, { timeout: 20000 });
      await guest.waitForFunction(
        () => window.__db.game.ready <= 0 && window.__db.online.remoteSequence > 3,
      );
      expect(await host.evaluate(() => window.__db.map.group.userData.kami.radius)).toBe(28);
      expect(await guest.evaluate(() => window.__db.map.group.userData.kami.radius)).toBe(28);
      const before = await guest.evaluate(() => window.__db.enemy.pos.toArray());
      await guest.keyboard.down('KeyW');
      await guest.waitForFunction(
        (before) =>
          Math.hypot(window.__db.enemy.pos.x - before[0], window.__db.enemy.pos.z - before[2]) >
          0.6,
        before,
      );
      await guest.keyboard.up('KeyW');
      await host.keyboard.down('KeyI');
      await host.waitForFunction(() => window.__db.player.ki >= 100, null, { timeout: 15000 });
      await host.keyboard.up('KeyI');
      await host.keyboard.press('KeyU');
      await guest.waitForFunction(() => window.__db.map.brokenTiles > 0, null, { timeout: 20000 });
      await guest.waitForFunction(() => window.__db.map.senzus?.some((b) => b.active), null, {
        timeout: 45000,
      });
      const values = await Promise.all(
        [host, guest].map((page) =>
          page.evaluate(() => ({
            map: window.__db.game.selectedMap,
            tiles: window.__db.map.brokenTiles,
            beans: window.__db.map.senzuSpawnCount,
            mode: window.__db.online.transport.mode,
          })),
        ),
      );
      expect(values[0].map).toBe(3);
      expect(values[1].map).toBe(3);
      expect(values[0].tiles).toBe(values[1].tiles);
      expect(values[0].beans).toBe(values[1].beans);
      console.log('KAMI ONLINE', JSON.stringify({ mode, values }));
      expect(errors.flat()).toEqual([]);
    } catch (error) {
      console.log(
        'KAMI ONLINE FAILURE',
        JSON.stringify(
          await Promise.all(
            [host, guest].map((page) =>
              page.evaluate(() => ({
                active: window.__db?.online.active,
                status: document.querySelector('#onlineStatus')?.textContent,
                diagnostics: window.__db?.online.exportDiagnostics?.(),
              })),
            ),
          ),
        ),
      );
      throw error;
    } finally {
      await Promise.all(contexts.map((c) => c.close()));
    }
  });

for (const mode of ['direct', 'relay']) {
  test(`full gameplay state recovers a real ${mode} peer and accepts subsequent inputs`, async ({
    browser,
  }) => {
    const pair = await startDeliveryPair(browser, mode === 'relay');
    try {
      await pair.guest.evaluate(() => {
        window.__db.enemy.hp -= 7;
      });
      await pair.guest.waitForFunction(
        () => window.__db.online.diagnostics.some((e) => e.kind === 'state-loaded'),
        null,
        { timeout: 20000 },
      );
      await pair.host.waitForFunction(() =>
        window.__db.online.diagnostics.some((e) => e.kind === 'state-resumed'),
      );
      const before = await pair.host.evaluate(() => window.__db.enemy.pos.toArray());
      await pair.guest.keyboard.down('KeyW');
      await pair.host.waitForFunction(
        (before) =>
          window.__db.enemy.pos.distanceTo({ x: before[0], y: before[1], z: before[2] }) > 0.5,
        before,
      );
      await pair.guest.keyboard.up('KeyW');
      await pair.guest.keyboard.press('KeyJ');
      await pair.host.waitForFunction(() =>
        window.__db.online.diagnostics.some(
          (e) => e.kind === 'input-accepted' && e.actions.includes('light'),
        ),
      );
      for (const page of [pair.host, pair.guest]) {
        expect(
          await page.evaluate(
            () => window.__db.online.active && !window.__db.online.recovery.paused,
          ),
        ).toBe(true);
        expect(await page.evaluate(() => window.__db.enemy.hp)).toBe(480);
      }
      expect(pair.errors.flat()).toEqual([]);
    } catch (error) {
      console.log(
        'RECOVERY DIAGNOSTICS',
        JSON.stringify(
          await Promise.all(
            [pair.host, pair.guest].map((page) =>
              page.evaluate(() => ({
                active: window.__db.online.active,
                recovery: window.__db.online.recovery?.pending,
                diagnostics: window.__db.online.exportDiagnostics(),
              })),
            ),
          ),
        ),
      );
      throw error;
    } finally {
      await pair.close();
    }
  });

  test(`result rematch preserves ${mode} opponents, settings and series score`, async ({
    browser,
  }) => {
    test.setTimeout(120000);
    const pair = await startDeliveryPair(browser, mode === 'relay');
    try {
      const id = await pair.host.evaluate(() => window.__db.online.room.match.id);
      for (let n = 0; n < 5 && !(await pair.host.evaluate(() => window.__db.game.over)); n++) {
        if (
          await pair.host.evaluate(
            () => window.__db.player.pos.distanceTo(window.__db.enemy.pos) > 8,
          )
        ) {
          await pair.host.keyboard.down('KeyW');
          await pair.host.waitForFunction(
            () => window.__db.player.pos.distanceTo(window.__db.enemy.pos) < 8,
            null,
            { timeout: 10000 },
          );
          await pair.host.keyboard.up('KeyW');
        }
        await pair.host.keyboard.down('KeyI');
        await pair.host.waitForFunction(() => window.__db.player.ki >= 100, null, {
          timeout: 12000,
        });
        await pair.host.keyboard.up('KeyI');
        console.log(
          'REMATCH ULT',
          n,
          await pair.host.evaluate(() => ({
            ki: window.__db.player.ki,
            hp: window.__db.enemy.hp,
            active: window.__db.online.active,
          })),
        );
        await pair.host.keyboard.press('KeyU');
        await pair.host.waitForFunction(
          () => window.__db.game.over || window.__db.player.attack?.isUlt,
          null,
          { timeout: 10000 },
        );
        await pair.host.waitForFunction(
          () => window.__db.game.over || !window.__db.player.attack,
          null,
          { timeout: 10000 },
        );
      }
      await pair.guest.waitForFunction(() => window.__db.game.over);
      await expect(pair.host.locator('#againBtn')).toHaveText('与对手再战');
      await pair.host.locator('#againBtn').click();
      await expect(pair.host.locator('#againBtn')).toHaveText('取消再战 · 等待对手');
      await pair.host.locator('#againBtn').click();
      await expect(pair.host.locator('#againBtn')).toHaveText('与对手再战');
      expect(await pair.host.evaluate(() => window.__db.online.room.match.id)).toBe(id);
      await pair.host.locator('#againBtn').click();
      await pair.guest.locator('#againBtn').click();
      for (const page of [pair.host, pair.guest])
        await page.waitForFunction(
          (id) =>
            window.__db.online.active &&
            window.__db.online.room.match.id !== id &&
            window.__db.game.ready <= 0,
          id,
          { timeout: 20000 },
        );
      expect(await pair.host.evaluate(() => window.__db.online.room.series.scores)).toEqual([1, 0]);
      await pair.host.locator('#pauseBtn').click();
      for (const page of [pair.host, pair.guest])
        await page.waitForFunction(
          () => !window.__db.online.active && !window.__db.online.room.match,
        );
      await pair.guest
        .locator('#charList .char-card')
        .nth(
          await pair.guest.evaluate(() => window.__db.CHARACTERS.findIndex((c) => c.id === 'tien')),
        )
        .click();
      expect(await pair.host.evaluate(() => window.__db.online.room.series.scores)).toEqual([1, 0]);
      await pair.host.locator('#startBtn').click();
      await pair.guest.locator('#startBtn').click();
      await pair.guest.waitForFunction(
        () => window.__db.online.active && window.__db.game.ready <= 0,
      );
      expect(await pair.guest.evaluate(() => window.__db.enemy.def.id)).toBe('tien');
      expect(pair.errors.flat()).toEqual([]);
    } catch (error) {
      console.log(
        'RECOVERY DIAGNOSTICS',
        JSON.stringify(
          await Promise.all(
            [pair.host, pair.guest].map((page) =>
              page.evaluate(() => ({
                active: window.__db.online.active,
                recovery: window.__db.online.recovery?.pending,
                diagnostics: window.__db.online.exportDiagnostics(),
              })),
            ),
          ),
        ),
      );
      throw error;
    } finally {
      await pair.close();
    }
  });
}

for (const mode of ['direct', 'relay'])
  test(`authority timing records ${mode} device input, acceptance and contact under 75ms input delay`, async ({
    browser,
  }) => {
    const pair = await startDeliveryPair(browser, mode === 'relay');
    try {
      await pair.guest.evaluate(() => {
        const transport = window.__db.online.transport,
          write = transport.writePacket.bind(transport);
        transport.writePacket = (packet) => {
          if (packet.kind === 'input') {
            setTimeout(() => write(packet), 75);
            return true;
          }
          return write(packet);
        };
      });
      await pair.host.keyboard.press('KeyJ');
      await pair.host.waitForFunction(() =>
        window.__db.online.diagnostics.some((e) => e.kind === 'host-input-accepted'),
      );
      await pair.guest.keyboard.press('KeyJ');
      await pair.guest.waitForFunction(() => window.__db.online.inputSamples.length > 0);
      await pair.host.keyboard.down('KeyW');
      await pair.host.waitForFunction(
        () => window.__db.player.pos.distanceTo(window.__db.enemy.pos) < 1.2,
      );
      await pair.host.keyboard.up('KeyW');
      await pair.host.waitForFunction(
        () => !window.__db.player.attack && !window.__db.enemy.attack,
      );
      await pair.guest.keyboard.press('KeyJ');
      await pair.host.waitForFunction(() =>
        window.__db.online.diagnostics.some(
          (e) => e.kind === 'authoritative-combat' && e.event === 'contact' && e.side === 1,
        ),
      );
      const records = await Promise.all(
        [pair.host, pair.guest].map((page) =>
          page.evaluate(() => window.__db.online.exportDiagnostics()),
        ),
      );
      const { mkdir, writeFile } = await import('node:fs/promises');
      await mkdir('performance/completion-audit', { recursive: true });
      await writeFile(
        `performance/completion-audit/authority-${mode}.json`,
        JSON.stringify(records, null, 2),
      );
      const host = records[0].events.filter((e) => e.kind === 'host-input-accepted'),
        samples = records[1].inputSamples;
      expect(host.every((e) => Number.isFinite(e.deviceToAcceptanceMs))).toBe(true);
      expect(samples.some((e) => e.confirmedRoundTripMs >= 75)).toBe(true);
      expect(
        records[0].events.some(
          (e) =>
            e.kind === 'authoritative-combat' &&
            e.event === 'contact' &&
            Number.isSafeInteger(e.inputSequence),
        ),
      ).toBe(true);
      expect(pair.errors.flat()).toEqual([]);
    } finally {
      await pair.close();
    }
  });
