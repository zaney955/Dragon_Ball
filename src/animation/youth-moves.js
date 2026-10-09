export function register({ animation, combat, match }) {
  const stances = {
    spring: {
      t: [0.06, 0, 0],
      aR: [-0.55, 0, 0.32],
      aL: [-0.65, 0, -0.32],
      lL: [0.15, 0, 0.08],
      lR: [-0.12, 0, -0.08],
    },
    relaxed: {
      t: [0.1, 0, 0],
      aR: [-0.25, 0, 0.12],
      aL: [-0.38, 0, -0.12],
      lL: [0.15, 0, 0.04],
      lR: [-0.05, 0, -0.04],
    },
    straight: {
      t: [0, 0, 0],
      aR: [-0.45, 0, 0.12],
      aL: [-0.55, 0, -0.12],
      lL: [0.06, 0, 0.03],
      lR: [-0.12, 0, -0.03],
    },
    tyrant: {
      t: [0.08, 0, 0],
      aR: [-0.32, 0, 0.5],
      aL: [-0.32, 0, -0.5],
      lL: [0.1, 0, 0.16],
      lR: [-0.12, 0, -0.16],
    },
    crane: {
      t: [0.02, 0, 0],
      aR: [-0.75, 0, 0.32],
      aL: [-0.6, 0, -0.35],
      lL: [0.16, 0, 0.08],
      lR: [-0.16, 0, -0.08],
    },
    low: {
      t: [0.23, 0, 0],
      y: -0.1,
      aR: [-0.65, 0, 0.28],
      aL: [-0.6, 0, -0.28],
      lL: [0.28, 0, 0.08],
      lR: [0.12, 0, -0.08],
    },
    wolf: {
      t: [0.22, 0, 0],
      aR: [-0.95, 0, 0.6],
      aL: [-0.85, 0, -0.6],
      lL: [0.2, 0, 0.12],
      lR: [-0.25, 0, -0.12],
    },
    axe: {
      t: [0.1, 0, 0],
      aR: [-0.8, 0, -0.15],
      aL: [-1, 0, 0.25],
      lL: [0.15, 0, 0.2],
      lR: [-0.1, 0, -0.2],
    },
    kicker: {
      t: [0.05, 0, 0],
      aR: [-0.8, 0, 0.3],
      aL: [-0.8, 0, -0.3],
      lL: [0.2, 0, 0.05],
      lR: [-0.15, 0, -0.05],
    },
    defensive: {
      t: [-0.08, 0, 0],
      aR: [-0.4, 0, 0.2],
      aL: [-0.4, 0, -0.2],
      lL: [-0.12, 0, 0.04],
      lR: [0.2, 0, -0.04],
    },
    float: {
      t: [0, 0, 0],
      aR: [-0.32, 0, 0.35],
      aL: [-0.32, 0, -0.35],
      lL: [0.2, 0, 0.04],
      lR: [0.2, 0, -0.04],
    },
    wobble: {
      t: [0.15, 0, 0.05],
      aR: [-0.2, 0, 0.5],
      aL: [-0.3, 0, -0.4],
      lL: [0.08, 0, 0.12],
      lR: [-0.12, 0, -0.12],
    },
    cat: {
      t: [0.18, 0, 0],
      aR: [-0.5, 0, 0.2],
      aL: [-0.45, 0, -0.18],
      lL: [0.2, 0, 0.06],
      lR: [-0.15, 0, -0.06],
    },
    mech: {
      t: [0.02, 0, 0],
      aR: [-0.45, 0, 0.15],
      aL: [-0.45, 0, -0.15],
      lL: [0.06, 0, 0.12],
      lR: [-0.06, 0, -0.12],
    },
  };
  animation.youthEffector = (motion, index, id) =>
    /staff/i.test(motion)
      ? 'staff'
      : /^axe/.test(motion)
        ? 'axe'
        : motion === 'caneTap'
          ? 'cane'
          : /kick|sweep/i.test(motion)
            ? 'footR'
            : motion === 'knee'
              ? 'kneeR'
              : motion === 'headbutt'
                ? 'head'
                : /Belly|Ram/.test(motion)
                  ? 'torso'
                  : /doublePalm|psychic|volley/.test(motion)
                    ? 'both'
                    : motion === 'cross' ||
                        motion === 'backClaw' ||
                        (id === 'pilaf' && index === 0) ||
                        (id === 'yamcha' && index === 0)
                      ? 'handL'
                      : 'handR';
  animation.youthStance = (c) => ({
    ...animation.cloneCombatPose(animation.pz(stances[c.youth.stance])),
    eR: -1.05,
    eL: -1.1,
    kR: c.id === 'krillin' ? 0.45 : 0.17,
    kL: c.id === 'krillin' ? 0.5 : 0.15,
  });
  animation.authorYouthMove = function (c, a, index = 0) {
    const neutral = animation.youthStance(c),
      prep = animation.cloneCombatPose(neutral),
      contact = animation.cloneCombatPose(neutral),
      follow = animation.cloneCombatPose(neutral);
    const heavy = a.chainType === 'heavy',
      side = (a.effector ?? animation.youthEffector(a.motion, index, c.id)) === 'handL' ? 'L' : 'R',
      sign = side === 'R' ? 1 : -1;
    const twist = {
      goku: 0.34,
      roshi: 0.18,
      taopaipai: 0.1,
      piccolo: 0.4,
      tien: 0.2,
      krillin: 0.25,
      yamcha: 0.45,
      gyumao: 0.55,
      chichi: 0.32,
      bulma: 0.28,
      chiaotzu: 0.05,
      oolong: 0.42,
      korin: 0.15,
      pilaf: 0.12,
    }[c.id];
    prep.t[1] = -sign * twist;
    prep.y -= heavy ? 0.1 : 0.04;
    prep['a' + side] = [-0.3, 0, sign * 0.65];
    prep['e' + side] = -1.4;
    contact.t = [neutral.t[0] + (heavy ? 0.12 : 0.04), sign * twist * 0.7, 0];
    contact['a' + side] = [-1.45, 0, -sign * 0.6];
    contact['e' + side] = -0.04;
    contact.lL[0] += 0.14;
    contact.kL = 0.24;
    if (
      a.effector === 'both' ||
      /psychic|volley|doublePalm|kame|kikoho|mafuba|bakuriki/i.test(a.motion)
    ) {
      prep.aL = [-0.7, 0, -0.6];
      prep.aR = [-0.7, 0, 0.6];
      contact.aR = [-1.45, 0, -0.6];
      contact.aL = [-1.45, 0, 0.6];
      contact.eL = contact.eR = -0.05;
      contact.t[1] = 0;
    }
    if (/kick|sweep/i.test(a.motion) || a.effector === 'footR') {
      prep.lR = [0.35, 0, 0.12];
      prep.kR = 0.9;
      contact.lR = [a.level === 'low' ? -1.1 : -1.55, 0, -0.12];
      contact.kR = 0.02;
      contact.t[0] = a.level === 'low' ? 0.35 : -0.15;
      contact.y = a.level === 'low' ? -0.15 : neutral.y;
      contact.aL = [-0.7, 0, -0.75];
    }
    if (a.motion === 'spinKick') {
      prep.t[1] = -1;
      contact.t[1] = 0.25;
      contact.ry = 0.1;
    }
    if (a.motion === 'knee') {
      contact.lR = [-1.55, 0, 0];
      contact.kR = 1.6;
    }
    if (/uppercut|psychicLift/.test(a.motion) || a.launch) {
      prep.y = -0.14;
      contact['a' + side] = [-1.85, 0, -sign * 0.5];
      contact.ry = 0.08;
      contact.t[0] = -0.12;
    }
    if (a.motion === 'volleySpike') {
      prep.aR = [-2.7, 0, 0.25];
      prep.aL = [-2.7, 0, -0.25];
      contact.aR = [-0.7, 0, -0.45];
      contact.aL = [-0.7, 0, 0.45];
      contact.t[0] = 0.45;
      contact.ry = 0.2;
    }
    if (/^staff/.test(a.motion)) {
      prep.w = contact.w = 1;
      prep.aR = [-1.6, 0, 0.45];
      contact.aR = [-1.45, 0, -0.6];
      contact.eR = -0.05;
      contact.aL = [-0.6, 0, -0.4];
      if (a.motion === 'staffSmash') {
        prep.aR = [-2.8, 0, -0.45];
        contact.aR = [-0.75, 0, -0.6];
        contact.t[0] = 0.45;
        contact.ry = 0.12;
      }
      if (a.motion === 'staffSweep') {
        prep.t[1] = -0.6;
        contact.t[1] = 0.4;
        contact.y = -0.12;
      }
    }
    if (/^axe/.test(a.motion)) {
      prep.aR = [-2.5, 0, 0.3];
      prep.aL = [-1.7, 0, -0.2];
      contact.aR = [a.motion === 'axeChop' ? -1.2 : -1.4, 0, -0.5];
      contact.aL = [-1.3, 0, 0.4];
      contact.eR = contact.eL = -0.03;
      contact.t[0] = 0.3;
    }
    if (a.motion === 'caneTap') {
      prep.aR = [-2.15, 0, 0.25];
      contact.aR = [-1.4, 0, -0.55];
      contact.t[0] = 0.22;
      contact.eR = -0.02;
    }
    if (/Belly|Ram|headbutt/.test(a.motion)) {
      prep.t[0] = -0.12;
      contact.t[0] = a.motion === 'headbutt' ? 0.65 : 0.42;
      contact.aR = [-0.8, 0, 0.3];
      contact.aL = [-0.8, 0, -0.3];
    }
    if (a.motion === 'bagSwing') {
      prep.aR = [-0.3, 0, 1.15];
      contact.aR = [-1.25, 0, -0.9];
      contact.t[1] = 0.45;
    }
    if (a.motion === 'solarFlare') {
      prep.aR = [-1.8, 0, -0.4];
      prep.aL = [-1.8, 0, 0.4];
      contact.aR = [-2, 0, -0.35];
      contact.aL = [-2, 0, 0.35];
      contact.eR = contact.eL = -1.2;
    }
    if (a.motion === 'transform') {
      prep.aR = [-1.4, 0, 0.8];
      prep.aL = [-1.4, 0, -0.8];
      contact.aR = [-2.1, 0, 0.8];
      contact.aL = [-2.1, 0, -0.8];
      contact.t[0] = -0.12;
    }
    if (a.motion === 'spawnEgg') {
      prep.h[0] = 0.2;
      contact.h[0] = 0.5;
      contact.t[0] = 0.35;
      contact.aR = [-0.3, 0, 0.5];
      contact.aL = [-0.3, 0, -0.5];
    }
    if (a.motion === 'beanEat') {
      prep.aR = [-1.8, 0, -0.45];
      contact.aR = [-2, 0, -0.45];
      contact.eR = -1.2;
    }
    Object.assign(follow, animation.cloneCombatPose(contact));
    follow.t[1] += sign * twist * 0.2;
    follow.eR += 0.08;
    if (a.motion === 'axeChop') follow.aR[0] = -0.6;
    follow.y -= 0.02;
    return [
      [0, neutral],
      [0.22, prep],
      [0.48, contact],
      [0.58, follow],
      [0.83, animation.mixCombatPose(follow, neutral, 0.65)],
      [1, neutral],
    ];
  };
  return function initialize() {
    const neutralBase = combat.neutralCombatPose,
      poseBase = combat.combatPose;
    combat.neutralCombatPose = function (f, recovering = false) {
      if (!f.def.youth) return neutralBase(f, recovering);
      const q = neutralBase(f, recovering);
      if (['idle', 'walk', 'crouch'].includes(f.state) && !f.crouching) {
        const s = animation.youthStance(f.def);
        q.aR = s.aR;
        q.aL = s.aL;
        q.t = s.t;
        q.y += s.y;
        q.eR = s.eR;
        q.eL = s.eL;
        if (f.state === 'idle') {
          q.lL = s.lL;
          q.lR = s.lR;
        }
        if (f.def.id === 'goku') q.y += Math.abs(Math.sin(match.game.simTime * 5)) * 0.025;
        if (f.def.id === 'oolong') q.t[2] += Math.sin(match.game.simTime * 3) * 0.04;
      }
      return q;
    };
    combat.combatPose = function (f) {
      if (!f.attack?.authored) return poseBase(f);
      const a = f.attack,
        t = f.stateTimer;
      let phase =
        t < a.hitT
          ? (t / Math.max(0.001, a.hitT)) * 0.48
          : t < a.hitT + a.active
            ? 0.48 + ((t - a.hitT) / a.active) * 0.1
            : 0.58 + Math.min(1, (t - a.hitT - a.active) / a.recovery) * 0.42;
      if (a.hits && t >= a.hitT && t < a.hitT + a.active) {
        const local = t - a.hitT;
        const last = a.hits.filter((h) => h <= local).at(-1) ?? 0;
        phase = 0.48 + Math.sin(Math.min(1, (local - last) / 0.12) * Math.PI) * 0.1;
      }
      const q = animation.cloneCombatPose(animation.samplePose(a.anim, phase));
      // Fit only the committed target height, retaining the authored twist and joints.
      const reach = Math.exp(-(((t - a.hitT) / Math.max(0.08, a.active)) ** 2));
      if (a.chainType === 'light' && ['korin', 'oolong'].includes(f.def.id)) q.t[0] += 0.12 * reach;
      if (
        ['handL', 'handR', 'both', 'axe', 'cane', 'staff'].includes(a.effector) &&
        a.targetY != null
      ) {
        const shoulder = f.anatomy ? f.anatomy.hip + f.anatomy.armY : 1.71 * f.baseScale;
        const tilt = Math.max(
          -0.35,
          Math.min(1.35, Math.atan2(shoulder + f.pos.y - a.targetY, 0.7)),
        );
        const fit = a.effector === 'axe' && a.motion !== 'axeJab' ? 0 : tilt;
        q.aR[0] += fit * reach;
        q.aL[0] += fit * reach;
        const crouch =
          Math.max(0, Math.min(0.65, (shoulder + f.pos.y - a.targetY - 0.65) * 0.42)) * reach;
        q.y -= crouch;
        q.kR += crouch * 0.8;
        q.kL += crouch * 0.8;
        if (a.effector === 'axe') q.aR[2] -= 0.35 * reach;
        if (a.launch && ['handR', 'handL', 'both'].includes(a.effector)) {
          const pitch = -Math.atan2(0.7, shoulder + f.pos.y - crouch - a.targetY) - q.t[0];
          q.aR[0] += (pitch - q.aR[0]) * reach;
          if (a.effector === 'both' || a.effector === 'handL') q.aL[0] += (pitch - q.aL[0]) * reach;
        }
      }
      if (f.youth?.form === 'fourArms') {
        q.t[1] += Math.sin(t * 35) * 0.08;
      }
      let out = q;
      if (f.poseEntry && t < 0.045)
        out = animation.mixCombatPose(f.poseEntry, q, animation.smoothstep(t / 0.045));
      if (t > a.dur - 0.06)
        out = animation.mixCombatPose(
          out,
          combat.neutralCombatPose(f, true),
          animation.smoothstep(Math.max(0, (t - a.dur + 0.06) / 0.06)),
        );
      return out;
    };
  };
}
