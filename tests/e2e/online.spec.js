import { test, expect } from '@playwright/test';

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
  const result = await page.evaluate(async () => {
    const sockets = [];
    async function connect() {
      const socket = new WebSocket('ws://127.0.0.1:8787/connect');
      const client = { socket, state: null, error: null };
      sockets.push(client);
      socket.onmessage = ({ data }) => {
        const message = JSON.parse(data);
        if (message.type === 'state') client.state = message;
        if (message.type === 'error') client.error = message.message;
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
        thirdPlayerDenied: !!clients[4].error,
        emptyClosed: true,
      };
    } finally {
      sockets.forEach(({ socket }) => socket.close());
    }
  });
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
