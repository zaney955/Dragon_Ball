import { test, expect } from '@playwright/test';
import { spectatorFixture } from '../fixtures/spectator.js';

test.skip(!process.env.ONLINE_TEST, 'Run npm run test:online for the multiplayer runtime.');

async function lobby(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?test=1');
  await expect(page.locator('#loading')).toHaveClass('hidden');
  await page.evaluate(() => window.__db.renderer.setPixelRatio(0.5));
  await page.locator('#homeOnline').click();
  await expect(page.locator('.onlineRoomCard')).toHaveCount(3);
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
      const socket = new WebSocket('ws://127.0.0.1:8787/connect');
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
      send(clients[0], { type: 'playing', match: id });
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
      await expect(guest.locator('[data-room="1"]')).toHaveText('加入房间');
      await guest.locator('[data-room="1"]').click();
      await expect(host.locator('#onlineRoomTitle')).toHaveText('房间 1');
      await expect.poll(() => host.evaluate(() => window.__db.online.room.players.length)).toBe(2);
      for (const page of [host, guest]) {
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
      await expect(host.locator('#startBtn')).toHaveText('准备');
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
      await guest.keyboard.down('KeyW');
      await guest.waitForTimeout(500);
      await guest.keyboard.up('KeyW');
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
      await host.waitForTimeout(500);
      await host.keyboard.up('KeyW');
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
      await expect(guest.locator('#startBtn')).toHaveText('准备');
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
      await expect(host.locator('#onlineRoomTitle')).toHaveText('房间 1');
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
    await Promise.all([lobby(host), lobby(guest)]);
    await host.locator('[data-room="2"]').click();
    await expect(guest.locator('[data-room="2"]')).toHaveText('加入房间');
    await guest.locator('[data-room="2"]').click();
    for (const page of [host, guest])
      await expect.poll(() => page.evaluate(() => window.__db.online.room?.players.length)).toBe(2);
    await host.locator('#startBtn').click();
    await guest.locator('#startBtn').click();
    await guest.waitForFunction(() => window.__db.online.active && window.__db.game.ready <= 0);
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
    await guest.waitForTimeout(50);
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
    await guest.waitForTimeout(700);
    expect(await guest.evaluate(() => window.__db.online.active)).toBe(true);
    await guest.waitForFunction(() => window.__db.enemy.state === 'idle');
    await guest.keyboard.press('KeyJ');
    await guest.waitForTimeout(40);
    const attackPreview = await guest.evaluate(() => ({
      displayed: window.__db.enemy.onlineVisualAction?.type === 'light',
      authoritativeAttack: !!window.__db.enemy.attack,
    }));
    console.log(JSON.stringify({ attackPreview }));
    expect(attackPreview.displayed).toBe(true);
    expect(attackPreview.authoritativeAttack).toBe(false);
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
    await expect(guest.locator('[data-room="3"]')).toHaveText('加入房间');
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
    await host.waitForFunction(() => window.__db.player.ki >= 90, null, { timeout: 10000 });
    await host.keyboard.up('KeyI');
    await host.waitForFunction(() => window.__db.player.state !== 'charge');
    await host.keyboard.down('KeyS');
    await host.keyboard.press('KeyR');
    await host.keyboard.up('KeyS');
    await host.waitForFunction(() => window.__db.player.youth.form === 'fourArms', null, {
      timeout: 10000,
    });
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
    await expect(host.locator('#startBtn')).toHaveText('准备');
    await expect(guest.locator('#startBtn')).toHaveText('准备');
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
  } finally {
    await Promise.all(contexts.map((c) => c.close()));
  }
});
