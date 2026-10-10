import { StateRecovery } from './state-recovery.js';
import { battleStateDigest } from '../combat/battle-state.js';
import { BATTLE_PROTOCOL, BATTLE_RULESET, compatibleBattle } from './battle-version.js';
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
    diagnostics: [],
    incidents: [],
  });
  let baseAdvance, baseBack, basePause, baseVictory, previousSettings;
  const status = (message) => online.onStatus?.(message);
  const neutral = () => ({ actions: [] });
  function trace(kind, detail = {}) {
    online.diagnostics.push({
      at: performance.now(),
      simTime: match.game.simTime,
      role: online.host ? 'host' : 'guest',
      transport: online.transport.forceRelay ? 'relay' : 'direct',
      kind,
      ...detail,
    });
    if (online.diagnostics.length > 120) online.diagnostics.shift();
    if (
      [
        'simulation-error',
        'version-mismatch',
        'delivery-error',
        'state-recovery-error',
        'connection-closed',
      ].includes(kind)
    ) {
      online.incidents.push({
        kind,
        at: performance.now(),
        events: structuredClone(online.diagnostics),
      });
      if (online.incidents.length > 10) online.incidents.shift();
    }
  }
  online.exportDiagnostics = () => ({
    protocol: BATTLE_PROTOCOL,
    ruleset: BATTLE_RULESET,
    room: online.room?.id,
    match: online.room?.match?.id,
    characters: [match.player?.def.id, match.enemy?.def.id],
    rule: match.game.matchRule,
    map: match.game.selectedMap,
    clockOrigin: performance.timeOrigin,
    events: structuredClone(online.diagnostics),
    incidents: structuredClone(online.incidents),
    inputSamples: structuredClone(online.inputSamples ?? []),
    delivery: online.transport.delivery
      ? {
          ...online.transport.delivery.stats,
          pending: online.transport.delivery.pending.size,
          buffered: online.transport.delivery.incoming.size,
          bytes: online.transport.delivery.pendingBytes,
          epoch: online.transport.epoch,
        }
      : null,
  });
  const checkpoint = () => [
    ai.tacticalSeed >>> 0,
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
    const actions = online.remoteActions.splice(0, 20);
    for (const action of actions) {
      online.acceptedActions[1].push({
        type: action.type,
        inputSequence: action.inputSequence,
        time: match.game.simTime,
      });
      if (online.acceptedActions[1].length > 64) online.acceptedActions[1].shift();
      trace('input-accepted', {
        inputAt: action.inputAt,
        inputSequence: action.inputSequence,
        waitMs: performance.now() - action.receivedAt,
        actions: [action.type],
      });
    }
    return { ...online.remote, actions };
  };

  online.observeCombatEvent = (event) => {
    if (
      !online.active ||
      online.spectating ||
      !['attack', 'contact', 'parry', 'guardbreak'].includes(event.type)
    )
      return;
    if (online.host && event.type === 'attack') {
      const queue = online.acceptedActions[event.side];
      const index = queue
        .map((a) => a.type === event.inputAction && event.time - a.time <= 0.35)
        .lastIndexOf(true);
      if (index >= 0) {
        online.serialInputs.set(event.serial, queue[index]);
        queue.splice(0, index + 1);
        if (online.serialInputs.size > 512)
          online.serialInputs.delete(online.serialInputs.keys().next().value);
      }
    }
    const source = online.serialInputs?.get(event.serial);
    trace(online.host ? 'authoritative-combat' : 'replayed-combat', {
      event: event.type,
      side: event.side,
      serial: event.serial,
      move: event.move,
      combatSequence: event.sequence,
      damage: event.damage,
      blocked: event.blocked,
      inputSequence: source?.inputSequence,
      acceptedToEventSeconds: source ? event.time - source.time : undefined,
    });
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
    online.recovery = null;
    document.getElementById('againBtn').disabled = false;
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
    online.recovery = new StateRecovery({
      host: () => online.host,
      send: (packet) => online.transport.packet(packet),
      capture: () => {
        online.pendingFrames.length = 0;
        return combat.captureBattleState();
      },
      restore: (snapshot) => {
        online.presentation?.clear();
        const hash = combat.restoreBattleState(snapshot);
        attachPresentation();
        return hash;
      },
      digest: battleStateDigest,
      sequence: () => (online.host ? online.sequence : online.remoteSequence),
      setSequence: (value) => {
        online.remoteSequence = value;
      },
      clearInput: () => {
        online.releaseInput();
        online.remote = neutral();
        online.remoteActions = [];
      },
      notify: (message) => {
        status(message);
        match.notify(message, 2);
      },
      trace,
      fail: (message) => {
        online.transport.packet({ kind: 'return' });
        online.returnToRoom();
        status(message);
      },
    });
    online.inputSequence = online.hostInputSequence = 0;
    online.acceptedActions = [[], []];
    online.serialInputs = new Map();
    online.lastAcknowledgedInput = null;
    online.inputSamples = [];
    if (spectating) online.spectator.start();
    else if (!online.host) {
      attachPresentation();
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

  function attachPresentation() {
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

  function packet(data) {
    if (!online.room?.match) return;
    trace('receive', {
      packet: data.kind,
      sequence: data.seq,
      inputAt: data.at,
      input: data.kind === 'input' ? data.data : undefined,
    });
    if (data.kind !== 'return' && !compatibleBattle(data)) {
      trace('version-mismatch', { remoteProtocol: data.protocol, remoteRuleset: data.ruleset });
      online.transport.packet({ kind: 'return' });
      online.returnToRoom();
      status('对战版本不同，请双方刷新页面后重新准备');
      return;
    }
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
    if (online.recovery?.receive(data, performance.now())) return;
    if (online.recovery?.paused && data.kind === 'frames') return;
    if (data.kind === 'input' && online.host) {
      try {
        const decoded = decodeInput(data.data);
        online.remote = { ...decoded, actions: [] };
        online.receivedInput = Number.isFinite(data.at)
          ? { at: data.at, seq: data.inputSeq, receivedAt: performance.now() }
          : null;
        online.remoteActions.push(
          ...decoded.actions.map((action) => ({
            ...action,
            inputSequence: data.inputSeq,
            inputAt: data.at,
            receivedAt: performance.now(),
          })),
        );
        if (online.remoteActions.length > 256) throw new Error('输入积压超出恢复窗口');
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
      if (!Array.isArray(data.check) || !data.check.every(Number.isFinite))
        throw new Error('权威状态检查字段无效');
      if (
        !Array.isArray(data.check) ||
        actual.length !== data.check.length ||
        actual.some((n, i) => Math.abs(n - data.check[i]) > 0.001)
      )
        throw Object.assign(new Error('对战状态不同步'), {
          differences: actual
            .map((value, index) => ({ index, local: value, host: data.check[index] }))
            .filter((row) => Math.abs(row.local - row.host) > 0.001),
        });
      online.receivedAt = performance.now();
      if (Number.isFinite(data.ack?.at) && data.ack.seq !== online.lastAcknowledgedInput) {
        online.lastAcknowledgedInput = data.ack.seq;
        const sample = {
          sequence: data.ack.seq,
          confirmedRoundTripMs: online.receivedAt - data.ack.at,
          hostProcessingMs: data.ack.processing,
          receivedFrame: data.seq,
        };
        online.inputSamples.push(sample);
        if (online.inputSamples.length > 200) online.inputSamples.shift();
        trace('input-confirmed', sample);
      }
      online.presentation?.snapshot(online.receivedAt, data.ack, data.age);
      online.remoteSequence = data.seq;
      online.lastPacket = online.receivedAt;
      if (match.game.over) {
        online.presentation?.clear();
        document.getElementById('againBtn').textContent = '返回房间';
      }
    } catch (error) {
      trace('simulation-error', {
        message: error.message,
        differences: error.differences,
        sequence: data.seq,
        localSequence: online.remoteSequence,
      });
      online.recovery.request(error.message, performance.now());
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
    online.recovery?.pump(now);
    if (online.recovery?.paused) return;
    if (online.host) {
      online.spectator.publish(now);
      if (match.game.over && !online.reportedEnd) {
        online.reportedEnd = true;
        online.command({
          type: 'ended',
          match: online.room.match.id,
          winner:
            match.game.lastWinner === 'player' ? 0 : match.game.lastWinner === 'enemy' ? 1 : null,
        });
      }
    }
    if (!online.host && now - online.lastPacket > 15000 && !match.game.over) {
      online.returnToRoom();
      status('对战连接中断，请重新准备');
      return;
    }
    if (!online.host && !match.game.over) {
      const source = input.readPlayerInput();
      const held = canonical(source);
      online.localActions ??= [];
      held.actions.unshift(...online.localActions.splice(0));
      const encoded = encodeInput(held);
      if (!(encoded[0] & 15)) encoded[1] = 0; // Camera yaw is irrelevant while stationary.
      const signature = JSON.stringify(encoded.slice(0, 2));
      const heldChanged = encoded[0] !== online.lastHeld;
      const yawDue = now - online.lastInputSend >= (online.transport.forceRelay ? 50 : 16);
      if (heldChanged || (signature !== online.lastInput && yawDue) || encoded[2].length) {
        online.transport.packet({
          kind: 'input',
          data: encoded,
          at: now,
          inputSeq: ++online.inputSequence,
        });
        if (held.actions.length)
          trace('input-sent', {
            inputSequence: online.inputSequence,
            actions: held.actions.map((a) => a.type),
            deviceToSendMs: Math.max(
              0,
              ...source.actions.filter((a) => Number.isFinite(a.at)).map((a) => now - a.at),
            ),
          });
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
    resultActions();
  };
  // Called after this frame's simulation and before rendering. Input sampling,
  // prediction and spectator publication stay in frame(), exactly once per rAF.
  online.flush = () => {
    if (!online.active || online.spectating) return;
    online.transport.pump();
    if (online.recovery?.paused) return;
    const now = performance.now();
    const interval = online.transport.forceRelay ? 1000 / 30 : 0;
    if (online.host && now - online.lastFlush >= interval && online.pendingFrames.length) {
      const count = online.pendingFrames.length;
      const accepted = online.transport.packet({
        kind: 'frames',
        seq: online.sequence + 1,
        frames: online.pendingFrames.slice(0, count),
        check: checkpoint(),
        age: Math.max(0, (now - (online.lastSimulatedAt ?? now)) / 1000),
        ack: online.appliedInput
          ? {
              at: online.appliedInput.at,
              seq: online.appliedInput.seq,
              processing: now - online.appliedInput.receivedAt,
            }
          : null,
      });
      if (accepted && online.active) {
        // Preserve the 30 Hz phase instead of turning 33.3 ms into 50 ms when
        // a 60 Hz browser frame lands just before the deadline.
        online.lastFlush = interval ? now - ((now - online.lastFlush) % interval) : now;
        online.sequence++;
        online.pendingFrames.splice(0, count);
      }
    }
  };
  online.renderAlpha = () => 1; // Guest presentation predicts from the latest authoritative frame.
  function resultActions() {
    if (!online.active || online.spectating || !match.game.over) return;
    const button = document.getElementById('againBtn');
    const votes = online.room?.series?.votes ?? [false, false];
    button.disabled = !online.room?.match?.finished;
    button.textContent = button.disabled
      ? '正在确认结果'
      : votes[online.host ? 0 : 1]
        ? '取消再战 · 等待对手'
        : '与对手再战';
    document.getElementById('menuBtn').textContent = '换角色 / 返回房间';
    const sub = document.getElementById('resultSub');
    sub.textContent = `${match.game.endReason ?? '回合结束'} · 系列比分 ${online.room?.series?.scores?.join(' : ') ?? '0 : 0'}`;
  }

  function state(data) {
    if (!data.you) trace('connection-closed', { wasActive: online.active });
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
    resultActions();
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
      onDiagnostic: trace,
      onFailure: (message) => {
        trace('delivery-error', { message });
        if (online.active || online.preparing) online.returnToRoom();
        status(message);
      },
    });
    const sendPacket = online.transport.packet.bind(online.transport);
    online.transport.packet = (data) =>
      sendPacket({ ...data, protocol: BATTLE_PROTOCOL, ruleset: BATTLE_RULESET });
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
      if (online.recovery?.paused) {
        input.clearPresses();
        online.localActions = [];
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
          const source = input.readPlayerInput();
          const encoded = encodeInput(source);
          if (source.actions.length) {
            const seq = ++online.hostInputSequence;
            online.acceptedActions[0].push(
              ...source.actions.map((action) => ({
                type: action.type,
                inputSequence: seq,
                time: match.game.simTime,
              })),
            );
          }
          if (online.acceptedActions[0].length > 64)
            online.acceptedActions[0].splice(0, online.acceptedActions[0].length - 64);
          if (encoded[2].length)
            trace('host-input-accepted', {
              actions: encoded[2],
              inputSequence: online.hostInputSequence,
              deviceToAcceptanceMs: Math.max(
                0,
                ...source.actions
                  .filter((a) => Number.isFinite(a.at))
                  .map((a) => performance.now() - a.at),
              ),
            });
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
      document.getElementById('againBtn').onclick = () => {
        if (!online.active) return originalAgain();
        if (online.spectating) return online.returnToRoom();
        online.command({
          type: 'rematch',
          match: online.room.match.id,
          ready: !online.room.series?.votes?.[online.host ? 0 : 1],
        });
      };
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
