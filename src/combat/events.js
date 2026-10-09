import * as THREE from 'three';
export function register({
  audio: audioModule,
  characters: charactersModule,
  combat: combatModule,
  match: matchModule,
  render: renderModule,
  training: trainingModule,
}) {
  combatModule.impactKind = function impactKind(a, blocking = false, guardBreak = false) {
    return guardBreak
      ? 'guardbreak'
      : blocking
        ? 'block'
        : a.isUlt
          ? 'ultimate'
          : a.id === 'throw'
            ? 'throw'
            : a.id === 'special'
              ? 'special'
              : a.chainType === 'heavy' || a.id === 'launcher' || a.id === 'sweep'
                ? 'heavy'
                : 'light';
  };
  combatModule.beginMoveEvent = function beginMoveEvent(f, previous) {
    f.poseEntry = previous;
    f.attack.serial = ++combatModule.combatEvents.serial;
    f.attack.swingFired = false;
    f.attack.activeFired = false;
    f.attack.whiffFired = false;
    combatModule.emitCombatEvent('attack', f, null, f.attack);
  };
  combatModule.emitCombatEvent = function emitCombatEvent(type, f, foe, a, detail = {}) {
    const e = {
      sequence: ++combatModule.combatEvents.sequence,
      time: matchModule.game.simTime,
      round: matchModule.game.round,
      type,
      side: f === matchModule.enemy ? 1 : 0,
      target: foe ? (foe === matchModule.enemy ? 1 : 0) : null,
      character: f?.def.id,
      move: a?.name ?? a?.id,
      serial: a?.serial,
      chainType: a?.chainType,
      motion: a?.motion,
      cost: a?.kiCost ?? 0,
      ...detail,
    };
    if (matchModule.combatDiagnostics.enabled) {
      combatModule.combatEvents.history.push(e);
      if (combatModule.combatEvents.history.length > 512) combatModule.combatEvents.history.shift();
    }
    if (f) {
      f.lastCombatEvent = e;
      if (type === 'contact' || type === 'parry') f.lastContactTime = matchModule.game.simTime;
    }
    trainingModule.processDrillEvent(e);
    if (!matchModule.game.manualTest) {
      const pos = (foe ?? f)?.pos.clone().add(new THREE.Vector3(0, (foe ?? f).baseScale * 1.23, 0));
      if (pos) presentCombatEvent(e, pos, a);
    }
    return e;
  };
  combatModule.commitImpactFeedback = function commitImpactFeedback(kind) {
    const p = combatModule.FEEDBACK_PROFILES[kind];
    matchModule.game.hitStop = Math.max(matchModule.game.hitStop, p.stop);
  };
  function presentCombatEvent(e, pos, a) {
    const p = combatModule.FEEDBACK_PROFILES[e.feedback ?? e.type];
    if (!p) return;
    matchModule.game.shake = Math.max(matchModule.game.shake, p.shake);
    matchModule.game.cameraImpulse = Math.max(matchModule.game.cameraImpulse, p.impulse);
    const color =
      e.feedback === 'ultimate'
        ? charactersModule.CHARACTERS.find((c) => c.id === e.character).ultColor
        : p.color;
    if (p.count && renderModule.effects.length < 180)
      renderModule.spawnSpark(pos, color, p.count, e.feedback === 'ultimate' ? 1.15 : 0.55);
    if (p.ring && renderModule.effects.length < 180)
      renderModule.spawnShockRing(pos, color, p.ring);
    audioModule.eventSound(e.feedback ?? e.type, a);
  }
  return function initialize() {
    combatModule.FEEDBACK_PROFILES = Object.freeze({
      light: {
        stop: 0.03,
        shake: 0.06,
        impulse: 0.065,
        count: 6,
        ring: 0.54,
        color: 0xffe8b9,
        tone: 240,
        tail: 75,
        volume: 0.038,
      },
      heavy: {
        stop: 0.055,
        shake: 0.145,
        impulse: 0.19,
        count: 11,
        ring: 0.88,
        color: 0xffd092,
        tone: 105,
        tail: 38,
        volume: 0.065,
      },
      special: {
        stop: 0.046,
        shake: 0.115,
        impulse: 0.15,
        count: 9,
        ring: 0.8,
        color: 0xffdab0,
        tone: 155,
        tail: 46,
        volume: 0.052,
      },
      block: {
        stop: 0.018,
        shake: 0.026,
        impulse: 0.035,
        count: 4,
        ring: 0.35,
        color: 0x93dfe8,
        tone: 470,
        tail: 220,
        volume: 0.038,
      },
      parry: {
        stop: 0.024,
        shake: 0.022,
        impulse: 0.025,
        count: 6,
        ring: 0.55,
        color: 0xa9efff,
        tone: 1040,
        tail: 580,
        volume: 0.038,
      },
      guardbreak: {
        stop: 0.065,
        shake: 0.17,
        impulse: 0.22,
        count: 13,
        ring: 1.04,
        color: 0xffc47a,
        tone: 125,
        tail: 43,
        volume: 0.064,
      },
      ultimate: {
        stop: 0.095,
        shake: 0.31,
        impulse: 0.43,
        count: 18,
        ring: 1.45,
        color: 0xffedb2,
        tone: 75,
        tail: 30,
        volume: 0.065,
      },
      throw: {
        stop: 0.042,
        shake: 0.12,
        impulse: 0.14,
        count: 8,
        ring: 0.72,
        color: 0xffdfac,
        tone: 130,
        tail: 45,
        volume: 0.05,
      },
      swing: {
        stop: 0,
        shake: 0,
        impulse: 0,
        count: 0,
        ring: 0,
        color: 0xffffff,
        tone: 1500,
        tail: 700,
        volume: 0.016,
      },
      evade: {
        stop: 0,
        shake: 0,
        impulse: 0,
        count: 0,
        ring: 0,
        color: 0x9cdbed,
        tone: 700,
        tail: 350,
        volume: 0.022,
      },
      tech: {
        stop: 0,
        shake: 0,
        impulse: 0,
        count: 0,
        ring: 0,
        color: 0xaddce7,
        tone: 880,
        tail: 560,
        volume: 0.028,
      },
      breaker: {
        stop: 0,
        shake: 0,
        impulse: 0,
        count: 0,
        ring: 0,
        color: 0x8ddff1,
        tone: 120,
        tail: 42,
        volume: 0.045,
      },
      pickup: {
        stop: 0,
        shake: 0,
        impulse: 0,
        count: 8,
        ring: 0.6,
        color: 0xaaff9d,
        tone: 760,
        tail: 1120,
        volume: 0.025,
      },
    });
    combatModule.combatEvents = {
      serial: 0,
      sequence: 0,
      history: [],
      audioVoices: 0,
      audioPeak: 0,
    };
  };
}
