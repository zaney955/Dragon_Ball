import { OnlineTransport } from './transport.js';
import { decodeInput, encodeInput } from './input-codec.js';

export function register({ app, ai, combat, input, match, render, ui, world }) {
  const online = (app.online = {
    active: false,
    rooms: [],
    you: null,
    room: null,
    host: false,
    sequence: 0,
    remote: { actions: [] },
    pendingFrames: [],
    remoteActions: [],
  });
  let baseAdvance, baseBack, basePause, baseVictory, previousSettings;
  const status = (message) => online.onStatus?.(message);
  const neutral = () => ({ actions: [] });
  const checkpoint = () => [
    ai.tacticalSeed,
    match.game.timeLeft,
    ...[match.player, match.enemy].flatMap((f) => [
      f.hp,
      f.ki,
      f.pos.x,
      f.pos.y,
      f.pos.z,
      f.stateTimer,
    ]),
  ];
  const canonical = (value) => decodeInput(encodeInput(value));
  const remoteInput = () => ({ ...online.remote, actions: online.remoteActions.splice(0, 20) });

  online.connect = () => online.transport.connect();
  online.command = (message) => online.transport.send(message);
  online.releaseInput = () => {
    for (const key in input.keys) input.keys[key] = false;
    input.clearPresses();
    online.localActions = [];
    online.lastInput = null;
    if (online.active && !online.host)
      online.transport.packet({ kind: 'input', data: encodeInput(neutral()) });
  };
  online.stop = () => {
    online.active = false;
    online.pendingFrames = [];
    online.remoteActions = [];
    online.remote = neutral();
    online.localActions = [];
    online.lastInput = null;
    online.waitingAck = false;
    online.preparing = null;
    online.guestStarted = false;
    online.transport.match = null;
    match.game.online = false;
    document.body.classList.remove('onlineFight');
    if (previousSettings) Object.assign(match.game, previousSettings);
    previousSettings = null;
    document.getElementById('pauseBtn').textContent = '暂停';
    document.getElementById('menuBtn').textContent = '返回菜单';
    match.clearVictory?.();
  };
  online.returnToRoom = () => {
    const id = online.room?.match?.id;
    online.stop();
    baseBack();
    if (id) online.command({ type: 'finish', match: id });
    online.onReturn?.();
  };
  online.leave = (disconnect = false) => {
    if (online.active || match.game.online) {
      online.stop();
      baseBack();
    }
    online.transport.resetPeer();
    online.preparing = null;
    online.guestStarted = false;
    if (!disconnect) online.command({ type: 'leave' });
  };
  online.close = () => {
    online.leave(true);
    online.transport.close();
    online.rooms = [];
    online.you = null;
    online.room = null;
  };

  function beginBattle() {
    if (online.active || !online.room?.match) return;
    const room = online.room;
    previousSettings = Object.fromEntries(
      [
        'difficulty',
        'selectedChar',
        'selectedMap',
        'opponent',
        'lightPreset',
        'keepPair',
        'wins',
        'matchRound',
        'ringOut',
        'matchRule',
      ].map((key) => [key, match.game[key]]),
    );
    online.active = true;
    online.sequence = 0;
    online.remoteSequence = 0;
    online.pendingFrames = [];
    online.lastFlush = performance.now();
    online.lastPacket = performance.now();
    online.remote = neutral();
    online.remoteActions = [];
    online.host = room.players.find((p) => p.id === online.you)?.seat === 0;
    Object.assign(match.game, {
      online: true,
      onlineSeat: online.host ? 0 : 1,
      difficulty: 'local',
      selectedChar: room.players[0].character,
      opponent: room.players[1].character,
      selectedMap: room.map,
      lightPreset: room.light,
      keepPair: false,
      wins: [0, 0],
      matchRound: 1,
      ringOut: room.ringOut,
      matchRule: room.rule,
    });
    ai.setCombatSeed(room.match.seed);
    match.startFight();
    document.body.classList.add('onlineFight');
    online.onBegin?.();
    document.getElementById('arenaName').lastElementChild.textContent =
      `联机 · ${online.host ? '1P' : '2P'} · 房间 ${room.id}`;
    document.getElementById('againBtn').textContent = '返回房间';
    document.getElementById('menuBtn').textContent = '返回房间';
    document.getElementById('pauseBtn').textContent = '返回房间';
    status('已连接，正在联机对战');
  }

  function packet(data) {
    if (!online.room?.match) return;
    if (data.kind === 'begin' && !online.host) {
      beginBattle();
      online.transport.packet({ kind: 'ack' });
      return;
    }
    if (data.kind === 'ack' && online.host && !online.guestStarted) {
      online.guestStarted = true;
      beginBattle();
      return;
    }
    if (!online.active) return;
    online.lastPacket = performance.now();
    if (data.kind === 'return') {
      online.returnToRoom();
      return;
    }
    if (data.kind === 'input' && online.host) {
      try {
        const decoded = decodeInput(data.data);
        online.remote = { ...decoded, actions: [] };
        online.remoteActions.push(...decoded.actions);
        if (online.remoteActions.length > 20) online.remoteActions.length = 20;
      } catch {
        status('收到无效输入，对局已停止');
        online.returnToRoom();
      }
      return;
    }
    if (data.kind !== 'frames' || online.host || data.seq <= online.remoteSequence) return;
    const queuedActions = combat.inputEdges.splice(0);
    const queuedPresses = { ...input.justPressed };
    try {
      if (
        data.seq !== online.remoteSequence + 1 ||
        !Array.isArray(data.frames) ||
        data.frames.length > 32
      )
        throw new Error('对战数据顺序不一致');
      const previous = [match.player.pos.clone(), match.enemy.pos.clone()];
      for (const frame of data.frames) {
        if (
          !Number.isFinite(frame.dt) ||
          frame.dt < 0 ||
          frame.dt > 0.1 ||
          !Array.isArray(frame.a) ||
          !Array.isArray(frame.b)
        )
          throw new Error('对战时间数据无效');
        let a = 0,
          b = 0;
        baseAdvance(
          frame.dt,
          () => decodeInput(frame.a[a++]),
          () => decodeInput(frame.b[b++]),
        );
        if (a !== frame.a.length || b !== frame.b.length) throw new Error('模拟步骤不一致');
      }
      const actual = checkpoint();
      if (
        !Array.isArray(data.check) ||
        actual.length !== data.check.length ||
        actual.some((n, i) => Math.abs(n - data.check[i]) > 0.001)
      )
        throw new Error('对战状态不同步');
      [match.player, match.enemy].forEach((f, i) => f.previousPos.copy(previous[i]));
      online.receivedAt = performance.now();
      online.remoteSequence = data.seq;
      online.lastPacket = online.receivedAt;
      if (match.game.over) document.getElementById('againBtn').textContent = '返回房间';
    } catch (error) {
      status(`${error.message}，请双方返回房间重新准备`);
      online.returnToRoom();
    } finally {
      if (online.active && !match.game.over) {
        combat.inputEdges.push(...queuedActions);
        Object.assign(input.justPressed, queuedPresses);
      }
    }
  }

  online.frame = () => {
    if (!online.active) {
      if (online.preparing && performance.now() - online.preparing.at > 30000) {
        online.returnToRoom();
        status('连接超时，请双方重新准备');
        return;
      }
      if (
        online.preparing &&
        performance.now() - online.preparing.at > 5000 &&
        !online.preparing.sent &&
        online.host
      ) {
        online.preparing.sent = true;
        online.transport.packet({ kind: 'begin' });
        status('双方已准备，正在连接对手…');
      } else if (
        online.preparing &&
        online.host &&
        !online.preparing.sent &&
        online.transport.channel?.readyState === 'open'
      ) {
        online.preparing.sent = true;
        online.transport.packet({ kind: 'begin' });
      }
      return;
    }
    const now = performance.now();
    if (!online.host && now - online.lastPacket > 15000 && !match.game.over) {
      online.returnToRoom();
      status('对战连接中断，请重新准备');
      return;
    }
    const interval = online.transport.forceRelay ? 100 : 50;
    if (now - online.lastFlush < interval) return;
    online.lastFlush = now;
    if (online.host && online.pendingFrames.length) {
      online.transport.packet({
        kind: 'frames',
        seq: ++online.sequence,
        frames: online.pendingFrames.splice(0),
        check: checkpoint(),
      });
    }
    if (!online.host && !match.game.over) {
      const held = canonical(input.readPlayerInput());
      online.localActions ??= [];
      held.actions.unshift(...online.localActions.splice(0));
      const encoded = encodeInput(held);
      if (!(encoded[0] & 15)) encoded[1] = 0; // Camera yaw is irrelevant while stationary.
      const signature = JSON.stringify(encoded.slice(0, 2));
      if (signature !== online.lastInput || encoded[2].length) {
        online.transport.packet({ kind: 'input', data: encoded });
        online.lastInput = signature;
      }
    }
  };
  online.renderAlpha = () =>
    Math.min(
      1,
      (performance.now() - (online.receivedAt ?? 0)) / (online.transport.forceRelay ? 100 : 50),
    );

  function state(data) {
    const oldRoom = online.room;
    online.you = data.you;
    online.rooms = data.rooms;
    online.room = data.rooms.find((r) => r.players.some((p) => p.id === data.you)) ?? null;
    online.host = online.room?.players.find((p) => p.id === data.you)?.seat === 0;
    if (!online.room?.match) {
      online.preparing = null;
      online.transport.match = null;
    }
    if (
      online.active &&
      (!online.room ||
        online.room.players.length < 2 ||
        oldRoom?.match?.id !== online.room.match?.id)
    ) {
      online.stop();
      baseBack();
      online.onReturn?.();
      status(data.you ? '对手已离开，等待新的玩家加入' : '连接中断，请重新进入大厅');
    }
    if (online.room?.players.length === 2) {
      const key = online.room.players.map((p) => p.id).join(':');
      online.transport.peer(key, online.host).catch(() => status('正在连接对手…'));
      if (online.room.match && online.preparing?.id !== online.room.match.id && !online.active) {
        online.transport.match = online.room.match.id;
        online.transport.forceRelay = false;
        online.preparing = { id: online.room.match.id, at: performance.now(), sent: false };
        online.guestStarted = false;
        status('双方已准备，正在连接对手…');
      }
    } else online.transport.resetPeer();
    online.onState?.();
  }

  return function initialize() {
    const configured = import.meta.env.VITE_ONLINE_URL;
    const local = ['localhost', '127.0.0.1'].includes(location.hostname);
    online.transport = new OnlineTransport({
      url:
        configured ||
        (local
          ? 'ws://127.0.0.1:8787/connect'
          : 'wss://dragon-ball-online.coin-divination-edge-reading.workers.dev/connect'),
      onState: state,
      onPacket: packet,
      onStatus: status,
      onError: status,
    });
    baseAdvance = combat.advanceCombat;
    combat.advanceCombat = (raw, ...providers) => {
      if (!online.active) return baseAdvance(raw, ...providers);
      if (match.game.over) {
        document.getElementById('againBtn').textContent = '返回房间';
        return;
      }
      if (!online.host) {
        const held = input.readPlayerInput();
        (online.localActions ??= []).push(...held.actions);
        return;
      }
      if (online.pendingFrames.length >= 30) {
        status('网络拥堵，正在等待对手');
        return;
      }
      const frame = { dt: raw, a: [], b: [] };
      baseAdvance(
        raw,
        () => {
          const encoded = encodeInput(input.readPlayerInput());
          frame.a.push(encoded);
          return decodeInput(encoded);
        },
        () => {
          const encoded = encodeInput(remoteInput());
          frame.b.push(encoded);
          return decodeInput(encoded);
        },
      );
      online.pendingFrames.push(frame);
    };
    basePause = match.setPaused;
    match.setPaused = (value) => {
      if (online.active) {
        online.releaseInput();
        return;
      }
      basePause(value);
    };
    baseVictory = match.beginVictory;
    if (baseVictory)
      match.beginVictory = (...args) => {
        if (online.active) match.game.matchFinished = true;
        return baseVictory(...args);
      };
    queueMicrotask(() => {
      baseBack = match.backToMenu;
      match.backToMenu = () => {
        if (online.active) {
          online.transport.packet({ kind: 'return' });
          online.returnToRoom();
        } else baseBack();
      };
      const originalAgain = document.getElementById('againBtn').onclick;
      const originalPause = document.getElementById('pauseBtn').onclick;
      document.getElementById('againBtn').onclick = () =>
        online.active ? online.returnToRoom() : originalAgain();
      document.getElementById('pauseBtn').onclick = () =>
        online.active ? online.returnToRoom() : originalPause();
      if (window.__db) window.__db.online = online;
    });
    new ResizeObserver(() => {
      document.documentElement.style.setProperty(
        '--online-touch-height',
        document.getElementById('touch').offsetHeight + 'px',
      );
    }).observe(document.getElementById('touch'));
    addEventListener('pagehide', () => online.close());
  };
}
