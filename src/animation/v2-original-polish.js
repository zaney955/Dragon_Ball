import * as THREE from 'three';
export function register({
  animation: animationModule,
  art: artModule,
  characters: charactersModule,
  combat: combatModule,
  match: matchModule,
  render: renderModule,
  ui: uiModule,
}) {
  let rDef,
    tDef,
    oldFour,
    v2PolishBase,
    fittedAttack,
    fittedSpecial,
    fittedUlt,
    fittedBlast,
    v2StartFightBase,
    v2CollectBase,
    staturePoseBase,
    fitAnatomyBase,
    v2OldNeutralBase;
  // M3: hand, elbow, low step and claw routes retain their actual contact instrument.
  function oldRoute(c, type, index, name, prep, strike, extras = {}) {
    const a = c.combos[type][index],
      phase = renderModule.CONTACT_PHASE[a.motion] ?? 0.45,
      key = c.id + '_' + type + index;
    animationModule.ANIM[key] = [
      [0, animationModule.IDLE_POSE],
      [phase * 0.55, animationModule.pz(prep)],
      [phase, animationModule.pz(strike)],
      [phase + 0.12, animationModule.pz(strike)],
      [1, animationModule.IDLE_POSE],
    ];
    c.combos[type][index] = combatModule.finalizeMove({
      ...a,
      name,
      anim: animationModule.ANIM[key],
      ...extras,
    });
  }

  // Physical stature is committed when an old fighter starts a move against a new anatomy.
  function fitNewOpponent(f) {
    const foe = f === matchModule.player ? matchModule.enemy : matchModule.player;
    if (f.attack && !f.anatomy && foe?.anatomy) {
      f.attack.targetScale = combatModule.stature(foe) / 2.1;
      f.attack.beamHeight = Math.min(1.45 * f.baseScale, combatModule.stature(foe) * 0.75);
    }
  }
  return function initialize() {
    // M3: hand, elbow, low step and claw routes retain their actual contact instrument.
    rDef = charactersModule.CHARACTERS[1];
    tDef = charactersModule.CHARACTERS[4];
    oldRoute(
      rDef,
      'light',
      1,
      '龟仙贴身肘',
      {
        aR: [-0.6, 0, 0.6],
        t: [0.07, -0.38, 0],
      },
      {
        aR: [-1.35, 0, -0.45],
        t: [0.2, 0.15, 0],
      },
      {
        drive: 3.4,
      },
    );
    oldRoute(
      rDef,
      'light',
      2,
      '龟仙沉身扫腿',
      {
        lR: [0.35, 0, 0.3],
        t: [0.25, -0.2, 0],
        y: -0.11,
      },
      {
        lR: [-1.28, 0, -0.32],
        t: [0.4, 0.17, 0],
        y: -0.16,
      },
      {
        level: 'low',
      },
    );
    oldRoute(
      rDef,
      'light',
      3,
      '龟仙回身踢',
      {
        aL: [-0.6, 0, -0.7],
        lR: [0.3, 0, 0.4],
        t: [0.1, -0.5, 0],
      },
      {
        lR: [-1.55, 0, -0.15],
        t: [-0.13, 0.1, 0],
      },
    );
    oldRoute(
      rDef,
      'heavy',
      1,
      '龟仙靠膝',
      {
        lR: [0.2, 0, 0.08],
        t: [0.2, -0.1, 0],
      },
      {
        lR: [-1.55, 0, 0],
        t: [0.18, 0.05, 0],
      },
    );
    oldRoute(
      rDef,
      'heavy',
      2,
      '双掌卸力',
      {
        aL: [-0.3, 0, -0.6],
        aR: [-0.3, 0, 0.6],
        t: [-0.05, 0, 0],
      },
      {
        aR: [-1.45, 0, -0.58],
        aL: [-1.45, 0, 0.58],
        t: [0.15, 0, 0],
      },
    );
    oldRoute(
      rDef,
      'heavy',
      3,
      '龟仙沉腰重掌',
      {
        aR: [-0.35, 0, 0.65],
        aL: [-0.6, 0, -0.4],
        y: -0.08,
        t: [0.2, -0.2, 0],
      },
      {
        aR: [-1.45, 0, -0.58],
        aL: [-0.5, 0, -0.3],
        t: [0.32, 0.12, 0],
        y: -0.09,
      },
    );
    oldRoute(
      tDef,
      'light',
      1,
      '鹤流交错直掌',
      {
        aL: [-0.5, 0, -0.5],
        t: [0.04, 0.3, 0],
      },
      {
        aL: [-1.42, 0, 0.58],
        aR: [-0.5, 0, 0.2],
        t: [0.06, -0.08, 0],
      },
      {
        drive: 4,
      },
    );
    oldRoute(
      tDef,
      'light',
      2,
      '鹤流折肘',
      {
        aR: [-0.6, 0, 0.75],
        t: [0.05, -0.35, 0],
      },
      {
        aR: [-1.4, 0, -0.55],
        t: [0.1, 0.15, 0],
      },
      {
        drive: 4,
      },
    );
    oldRoute(
      tDef,
      'light',
      3,
      '鹤流转身踢',
      {
        lR: [0.22, 0, 0.3],
        t: [0, -0.4, 0],
      },
      {
        lR: [-1.6, 0, -0.12],
        t: [-0.12, 0.18, 0],
      },
    );
    oldRoute(
      tDef,
      'heavy',
      1,
      '鹤流截空腿',
      {
        lR: [-0.4, 0, 0.2],
        t: [0.12, 0, 0],
      },
      {
        lR: [-1.8, 0, -0.1],
        t: [-0.16, 0, 0],
      },
    );
    oldRoute(
      tDef,
      'heavy',
      2,
      '鹤流压掌',
      {
        aR: [-2, 0, 0.2],
        aL: [-2, 0, -0.2],
        t: [-0.1, 0, 0],
      },
      {
        aR: [-1.45, 0, -0.6],
        aL: [-1.45, 0, 0.6],
        t: [0.2, 0, 0],
      },
    );
    oldRoute(
      tDef,
      'heavy',
      3,
      '鹤流震身拳',
      {
        aR: [-0.3, 0, 0.7],
        t: [0.05, -0.35, 0],
      },
      {
        aR: [-1.48, 0, -0.6],
        t: [0.16, 0.12, 0],
      },
    );
    oldRoute(
      charactersModule.kDef,
      'light',
      1,
      '小林低身反掌',
      {
        aR: [-0.6, 0, 0.4],
        t: [0.16, -0.24, 0],
        y: -0.07,
      },
      {
        aR: [-1.48, 0, -0.62],
        t: [0.16, 0.08, 0],
        y: -0.08,
      },
      {
        drive: 4.5,
      },
    );
    oldRoute(
      charactersModule.kDef,
      'light',
      2,
      '小林跃步连踢',
      {
        lR: [-0.5, 0, 0.1],
        t: [0.1, 0, 0],
      },
      {
        lR: [-1.55, 0, -0.05],
        t: [-0.12, 0, 0],
      },
      {
        drive: 5,
      },
    );
    oldRoute(
      charactersModule.kDef,
      'light',
      3,
      '小林转身重拳',
      {
        aR: [-0.4, 0, 0.7],
        t: [0.1, -0.4, 0],
        y: -0.07,
      },
      {
        aR: [-1.5, 0, -0.62],
        t: [0.1, 0.08, 0],
        y: -0.07,
      },
      {
        motion: 'heavyPunch',
        range: 1.4,
        drive: 4,
      },
    );
    oldRoute(
      charactersModule.kDef,
      'heavy',
      1,
      '小林跃膝',
      {
        lR: [0.1, 0, 0.1],
        t: [0.15, 0, 0],
      },
      {
        lR: [-1.7, 0, 0],
        t: [0.05, 0, 0],
      },
    );
    oldRoute(
      charactersModule.kDef,
      'heavy',
      2,
      '小林双掌突进',
      {
        aR: [-0.6, 0, 0.4],
        aL: [-0.6, 0, -0.4],
        y: -0.06,
      },
      {
        aR: [-1.5, 0, -0.6],
        aL: [-1.5, 0, 0.6],
        t: [0.14, 0, 0],
      },
      {
        drive: 5,
      },
    );
    oldRoute(
      charactersModule.kDef,
      'heavy',
      3,
      '小林低身回旋踢',
      {
        lR: [0.3, 0, 0.3],
        t: [0.3, -0.35, 0],
        y: -0.12,
      },
      {
        lR: [-1.4, 0, -0.14],
        t: [0.32, 0.16, 0],
        y: -0.15,
      },
      {
        level: 'low',
      },
    );
    oldRoute(
      charactersModule.yDef,
      'light',
      1,
      '狼牙反爪',
      {
        aL: [-0.4, 0, -0.85],
        t: [0.15, 0.35, 0],
      },
      {
        aL: [-1.45, 0, 0.64],
        aR: [-0.6, 0, 0.3],
        t: [0.16, -0.12, 0],
      },
      {
        drive: 4.8,
      },
    );
    oldRoute(
      charactersModule.yDef,
      'light',
      2,
      '狼牙贴身肘',
      {
        aR: [-0.6, 0, 0.8],
        t: [0.16, -0.35, 0],
      },
      {
        aR: [-1.42, 0, -0.5],
        t: [0.24, 0.1, 0],
      },
      {
        drive: 4.8,
      },
    );
    oldRoute(
      charactersModule.yDef,
      'light',
      3,
      '狼牙扫尾踢',
      {
        lR: [0.2, 0, 0.35],
        t: [0.12, -0.45, 0],
      },
      {
        lR: [-1.6, 0, -0.15],
        t: [-0.05, 0.12, 0],
      },
    );
    oldRoute(
      charactersModule.yDef,
      'heavy',
      1,
      '狼牙交错爪',
      {
        aL: [-0.5, 0, -0.8],
        t: [0.18, 0.3, 0],
      },
      {
        aL: [-1.45, 0, 0.62],
        aR: [-0.6, 0, 0.3],
        t: [0.14, -0.12, 0],
      },
      {
        hits: [0, 0.07],
        dmg: 7,
        active: 0.17,
        drive: 4.7,
      },
    );
    oldRoute(
      charactersModule.yDef,
      'heavy',
      2,
      '狼牙压肘',
      {
        aR: [-0.7, 0, 0.8],
        t: [0.25, -0.3, 0],
      },
      {
        aR: [-1.48, 0, -0.58],
        t: [0.28, 0.08, 0],
      },
    );
    oldRoute(
      charactersModule.yDef,
      'heavy',
      3,
      '狼牙终式穿掌',
      {
        aR: [-0.4, 0, 0.7],
        aL: [-0.5, 0, -0.5],
        t: [0.2, -0.3, 0],
      },
      {
        aR: [-1.5, 0, -0.62],
        aL: [-0.5, 0, -0.25],
        t: [0.28, 0.08, 0],
      },
    );
    oldFour = new Set(['roshi', 'tien', 'krillin', 'yamcha']);
    v2PolishBase = animationModule.polishCombatPose;
    animationModule.polishCombatPose = function (f, p) {
      if (!oldFour.has(f.def.id)) return v2PolishBase(f, p);
      let q = animationModule.cloneCombatPose(p),
        a = f.attack;
      if (!a) return q;
      const entry = Math.min(0.045, a.startup * 0.45);
      if (f.poseEntry && f.stateTimer < entry)
        q = animationModule.mixCombatPose(
          f.poseEntry,
          q,
          animationModule.smoothstep(f.stateTimer / entry),
        );
      const end = a.hitT + a.active;
      if (!a.isUlt && f.stateTimer > end + 2 * matchModule.STEP) {
        const u = Math.min(1, (f.stateTimer - end) / a.recovery);
        q.t[1] += Math.sin(u * Math.PI) * (f.def.id === 'yamcha' ? 0.08 : 0.04);
        const fade = Math.min(0.1, a.recovery * 0.4);
        if (f.stateTimer > a.dur - fade)
          q = animationModule.mixCombatPose(
            q,
            combatModule.neutralCombatPose(f, true),
            animationModule.smoothstep((f.stateTimer - a.dur + fade) / fade),
          );
      }
      return q;
    };
    // Physical stature is committed when an old fighter starts a move against a new anatomy.
    fittedAttack = combatModule.Fighter.prototype.startAttack;
    fittedSpecial = combatModule.Fighter.prototype.startSpecial;
    fittedUlt = combatModule.Fighter.prototype.startUlt;
    fittedBlast = combatModule.Fighter.prototype.startKiBlast;
    combatModule.Fighter.prototype.startAttack = function (...args) {
      fittedAttack.apply(this, args);
      fitNewOpponent(this);
    };
    combatModule.Fighter.prototype.startSpecial = function (...args) {
      const result = fittedSpecial.apply(this, args);
      fitNewOpponent(this);
      return result;
    };
    combatModule.Fighter.prototype.startUlt = function (...args) {
      const result = fittedUlt.apply(this, args);
      fitNewOpponent(this);
      return result;
    };
    combatModule.Fighter.prototype.startKiBlast = function (...args) {
      const result = fittedBlast.apply(this, args),
        foe = this === matchModule.player ? matchModule.enemy : matchModule.player;
      if (!this.anatomy && this.attack?.isKiBlast && foe?.anatomy)
        this.attack.targetHeight = foe.pos.y + combatModule.stature(foe) * 0.7;
      return result;
    };
    // The four older fighters share joint names but now have distinct entry/recovery and cloth details.
    // The four older fighters share joint names but now have distinct entry/recovery and cloth details.
    for (const c of charactersModule.CHARACTERS.filter((c) => oldFour.has(c.id))) {
      const build = c.buildBody;
      c.buildBody = () => {
        const b = build(),
          p = b.parts;
        if (c.id === 'roshi') {
          for (const side of ['L', 'R']) {
            const cuff = charactersModule.meshTo(
              p['fore' + side],
              new THREE.CylinderGeometry(0.085, 0.09, 0.065, 14),
              charactersModule.M(0xf8e4cc),
              0,
              -0.24,
              0,
            );
            cuff.name = 'rolled-shirt-cuff';
          }
          artModule.stitch(
            p.head,
            charactersModule.M(0xd1ad88),
            [
              [-0.1, 0.2, 0.195],
              [0, 0.22, 0.21],
              [0.1, 0.2, 0.195],
            ],
            0.004,
          );
        }
        if (c.id === 'tien') {
          for (const side of ['L', 'R']) {
            artModule.stitch(
              p['arm' + side],
              charactersModule.M(0xcb9774),
              [
                [-0.045, -0.09, 0.095],
                [0, -0.2, 0.116],
                [0.045, -0.29, 0.09],
              ],
              0.005,
            );
            charactersModule.meshTo(
              p['knee' + side],
              new THREE.CylinderGeometry(0.112, 0.112, 0.09, 16),
              charactersModule.M(0xf0ead5),
              0,
              -0.3,
              0,
            );
          }
          artModule.stitch(
            p.torsoGroup,
            charactersModule.M(0xb54235),
            [
              [0.09, -0.08, 0.23],
              [0.18, -0.22, 0.24],
              [0.13, -0.31, 0.25],
            ],
            0.027,
          );
        }
        if (c.id === 'krillin') {
          for (const side of ['L', 'R']) {
            const ear = charactersModule.ball(
              p.head,
              charactersModule.M(0xc79168),
              side === 'L' ? -0.257 : 0.257,
              -0.008,
              0.017,
              0.027,
              [0.4, 1, 0.5],
            );
            ear.name = 'small-ear-fold';
          }
          artModule.stitch(
            p.torsoGroup,
            charactersModule.M(0x9e3524),
            [
              [-0.17, 0.1, 0.215],
              [-0.08, 0.06, 0.24],
              [0.02, 0.09, 0.25],
            ],
            0.006,
          );
        }
        if (c.id === 'yamcha') {
          for (const side of ['L', 'R']) {
            const a = p['hand' + side];
            for (let i = 0; i < 3; i++)
              charactersModule.ball(
                a,
                charactersModule.M(0xd79e78),
                (i - 1) * 0.025,
                -0.045,
                0.04,
                0.017,
                [0.55, 1.6, 0.6],
              );
          }
          artModule.stitch(
            p.head,
            charactersModule.M(0x8d624a),
            [
              [0.06, -0.08, 0.236],
              [0.1, -0.12, 0.227],
            ],
            0.004,
          );
        }
        return b;
      };
    }
    v2StartFightBase = matchModule.startFight;
    matchModule.startFight = function (...args) {
      uiModule.v2Goal = null;
      return v2StartFightBase.apply(this, args);
    };
    queueMicrotask(() => {
      if (window.__db)
        Object.assign(window.__db, {
          startFight: matchModule.startFight,
          polishCombatPose: animationModule.polishCombatPose,
        });
    });
    // Intuition follows an executed attack that would touch the cat during invulnerability.
    v2CollectBase = combatModule.collectCombatHits;
    combatModule.collectCombatHits = function () {
      v2CollectBase();
      for (const f of [matchModule.player, matchModule.enemy]) {
        const foe = f === matchModule.player ? matchModule.enemy : matchModule.player,
          a = foe?.attack;
        if (
          f?.def.id !== 'korin' ||
          f.invulnerable <= 0 ||
          f.state !== 'dash' ||
          !a ||
          f.stateTimer > 0.3 ||
          foe.stateTimer < a.hitT ||
          foe.stateTimer > a.hitT + a.active
        )
          continue;
        const inv = f.invulnerable;
        f.invulnerable = 0;
        const touching = combatModule.combatIntersects(foe, f, a);
        f.invulnerable = inv;
        if (touching) {
          f.v2.intuition = 1.25;
          combatModule.emitCombatEvent('intuition', f, foe, a);
        }
      }
    };
    queueMicrotask(() => {
      if (window.__db)
        Object.assign(window.__db, {
          collectCombatHits: combatModule.collectCombatHits,
        });
    });
    // Tall martial artists lower their body before reaching a small new skeleton.
    // Stature and arm fit are committed at startup, never followed during a jump.
    staturePoseBase = combatModule.combatPose;
    combatModule.combatPose = function (f) {
      let q = staturePoseBase(f),
        a = f.attack;
      if (!a || f.anatomy || a.fitAnatomyHeight == null) return q;
      const contact = Math.exp(-(((f.stateTimer - a.hitT) / Math.max(0.085, a.active)) ** 2));
      if (/kick/i.test(a.motion) && !a.isUlt) {
        q = animationModule.cloneCombatPose(q);
        const angle = -Math.acos(
          THREE.MathUtils.clamp(
            (0.96 * f.baseScale - a.fitAnatomyHeight) / (0.89 * f.baseScale),
            -0.8,
            0.9,
          ),
        );
        q.lR = [THREE.MathUtils.lerp(q.lR[0], angle, contact), 0, -0.08];
        q.kR = THREE.MathUtils.lerp(q.kR, 0.04, contact);
      }
      if (
        (!a.isUlt || a.shape === 'wolf') &&
        !a.isThrow &&
        !a.antiAir &&
        !/kick|sweep|staff|uppercut/i.test(a.motion)
      ) {
        q = animationModule.cloneCombatPose(q);
        const crouch = a.fitAnatomyHeight < 1.5 && f.baseScale > 1.15 ? 0.25 : 0;
        q.y -= crouch * contact;
        q.kL += crouch * 1.5 * contact;
        q.kR += crouch * 1.5 * contact;
        const shoulder = (1.28 + f.parts.armR.position.y - crouch) * f.baseScale,
          height = a.fitAnatomyHeight;
        const angle = -Math.atan2(0.5 * f.baseScale, Math.max(0.05, shoulder - height));
        q.t[0] *= 1 - contact * 0.7;
        q.t[1] *= 1 - contact * 0.8;
        const left = a.motion === 'cross' || a.motion === 'backClaw';
        q[left ? 'aL' : 'aR'] = [
          THREE.MathUtils.lerp(q[left ? 'aL' : 'aR'][0], angle, contact),
          0,
          left ? 0.6 : -0.6,
        ];
        q[left ? 'eL' : 'eR'] = THREE.MathUtils.lerp(q[left ? 'eL' : 'eR'], -0.05, contact);
        if (a.motion === 'doublePalm' || a.shape === 'wolf') {
          q.aL = [angle, 0, 0.6];
          q.aR = [angle, 0, -0.6];
          q.eL = q.eR = -0.05;
        }
      }
      return q;
    };
    fitAnatomyBase = fitNewOpponent;
    fitNewOpponent = function (f) {
      fitAnatomyBase(f);
      const foe = f === matchModule.player ? matchModule.enemy : matchModule.player;
      if (f.attack && !f.anatomy && foe?.anatomy)
        f.attack.fitAnatomyHeight = combatModule.stature(foe) * 0.94;
    };
    queueMicrotask(() => {
      if (window.__db)
        Object.assign(window.__db, {
          combatPose: combatModule.combatPose,
        });
    });
    // Old four: distinct head/step rhythm, defensive posture and recovery identity.
    // Standing torso centres and all first-contact trajectories remain the V1 contract.
    v2OldNeutralBase = combatModule.neutralCombatPose;
    combatModule.neutralCombatPose = function (f, recovering = false) {
      let q = v2OldNeutralBase(f, recovering);
      if (!oldFour.has(f.def.id)) return q;
      q = animationModule.cloneCombatPose(q);
      const id = f.def.id;
      const head = {
        roshi: [0.055, 0, 0],
        tien: [-0.035, 0, 0],
        krillin: [-0.04, 0, -0.06],
        yamcha: [0.075, 0, 0.035],
      }[id];
      if (['idle', 'walk', 'crouch'].includes(f.state)) q.h = head.slice();
      if (f.state === 'walk') {
        const w = Math.sin(f.walkPhase),
          front = THREE.MathUtils.clamp(f.vel.dot(f.forward()) / (6.8 * f.def.speed), -1, 1),
          amp = {
            roshi: 0.36,
            tien: 0.6,
            krillin: 0.74,
            yamcha: 0.64,
          }[id];
        q.lL[0] = w * amp * front;
        q.lR[0] = -w * amp * front;
        q.kL = 0.12 + Math.max(0, -w * front) * amp;
        q.kR = 0.12 + Math.max(0, w * front) * amp;
        q.y = Math.abs(w) * (id === 'roshi' ? 0.012 : id === 'krillin' ? 0.024 : 0.019);
        q.aR[0] -= w * (id === 'tien' ? 0.12 : 0.07);
        q.aL[0] += w * 0.08;
      }
      if (f.state === 'dash') {
        q.t[0] = {
          roshi: 0.3,
          tien: 0.45,
          krillin: 0.47,
          yamcha: 0.37,
        }[id];
        q.h[0] = head[0];
        if (id === 'krillin') {
          q.y = -0.18;
          q.kL = 0.8;
          q.kR = 0.6;
        }
        if (id === 'yamcha') {
          q.aR[2] = 0.65;
          q.aL[2] = -0.65;
        }
      }
      if (f.state === 'landing') {
        const k = 1 - Math.min(1, f.stateTimer / 0.12);
        q.kR += (id === 'krillin' ? 0.2 : id === 'roshi' ? 0.12 : 0.08) * k;
      }
      if (matchModule.game.over && f.hp > 0) {
        const won = matchModule.game.lastWinner === (f === matchModule.player ? 'player' : 'enemy');
        q.h = won ? [id === 'roshi' ? -0.15 : -0.08, 0, 0] : [0.23, 0, 0];
        if (won) {
          q.aR =
            id === 'roshi'
              ? [-1.1, 0, 0.8]
              : id === 'tien'
                ? [-0.7, 0, -0.3]
                : id === 'krillin'
                  ? [-2.1, 0, 0.3]
                  : [-0.7, 0, 0.8];
          q.aL = id === 'tien' ? [-0.7, 0, 0.3] : [-0.5, 0, -0.3];
        }
      }
      return q;
    };
    queueMicrotask(() => {
      if (window.__db)
        Object.assign(window.__db, {
          neutralCombatPose: combatModule.neutralCombatPose,
        });
    });
  };
}
