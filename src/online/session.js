import { OnlineTransport } from './transport.js';
import { decodeInput, encodeInput } from './input-codec.js';
import { GuestPresentation } from './presentation.js';
import { createSpectator } from './spectator.js';

export function register({
  app,
  ai,
  animation,
  characters,
  combat,
  input,
  match,
  render,
  ui,
  world,
}) {
  const online = (app.online = {
    active: false,
    rooms: [],
    you: null,
    room: null,
    host: false,
    spectating: false,
    watching: 0,
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
      f.guard,
      Number(f.guardBroken),
      f.pos.x,
      f.pos.y,
      f.pos.z,
      f.stateTimer,
    ]),
  ];
  const canonical = (value) => decodeInput(encodeInput(value));
  const remoteInput = () => {
    online.appliedInput = online.receivedInput;
    return { ...online.remote, actions: online.remoteActions.splice(0, 20) };
  };

  online.connect = () => online.transport.connect();
  online.command = (message) => online.transport.send(message);
  online.releaseInput = () => {
    for (const key in input.keys) input.keys[key] = false;
    input.clearPresses();
    online.localActions = [];
    online.lastInput = null;
    if (online.active && !online.host && !online.spectating)
      online.transport.packet({ kind: 'input', data: encodeInput(neutral()) });
  };
  online.stop = () => {
    online.spectator?.clear();
    online.presentation?.clear();
    online.presentation = null;
    for (const fighter of [match.player, match.enemy]) {
      if (fighter?.onlineBaseRender) {
        fighter.render = fighter.onlineBaseRender;
        delete fighter.onlineBaseRender;
      }
    }
    online.active = false;
    online.spectating = false;
    match.game.spectating = false;
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
    document.body.classList.remove('onlineFight', 'spectating');
    if (previousSettings) Object.assign(match.game, previousSettings);
    previousSettings = null;
    document.getElementById('pauseBtn').textContent = '暂停';
    document.getElementById('menuBtn').textContent = '返回菜单';
    match.clearVictory?.();
  };
  online.returnToRoom = () => {
    const id = online.room?.match?.id;
    const watching = online.spectating;
    online.stop();
    baseBack();
    if (watching) {
      online.command({ type: 'unwatch' });
      online.watching = 0;
      online.room = null;
    } else if (id) online.command({ type: 'finish', match: id });
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
    online.watching = 0;
  };

  function beginBattle(spectating = false) {
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
    online.spectating = spectating;
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
      spectating,
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
    online.lastHeld = null;
    online.lastInputSend = 0;
    online.lastVisualAt = null;
    online.receivedInput = online.appliedInput = null;
    if (spectating) online.spectator.start();
    else if (!online.host) {
      const fighters = [match.player, match.enemy];
      online.presentation = new GuestPresentation({
        fighters,
        mobility: combat.mobilitySpeed,
        bounds: () => {
          const bounds = world.currentMap?.bounds ?? { x: 13.5, z: 6 };
          const extra = match.game.ringOut && match.game.selectedMap === 0 ? 2.5 : 0;
          return { x: bounds.x + extra, z: bounds.z + extra };
        },
      });
      for (const fighter of fighters) {
        fighter.onlineBaseRender = fighter.render;
        fighter.render = function (dt) {
          this.onlineBaseRender(dt, 1);
          if (!this.onlineVisualPosition) return;
          const offset = this.onlineVisualPosition.clone().sub(this.pos);
          this.root.position.add(offset);
          this.shadow.position.x += offset.x;
          this.shadow.position.z += offset.z;
          if (this.nimbus) this.nimbus.position.add(offset);
          if (this === match.enemy && this.onlineVisualAction) {
            const action = this.onlineVisualAction,
              chain = this.def.combos[action.type],
              index =
                this.comboType === action.type && this.comboTimer > 0
                  ? Math.min(this.comboIdx + 1, chain.length - 1)
                  : 0;
            const attack =
              action.type === 'heavy' && (action.up || action.down)
                ? this.def.directionMoves[action.up ? 0 : 1]
                : chain[index];
            const view = Object.create(this);
            view.state = 'attack';
            view.attack = attack;
            view.stateTimer = Math.min(attack.dur, (performance.now() - action.at) / 1000);
            view.poseEntry = null;
            characters.applyPose(this.parts, combat.combatPose(view), 0, true);
          } else if (this === match.enemy && this.onlineVisualWalk && !this.attack) {
            const view = Object.create(this);
            view.state = 'walk';
            view.walkPhase = this.walkPhase + performance.now() * 0.012;
            characters.applyPose(this.parts, combat.neutralCombatPose(view), dt, false);
          }
        };
      }
    }
    document.body.classList.add('onlineFight');
    document.body.classList.toggle('spectating', spectating);
    online.onBegin?.();
    document.getElementById('arenaName').lastElementChild.textContent =
      `${spectating ? '观战' : '联机 · ' + (online.host ? '1P' : '2P')} · 房间 ${room.id}`;
    for (const id of ['againBtn', 'menuBtn', 'pauseBtn'])
      document.getElementById(id).textContent = spectating ? '退出观战' : '返回房间';
    if (online.host) online.command({ type: 'playing', match: room.match.id });
    online.reportedEnd = false;
    status(spectating ? '正在观战，可随时退出' : '已连接，正在联机对战');
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
        online.receivedInput = Number.isFinite(data.at)
          ? { at: data.at, receivedAt: performance.now() }
          : null;
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
      online.receivedAt = performance.now();
      online.presentation?.snapshot(online.receivedAt, data.ack, data.age);
      online.remoteSequence = data.seq;
      online.lastPacket = online.receivedAt;
      if (match.game.over) {
        online.presentation?.clear();
        document.getElementById('againBtn').textContent = '返回房间';
      }
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
    if (online.active && online.spectating) {
      const now = performance.now();
      if (now - online.lastPacket > 15000) {
        online.returnToRoom();
        status('观战连接中断，已返回大厅');
        return;
      }
      online.spectator.update(
        now,
        Math.min(0.05, Math.max(0, (now - (online.lastVisualAt ?? now - 16)) / 1000)),
      );
      online.lastVisualAt = now;
      return;
    }
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
    if (online.host) {
      online.spectator.publish(now);
      if (match.game.over && !online.reportedEnd) {
        online.reportedEnd = true;
        online.command({ type: 'ended', match: online.room.match.id });
      }
    }
    if (!online.host && now - online.lastPacket > 15000 && !match.game.over) {
      online.returnToRoom();
      status('对战连接中断，请重新准备');
      return;
    }
    const interval = online.transport.forceRelay ? 100 : 0;
    if (online.host && now - online.lastFlush >= interval && online.pendingFrames.length) {
      online.lastFlush = now;
      online.transport.packet({
        kind: 'frames',
        seq: ++online.sequence,
        frames: online.pendingFrames.splice(0),
        check: checkpoint(),
        age: Math.max(0, (now - (online.lastSimulatedAt ?? now)) / 1000),
        ack: online.appliedInput
          ? { at: online.appliedInput.at, processing: now - online.appliedInput.receivedAt }
          : null,
      });
    }
    if (!online.host && !match.game.over) {
      const held = canonical(input.readPlayerInput());
      online.localActions ??= [];
      held.actions.unshift(...online.localActions.splice(0));
      const encoded = encodeInput(held);
      if (!(encoded[0] & 15)) encoded[1] = 0; // Camera yaw is irrelevant while stationary.
      const signature = JSON.stringify(encoded.slice(0, 2));
      const heldChanged = encoded[0] !== online.lastHeld;
      const yawDue = now - online.lastInputSend >= (online.transport.forceRelay ? 50 : 16);
      if (heldChanged || (signature !== online.lastInput && yawDue) || encoded[2].length) {
        online.transport.packet({ kind: 'input', data: encoded, at: now });
        online.lastInput = signature;
        online.lastHeld = encoded[0];
        online.lastInputSend = now;
      }
      online.presentation?.record(held, now);
      online.presentation?.update(
        now,
        Math.min(0.05, Math.max(0, (now - (online.lastVisualAt ?? now - 16)) / 1000)),
        match.game.ready <= 0,
      );
      online.lastVisualAt = now;
    }
  };
  online.renderAlpha = () => 1; // Guest presentation predicts from the latest authoritative frame.

  function state(data) {
    const oldRoom = online.room;
    online.you = data.you;
    online.rooms = data.rooms;
    online.watching = data.watching ?? 0;
    online.room =
      data.rooms.find((r) => r.players.some((p) => p.id === data.you)) ??
      data.rooms.find((r) => r.id === online.watching) ??
      null;
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
      status(data.you ? '对战已结束或玩家已离开' : '连接中断，请重新进入大厅');
    }
    if (online.watching && online.room?.match?.playing) {
      online.transport.resetPeer();
      if (!online.active) beginBattle(true);
      online.onState?.();
      return;
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
    online.spectator = createSpectator({ online, animation, combat, match, render, world });
    const configured = import.meta.env.VITE_ONLINE_URL;
    online.transport = new OnlineTransport({
      url:
        configured ||
        `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/api/online`,
      onState: state,
      onPacket: packet,
      onSpectatorFrame: (message) => online.spectator.receive(message),
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
      if (online.spectating) {
        input.clearPresses();
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
      online.lastSimulatedAt = performance.now();
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
          if (!online.spectating) online.transport.packet({ kind: 'return' });
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
